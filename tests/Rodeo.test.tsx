// La lista del rodeo. Lo que hay que probar acá es el **filtrado en el
// cliente** (decisión 58): que la lista se pida una vez y que buscar y filtrar
// no vuelvan a pedirla. Que la 103 esté preñada lo decidió el núcleo.

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { aAnimal, aRodeo } from '../src/ruteo';
import { montarApi, type ApiFalsa, type Manejador } from './servidor';
import {
  EST,
  V102,
  V106,
  animales,
  animalesConBajas,
  establecimiento,
  sesionDePrueba,
} from './fixtures';

function montarRodeo(cambios: Record<string, Manejador> = {}): ApiFalsa {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = '#/rodeo';
  return montarApi({
    ...sesionDePrueba(),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    [`GET /establecimientos/${EST}/animales`]: { cuerpo: animales },
    [`GET /establecimientos/${EST}/animales?todas=true`]: { cuerpo: animalesConBajas },
    ...cambios,
  });
}

/** Las caravanas visibles, en el orden en que están en la pantalla. */
const caravanas = (): string[] =>
  [...document.querySelectorAll('.lista .caravana')].map((e) => e.textContent ?? '');

const contador = () => screen.getByRole('heading', { name: /^\d+ de \d+$/ }).textContent;

/** Un chip de uno de los tres grupos de filtros, buscado por el nombre del grupo. */
const chip = (grupo: string, rotulo: string): HTMLElement =>
  within(screen.getByRole('group', { name: grupo })).getByRole('button', { name: rotulo });

describe('la lista del rodeo', () => {
  it('trae las activas y cada una lleva a su ficha', async () => {
    montarRodeo();
    render(<App />);

    expect(await screen.findByRole('heading', { name: '7 de 7' })).toBeInTheDocument();
    expect(caravanas()).toEqual(['101', '102', '103', '104', '105', '106', '150']);
    // La dirección lleva de dónde se vino: la ficha abierta desde acá vuelve acá.
    expect(screen.getByRole('link', { name: /^102/ })).toHaveAttribute(
      'href',
      aAnimal(V102, aRodeo()),
    );
  });

  it('muestra los dos ejes con palabras, no solo con color', async () => {
    montarRodeo();
    render(<App />);

    await screen.findByRole('heading', { name: '7 de 7' });
    const fila103 = screen.getByRole('link', { name: /^103/ });
    expect(fila103).toHaveTextContent('Preñada');
    expect(fila103).toHaveTextContent('En ordeñe');
    expect(fila103).toHaveTextContent('Lactancia tardía');
    expect(fila103).toHaveTextContent('parió el 05/10/2025');
  });
});

