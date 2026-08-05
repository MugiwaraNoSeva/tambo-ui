// Anular desde el historial. Es la corrección como manda el event sourcing: no
// se edita ni se borra nada, se carga una anulación y el original queda con su
// marca.
//
// **Estos tests cambiaron de premisa con la decisión 101.** Antes afirmaban que
// el botón aparecía en un solo evento —el último vigente, porque la regla era
// LIFO— y esa afirmación era correcta cuando se escribió. Ahora la anulación se
// juzga por consecuencia: se pliega el log sin ese evento y se mira si sigue
// siendo válido. Un control lechero de hace tres meses se puede anular, porque no
// habilitó a nada; el celo que precede a una inseminación, no.
//
// Lo que la UI no hace —y estos tests lo fijan— es adivinar cuál de las dos cosas
// es. Ofrece el botón en todo lo vigente y deja que conteste la API, que ahora
// además explica qué habría que resolver primero.

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
const botonesDeAnular = () => screen.getAllByRole('button', { name: 'Anular este evento' });

/** El de arriba de todo: el último que ocurrió, que es por donde se empieza. */
const anularElPrimero = async () => {
  const botones = botonesDeAnular();
  await userEvent.click(botones[0] as HTMLElement);
};

describe('el botón de anular', () => {
  it('aparece en cada evento vigente, y no solo en el último (decisión 101)', async () => {
    montarFicha();
    render(<App />);
    await esperarHistorial();

    // Los cuatro del log de la 102 están vigentes, así que los cuatro se ofrecen.
    // Con el LIFO se ofrecía uno. Que la API acepte los cuatro es otra pregunta y
    // la contesta ella: acá lo que se fija es que la UI no adivine por posición.
    expect(botonesDeAnular()).toHaveLength(4);
    expect(filas()).toHaveLength(4);
    for (const fila of filas()) {
      expect(fila.querySelector('button')?.textContent).toBe('Anular este evento');
    }
  });

  it('no lo ofrece en los anulados ni en las anulaciones', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: eventos105 },
    });
    render(<App />);
    await screen.findByText(/fecha equivocada al pasar de la libreta/i);

    // Cinco eventos y tres botones: quedan afuera el celo anulado —deshacer lo ya
    // deshecho no significa nada— y la anulación misma, que se arregla volviendo a
    // cargar el evento y no anulando el meta-evento (decisión 101).
    expect(filas()).toHaveLength(5);
    expect(botonesDeAnular()).toHaveLength(3);

    const sinBoton = filas().filter((f) => f.querySelector('button') === null);
    expect(sinBoton).toHaveLength(2);
    expect(sinBoton.map((f) => f.textContent).join(' ')).toContain('Anulación');
    expect(sinBoton.map((f) => f.textContent).join(' ')).toContain('anulado');
  });
});

describe('anular', () => {
  it('pide observaciones y manda una anulación con el id del evento', async () => {
    const falsa = montarFicha();
    render(<App />);
    await esperarHistorial();

    await anularElPrimero();

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

  it('anula el evento de esa fila y no el último, que es lo que la 101 habilitó', async () => {
    const falsa = montarFicha();
    render(<App />);
    await esperarHistorial();

    // La última fila es la más vieja: el alta. Con el LIFO esto no se podía ni
    // intentar desde la pantalla, y es el caso que hace falta fijar — que el
    // formulario que se abre apunte al evento **de su renglón**.
    const botones = botonesDeAnular();
    await userEvent.click(botones[botones.length - 1] as HTMLElement);
    await userEvent.type(screen.getByLabelText('Por qué se anula'), 'El alta estaba duplicada.');
    await userEvent.click(screen.getByRole('button', { name: 'Anular' }));

    await waitFor(() => expect(falsa.cuerpoDe(RUTA_POST)).toBeDefined());
    expect((falsa.cuerpoDe(RUTA_POST) as { payload: unknown }).payload).toEqual({
      evento_anulado_id: 'e102-1',
    });
  });

  it('después de anular vuelve a pedir toda la ficha, no solo el historial', async () => {
    const falsa = montarFicha();
    render(<App />);
    await esperarHistorial();
    const antes = falsa.pedidos.filter((p) => p.metodo === 'GET').length;

    await anularElPrimero();
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

  it('si la anulación dejaría el log inválido, muestra qué habría que resolver primero', async () => {
    // El rechazo que reemplazó al `ANULACION_INVALIDA` por posición: mismo 409,
    // misma forma, y **con la lista** de lo que quedaría colgado. Es la mitad de
    // lo que hace que ahora convenga ofrecer el botón y dejar que la API conteste.
    const mensaje =
      'Anular este evento dejaría inválidos otros que se cargaron después. ' +
      'Resolvé primero los que se listan abajo.';
    montarFicha({
      [RUTA_POST]: {
        status: 409,
        cuerpo: {
          codigo: 'CONFLICTO_RETROACTIVO',
          mensaje,
          forzable: false,
          conflictos: [
            {
              evento_id: 'e102-3',
              codigo: 'TRANSICION_INVALIDA',
              mensaje: 'El parto del 13/01/2026 necesita que el animal esté preñado.',
            },
          ],
        },
      },
    });
    render(<App />);
    await esperarHistorial();

    await anularElPrimero();
    await userEvent.type(screen.getByLabelText('Por qué se anula'), 'Me equivoqué.');
    await userEvent.click(screen.getByRole('button', { name: 'Anular' }));

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(screen.getByText('CONFLICTO_RETROACTIVO')).toBeInTheDocument();
    // La lista, que es lo que convierte el "no" en algo accionable.
    expect(screen.getByText('Lo que quedaría inválido')).toBeInTheDocument();
    expect(
      screen.getByText('El parto del 13/01/2026 necesita que el animal esté preñado.'),
    ).toBeInTheDocument();
    // Y sigue sin ser forzable: forzarla dejaría el log inválido.
    expect(screen.queryByRole('button', { name: 'Confirmar igual' })).not.toBeInTheDocument();
  });

  it('cancelar cierra el formulario sin mandar nada', async () => {
    const falsa = montarFicha();
    render(<App />);
    await esperarHistorial();

    await anularElPrimero();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByLabelText('Por qué se anula')).not.toBeInTheDocument();
    expect(falsa.pedidos.some((p) => p.metodo === 'POST')).toBe(false);
  });
});
