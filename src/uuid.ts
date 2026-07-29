// ─────────────────────────────────────────────────────────────────────────────
// Un uuid para el evento, generado acá y no por `crypto.randomUUID`.
//
// El id del cliente es lo que hace que un reintento no duplique una carga
// (decisión 41 del lado de la API, 63 del lado de la UI): en el corral la señal
// se corta, un `POST` cuya respuesta se pierde deja al tambero sin saber si el
// parto entró, y volver a apretar "Cargar" sin id lo carga dos veces.
//
// ── Por qué no `crypto.randomUUID` ──────────────────────────────────────────
//
// Porque **no existe fuera de un contexto seguro**, y el celular del tambo entra
// por `http://192.168.x.x` en la red del establecimiento, que no lo es. La
// decisión 63 lo dejó anotado como deuda con nombre: la protección se degradaba
// en silencio justamente en el único escenario para el que se había escrito.
//
// `crypto.getRandomValues`, en cambio, **sí** está disponible sobre HTTP: la
// restricción de contexto seguro alcanza a `randomUUID` y a `crypto.subtle`, no
// a él. Con dieciséis bytes de ahí, armar el uuid son cuatro líneas.
//
// ── Por qué versión 4 y no 7 ────────────────────────────────────────────────
//
// El servidor genera **v7** (decisión 41), que lleva un timestamp adentro y por
// eso ordena. Acá se genera **v4**, aleatorio puro, y la diferencia es
// deliberada: un v7 armado en el celular metería el reloj del dispositivo dentro
// de una clave primaria permanente, y ese es exactamente el reloj que el sistema
// decidió no creerle (decisión 52). Un id con una fecha adentro que puede estar
// mal es un dato que no puede sostener lo que dice.
//
// El costo es real y conviene nombrarlo: los ids que entran por la UI dejan de
// ser secuenciales, así que `eventos` pierde la localidad de índice que el v7 le
// daba a los inserts. Es un costo de rendimiento en una tabla que hoy tiene
// miles de filas, contra un dato engañoso que quedaría guardado para siempre.
// Se revisa si el volumen lo hace notar.
// ─────────────────────────────────────────────────────────────────────────────

const BYTES = 16;

/**
 * Un UUID v4, o `undefined` si el browser no sabe dar bytes aleatorios.
 *
 * El `undefined` no es un caso que se espere —`getRandomValues` está en todos
 * los browsers que corren esta app— pero se devuelve igual en vez de inventar
 * una alternativa con `Math.random`: un id con poca entropía puede **chocar con
 * el de otro evento** y hacer que la API rechace una carga buena por duplicada,
 * que es peor que no tener id. Sin id, el servidor genera el suyo y lo único que
 * se pierde es la protección contra el reintento.
 */
export function nuevoUuid(): string | undefined {
  const bytes = new Uint8Array(BYTES);
  try {
    globalThis.crypto.getRandomValues(bytes);
  } catch {
    return undefined;
  }

  const version = bytes[6];
  const variante = bytes[8];
  if (version === undefined || variante === undefined) return undefined;

  // Los cuatro bits de versión (4) y los dos de variante (RFC 4122). Sin esto
  // el string tiene forma de uuid pero no es un uuid de ninguna versión.
  bytes[6] = (version & 0x0f) | 0x40;
  bytes[8] = (variante & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return (
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-${hex.slice(20)}`
  );
}
