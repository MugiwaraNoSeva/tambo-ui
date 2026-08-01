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

export type Ruta =
  | { nombre: 'tablero' }
  | { nombre: 'rodeo' }
  | { nombre: 'animal'; id: string }
  | { nombre: 'cargar'; id: string }
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

/** De `#/animales/abc/cargar` a `{nombre: 'cargar', id: 'abc'}`. */
export function leerRuta(hash: string): Ruta {
  const partes = hash.replace(/^#\/?/, '').split('/').filter((p) => p !== '');
  const [primera, segunda, tercera, cuarta] = partes;

  if (primera === 'rodeo') return { nombre: 'rodeo' };
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
      return cuarta === 'gente'
        ? { nombre: 'panel-tambo-gente', id: tercera }
        : { nombre: 'panel-tambo', id: tercera };
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

export function usarRuta(): Ruta {
  const hash = useSyncExternalStore(suscribir, hashActual, () => '');
  return leerRuta(hash);
}

// Las direcciones se arman con estas funciones y no a mano, por el mismo motivo
// por el que las rutas de la API se arman en el cliente: un solo lugar.
export const aTablero = () => '#/';
export const aRodeo = () => '#/rodeo';
export const aAnimal = (id: string) => `#/animales/${id}`;
export const aCargar = (id: string) => `#/animales/${id}/cargar`;
export const aAlta = () => '#/alta';
export const aTanque = () => '#/tanque';
export const aCuenta = () => '#/cuenta';
export const aPanel = () => '#/admin';
export const aPanelTambo = (id: string) => `#/admin/tambos/${id}`;
export const aPanelTamboGente = (id: string) => `#/admin/tambos/${id}/gente`;
export const aPanelUsuarios = () => '#/admin/usuarios';

/** Navegación imperativa, para después de guardar algo. */
export function ir(destino: string): void {
  window.location.hash = destino;
}
