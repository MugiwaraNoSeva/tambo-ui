// ─────────────────────────────────────────────────────────────────────────────
// El único lugar de la UI que sabe que la API existe.
//
// Una función por fila de §9, con el nombre de la operación y no de la ruta. La
// URL se arma acá adentro: ninguna pantalla concatena strings de rutas, porque
// el día que el prefijo cambie tiene que cambiar en un solo archivo.
//
// **Acá no hay reglas de dominio**, ni siquiera las obvias. El cliente manda lo
// que le dan y devuelve lo que le contestan; si la API dice que no, ese "no"
// viaja entero —código, mensaje y `forzable`— hasta la pantalla, que lo muestra
// tal cual. Reescribir un mensaje de §5.6 acá sería duplicar el dominio en el
// peor lugar posible: el que nadie mira cuando la regla cambia.
//
// Por ser el único lugar que sabe de HTTP, es también el único que pone el
// `Authorization` y el único que atiende el 401. Ninguna pantalla arma un header
// ni pregunta si la sesión sigue viva: el token lo lee de `sesion.ts` al salir y
// el 401 lo devuelve ahí al entrar.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CuerpoAlta,
  CuerpoError,
  CuerpoEvento,
  CuerpoLogin,
  CuerpoPassword,
  CuerpoTanque,
  RespuestaAlertas,
  RespuestaAlta,
  RespuestaAnimal,
  RespuestaAnimales,
  RespuestaEstablecimiento,
  RespuestaEstablecimientos,
  RespuestaEvento,
  RespuestaEventos,
  RespuestaKPIs,
  RespuestaLactancias,
  RespuestaLogin,
  RespuestaRodeo,
  RespuestaTanque,
  RespuestaTanquePost,
  RespuestaYo,
} from './tipos';
import { anotarFechaDeLaRespuesta } from '../reloj';
import { caerLaSesion, tokenGuardado } from '../sesion';

/**
 * Un rechazo de la API, ya con su cuerpo de §9.1 parseado.
 *
 * Es una excepción y no un `Result` a propósito: el 95% de las llamadas de la
 * UI son lecturas que solo pueden fallar por red o por 404, y obligarlas a
 * destructurar un resultado en cada pantalla sería ruido. Los dos lugares donde
 * el rechazo **es** el flujo —la carga de eventos y la anulación— lo atrapan
 * con `catch` y leen `error.cuerpo`.
 */
export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly cuerpo: CuerpoError,
  ) {
    super(cuerpo.mensaje);
    this.name = 'ErrorApi';
  }

  /** ¿Este rechazo admite "Confirmar igual"? Lo dice el servidor (§5.6). */
  get forzable(): boolean {
    return this.cuerpo.forzable === true;
  }
}

/** La red se cayó, la API no está levantada, el celular perdió señal. */
export class ErrorDeRed extends Error {
  constructor(causa: unknown) {
    super(
      'No se pudo hablar con el servidor. Fijate que tengas señal y volvé a intentar; ' +
        'lo que cargaste hasta ahora no se perdió.',
    );
    this.name = 'ErrorDeRed';
    this.cause = causa;
  }
}

/**
 * La URL de la API. Llega por `VITE_API_URL` porque en desarrollo la demo elige
 * su propio puerto y en producción la API vive en otro host.
 */
export function urlBase(): string {
  const url = import.meta.env['VITE_API_URL'];
  if (typeof url === 'string' && url.length > 0) return url.replace(/\/$/, '');
  // Sin variable, mismo origen: es lo que vale cuando la API sirve la UI.
  return '';
}

/**
 * Los dos casos en que un pedido no se comporta como todos los demás. Son dos y
 * están acá arriba para que se lean juntos: los dos hablan de `/auth`.
 */
interface Opciones {
  /** Solo el login: es el pedido que va a *buscar* el token, así que no lo lleva. */
  sinToken?: boolean;
  /**
   * El pedido lleva una contraseña adentro, y entonces su 401 habla de **esa**
   * contraseña y no de la sesión: el login que se erró, o la contraseña actual
   * mal escrita en `POST /auth/password`, que la API rechaza con 401 y el mismo
   * `NO_AUTENTICADO` que un token vencido. Sin esta marca, un dedo torpe en el
   * formulario de cambio de contraseña echaría al tambero de una sesión que
   * está perfectamente viva.
   */
  validaUnaPassword?: boolean;
}

