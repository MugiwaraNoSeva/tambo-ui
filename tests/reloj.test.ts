// "Ayer", contado sobre el string del servidor y sin `new Date`.
//
// Los bordes son el punto entero de que esta función exista: restarle un día al
// primero de marzo es donde fallan todas las implementaciones caseras, y donde
// `new Date` además se corre de zona horaria (`new Date('2026-03-01')` es
// medianoche UTC, que en Montevideo es el 28 de febrero — decisiones 47 y 52).

import { describe, expect, it } from 'vitest';
import { diaAnterior } from '../src/reloj';

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
