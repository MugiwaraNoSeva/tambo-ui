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
  CuerpoAltaUsuario,
  CuerpoError,
  CuerpoEstablecimiento,
  CuerpoEvento,
  CuerpoLogin,
  CuerpoPassword,
  CuerpoPatchEstablecimiento,
  CuerpoPatchUsuario,
  CuerpoTanque,
  RespuestaAlertas,
  RespuestaAlta,
  RespuestaAnimal,
  RespuestaAnimales,
  RespuestaConfigDefault,
  RespuestaConfiguraciones,
  RespuestaEstablecimiento,
  RespuestaEstablecimientoCreado,
  RespuestaEstablecimientos,
  RespuestaEvento,
  RespuestaEventos,
  RespuestaKPIs,
  RespuestaLactancias,
  RespuestaLogin,
  RespuestaPartosDelRodeo,
  RespuestaPrenez,
  RespuestaRazas,
  RespuestaReparto,
  RespuestaRodeo,
  RespuestaSalidas,
  RespuestaServicios,
  RespuestaTanque,
  RespuestaTanquePost,
  RespuestaToros,
  RespuestaUsuarios,
  RespuestaYo,
  Rol,
  UsuarioAdmin,
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
const U = (usuario: string) => `/usuarios/${encodeURIComponent(usuario)}`;
const P = (usuario: string, est: string) => `${U(usuario)}/permisos/${encodeURIComponent(est)}`;

/**
 * La cola de una URL, salteando lo que no vino.
 *
 * Existe porque desde las decisiones 97 a 107 casi todas las lecturas del rodeo
 * aceptan ventana, y armar el `?desde=…&hasta=…` a mano en cada una es cómo se
 * cuela un `?desde=undefined` — un 400 de la API por un string de más, que es
 * exactamente el borde que la decisión 49 encontró en el tanque.
 */
function cola(parametros: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [nombre, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== '') q.set(nombre, String(valor));
  }
  const escrita = q.toString();
  return escrita === '' ? '' : `?${escrita}`;
}

