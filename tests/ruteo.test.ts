import { describe, expect, it } from 'vitest';
import { aAnimal, aCargar, leerRuta } from '../src/ruteo';

describe('leerRuta', () => {
  it('el hash vacío es el tablero', () => {
    expect(leerRuta('')).toEqual({ nombre: 'tablero' });
    expect(leerRuta('#/')).toEqual({ nombre: 'tablero' });
  });

  it('lee las pantallas sueltas', () => {
    expect(leerRuta('#/rodeo')).toEqual({ nombre: 'rodeo' });
    expect(leerRuta('#/alta')).toEqual({ nombre: 'alta' });
    expect(leerRuta('#/tanque')).toEqual({ nombre: 'tanque' });
  });

  it('lee la ficha y la carga de un animal', () => {
    expect(leerRuta(aAnimal('abc'))).toEqual({ nombre: 'animal', id: 'abc' });
    expect(leerRuta(aCargar('abc'))).toEqual({ nombre: 'cargar', id: 'abc' });
  });

  it('lo que no se entiende cae en el tablero, no en un error', () => {
    expect(leerRuta('#/cualquiera')).toEqual({ nombre: 'tablero' });
    expect(leerRuta('#/animales')).toEqual({ nombre: 'tablero' });
  });
});
