// La conversión de presentación, que vive en un solo helper y por eso se prueba
// en un solo lugar. El caso que importa es el del cambio de mes: es el que se
// rompe cuando alguien reemplaza el `split` por un `new Date`.

import { describe, expect, it } from 'vitest';
import {
  CATEGORIA,
  REPRODUCTIVO,
  SIN_DATO,
  dias,
  fechaCorta,
  fechaOSinDato,
  litros,
  numero,
  porcentaje,
} from '../src/formato';

describe('fechaCorta', () => {
  it('pasa de ISO a DD/MM/AAAA', () => {
    expect(fechaCorta('2026-07-29')).toBe('29/07/2026');
  });

  it('no corre el día en el primero del mes', () => {
    // `new Date('2026-03-01')` es medianoche UTC, que en Montevideo es el 28 de
    // febrero: el bug que este test existe para que no vuelva.
    expect(fechaCorta('2026-03-01')).toBe('01/03/2026');
    expect(fechaCorta('2026-01-01')).toBe('01/01/2026');
  });

  it('recorta el instante ISO a su fecha', () => {
    expect(fechaCorta('2026-07-29T23:40:00.000Z')).toBe('29/07/2026');
  });

  it('deja pasar lo que no tiene forma de fecha en vez de inventar', () => {
    expect(fechaCorta('mañana')).toBe('mañana');
  });

  it('el vacío es vacío, y donde hace falta se dice', () => {
    expect(fechaCorta(null)).toBe('');
    expect(fechaOSinDato(null)).toBe(SIN_DATO);
  });
});

describe('números', () => {
  it('usa coma decimal', () => {
    expect(numero(23.666, 1)).toBe('23,7');
    expect(litros(71.666)).toBe('71,7 L');
  });

  it('un null es "sin datos" y nunca 0 (decisión 37)', () => {
    expect(numero(null)).toBe(SIN_DATO);
    expect(porcentaje(null)).toBe(SIN_DATO);
    expect(dias(null)).toBe(SIN_DATO);
    expect(litros(null)).toBe(SIN_DATO);
  });

  it('un 0 de verdad se muestra como 0', () => {
    expect(numero(0)).toBe('0');
    expect(porcentaje(0)).toBe('0 %');
  });

  it('singulariza el día', () => {
    expect(dias(1)).toBe('1 día');
    expect(dias(2)).toBe('2 días');
  });
});

describe('vocabulario', () => {
  it('los estados se dicen con palabras, no solo con color', () => {
    expect(REPRODUCTIVO.PRENADA).toBe('Preñada');
    expect(REPRODUCTIVO.VACIA).toBe('Vacía');
    expect(CATEGORIA.LACTANCIA_TARDIA).toBe('Lactancia tardía');
  });
});
