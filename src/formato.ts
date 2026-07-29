// ─────────────────────────────────────────────────────────────────────────────
// Presentación: de lo que dice la API a lo que lee el tambero.
//
// **Un solo archivo, y nada de dominio adentro.** Acá se traduce forma, no
// significado: una fecha ISO a DD/MM/AAAA, un `PRENADA` a "Preñada", un número
// con demasiados decimales a uno que se lee de un vistazo. Ninguna de estas
// funciones decide nada — si alguna empieza a preguntar "¿y si está preñada
// hace más de…?", se mudó al lado equivocado del contrato.
//
// Las fechas se manipulan **como strings**, nunca con `new Date`. `new
// Date('2026-03-01')` se parsea como medianoche UTC y en UTC−3 se muestra como
// el 28 de febrero: exactamente la corrupción que el núcleo evita haciendo toda
// su aritmética en UTC (decisión 26) y que la decisión 47 encontró en los
// parsers de `pg`. Un `split('-')` no tiene zona horaria.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CategoriaAlimentacion,
  EstadoProductivo,
  EstadoReproductivo,
  EstadoVida,
  MotivoBaja,
  ResultadoCria,
  SexoCria,
  TipoEvento,
} from './api/tipos';

/** `2026-03-01` → `01/03/2026`. Devuelve el original si no tiene esa forma. */
export function fechaCorta(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '';
  const partes = iso.slice(0, 10).split('-');
  const [anio, mes, dia] = partes;
  if (partes.length !== 3 || anio === undefined || mes === undefined || dia === undefined) {
    return iso;
  }
  return `${dia}/${mes}/${anio}`;
}

/** Lo mismo, pero para donde el vacío tiene que decirse. */
export const fechaOSinDato = (iso: string | null | undefined): string =>
  iso === null || iso === undefined || iso === '' ? SIN_DATO : fechaCorta(iso);

/**
 * Lo que se muestra donde el número es `null`.
 *
 * Nunca 0 y nunca en blanco (decisión 37): un cero dice "medimos y dio cero" y
 * un blanco dice "acá no va nada", cuando lo que pasa es que no hay con qué
 * calcularlo.
 */
export const SIN_DATO = 'sin datos';

/** Un número con los decimales justos, o "sin datos" si es null. */
export function numero(valor: number | null | undefined, decimales = 0): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return SIN_DATO;
  return valor.toFixed(decimales).replace('.', ',');
}

/** Un porcentaje que viene 0–100 del núcleo. */
export const porcentaje = (valor: number | null | undefined, decimales = 0): string =>
  valor === null || valor === undefined ? SIN_DATO : `${numero(valor, decimales)} %`;

/** Días, con la unidad pegada porque un número pelado no dice de qué. */
export const dias = (valor: number | null | undefined): string =>
  valor === null || valor === undefined ? SIN_DATO : `${numero(valor)} ${valor === 1 ? 'día' : 'días'}`;

export const litros = (valor: number | null | undefined, decimales = 1): string =>
  valor === null || valor === undefined ? SIN_DATO : `${numero(valor, decimales)} L`;

// ── El vocabulario, en castellano ────────────────────────────────────────────
//
// Los estados se escriben SIEMPRE con su texto, nunca solo con un color: en el
// corral hay sol de frente y apuro, y media población masculina distingue mal el
// rojo del verde.

export const REPRODUCTIVO: Record<EstadoReproductivo, string> = {
  VACIA: 'Vacía',
  INSEMINADA: 'Inseminada',
  PRENADA: 'Preñada',
};

export const PRODUCTIVO: Record<EstadoProductivo, string> = {
  SECA: 'Seca',
  EN_LACTANCIA: 'En ordeñe',
};

export const VIDA: Record<EstadoVida, string> = {
  SIN_ALTA: 'Sin alta',
  ACTIVA: 'Activa',
  BAJA: 'De baja',
};

/**
 * Las categorías de alimentación. Espeja `NOMBRE_CATEGORIA` de `tambo-reglas`
 * a propósito y no lo importa: traerlo obligaría a un `import` de valor —no de
 * tipo— y con él viajaría al bundle del browser el motor de dominio entero por
 * seis strings (decisión 51). El tipo sí viene del núcleo, así que si mañana
 * aparece una categoría nueva este `Record` no compila.
 */
export const CATEGORIA: Record<CategoriaAlimentacion, string> = {
  RECRIA: 'Recría',
  LACTANCIA_TEMPRANA: 'Lactancia temprana',
  LACTANCIA_MEDIA: 'Lactancia media',
  LACTANCIA_TARDIA: 'Lactancia tardía',
  PREPARTO: 'Preparto',
  SECA: 'Vaca seca',
};

export const TIPO_EVENTO: Record<TipoEvento, string> = {
  alta: 'Alta',
  celo: 'Celo',
  inseminacion: 'Inseminación',
  tacto_positivo: 'Tacto positivo',
  tacto_negativo: 'Tacto negativo',
  parto: 'Parto',
  aborto: 'Aborto',
  secado: 'Secado',
  control_lechero: 'Control lechero',
  baja: 'Baja',
  anulacion: 'Anulación',
};

export const MOTIVO_BAJA: Record<MotivoBaja, string> = {
  venta: 'Venta',
  muerte: 'Muerte',
  descarte: 'Descarte',
  otro: 'Otro',
};

export const SEXO_CRIA: Record<SexoCria, string> = {
  hembra: 'Hembra',
  macho: 'Macho',
};

export const RESULTADO_CRIA: Record<ResultadoCria, string> = {
  viva: 'Nacida viva',
  muerta: 'Nacida muerta',
};

/** Etiqueta de una categoría que puede venir null (animal no ACTIVA). */
export function categoria(valor: string | null | undefined): string {
  if (valor === null || valor === undefined) return SIN_DATO;
  return CATEGORIA[valor as CategoriaAlimentacion] ?? valor;
}

/**
 * El día de hoy del dispositivo, en `YYYY-MM-DD`.
 *
 * Es solo un **respaldo**: cuando la respuesta de la API trae su propio `fecha`
 * —y casi todas lo traen— se usa ese, porque el que decide si un evento es
 * futuro es el reloj del servidor y no el del celular (decisión 52).
 */
export function hoyDelDispositivo(): string {
  const ahora = new Date();
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;
}
