// El alta: la única carga que crea la fila del animal, y por eso tiene pantalla
// propia. Lo que se prueba es qué arma el formulario — sobre todo qué **no**
// manda cuando los campos opcionales quedan vacíos.

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { anotarFechaDeLaRespuesta } from '../src/reloj';
import { aRodeo, aTablero } from '../src/ruteo';
import { montarApi, type ApiFalsa, type Manejador } from './servidor';
import { EST, HOY, V102, animal102, animales, establecimiento, eventos102, sesionDePrueba } from './fixtures';

const RUTA_POST = `POST /establecimientos/${EST}/animales`;
const NUEVO = '99999999-9999-9999-9999-999999999999';

function montarAlta(cambios: Record<string, Manejador> = {}): ApiFalsa {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = '#/alta';
  anotarFechaDeLaRespuesta({ fecha: HOY });
  return montarApi({
    ...sesionDePrueba(),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    [`GET /establecimientos/${EST}/animales`]: { cuerpo: animales },
    [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: eventos102 },
    [RUTA_POST]: {
      status: 201,
      cuerpo: {
        animal_id: NUEVO,
        caravana: '201',
        evento_alta_id: 'alta-1',
        proyeccion: animal102.proyeccion,
      },
    },
    ...cambios,
  });
}

const mandado = (falsa: ApiFalsa) => falsa.cuerpoDe(RUTA_POST) as Record<string, unknown>;

describe('el alta mínima', () => {
  it('caravana y fecha alcanzan: lo opcional no viaja vacío', async () => {
    const falsa = montarAlta();
    render(<App />);

    await userEvent.type(await screen.findByLabelText('Caravana'), '201');
    await userEvent.click(screen.getByRole('button', { name: 'Dar de alta' }));

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    expect(mandado(falsa)).toEqual({
      caravana: '201',
      fecha_evento: HOY,
      observaciones: null,
    });
    // Sin `payload`: un objeto vacío diría "declaro que no sé nada", y no es lo
    // mismo que no declarar nada.
    expect(mandado(falsa)['payload']).toBeUndefined();
  });

  it('lleva a la ficha del animal recién creado, con el origen puesto', async () => {
    montarAlta();
    render(<App />);

    await userEvent.type(await screen.findByLabelText('Caravana'), '201');
    await userEvent.click(screen.getByRole('button', { name: 'Dar de alta' }));

    // Con el `de=` del tablero, que es de donde se entra al alta. Sin él la ficha
    // nueva caía en su default —el rodeo— y volver al tablero costaba pasar por
    // una lista de doscientas.
    await waitFor(() =>
      expect(window.location.hash).toBe(`#/animales/${NUEVO}?de=${encodeURIComponent(aTablero())}`),
    );
  });

  it('y el origen que conserva es con el que se abrió el alta, no el default', async () => {
    montarAlta();
    window.location.hash = `#/alta?de=${encodeURIComponent(aRodeo())}`;
    render(<App />);

    await userEvent.type(await screen.findByLabelText('Caravana'), '201');
    await userEvent.click(screen.getByRole('button', { name: 'Dar de alta' }));

    await waitFor(() =>
      expect(window.location.hash).toBe(`#/animales/${NUEVO}?de=${encodeURIComponent(aRodeo())}`),
    );
  });

  it('una caravana en uso muestra el mensaje de la API tal cual', async () => {
    const mensaje = 'La caravana 102 ya está en uso por otro animal activo del establecimiento.';
    montarAlta({
      [RUTA_POST]: { status: 409, cuerpo: { codigo: 'CARAVANA_EN_USO', mensaje, forzable: false } },
    });
    render(<App />);

    await userEvent.type(await screen.findByLabelText('Caravana'), '102');
    await userEvent.click(screen.getByRole('button', { name: 'Dar de alta' }));

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar igual' })).not.toBeInTheDocument();
  });
});

describe('el estado inicial', () => {
  it('está plegado, porque el alta común es una ternera del tambo', async () => {
    montarAlta();
    render(<App />);
    await screen.findByLabelText('Caravana');

    expect(screen.queryByLabelText('Reproductivo')).not.toBeInTheDocument();
  });

  it('desplegado, manda solo los campos que se llenaron', async () => {
    const falsa = montarAlta();
    render(<App />);

    await userEvent.type(await screen.findByLabelText('Caravana'), '201');
    await userEvent.click(screen.getByLabelText('Cargar su estado inicial'));
    await userEvent.selectOptions(screen.getByLabelText('Reproductivo'), 'PRENADA');
    await userEvent.type(screen.getByLabelText('Lactancias que ya cursó'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Dar de alta' }));

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    expect(mandado(falsa)['payload']).toEqual({
      estado_inicial: { reproductivo: 'PRENADA', numero_lactancia: 3 },
    });
  });
});

describe('la cría del rodeo', () => {
  it('la madre y el parto se eligen de listas, no se tipean uuids', async () => {
    const falsa = montarAlta();
    render(<App />);

    await userEvent.type(await screen.findByLabelText('Caravana'), '201');
    await userEvent.click(screen.getByLabelText('Es cría de una vaca del rodeo'));

    // La madre sale del rodeo, con su caravana.
    const madre = await screen.findByLabelText('Madre');
    await userEvent.selectOptions(madre, V102);

    // Y el parto, del log de esa madre, ya filtrado a los partos vigentes.
    const parto = await screen.findByLabelText('Parto del que salió');
    expect([...parto.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Elegí el parto',
      '13/01/2026',
    ]);
    await userEvent.selectOptions(parto, 'e102-3');
    await userEvent.click(screen.getByRole('button', { name: 'Dar de alta' }));

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    expect(mandado(falsa)['payload']).toEqual({
      madre_id: V102,
      parto_evento_id: 'e102-3',
    });
  });

  it('el rodeo y los partos solo se piden si se marca la casilla', async () => {
    const falsa = montarAlta();
    render(<App />);
    await screen.findByLabelText('Caravana');

    expect(falsa.pedidos.map((p) => p.ruta)).not.toContain(`/establecimientos/${EST}/animales`);

    await userEvent.click(screen.getByLabelText('Es cría de una vaca del rodeo'));
    await waitFor(() =>
      expect(falsa.pedidos.map((p) => p.ruta)).toContain(`/establecimientos/${EST}/animales`),
    );
  });
});
