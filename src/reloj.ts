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

// ── Ayer ─────────────────────────────────────────────────────────────────────
//
// Existe porque "ayer" es la segunda fecha más cargada del sistema —el ordeñe de
// anoche, el celo que se vio al caer la tarde y se anota a la mañana— y con el
// `<input type="date">` cuesta tres toques: abrir el calendario nativo, elegir y
// confirmar. Con esto cuesta uno.
//
// **Sin `new Date`, que en este archivo está prohibido** (decisiones 47 y 52):
// `new Date('2026-03-01')` es medianoche UTC y en Montevideo se lee 28 de
// febrero, así que restarle un día por ahí devolvería el 27. El corte del día lo
// hace el servidor en la zona del tambo y acá solo se cuenta hacia atrás sobre
// el string que él mandó.
//
// Tampoco se importa el `sumarDias` del núcleo, que hace exactamente esto: la
// decisión 51 le prohíbe a esta UI importar **valores** de `tambo-reglas`, y por
// eso `src/api/nucleo.ts` es solo declaraciones. Además esto no es dominio —es
// aritmética de calendario, la misma que hay en cualquier almanaque— así que
// duplicarlo no duplica ninguna regla del tambo.

const DIAS_DEL_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** La regla gregoriana entera, no el `% 4` que falla en 1900 y en 2100. */
const bisiesto = (anio: number): boolean =>
  (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

/**
 * El día anterior a un `YYYY-MM-DD`, como otro `YYYY-MM-DD`.
 *
 * Lo que no se entiende vuelve tal cual: esta función no valida fechas —de eso
 * se encarga el `input type="date"` y, al final, la API— y devolver algo
 * inventado sería peor que devolver lo que entró.
 */
export function diaAnterior(dia: string): string {
  if (!ES_FECHA.test(dia)) return dia;

  const anio = Number(dia.slice(0, 4));
  const mes = Number(dia.slice(5, 7));
  const numero = Number(dia.slice(8, 10));

  // El caso común: no se cruza ningún borde y el mes ni se mira.
  if (numero > 1) return `${dia.slice(0, 8)}${dosDigitos(numero - 1)}`;

  const mesAntes = mes === 1 ? 12 : mes - 1;
  const anioAntes = mes === 1 ? anio - 1 : anio;
  const ultimo =
    mesAntes === 2 && bisiesto(anioAntes) ? 29 : (DIAS_DEL_MES[mesAntes - 1] ?? 30);

  return `${String(anioAntes).padStart(4, '0')}-${dosDigitos(mesAntes)}-${dosDigitos(ultimo)}`;
}

/**
 * `n` días antes de un `YYYY-MM-DD`. Lo usan los atajos del período del tanque,
 * donde "los últimos 7 días" es un borde que hay que calcular y no un día suelto.
 *
 * Se cuenta hacia atrás de a uno y no con una cuenta cerrada, porque la que sabe
 * de meses y de bisiestos es `diaAnterior` y escribirla dos veces sería tener dos
 * febreros. Treinta vueltas de un bucle sobre tres `Number` no se miden.
 */
export function diasAntes(dia: string, n: number): string {
  let cursor = dia;
  for (let i = 0; i < n; i += 1) cursor = diaAnterior(cursor);
  return cursor;
}
