import { describe, expect, it } from 'vitest';
import {
  aAnimal,
  aCargar,
  aCorrida,
  aPanel,
  aPanelTambo,
  aPanelUsuarios,
  aPartos,
  esRutaDeAdmin,
  leerRuta,
  parametro,
  vueltaDe,
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

  it('lee la ficha, los partos y la carga de un animal', () => {
    expect(leerRuta(aAnimal('abc'))).toEqual({ nombre: 'animal', id: 'abc' });
    expect(leerRuta(aPartos('abc'))).toEqual({ nombre: 'partos', id: 'abc' });
    // Sin tipo es el menú de los nueve; con tipo, el formulario de ese tipo. Acá
    // el tipo viaja **crudo**: quién lo valida es la pantalla, contra el
    // vocabulario, y este archivo no sabe qué es un `TipoEvento`.
    expect(leerRuta(aCargar('abc'))).toEqual({ nombre: 'cargar', id: 'abc', tipo: null });
    expect(leerRuta(aCargar('abc', { tipo: 'parto' }))).toEqual({
      nombre: 'cargar',
      id: 'abc',
      tipo: 'parto',
    });
    // Y uno inventado llega igual, sin romper: lo descarta la pantalla, que cae
    // en el menú.
    expect(leerRuta('#/animales/abc/cargar/tacto_de_verano')).toEqual({
      nombre: 'cargar',
      id: 'abc',
      tipo: 'tacto_de_verano',
    });
  });

  it('lo que cuelga de un animal y no se entiende es su ficha, no el inicio', () => {
    // Un `/partoss` mal tipeado no tiene por qué mandar a otra pantalla: el
    // animal se sabe cuál es.
    expect(leerRuta('#/animales/abc/partoss')).toEqual({ nombre: 'animal', id: 'abc' });
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

describe('los parámetros del hash', () => {
  it('no cambian qué pantalla es: el camino manda', () => {
    expect(leerRuta(aAnimal('abc', '#/rodeo'))).toEqual({ nombre: 'animal', id: 'abc' });
    expect(leerRuta(aCargar('abc', { desde: '#/', caravana: '104' }))).toEqual({
      nombre: 'cargar',
      id: 'abc',
      tipo: null,
    });
  });

  it('la vuelta sale del `de`, y sin él cae en el default de la pantalla', () => {
    expect(vueltaDe(aAnimal('abc', '#/rodeo'), '#/otra')).toBe('#/rodeo');
    expect(vueltaDe(aAnimal('abc'), '#/otra')).toBe('#/otra');
    expect(vueltaDe('#/animales/abc?de=', '#/otra')).toBe('#/otra');
  });

  it('la vuelta solo acepta un hash de esta app', () => {
    // Es un `href` y llega de la barra de direcciones: sin este filtro, un `de`
    // con una URL de afuera convertiría la flecha de volver en un enlace a
    // cualquier lado.
    expect(vueltaDe('#/animales/abc?de=https%3A%2F%2Fmalo.example', '#/rodeo')).toBe('#/rodeo');
    expect(vueltaDe('#/animales/abc?de=%2F%2Fmalo.example', '#/rodeo')).toBe('#/rodeo');
    expect(vueltaDe('#/animales/abc?de=javascript%3Aalert(1)', '#/rodeo')).toBe('#/rodeo');
  });

  it('la caravana viaja para que la carga no tenga que ir a pedirla', () => {
    expect(parametro(aCargar('abc', { caravana: '104' }), 'c')).toBe('104');
    // Sin caravana no se escribe el parámetro: la pantalla la va a buscar.
    expect(parametro(aCargar('abc'), 'c')).toBeUndefined();
    expect(parametro(aCargar('abc', { caravana: null }), 'c')).toBeUndefined();
  });

  it('una caravana con caracteres raros vuelve entera', () => {
    const con = aCargar('abc', { caravana: 'A 1/2&3' });
    expect(parametro(con, 'c')).toBe('A 1/2&3');
    // Y no se lleva puesto el camino: sigue siendo la carga de `abc`.
    expect(leerRuta(con)).toEqual({ nombre: 'cargar', id: 'abc', tipo: null });
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
