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
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CuerpoAlta,
  CuerpoError,
  CuerpoEvento,
  CuerpoTanque,
  RespuestaAlertas,
  RespuestaAlta,
  RespuestaAnimal,
  RespuestaAnimales,
  RespuestaEstablecimiento,
  RespuestaEvento,
  RespuestaEventos,
  RespuestaKPIs,
  RespuestaLactancias,
  RespuestaRodeo,
  RespuestaTanque,
  RespuestaTanquePost,
} from './tipos';

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

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${urlBase()}${ruta}`, {
      method: metodo,
      ...(cuerpo === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) }),
    });
  } catch (causa) {
    throw new ErrorDeRed(causa);
  }

  if (!respuesta.ok) {
    // Un 500 o un proxy caído pueden contestar HTML: si el cuerpo no es el de
    // §9.1, se arma uno con la misma forma para que quien lo muestre no tenga
    // que distinguir dos casos.
    const cuerpoError = await respuesta.json().catch(
      (): CuerpoError => ({
        codigo: 'RESPUESTA_ILEGIBLE',
        mensaje: `El servidor contestó ${respuesta.status} y algo que no se entiende.`,
      }),
    );
    throw new ErrorApi(respuesta.status, cuerpoError as CuerpoError);
  }

  return (await respuesta.json()) as T;
}

const get = <T>(ruta: string) => pedir<T>('GET', ruta);
const post = <T>(ruta: string, cuerpo: unknown) => pedir<T>('POST', ruta, cuerpo);

const E = (est: string) => `/establecimientos/${encodeURIComponent(est)}`;
const A = (est: string, animal: string) => `${E(est)}/animales/${encodeURIComponent(animal)}`;

// ── Las operaciones, en el orden de la tabla de §9 ───────────────────────────

export const api = {
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