async function pedir<T>(
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
  opciones: Opciones = {},
): Promise<T> {
  // El header de auth va **siempre que haya token**, con cuerpo o sin cuerpo:
  // el `content-type` sí depende del cuerpo, y confundir las dos condiciones
  // dejaría todos los GET sin credencial.
  const cabeceras: Record<string, string> = {};
  if (cuerpo !== undefined) cabeceras['content-type'] = 'application/json';
  const token = opciones.sinToken === true ? null : tokenGuardado();
  if (token !== null) cabeceras['authorization'] = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${urlBase()}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    });
  } catch (causa) {
    throw new ErrorDeRed(causa);
  }

  if (!respuesta.ok) {
    // Un 500 o un proxy caído pueden contestar HTML: si el cuerpo no es el de
    // §9.1, se arma uno con la misma forma para que quien lo muestre no tenga
    // que distinguir dos casos.
    const cuerpoError = (await respuesta.json().catch(
      (): CuerpoError => ({
        codigo: 'RESPUESTA_ILEGIBLE',
        mensaje: `El servidor contestó ${respuesta.status} y algo que no se entiende.`,
      }),
    )) as CuerpoError;

    // El 401 se atiende **acá y en ningún otro lado**: no hay token, venció, la
    // firma no cierra o al usuario lo desactivaron. Se borra el token y se
    // avisa, que es lo que devuelve al login desde cualquier pantalla —incluida
    // la que estaba a mitad de una carga cuando se cumplieron las 8 horas—.
    //
    // El 403 **no** pasa por acá a propósito: la sesión está bien y lo que falta
    // es permiso sobre ese tambo. Mandarlo al login por un 403 sería condenar al
    // tambero a escribir la contraseña para siempre sin que eso arregle nada.
    if (respuesta.status === 401 && opciones.validaUnaPassword !== true) {
      caerLaSesion({ mensaje: cuerpoError.mensaje, seEstabaCargando: metodo === 'POST' });
    }

    throw new ErrorApi(respuesta.status, cuerpoError);
  }

  // Un 204 no trae cuerpo y `json()` sobre vacío tira: es el caso de
  // `POST /auth/password`, la única operación de §9 que contesta sin nada.
  if (respuesta.status === 204) return undefined as T;

  const cuerpoRespuesta = (await respuesta.json()) as T;
  // De paso, el reloj: casi toda respuesta de §9 trae el `hoy` del servidor, y
  // los formularios lo necesitan para su fecha por default (decisión 62). Se
  // anota acá —el único lugar por donde pasan todas— para que ninguna pantalla
  // tenga que pedir un endpoint solo para enterarse del día.
  anotarFechaDeLaRespuesta(cuerpoRespuesta);
  return cuerpoRespuesta;
}

const get = <T>(ruta: string) => pedir<T>('GET', ruta);
const post = <T>(ruta: string, cuerpo: unknown) => pedir<T>('POST', ruta, cuerpo);

const E = (est: string) => `/establecimientos/${encodeURIComponent(est)}`;
const A = (est: string, animal: string) => `${E(est)}/animales/${encodeURIComponent(animal)}`;

// ── Las operaciones, en el orden de la tabla de §9 ───────────────────────────

export const api = {
  /**
   * Entrar. Es el único pedido que no manda el header —va a buscar el token que
   * todos los demás llevan— y el único cuyo 401 no cierra la sesión: el "Email o
   * contraseña incorrectos" es la respuesta esperable de esta pantalla.
   */
  login: (cuerpo: CuerpoLogin) =>
    pedir<RespuestaLogin>('POST', '/auth/login', cuerpo, {
      sinToken: true,
      validaUnaPassword: true,
    }),

  /** Quién soy y qué puedo, ahora. Lo primero que la app pregunta al arrancar. */
  yo: () => get<RespuestaYo>('/auth/yo'),

  /** Cambiar la contraseña propia. Contesta 204 y no cierra la sesión. */
  cambiarPassword: (cuerpo: CuerpoPassword) =>
    pedir<void>('POST', '/auth/password', cuerpo, { validaUnaPassword: true }),

  /** Mis tambos: donde tengo permiso, o todos si soy admin. De acá sale el selector. */
  establecimientos: () => get<RespuestaEstablecimientos>('/establecimientos'),

  establecimiento: (est: string) => get<RespuestaEstablecimiento>(E(est)),

  /** El listado del rodeo. Sin `todas`, solo las ACTIVAS. */
  animales: (est: string, todas = false) =>
    get<RespuestaAnimales>(`${E(est)}/animales${todas ? '?todas=true' : ''}`),

  animal: (est: string, animal: string) => get<RespuestaAnimal>(A(est, animal)),

  alta: (est: string, cuerpo: CuerpoAlta) => post<RespuestaAlta>(`${E(est)}/animales`, cuerpo),

  cargarEvento: (est: string, animal: string, cuerpo: CuerpoEvento) =>
    post<RespuestaEvento>(`${A(est, animal)}/eventos`, cuerpo),

  eventos: (est: string, animal: string) => get<RespuestaEventos>(`${A(est, animal)}/eventos`),

  kpis: (est: string, animal: string) => get<RespuestaKPIs>(`${A(est, animal)}/kpis`),

  lactancias: (est: string, animal: string) =>
    get<RespuestaLactancias>(`${A(est, animal)}/lactancias`),

  rodeo: (est: string) => get<RespuestaRodeo>(`${E(est)}/rodeo`),

  alertas: (est: string) => get<RespuestaAlertas>(`${E(est)}/alertas`),

  cargarTanque: (est: string, cuerpo: CuerpoTanque) =>
    post<RespuestaTanquePost>(`${E(est)}/tanque`, cuerpo),

  tanque: (est: string, periodo?: { desde?: string; hasta?: string }) => {
    const q = new URLSearchParams();
    if (periodo?.desde !== undefined) q.set('desde', periodo.desde);
    if (periodo?.hasta !== undefined) q.set('hasta', periodo.hasta);
    const cola = q.toString();
    return get<RespuestaTanque>(`${E(est)}/tanque${cola === '' ? '' : `?${cola}`}`);
  },
};