/** El período que aceptan `/servicios`, `/salidas`, `/partos` y el tanque. */
export interface Periodo {
  desde?: string;
  hasta?: string;
}

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

  // ── Las del admin ──────────────────────────────────────────────────────────
  //
  // Ninguna lleva `validaUnaPassword`, y en dos de ellas viaja una contraseña.
  // No es un olvido: esa marca es para el pedido cuyo 401 habla de una
  // contraseña **que se acaba de escribir en el formulario** —el login y el
  // cambio propio—. Acá la contraseña que viaja es la que el admin le pone a
  // otro, así que un 401 en `POST /usuarios` es su propia sesión que se cayó y
  // tiene que mandarlo al login como cualquier otro pedido. Siguen siendo dos.

  /** Crear una persona. La contraseña inicial se le dice de boca: no hay correo. */
  crearUsuario: (cuerpo: CuerpoAltaUsuario) => post<UsuarioAdmin>('/usuarios', cuerpo),

  /** Todas las personas del sistema, con sus permisos y **con los desactivados**. */
  usuarios: () => get<RespuestaUsuarios>('/usuarios'),

  /** Nombre, activo, admin y resetear la contraseña. Mandar solo lo que cambió. */
  editarUsuario: (id: string, cuerpo: CuerpoPatchUsuario) =>
    pedir<UsuarioAdmin>('PATCH', U(id), cuerpo),

  /** Dar acceso a un tambo, **o cambiarlo**: es el mismo pedido y es idempotente. */
  otorgarPermiso: (id: string, est: string, rol: Rol) =>
    pedir<UsuarioAdmin>('PUT', P(id, est), { rol }),

  /**
   * Sacar el acceso. Contesta **204 sin cuerpo**, también cuando no había nada
   * que revocar: quien llama pidió que esta persona no entre a este tambo, y
   * después de esto no entra. `pedir()` ya devuelve `undefined` en el 204 —el
   * único otro de la app es `POST /auth/password`—, y por eso esta operación no
   * pasa por los helpers `get`/`post`, que no cubren `DELETE`.
   */
  revocarPermiso: (id: string, est: string) => pedir<void>('DELETE', P(id, est)),

  /** Crear el tambo. Sin `config`: la pone la API con la del núcleo. */
  crearEstablecimiento: (cuerpo: CuerpoEstablecimiento) =>
    post<RespuestaEstablecimientoCreado>('/establecimientos', cuerpo),

  /**
   * Editar el tambo: el nombre, y archivarlo o desarchivarlo.
   *
   * **No hay `borrarEstablecimiento` porque no hay `DELETE`**: de un tambo
   * cuelgan sus animales, su log y sus permisos, y el log no admite borrados.
   * Archivar es la baja que este sistema tiene (decisión 91), igual que
   * desactivar es la de las personas.
   */
  editarEstablecimiento: (est: string, cuerpo: CuerpoPatchEstablecimiento) =>
    pedir<RespuestaEstablecimiento>('PATCH', E(est), cuerpo),

  /**
   * El historial de reglas del tambo: bajo cuáles se decidió cada cosa.
   *
   * Es de **lectura** y no de admin, así que esta operación no está en el bloque
   * de arriba: la pregunta es del que mira el rodeo y no encuentra una vaca donde
   * la esperaba.
   */
  configuraciones: (est: string) => get<RespuestaConfiguraciones>(`${E(est)}/configuraciones`),

  /**
   * Los valores de fábrica del núcleo.
   *
   * Vienen de la API y no de una constante de este lado porque la decisión 51
   * prohíbe importar **valores** del núcleo: copiarlos acá sería duplicar el
   * dominio en el peor lugar posible, el que nadie mira cuando la regla cambia.
   */
  configDefault: () => get<RespuestaConfigDefault>('/config-default'),

  /**
   * El catálogo de razas (decisión 109).
   *
   * **No cuelga de ningún establecimiento** y por eso está acá arriba, entre las
   * globales: una raza no es de nadie, y que "Jersey" sea la misma Jersey en
   * todos los tambos es el punto de que exista la tabla. Es de lectura para
   * cualquiera autenticado, como `/config-default`: quien da de alta un animal
   * necesita la lista.
   */
  razas: () => get<RespuestaRazas>('/razas'),

  // ── Y de acá en adelante, las del tambo ────────────────────────────────────

  /**
   * Mis tambos: donde tengo permiso, o todos si soy admin. De acá sale el
   * selector. **Sin los archivados**, salvo que se los pida el panel.
   */
  establecimientos: (archivados = false) =>
    get<RespuestaEstablecimientos>(`/establecimientos${archivados ? '?archivados=true' : ''}`),

  establecimiento: (est: string) => get<RespuestaEstablecimiento>(E(est)),

  /** El listado del rodeo. Sin `todas`, solo las ACTIVAS. */
  animales: (est: string, todas = false) =>
    get<RespuestaAnimales>(`${E(est)}/animales${todas ? '?todas=true' : ''}`),

  /**
   * La ficha. Con `fecha` devuelve **cómo estaba ese día**, plegando el log
   * (decisión 97), y ahí la respuesta viene sin `version`: esa es el contador con
   * el que se escribe, o sea una propiedad de hoy, y no de la foto.
   */
  animal: (est: string, animal: string, fecha?: string) =>
    get<RespuestaAnimal>(`${A(est, animal)}${cola({ fecha })}`),

  alta: (est: string, cuerpo: CuerpoAlta) => post<RespuestaAlta>(`${E(est)}/animales`, cuerpo),

  cargarEvento: (est: string, animal: string, cuerpo: CuerpoEvento) =>
    post<RespuestaEvento>(`${A(est, animal)}/eventos`, cuerpo),

  eventos: (est: string, animal: string) => get<RespuestaEventos>(`${A(est, animal)}/eventos`),

  kpis: (est: string, animal: string) => get<RespuestaKPIs>(`${A(est, animal)}/kpis`),

  lactancias: (est: string, animal: string) =>
    get<RespuestaLactancias>(`${A(est, animal)}/lactancias`),

  /**
   * La foto del rodeo. Con `fecha`, la de ese día: el cache no acepta fechas
   * (decisión 45), así que esa lectura **pliega el log entero** en vez de hacer
   * cinco consultas. Es la lectura de una consulta, no la de una pantalla que se
   * refresca sola.
   */
  rodeo: (est: string, fecha?: string) =>
    get<RespuestaRodeo>(`${E(est)}/rodeo${cola({ fecha })}`),

  alertas: (est: string) => get<RespuestaAlertas>(`${E(est)}/alertas`),

  /** Qué corral come qué (decisión 100). Acepta `fecha` como `/rodeo`. */
  reparto: (est: string, fecha?: string) =>
    get<RespuestaReparto>(`${E(est)}/reparto${cola({ fecha })}`),

  // ── Los indicadores del rodeo ──────────────────────────────────────────────

  /**
   * La tasa de concepción del rodeo (decisión 98): cuántos servicios prendieron.
   * Es el complemento de `servicios_por_concepcion` de `/kpis` — aquel mira desde
   * el animal y este desde el servicio, que es el indicador del **programa**.
   */
  servicios: (est: string, periodo: Periodo = {}) =>
    get<RespuestaServicios>(`${E(est)}/servicios${cola({ ...periodo })}`),

  /**
   * Qué rinde cada toro (decisión 96). **No acepta período, y es deliberado**: la
   * fertilidad de un toro es una propiedad suya que no cambia con el año.
   */
  toros: (est: string) => get<RespuestaToros>(`${E(est)}/toros`),

  /**
   * La tasa de preñez a 21 días (decisión 104): el único indicador con la vaca que
   * **nadie sirvió** en el denominador. `ventanas` es cuántos ciclos estrales
   * hacia atrás — 17 son un año, y el techo de la API son 52.
   */
  prenez: (est: string, opciones: { hasta?: string; ventanas?: number } = {}) =>
    get<RespuestaPrenez>(`${E(est)}/prenez${cola({ ...opciones })}`),

  /** Por qué se van las vacas (decisión 106), que es otra pregunta que cómo salieron. */
  salidas: (est: string, periodo: Periodo = {}) =>
    get<RespuestaSalidas>(`${E(est)}/salidas${cola({ ...periodo })}`),

  /** Cuánto costaron los partos: la distocia y lo que deja después (decisión 107). */
  partosDelRodeo: (est: string, periodo: Periodo = {}) =>
    get<RespuestaPartosDelRodeo>(`${E(est)}/partos${cola({ ...periodo })}`),

  // ── El tanque ──────────────────────────────────────────────────────────────

  cargarTanque: (est: string, cuerpo: CuerpoTanque) =>
    post<RespuestaTanquePost>(`${E(est)}/tanque`, cuerpo),

  /**
   * Los registros del período. **Sin `lote` es el tambo entero** y suma solo los
   * registros sin lote, que es el total por definición (decisión 33); con `lote`
   * se filtran los dos lados —la leche de ese lote sobre las vacas en ordeñe de
   * ese lote—, que es lo que hace comparable el litro por vaca de un corral.
   */
  tanque: (est: string, periodo: Periodo & { lote?: string } = {}) =>
    get<RespuestaTanque>(`${E(est)}/tanque${cola({ ...periodo })}`),
};
