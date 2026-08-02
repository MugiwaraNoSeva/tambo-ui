// Partos y lactancias: la pantalla que consume `LactanciaConNumeros` entera.
//
// Antes de existir, `api.lactancias` traía por lactancia las crías, el pico, el
// promedio de controles, el RCS máximo, la acumulada y la estandarizada a 305
// días, y la ficha dibujaba la curva de una sola y un renglón por cada
// anterior. El resto llegaba y se tiraba.
//
// El pedido sigue siendo **diferido**: lo hace esta pantalla al montarse, en vez
// del plegable de la ficha al abrirse. Que la ficha ya no lo pague se afirma en
// `Ficha.test.tsx`; acá se afirma la otra mitad.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../src/App';
import { aPartos } from '../src/ruteo';
import { montarApi, type ApiFalsa, type Manejador } from './servidor';
import {
  EST,
  V102,
  establecimiento,
  lactancias102,
  lactanciasSinControles,
  sesionDePrueba,
} from './fixtures';

function montarPartos(cambios: Record<string, Manejador> = {}, hash?: string): ApiFalsa {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = hash ?? aPartos(V102, { caravana: '102' });
  return montarApi({
    ...sesionDePrueba(),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    [`GET /establecimientos/${EST}/animales/${V102}/lactancias`]: { cuerpo: lactancias102 },
    ...cambios,
  });
}

const cifra = (rotulo: string): string => {
  const caja = screen.getByText(rotulo).closest('.cifra');
  return caja?.querySelector('.valor')?.textContent ?? '';
};

describe('la pantalla de partos', () => {
  it('pide las lactancias al montarse y las muestra con sus seis cifras', async () => {
    const falsa = montarPartos();
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Lactancia 3 (en curso)' }),
    ).toBeInTheDocument();
    expect(
      falsa.pedidos.some((p) => p.ruta.endsWith(`/animales/${V102}/lactancias`)),
    ).toBe(true);

    // Las seis, completas: hasta acá la ficha mostraba cuatro de una sola
    // lactancia y el resto de la respuesta se tiraba.
    expect(cifra('Pico')).toBe('28,0 L');
    expect(cifra('Al día en leche')).toBe('60');
    expect(cifra('Promedio por control')).toBe('23,7 L');
    expect(cifra('Acumulada')).toBe('4666 L');
    expect(cifra('A 305 días')).toBe('4666 L');
    expect(cifra('RCS máximo')).toBe('320');
  });

  it('dibuja la curva y la cuenta en palabras', async () => {
    montarPartos();
    render(<App />);
    await screen.findByRole('heading', { name: 'Lactancia 3 (en curso)' });

    expect(document.querySelectorAll('.curva .punto')).toHaveLength(6);
    expect(document.querySelectorAll('.curva .punto.pico')).toHaveLength(1);
    expect(document.querySelector('.curva .rotulo-pico')?.textContent).toBe('28,0 L');
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Curva de lactancia con 6 controles, del día 30 al 180 en leche, con el pico de 28,0 L al día 60.',
    );
  });

  it('muestra el parto que abrió cada lactancia, con sus crías', async () => {
    montarPartos();
    render(<App />);
    await screen.findByRole('heading', { name: 'Lactancia 3 (en curso)' });

    expect(screen.getByRole('heading', { name: 'El parto que la abrió' })).toBeInTheDocument();
    expect(screen.getByText('13/01/2026 — Parto')).toBeInTheDocument();
    expect(screen.getByText('1 cría: hembra, nacida viva')).toBeInTheDocument();
  });

  it('la caravana viaja en la dirección y no se pide el animal para el título', async () => {
    const falsa = montarPartos();
    render(<App />);
    await screen.findByRole('heading', { name: '102 — partos' });

    // Ni la proyección ni nada más: es una lectura y el título no vale un viaje.
    expect(falsa.pedidos.filter((p) => p.ruta.endsWith(`/animales/${V102}`))).toHaveLength(0);
  });

  it('sin caravana en la dirección el título es genérico, y no se pide igual', async () => {
    const falsa = montarPartos({}, aPartos(V102));
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Partos y lactancias' }),
    ).toBeInTheDocument();
    expect(falsa.pedidos.filter((p) => p.ruta.endsWith(`/animales/${V102}`))).toHaveLength(0);
  });

  it('avisa cuando la fecha de inicio no es confiable, y por qué eso ensucia la curva', async () => {
    montarPartos({
      [`GET /establecimientos/${EST}/animales/${V102}/lactancias`]: {
        cuerpo: lactanciasSinControles,
      },
    });
    render(<App />);

    expect(await screen.findByText(/datos incompletos/i)).toBeInTheDocument();
    expect(screen.getByText(/la fecha de inicio no es confiable/i)).toBeInTheDocument();
    // Y una lactancia sin controles no dibuja una curva vacía: lo dice. La
    // acumulada de una sin controles es "sin datos", no 0 (decisión 37).
    expect(screen.getByText(/todavía no hay controles lecheros/i)).toBeInTheDocument();
    expect(document.querySelector('.curva')).toBeNull();
    expect(cifra('Acumulada')).toBe('sin datos');
  });

  it('un animal sin lactancias lo dice, no deja la pantalla en blanco', async () => {
    montarPartos({
      [`GET /establecimientos/${EST}/animales/${V102}/lactancias`]: {
        cuerpo: { animal_id: V102, fecha: '2026-07-29', lactancias: [] },
      },
    });
    render(<App />);

    expect(
      await screen.findByText(/todavía no tuvo ninguna lactancia/i),
    ).toBeInTheDocument();
  });

  it('es una tarea: lleva flecha a la ficha y no lleva barra', async () => {
    montarPartos();
    render(<App />);
    await screen.findByRole('heading', { name: '102 — partos' });

    expect(screen.getByRole('link', { name: 'Volver' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument();
  });
});
