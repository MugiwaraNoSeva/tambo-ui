// ─────────────────────────────────────────────────────────────────────────────
// El ruteo, en treinta líneas y sin dependencias.
//
// Son cinco pantallas y ninguna anida. Un router de librería traería carga
// diferida, rutas anidadas, loaders y datos por ruta — todo eso resuelve
// problemas que esta app no tiene, y cada uno se paga en peso y en una API que
// hay que saber. Se usa el hash (`#/rodeo`) y no el History API porque el hash
// no necesita que el servidor reescriba nada: la app se puede servir desde
// cualquier lado, incluso desde un archivo (decisión 51).
//
// `useSyncExternalStore` es lo que hace que esto sea un router y no un truco:
// React se entera del `hashchange` por el mismo camino por el que se entera de
// cualquier estado de afuera, y el renderizado en el test no se desincroniza.
// ─────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from 'react';

/**
 * De qué lista sale una corrida. Viaja en la dirección —y no en un estado que
 * alguien tenga que pasar de pantalla en pantalla— porque es lo único que la
 * corrida necesita saber para armarse: con esto pide su lista y la congela.
 *
 * Lo que **no** viaja es el progreso. Recargar la página empieza una corrida
 * nueva, con la lista de ese momento y sin las marcas de lo ya cargado. Es lo
 * mismo que ya pasa con cualquier cosa que no se guardó, y que sobreviva a un
 * F5 es el problema de la cola offline, que es otra tanda.
 */
export type OrigenDeCorrida = 'para-revisar' | 'para-secar' | 'rodeo';

const ORIGENES: readonly OrigenDeCorrida[] = ['para-revisar', 'para-secar', 'rodeo'];

export type Ruta =
  | { nombre: 'tablero' }
  | { nombre: 'rodeo' }
  | { nombre: 'animal'; id: string }
  | { nombre: 'cargar'; id: string }
  | { nombre: 'corrida'; origen: OrigenDeCorrida }
  | { nombre: 'alta' }
  | { nombre: 'tanque' }
  | { nombre: 'cuenta' }
  // Las tres del panel. Son de **otro árbol**: las de arriba son rutas de un
  // tambo —se dibujan adentro del establecimiento activo, que les da el nombre,
  // la `Config` y el permiso— y estas no tienen tambo. La lista de tambos no
  // pertenece a ninguno, y la gente de uno se mira sin estar conectado a él.
  | { nombre: 'panel' }
  | { nombre: 'panel-tambo'; id: string }
  | { nombre: 'panel-tambo-gente'; id: string }
  | { nombre: 'panel-tambo-config'; id: string }
  | { nombre: 'panel-usuarios' };

/**
 * ¿Esta ruta es del panel? La pregunta `App` para saber de qué lado del árbol
 * dibujar, y existe como función para que agregar una cuarta ruta de admin no
 * obligue a acordarse de sumarla a un `||` en otro archivo.
 */
export const esRutaDeAdmin = (ruta: Ruta): boolean => ruta.nombre.startsWith('panel');

function suscribir(avisar: () => void): () => void {
  window.addEventListener('hashchange', avisar);
  return () => window.removeEventListener('hashchange', avisar);
}

const hashActual = (): string => window.location.hash;

// ── El camino y sus parámetros ───────────────────────────────────────────────
//
// El hash lleva dos cosas: **qué pantalla** (el camino) y **un par de datos que
// esa pantalla necesita para no tener que ir a buscarlos** (los parámetros). Los
// dos que hay son `de` —a dónde vuelve la flecha— y `c` —la caravana—, y los dos
// existen por el mismo motivo: viajan en la dirección para que sobrevivan a una
// recarga y a un enlace compartido, que es lo que ya hace todo lo demás del
// ruteo por hash. La alternativa era una pila de navegación que alguien tendría
// que mantener sincronizada con el "atrás" del browser, y esa se descartó.

