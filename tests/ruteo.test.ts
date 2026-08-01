import { describe, expect, it } from 'vitest';
import {
  aAnimal,
  aCargar,
  aCorrida,
  aPanel,
  aPanelTambo,
  aPanelUsuarios,
  esRutaDeAdmin,
  leerRuta,
} from '../src/ruteo';

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

  it('lee las tres corridas, cada una con su origen', () => {
    expect(leerRuta(aCorrida('para-revisar'))).toEqual({
      nombre: 'corrida',
      origen: 'para-revisar',
    });
    expect(leerRuta(aCorrida('para-secar'))).toEqual({ nombre: 'corrida', origen: 'para-secar' });
    expect(leerRuta(aCorrida('rodeo'))).toEqual({ nombre: 'corrida', origen: 'rodeo' });
  });

  it('una corrida sin origen o con uno inventado no existe', () => {
    // Adivinarle un origen sería empezar a cargar eventos sobre una lista que
    // nadie pidió. Cae en el inicio como cualquier hash que no se entienda.
    expect(leerRuta('#/corrida')).toEqual({ nombre: 'tablero' });
    expect(leerRuta('#/corrida/para-revizar')).toEqual({ nombre: 'tablero' });
    expect(leerRuta('#/corrida/todas')).toEqual({ nombre: 'tablero' });
  });
});

describe('las rutas del panel', () => {
  it('lee las tres, y cada constructora vuelve por donde salió', () => {
    expect(leerRuta(aPanel())).toEqual({ nombre: 'panel' });
    expect(leerRuta(aPanelUsuarios())).toEqual({ nombre: 'panel-usuarios' });
    expect(leerRuta(aPanelTambo('abc'))).toEqual({ nombre: 'panel-tambo', id: 'abc' });
  });

  it('un hash de admin que no se entiende cae en el panel, no en el tablero', () => {
    // Salir del panel por una letra mal tipeada sería mandarlo a otra
    // aplicación: el inicio del panel es el panel.
    expect(leerRuta('#/admin/tanbos')).toEqual({ nombre: 'panel' });
    expect(leerRuta('#/admin/tambos')).toEqual({ nombre: 'panel' });
    expect(leerRuta('#/admin/loquesea')).toEqual({ nombre: 'panel' });
  });

  it('esRutaDeAdmin separa los dos árboles', () => {
    expect(leerRuta(aPanel())).toSatisfy(esRutaDeAdmin);
    expect(leerRuta(aPanelTambo('abc'))).toSatisfy(esRutaDeAdmin);
    expect(leerRuta(aPanelUsuarios())).toSatisfy(esRutaDeAdmin);
    // Y ninguna del tambo se cuela: son dos árboles y no uno con una rama.
    expect(esRutaDeAdmin(leerRuta('#/'))).toBe(false);
    expect(esRutaDeAdmin(leerRuta('#/rodeo'))).toBe(false);
    expect(esRutaDeAdmin(leerRuta(aAnimal('abc')))).toBe(false);
  });
});
