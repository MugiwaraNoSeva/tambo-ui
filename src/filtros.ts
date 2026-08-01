// ─────────────────────────────────────────────────────────────────────────────
// Los filtros del rodeo: una sola definición, dos pantallas.
//
// Viven acá y no adentro del rodeo porque **la corrida los hereda**: se filtra
// "las treinta en ordeñe", se toca "Cargarle lo mismo a varias" y la corrida
// tiene que recorrer esas treinta y no las doscientas. Escritos dos veces, el
// día que se agregue un filtro habría dos listas que se despegan y un contador
// que dice "quedan 197" donde tendría que decir 30.
//
// **Acá no hay una sola regla de dominio.** Se compara el estado que la fila
// trae con el que el chip dice, y nada más: quién está INSEMINADA lo decidió el
// núcleo cuatro capas más abajo. Es la otra punta de la decisión 58 —el endpoint
// no pagina ni filtra a propósito, así que el filtrado pasa en el browser sobre
// la lista que ya está— y por eso escribir "10" y ver la lista achicarse mientras
// se tipea no cuesta un viaje por tecla.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CategoriaAlimentacion,
  EstadoProductivo,
  EstadoReproductivo,
} from './api/tipos';
import { CATEGORIA, PRODUCTIVO, REPRODUCTIVO } from './formato';
import { parametro } from './ruteo';

/** Lo mínimo que una fila necesita traer para que estos filtros la puedan mirar. */
export interface Filtrable {
  caravana: string | null;
  reproductivo: EstadoReproductivo | null;
  productivo: EstadoProductivo | null;
  categoria: CategoriaAlimentacion | null;
}

/** `null` es "sin filtrar por este eje", que es lo que devuelve soltar un chip. */
export interface Filtros {
  busqueda: string;
  reproductivo: EstadoReproductivo | null;
  productivo: EstadoProductivo | null;
  categoria: CategoriaAlimentacion | null;
}

export const SIN_FILTROS: Filtros = {
  busqueda: '',
  reproductivo: null,
  productivo: null,
  categoria: null,
};

export const hayFiltro = (f: Filtros): boolean =>
  f.busqueda.trim() !== '' ||
  f.reproductivo !== null ||
  f.productivo !== null ||
  f.categoria !== null;

/**
 * Las filas que pasan los filtros.
 *
 * La búsqueda es por **coincidencia parcial** y no por igualdad: el tambero
 * escribe "10" para ver la 101, la 102 y la 150, que es como se busca cuando uno
 * no se acuerda del número entero.
 */
export function filtrar<T extends Filtrable>(animales: readonly T[], f: Filtros): T[] {
  const texto = f.busqueda.trim().toLowerCase();
  return animales.filter(
    (a) =>
      (texto === '' || (a.caravana ?? '').toLowerCase().includes(texto)) &&
      (f.reproductivo === null || a.reproductivo === f.reproductivo) &&
      (f.productivo === null || a.productivo === f.productivo) &&
      (f.categoria === null || a.categoria === f.categoria),
  );
}

// ── Cómo viajan a la corrida ─────────────────────────────────────────────────
//
// En el hash, como todo lo demás que una pantalla necesita saber sin ir a
// buscarlo (ver `ruteo.ts`). Así una corrida filtrada sobrevive a una recarga y
// se puede compartir por mensaje, que es lo mismo que ya vale para el resto.

/** Los parámetros que le cuelga a la dirección de una corrida. */
export function aParametros(f: Filtros): Record<string, string | undefined> {
  const texto = f.busqueda.trim();
  return {
    q: texto === '' ? undefined : texto,
    repro: f.reproductivo ?? undefined,
    prod: f.productivo ?? undefined,
    cat: f.categoria ?? undefined,
  };
}

/**
 * Los filtros que trae una dirección.
 *
 * **Lo que no se reconoce se descarta**, y no es paranoia: un `?repro=PRENIADA`
 * tipeado a mano, si se aceptara tal cual, no matchearía ninguna fila y dejaría
 * una corrida vacía sin decir por qué. Descartado, la corrida recorre de más —que
 * se ve— en vez de recorrer de menos, que no se ve.
 */
export function deParametros(hash: string): Filtros {
  const uno = <T extends string>(nombre: string, validos: Record<T, unknown>): T | null => {
    const valor = parametro(hash, nombre);
    return valor !== undefined && Object.hasOwn(validos, valor) ? (valor as T) : null;
  };

  return {
    busqueda: parametro(hash, 'q') ?? '',
    reproductivo: uno<EstadoReproductivo>('repro', REPRODUCTIVO),
    productivo: uno<EstadoProductivo>('prod', PRODUCTIVO),
    categoria: uno<CategoriaAlimentacion>('cat', CATEGORIA),
  };
}

/** Cómo se lee un filtro puesto, para contarlo en una frase. */
export function enPalabras(f: Filtros): string[] {
  const puestos: string[] = [];
  if (f.busqueda.trim() !== '') puestos.push(`caravana "${f.busqueda.trim()}"`);
  if (f.reproductivo !== null) puestos.push(REPRODUCTIVO[f.reproductivo].toLowerCase());
  if (f.productivo !== null) puestos.push(PRODUCTIVO[f.productivo].toLowerCase());
  if (f.categoria !== null) puestos.push(CATEGORIA[f.categoria].toLowerCase());
  return puestos;
}