describe('buscar y filtrar', () => {
  it('busca por coincidencia parcial y sin volver a pedir la lista', async () => {
    const falsa = montarRodeo();
    render(<App />);
    await screen.findByRole('heading', { name: '7 de 7' });
    const pedidosIniciales = falsa.pedidos.length;

    await userEvent.type(screen.getByLabelText('Caravana'), '10');

    // "10" alcanza a la 101…106 y deja afuera a la 150: así se busca cuando uno
    // no se acuerda del número entero.
    expect(caravanas()).toEqual(['101', '102', '103', '104', '105', '106']);
    expect(contador()).toBe('6 de 7');
    // Y no hubo ni un viaje más al servidor (decisión 58).
    expect(falsa.pedidos.length).toBe(pedidosIniciales);
  });

  it('filtra por estado reproductivo y productivo a la vez, a un toque cada uno', async () => {
    montarRodeo();
    render(<App />);
    await screen.findByRole('heading', { name: '7 de 7' });

    // Un toque por filtro, no tres: el desplegable había que abrirlo, elegir y
    // confirmar, y mientras estaba abierto tapaba la lista.
    await userEvent.click(chip('Reproductivo', 'Vacía'));
    await userEvent.click(chip('Productivo', 'En ordeñe'));

    expect(caravanas()).toEqual(['102', '106']);
  });

  it('filtra por categoría de alimentación', async () => {
    montarRodeo();
    render(<App />);
    await screen.findByRole('heading', { name: '7 de 7' });

    await userEvent.click(chip('Categoría de alimentación', 'Lactancia temprana'));

    expect(caravanas()).toEqual(['106']);
  });

  it('tocar el chip puesto lo suelta: es la forma de dejar de filtrar', async () => {
    montarRodeo();
    render(<App />);
    await screen.findByRole('heading', { name: '7 de 7' });

    const vacias = chip('Reproductivo', 'Vacía');
    await userEvent.click(vacias);
    expect(contador()).toBe('4 de 7');
    expect(vacias).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(vacias);
    expect(contador()).toBe('7 de 7');
    expect(vacias).toHaveAttribute('aria-pressed', 'false');
  });

  it('dice en palabras qué está filtrado, y se quita todo de un toque', async () => {
    montarRodeo();
    render(<App />);
    await screen.findByRole('heading', { name: '7 de 7' });

    await userEvent.type(screen.getByLabelText('Caravana'), '10');
    await userEvent.click(chip('Reproductivo', 'Preñada'));

    // Con once chips en tres grupos, encontrar los dos puestos obliga a barrer
    // la pantalla. El caso que importa es la lista vacía: lo primero que hay que
    // saber ahí es por qué está vacía.
    expect(screen.getByText(/Filtrando por caravana "10" · preñada\./)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Quitar los filtros' }));

    expect(contador()).toBe('7 de 7');
    expect(screen.queryByText(/Filtrando por/)).not.toBeInTheDocument();
  });

  it('sin resultados lo dice, y distingue "no hay" de "no encontré"', async () => {
    montarRodeo();
    render(<App />);
    await screen.findByRole('heading', { name: '7 de 7' });

    await userEvent.type(screen.getByLabelText('Caravana'), '999');

    expect(screen.getByText(/ningún animal con esos filtros/i)).toBeInTheDocument();
    expect(contador()).toBe('0 de 7');
  });
});

/**
 * El hash como **semilla**: entra el filtro con el que se abrió el rodeo, y de
 * ahí en más manda el estado local. Es la puerta que le faltaba al reparto de
 * dietas del tablero, que ya sabía contar por categoría y no llevaba a ninguna.
 */
describe('los filtros que trae la dirección', () => {
  it('llega con el chip puesto y la lista ya filtrada', async () => {
    montarRodeo();
    window.location.hash = '#/rodeo?cat=LACTANCIA_TEMPRANA';
    render(<App />);

    expect(await screen.findByRole('heading', { name: '1 de 7' })).toBeInTheDocument();
    expect(caravanas()).toEqual(['106']);
    expect(chip('Categoría de alimentación', 'Lactancia temprana')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Y se dice en palabras, igual que si lo hubiera tocado alguien.
    expect(screen.getByText(/Filtrando por lactancia temprana\./)).toBeInTheDocument();
  });

  it('un valor que no se reconoce no rompe: el rodeo sale entero', async () => {
    // `?cat=BASURA` tomado en serio no matchearía ninguna fila y dejaría el rodeo
    // vacío sin decir por qué. Descartado, sale de más —que se ve— en vez de
    // salir de menos, que no se ve.
    montarRodeo();
    window.location.hash = '#/rodeo?cat=BASURA';
    render(<App />);

    expect(await screen.findByRole('heading', { name: '7 de 7' })).toBeInTheDocument();
    expect(screen.queryByText(/Filtrando por/)).not.toBeInTheDocument();
  });

  it('la ficha abierta con un filtro puesto vuelve al rodeo con ese filtro', async () => {
    montarRodeo();
    render(<App />);
    await screen.findByRole('heading', { name: '7 de 7' });

    await userEvent.click(chip('Categoría de alimentación', 'Lactancia temprana'));

    // Sin esto, volver desde la ficha aterrizaba en el rodeo entero y había que
    // filtrar de nuevo para seguir donde se estaba.
    expect(screen.getByRole('link', { name: /^106/ })).toHaveAttribute(
      'href',
      aAnimal(V106, aRodeo({ cat: 'LACTANCIA_TEMPRANA' })),
    );
  });
});

describe('las de baja', () => {
  it('quedan afuera hasta que se piden, y ahí la lista se vuelve a traer', async () => {
    const falsa = montarRodeo();
    render(<App />);
    await screen.findByRole('heading', { name: '7 de 7' });
    expect(caravanas()).not.toContain('107');

    await userEvent.click(screen.getByLabelText(/también las de baja/i));

    // Esta sí es una consulta nueva: `?todas=true` es otra lista, no un filtro
    // de la que ya está (decisión 53).
    expect(await screen.findByRole('heading', { name: '8 de 8' })).toBeInTheDocument();
    expect(caravanas()).toContain('107');
    expect(falsa.pedidos.map((p) => p.ruta)).toContain(
      `/establecimientos/${EST}/animales?todas=true`,
    );

    // Y la de baja se distingue con su palabra, no con un color.
    expect(screen.getByRole('link', { name: /^107/ })).toHaveTextContent('De baja');
  });
});
