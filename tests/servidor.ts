// ─────────────────────────────────────────────────────────────────────────────
// El servidor de mentira de la suite.
//
// Se mockea `fetch` y nada más abajo: el cliente arma la URL de verdad, serializa
// el cuerpo de verdad y parsea la respuesta de verdad, así que un error en la
// ruta o en la forma del cuerpo lo agarra el test. Lo que NO se prueba acá es el
// dominio — de eso hay 335 tests en `mu/`, `db/` y `api/`, y repetirlos contra
// un mock probaría que el mock hace lo que le pedimos, no que el sistema anda.
//
// Las respuestas se escriben con la forma exacta de §9. Si la API cambia y la
// fixture no, el test sigue en verde y miente: por eso las fixtures viven en un
// archivo aparte, para leerlas al lado del contrato.
// ─────────────────────────────────────────────────────────────────────────────

import { expect, vi } from 'vitest';

export interface RespuestaFalsa {
  status?: number;
  cuerpo?: unknown;
  /** El cuerpo no es JSON: un 502 del proxy, una página de error de nginx. */
  ilegible?: boolean;
}

export type Manejador = RespuestaFalsa | ((cuerpo: unknown) => RespuestaFalsa);

export interface ApiFalsa {
  /** Cada pedido que recibió, en orden: para afirmar qué mandó la pantalla. */
  pedidos: { metodo: string; ruta: string; cuerpo: unknown }[];
  /** El último cuerpo mandado a esa ruta, ya parseado. */
  cuerpoDe: (clave: string) => unknown;
}

/**
 * Monta un `fetch` que contesta según un mapa `"MÉTODO /ruta"` → respuesta.
 * Una ruta que no esté en el mapa es un fallo del test y no un 404 silencioso:
 * si la pantalla pide algo que nadie previó, hay que enterarse.
 */
export function montarApi(rutas: Record<string, Manejador>): ApiFalsa {
  const registro: ApiFalsa = {
    pedidos: [],
    cuerpoDe(clave) {
      const [metodo, ruta] = clave.split(' ');
      const encontrados = registro.pedidos.filter((p) => p.metodo === metodo && p.ruta === ruta);
      return encontrados[encontrados.length - 1]?.cuerpo;
    },
  };

  vi.stubGlobal('fetch', async (entrada: unknown, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://tambo.test');
    const ruta = `${url.pathname}${url.search}`;
    const metodo = init?.method ?? 'GET';
    const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    registro.pedidos.push({ metodo, ruta, cuerpo });

    const manejador = rutas[`${metodo} ${ruta}`];
    if (manejador === undefined) {
      throw new Error(
        `La pantalla pidió ${metodo} ${ruta}, que el test no previó. ` +
          `Previstas: ${Object.keys(rutas).join(', ')}`,
      );
    }

    const {
      status = 200,
      cuerpo: respuesta,
      ilegible = false,
    } = typeof manejador === 'function' ? manejador(cuerpo) : manejador;

    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (ilegible) throw new SyntaxError('Unexpected token < in JSON');
        return respuesta;
      },
    } as Response;
  });

  return registro;
}

/** `fetch` que se cae, para el caso del celular sin señal. */
export function montarApiCaida(): void {
  vi.stubGlobal('fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
}

/** Azúcar para leer las afirmaciones sobre lo que la pantalla mandó. */
export function esperarPedido(api: ApiFalsa, clave: string): void {
  const [metodo, ruta] = clave.split(' ');
  expect(api.pedidos.some((p) => p.metodo === metodo && p.ruta === ruta)).toBe(true);
}
