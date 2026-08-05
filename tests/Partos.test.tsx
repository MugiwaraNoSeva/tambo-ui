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

  it('un parto forzado con fecha confiable no dice que la curva esté sucia', async () => {
    // El caso de la decisión 110, que partió en dos lo que era un solo flag. La
    // 106 parió de monta: el parto entró forzado —nunca figuró preñada— así que
    // su ciclo sale de los indicadores, **pero la fecha es la que es**: la vieron
    // parir. Antes de la 110 esta lactancia avisaba que sus días en leche no eran
    // confiables, que era falso y le costaba la edad al primer parto a cada
    // vaquillona que parió de toro.
    montarPartos({
      [`GET /establecimientos/${EST}/animales/${V102}/lactancias`]: {
        cuerpo: lactanciasSinControles,
      },
    });
    render(<App />);

    expect(await screen.findByText(/datos incompletos/i)).toBeInTheDocument();
    expect(screen.getByText(/la fecha sí es confiable/i)).toBeInTheDocument();
    expect(screen.queryByText(/pone en duda la fecha/i)).not.toBeInTheDocument();
    // Y una lactancia sin controles no dibuja una curva vacía: lo dice. La
    // acumulada de una sin controles es "sin datos", no 0 (decisión 37).
    expect(screen.getByText(/todavía no hay controles lecheros/i)).toBeInTheDocument();
    expect(document.querySelector('.curva')).toBeNull();
    expect(cifra('Acumulada')).toBe('sin datos');
  });

  it('y cuando lo forzado sí pone en duda la fecha, avisa que la curva se ensucia', async () => {
    montarPartos({
      [`GET /establecimientos/${EST}/animales/${V102}/lactancias`]: {
        cuerpo: {
          ...lactanciasSinControles,
          lactancias: [
            { ...lactanciasSinControles.lactancias[0]!, fecha_incierta: true },
          ],
        },
      },
    });
    render(<App />);

    expect(await screen.findByText(/la fecha del parto no es confiable/i)).toBeInTheDocument();
    expect(screen.getByText(/los días en leche que son el eje de la curva/i)).toBeInTheDocument();
    // El otro aviso no se repite: son dos formas de decir lo mismo y el más
    // fuerte manda.
    expect(screen.queryByText(/^datos incompletos$/i)).not.toBeInTheDocument();
  });

  it('el equivalente maduro va aparte y con su factor al lado (decisión 105)', async () => {
    montarPartos();
    render(<App />);
    await screen.findByRole('heading', { name: /Lactancia 3/ });

    // Aparte de "A 305 días" porque contesta otra pregunta: aquella compara vacas
    // de la misma lactancia y esta compara **entre** lactancias, que es lo que
    // permite mirar a una vaquillona y a una vaca hecha en la misma columna.
    expect(cifra('A 305 días')).toBe('4666 L');
    expect(cifra('Equivalente maduro')).toBe('5039 L');
    // Y el factor, porque un número que se multiplicó por 1,08 tiene que poder
    // decir por qué: sin él, la lactancia de una vaquillona aparece treinta por
    // ciento más alta que la real y nadie sabe de dónde salió.
    expect(cifra('Factor aplicado')).toBe('1,08');
  });

  it('sin equivalente maduro no dibuja la sección vacía', async () => {
    montarPartos({
      [`GET /establecimientos/${EST}/animales/${V102}/lactancias`]: {
        cuerpo: lactanciasSinControles,
      },
    });
    render(<App />);
    await screen.findByRole('heading', { name: /Lactancia 2/ });

    expect(screen.queryByText('Comparada con una vaca madura')).not.toBeInTheDocument();
  });

  it('el parto dice cuánta ayuda necesitó y con qué cuerpo llegó', async () => {
    montarPartos();
    render(<App />);
    await screen.findByRole('heading', { name: /Lactancia 3/ });

    // Las dos juntas (decisiones 107 y 108) porque contestan lo mismo —cómo entró
    // a esta lactancia— y juntas explican los días abiertos que vienen después.
    expect(screen.getByText(/ayuda al parir: con una mano/i)).toBeInTheDocument();
    expect(screen.getByText(/condición corporal al parto: 3,25/i)).toBeInTheDocument();
  });

  it('y no inventa ninguna de las dos cuando no se declararon', async () => {
    montarPartos({
      [`GET /establecimientos/${EST}/animales/${V102}/lactancias`]: {
        cuerpo: lactanciasSinControles,
      },
    });
    render(<App />);
    await screen.findByRole('heading', { name: /Lactancia 2/ });

    // Un parto sin grado declarado se cuenta aparte, no como normal: escribir
    // "parió sola" acá sería la misma mentira, del lado de la pantalla.
    expect(screen.queryByText(/ayuda al parir/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/condición corporal al parto/i)).not.toBeInTheDocument();
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
