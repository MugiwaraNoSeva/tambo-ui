// Anular desde el historial. Es la corrección como manda el event sourcing: no
// se edita ni se borra nada, se carga una anulación y el original queda con su
// marca.

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { montarApi, type ApiFalsa, type Manejador } from './servidor';
import {
  EST,
  V102,
  animal102,
  establecimiento,
  eventos102,
  eventos105,
  kpis102,
  sesionDePrueba,
} from './fixtures';

const RUTA_POST = `POST /establecimientos/${EST}/animales/${V102}/eventos`;

function montarFicha(cambios: Record<string, Manejador> = {}): ApiFalsa {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = `#/animales/${V102}`;
  return montarApi({
    ...sesionDePrueba(),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    [`GET /establecimientos/${EST}/animales/${V102}`]: { cuerpo: animal102 },
    [`GET /establecimientos/${EST}/animales/${V102}/kpis`]: { cuerpo: kpis102 },
    [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: eventos102 },
    [RUTA_POST]: { status: 201, cuerpo: { evento_id: 'anul', proyeccion: animal102.proyeccion } },
    ...cambios,
  });
}

const esperarHistorial = () => screen.findByText(/toro Urubó/);
const filas = () => [...document.querySelectorAll('.historial > li')];

describe('el botón de anular', () => {
  it('aparece solo en el último evento vigente (§3.5: orden inverso)', async () => {
    montarFicha();
    render(<App />);
    await esperarHistorial();

    const botones = screen.getAllByRole('button', { name: 'Anular este evento' });
    expect(botones).toHaveLength(1);
    // Y está en el primero de la lista, que es el último que ocurrió.
    expect(filas()[0]?.textContent).toContain('Control lechero');
    expect(filas()[0]?.querySelector('button')?.textContent).toBe('Anular este evento');
  });

  it('salta los anulados y las anulaciones para elegir el último vigente', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: eventos105 },
    });
    render(<App />);
    await screen.findByText(/fecha equivocada al pasar de la libreta/i);

    // El log termina en una anulación (vigente: false) y tiene un celo anulado.
    // El último vigente es la inseminación del 21/07.
    const conBoton = filas().find((f) => f.querySelector('button') !== null);
    expect(conBoton?.textContent).toContain('21/07/2026 — Inseminación');
    expect(screen.getAllByRole('button', { name: 'Anular este evento' })).toHaveLength(1);
  });
});

describe('anular', () => {
  it('pide observaciones y manda una anulación con el id del evento', async () => {
    const falsa = montarFicha();
    render(<App />);
    await esperarHistorial();

    await userEvent.click(screen.getByRole('button', { name: 'Anular este evento' }));

    const anular = screen.getByRole('button', { name: 'Anular' });
    expect(anular).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText('Por qué se anula'),
      'Los litros eran de la 103.',
    );
    expect(anular).toBeEnabled();
    await userEvent.click(anular);

    await waitFor(() => expect(falsa.cuerpoDe(RUTA_POST)).toBeDefined());
    expect(falsa.cuerpoDe(RUTA_POST)).toEqual({
      // Con su id, como cualquier carga: una anulación reintentada después de un
      // corte de red vuelve como EVENTO_DUPLICADO (decisión 67).
      id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      ),
      tipo: 'anulacion',
      payload: { evento_anulado_id: 'e102-4' },
      observaciones: 'Los litros eran de la 103.',
    });
  });

  it('después de anular vuelve a pedir toda la ficha, no solo el historial', async () => {
    const falsa = montarFicha();
    render(<App />);
    await esperarHistorial();
    const antes = falsa.pedidos.filter((p) => p.metodo === 'GET').length;

    await userEvent.click(screen.getByRole('button', { name: 'Anular este evento' }));
    await userEvent.type(screen.getByLabelText('Por qué se anula'), 'Estaba mal.');
    await userEvent.click(screen.getByRole('button', { name: 'Anular' }));

    // Estado y log: una anulación los mueve a los dos, y la proyección la
    // calcula el servidor (no hay caché optimista).
    //
    // **Dos y no cuatro desde la Parte 3**: los números y la lactancia también
    // cambian con una anulación, pero viven en tarjetas que no se pidieron
    // todavía. Refrescar lo que nadie abrió sería pagar dos viajes para tirar el
    // resultado; cuando alguien las abra van a traer lo de después de anular,
    // que es justamente lo que corresponde.
    await waitFor(() =>
      expect(falsa.pedidos.filter((p) => p.metodo === 'GET').length).toBe(antes + 2),
    );
  });

  it('si la API dice que no era el último, muestra su mensaje tal cual', async () => {
    const mensaje =
      'Solo se puede anular el último evento vigente del animal. Anulá primero los posteriores, ' +
      'en orden inverso al que se cargaron.';
    montarFicha({
      [RUTA_POST]: { status: 422, cuerpo: { codigo: 'ANULACION_INVALIDA', mensaje, forzable: false } },
    });
    render(<App />);
    await esperarHistorial();

    await userEvent.click(screen.getByRole('button', { name: 'Anular este evento' }));
    await userEvent.type(screen.getByLabelText('Por qué se anula'), 'Me equivoqué.');
    await userEvent.click(screen.getByRole('button', { name: 'Anular' }));

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(screen.getByText('ANULACION_INVALIDA')).toBeInTheDocument();
    // Una anulación no es forzable: no se ofrece insistir.
    expect(screen.queryByRole('button', { name: 'Confirmar igual' })).not.toBeInTheDocument();
  });

  it('cancelar cierra el formulario sin mandar nada', async () => {
    const falsa = montarFicha();
    render(<App />);
    await esperarHistorial();

    await userEvent.click(screen.getByRole('button', { name: 'Anular este evento' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByLabelText('Por qué se anula')).not.toBeInTheDocument();
    expect(falsa.pedidos.some((p) => p.metodo === 'POST')).toBe(false);
  });
});
