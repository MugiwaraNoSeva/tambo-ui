// ─────────────────────────────────────────────────────────────────────────────
// Qué día es hoy, según el servidor.
//
// Todo formulario de carga propone la fecha de hoy por default, y la decisión 52
// dice de qué reloj sale: **del servidor, nunca del celular**. Quien decide si
// un evento es futuro es la API (`FECHA_FUTURA`), que corta el día en la zona
// del tambo; el celular del corral puede tener la hora mal, la zona mal, o estar
// del otro lado de la medianoche. Con el reloj del dispositivo, la UI propondría
// por default una fecha que la API rechaza — el peor error posible, porque el
// usuario no tocó nada y aun así le dicen que no.
//
// Lo que hace este módulo es simplemente **acordarse**: casi toda respuesta de
// §9 trae su propio `fecha` (`/rodeo`, `/alertas`, `/kpis`, `/lactancias`,
// `/tanque`, `/animales`), el cliente HTTP lo anota al pasar, y los formularios
// lo piden acá. Sin esto, cada pantalla de carga tendría que pedir un endpoint
// cualquiera solo para enterarse del día (decisión 62).
//
// El respaldo es el reloj del dispositivo, y solo se usa si todavía no volvió
// **ninguna** respuesta — entrar por un enlace directo a un formulario, sin
// pasar por el tablero. Es el mismo respaldo que la decisión 52 ya contemplaba.
// ─────────────────────────────────────────────────────────────────────────────

import { hoyDelDispositivo } from './formato';

let ultimaFecha: string | null = null;

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Anota el `fecha` de una respuesta, si lo trae. Lo llama el cliente HTTP con
 * **todo** cuerpo que parsea: qué respuestas traen fecha es cosa de §9, y
 * repetir esa lista acá sería mantenerla en dos lados.
 */
export function anotarFechaDeLaRespuesta(cuerpo: unknown): void {
  if (typeof cuerpo !== 'object' || cuerpo === null) return;
  const fecha = (cuerpo as { fecha?: unknown }).fecha;
  // Se acepta solo `YYYY-MM-DD`: `fecha_registro` es un instante ISO y no es
  // esto, y un campo `fecha` de otra forma sería otra cosa con el mismo nombre.
  if (typeof fecha === 'string' && ES_FECHA.test(fecha)) ultimaFecha = fecha;
}

/** El día de hoy para los defaults de los formularios. */
export function hoyDelServidor(): string {
  return ultimaFecha ?? hoyDelDispositivo();
}

/** true si el día que se está usando salió de una respuesta y no del celular. */
export const hayFechaDelServidor = (): boolean => ultimaFecha !== null;

/** Solo para los tests: la suite comparte el módulo entre archivos. */
export function olvidarFechaDelServidor(): void {
  ultimaFecha = null;
}
