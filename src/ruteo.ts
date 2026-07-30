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
  | { nombre: 'cuenta' };

function suscribir(avisar: () => void): () => void {
  window.addEventListener('hashchange', avisar);
  return () => window.removeEventListener('hashchange', avisar);
}

const hashActual = (): string => window.location.hash;

/** De `#/animales/abc/cargar` a `{nombre: 'cargar', id: 'abc'}`. */
export function leerRuta(hash: string): Ruta {
  const partes = hash.replace(/^#\/?/, '').split('/').filter((p) => p !== '');
  const [primera, segunda, tercera] = partes;

  if (primera === 'rodeo') return { nombre: 'rodeo' };
  if (primera === 'alta') return { nombre: 'alta' };
  if (primera === 'tanque') return { nombre: 'tanque' };
  if (primera === 'cuenta') return { nombre: 'cuenta' };
  if (primera === 'animales' && segunda !== undefined) {
    return tercera === 'cargar' ? { nombre: 'cargar', id: segunda } : { nombre: 'animal', id: segunda };
  }
  // Cualquier cosa que no se entienda cae en el tablero, que es el inicio: una
  // pantalla de "no encontrado" para un hash tipeado a mano no le sirve a nadie.
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

/** Navegación imperativa, para después de guardar algo. */
export function ir(destino: string): void {
  window.location.hash = destino;
}
