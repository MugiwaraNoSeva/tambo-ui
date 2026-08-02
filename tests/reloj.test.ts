// "Ayer", contado sobre el string del servidor y sin `new Date`.
//
// Los bordes son el punto entero de que esta función exista: restarle un día al
// primero de marzo es donde fallan todas las implementaciones caseras, y donde
// `new Date` además se corre de zona horaria (`new Date('2026-03-01')` es
// medianoche UTC, que en Montevideo es el 28 de febrero — decisiones 47 y 52).

import { describe, expect, it } from 'vitest';
import { diaAnterior, diasAntes } from '../src/reloj';

describe('diaAnterior', () => {
  it('el caso común: un día para atrás dentro del mismo mes', () => {
    expect(diaAnterior('2026-07-29')).toBe('2026-07-28');
    expect(diaAnterior('2026-07-02')).toBe('2026-07-01');
  });

  it('cruza el principio de mes y agarra el último del anterior', () => {
    expect(diaAnterior('2026-07-01')).toBe('2026-06-30');
    expect(diaAnterior('2026-08-01')).toBe('2026-07-31');
    expect(diaAnterior('2026-05-01')).toBe('2026-04-30');
  });

  it('cruza el año', () => {
    expect(diaAnterior('2026-01-01')).toBe('2025-12-31');
  });

  it('febrero, con la regla gregoriana entera y no el `% 4`', () => {
    // 2026 no es bisiesto.
    expect(diaAnterior('2026-03-01')).toBe('2026-02-28');
    // 2024 sí.
    expect(diaAnterior('2024-03-01')).toBe('2024-02-29');
    // 2000 es bisiesto (divisible por 400) y 1900 no (divisible por 100). Es el
    // par que separa la regla de verdad del atajo que casi siempre funciona.
    expect(diaAnterior('2000-03-01')).toBe('2000-02-29');
    expect(diaAnterior('1900-03-01')).toBe('1900-02-28');
    expect(diaAnterior('2100-03-01')).toBe('2100-02-28');
  });

  it('nunca usa el reloj del dispositivo: la misma entrada da lo mismo siempre', () => {
    // Es la garantía que hace que esta función se pueda testear así. Con `new
    // Date` adentro, el resultado dependería de la zona de quien corre el test.
    expect(diaAnterior('2026-03-01')).toBe(diaAnterior('2026-03-01'));
  });

  it('lo que no es una fecha vuelve tal cual, sin inventar nada', () => {
    // Esta función no valida: de eso se encargan el `input type="date"` y, al
    // final, la API. Devolver algo inventado sería peor que devolver lo que entró.
    expect(diaAnterior('')).toBe('');
    expect(diaAnterior('ayer')).toBe('ayer');
    expect(diaAnterior('2026-07')).toBe('2026-07');
  });
});

// Los bordes de los atajos del período del tanque. Se cuenta hacia atrás con
// `diaAnterior`, así que hereda sus bordes; lo que se prueba acá es que contarlo
// muchas veces siga cayendo donde tiene que caer.
describe('diasAntes', () => {
  it('cero días es el mismo día', () => {
    expect(diasAntes('2026-07-29', 0)).toBe('2026-07-29');
  });

  it('los bordes de los tres atajos del tanque, sobre el 29/07/2026', () => {
    // "Últimos 7 días" cuenta hoy adentro: son seis para atrás, no siete.
    expect(diasAntes('2026-07-29', 6)).toBe('2026-07-23');
    expect(diasAntes('2026-07-29', 29)).toBe('2026-06-30');
  });

  it('cruza meses, años y febrero sin acumular error', () => {
    expect(diasAntes('2026-01-05', 10)).toBe('2025-12-26');
    // Un año entero de un año no bisiesto.
    expect(diasAntes('2026-03-01', 365)).toBe('2025-03-01');
    // Y uno que se come el 29 de febrero de 2024.
    expect(diasAntes('2024-03-01', 366)).toBe('2023-03-01');
  });
});