/** Parte `#/animales/abc?de=%23%2Frodeo` en su camino y sus parámetros. */
function partir(hash: string): { partes: string[]; parametros: URLSearchParams } {
  const sinNumeral = hash.replace(/^#\/?/, '');
  const corte = sinNumeral.indexOf('?');
  const camino = corte === -1 ? sinNumeral : sinNumeral.slice(0, corte);
  return {
    partes: camino.split('/').filter((p) => p !== ''),
    parametros: new URLSearchParams(corte === -1 ? '' : sinNumeral.slice(corte + 1)),
  };
}

/** Un parámetro del hash, o `undefined` si no vino o vino vacío. */
export function parametro(hash: string, nombre: string): string | undefined {
  const valor = partir(hash).parametros.get(nombre);
  return valor === null || valor === '' ? undefined : valor;
}

/**
 * A dónde vuelve la flecha de esta pantalla.
 *
 * **Solo se acepta un hash de esta misma app.** Es un `href` y llega de la barra
 * de direcciones, así que sin este filtro un `?de=https://…` convertiría la
 * flecha de volver en un enlace a cualquier lado. Lo que no pase, cae en el
 * default de la pantalla, que es a dónde volvía antes de que esto existiera.
 */
export function vueltaDe(hash: string, pordefecto: string): string {
  const de = parametro(hash, 'de');
  return de !== undefined && de.startsWith('#/') ? de : pordefecto;
}

/** Le cuelga sus parámetros a una dirección, salteando los que no vinieron. */
function con(base: string, parametros: Record<string, string | null | undefined>): string {
  const cola = new URLSearchParams();
  for (const [nombre, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') cola.set(nombre, valor);
  }
  const escrita = cola.toString();
  return escrita === '' ? base : `${base}?${escrita}`;
}

/** De `#/animales/abc/cargar` a `{nombre: 'cargar', id: 'abc'}`. */
export function leerRuta(hash: string): Ruta {
  const { partes } = partir(hash);
  const [primera, segunda, tercera, cuarta] = partes;

  if (primera === 'rodeo') return { nombre: 'rodeo' };
  // Una corrida sin origen, o con uno que no se entiende, no existe: cae en el
  // inicio como cualquier hash inventado. Adivinarle un origen sería empezar a
  // cargar eventos sobre una lista que nadie pidió.
  if (primera === 'corrida' && segunda !== undefined) {
    const origen = ORIGENES.find((o) => o === segunda);
    if (origen !== undefined) return { nombre: 'corrida', origen };
  }
  if (primera === 'alta') return { nombre: 'alta' };
  if (primera === 'tanque') return { nombre: 'tanque' };
  if (primera === 'cuenta') return { nombre: 'cuenta' };
  if (primera === 'animales' && segunda !== undefined) {
    return tercera === 'cargar' ? { nombre: 'cargar', id: segunda } : { nombre: 'animal', id: segunda };
  }
  // El panel, con su propio "cae en el inicio": lo que empieza con `admin` y no
  // se entiende va a la lista de tambos y **no** al tablero. Salir del panel por
  // un `admin/tanbos` mal tipeado sería mandar a otra aplicación por una letra.
  if (primera === 'admin') {
    if (segunda === 'usuarios') return { nombre: 'panel-usuarios' };
    if (segunda === 'tambos' && tercera !== undefined) {
      if (cuarta === 'gente') return { nombre: 'panel-tambo-gente', id: tercera };
      if (cuarta === 'config') return { nombre: 'panel-tambo-config', id: tercera };
      return { nombre: 'panel-tambo', id: tercera };
    }
    return { nombre: 'panel' };
  }
  // Cualquier cosa que no se entienda cae en el tablero, que es el inicio: una
  // pantalla de "no encontrado" para un hash tipeado a mano no le sirve a nadie.
  //
  // Que `#/admin` de alguien que no es admin caiga acá **también es esto**, y no
  // hace falta que esta función lo sepa: quien decide es `App`, que es el único
  // que sabe quién está mirando. La cerradura de verdad es el 403 de la API.
  return { nombre: 'tablero' };
}

/** El hash de ahora, por el mismo camino por el que React ve cualquier estado de afuera. */
export function usarHash(): string {
  return useSyncExternalStore(suscribir, hashActual, () => '');
}

export function usarRuta(): Ruta {
  return leerRuta(usarHash());
}

/**
 * A dónde vuelve la flecha: lo que diga el `de` de la dirección, o el default
 * de la pantalla. Es lo que hace que la ficha abierta desde el tablero vuelva al
 * tablero y la abierta desde una corrida vuelva a la corrida, sin que ninguna
 * pantalla tenga que acordarse de dónde venía.
 */
export function usarVuelta(pordefecto: string): string {
  return vueltaDe(usarHash(), pordefecto);
}

/** La caravana que el llamador ya sabía, para no ir a pedirla de nuevo. */
export function usarCaravanaDelHash(): string | undefined {
  return parametro(usarHash(), 'c');
}

// Las direcciones se arman con estas funciones y no a mano, por el mismo motivo
// por el que las rutas de la API se arman en el cliente: un solo lugar.
export const aTablero = () => '#/';
export const aRodeo = () => '#/rodeo';
/** `desde` es a dónde tiene que volver la flecha de la ficha: el hash de quien la abrió. */
export const aAnimal = (id: string, desde?: string) => con(`#/animales/${id}`, { de: desde });

/**
 * La carga de un evento, con lo que quien la abre **ya sabe**: de dónde se vino
 * y qué caravana es. La caravana viaja para que la pantalla no tenga que pedir
 * el animal entero solo para escribirla en el encabezado — y si no viene, la
 * pantalla la va a buscar igual, así que un enlace pelado sigue andando.
 */
export const aCargar = (
  id: string,
  extra: { desde?: string; caravana?: string | null } = {},
) => con(`#/animales/${id}/cargar`, { de: extra.desde, c: extra.caravana });

/**
 * Una corrida, con los filtros que tenía puestos quien la empezó.
 *
 * Solo los usa el origen `rodeo` —las dos listas de trabajo ya vienen acotadas
 * por el servidor— y es lo que hace que el contador diga "quedan 30" y no
 * "quedan 197". Los arma `aParametros` de `filtros.ts`.
 */
export const aCorrida = (
  origen: OrigenDeCorrida,
  filtros: Record<string, string | undefined> = {},
) => con(`#/corrida/${origen}`, filtros);
export const aAlta = () => '#/alta';
export const aTanque = () => '#/tanque';
export const aCuenta = () => '#/cuenta';
export const aPanel = () => '#/admin';
export const aPanelTambo = (id: string) => `#/admin/tambos/${id}`;
export const aPanelTamboGente = (id: string) => `#/admin/tambos/${id}/gente`;
export const aPanelTamboConfig = (id: string) => `#/admin/tambos/${id}/config`;
export const aPanelUsuarios = () => '#/admin/usuarios';

/** Navegación imperativa, para después de guardar algo. */
export function ir(destino: string): void {
  window.location.hash = destino;
}
