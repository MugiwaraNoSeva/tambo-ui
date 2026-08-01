// La carga de un evento, y el flujo del rechazo — que es el único lugar donde
// la UI "sabe" algo de dominio: que un rechazo forzable se puede confirmar
// (decisión 50).
//
// Lo que se prueba es **qué manda el formulario** y **qué hace con lo que la API
// contesta**. Si el celo era válido o no lo deciden 237 tests del otro lado.

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { anotarFechaDeLaRespuesta } from '../src/reloj';
import { aCargar, aTablero } from '../src/ruteo';
import { montarApi, type ApiFalsa, type Manejador } from './servidor';
import {
  EST,
  HOY,
  V102,
  animal102,
  establecimiento,
  rechazoForzable,
  rechazoNoForzable,
  rutasDelTablero,
  sesionDePrueba,
} from './fixtures';

const RUTA_POST = `POST /establecimientos/${EST}/animales/${V102}/eventos`;

function montarCarga(cambios: Record<string, Manejador> = {}): ApiFalsa {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = `#/animales/${V102}/cargar`;
  // Se llega acá desde el tablero o desde la ficha, y esas pantallas ya vieron
  // el `hoy` del servidor. Se simula eso mismo en vez de dejar que el default
  // caiga en el reloj del dispositivo, que haría al test depender del día en
  // que se corre (decisión 62).
  anotarFechaDeLaRespuesta({ fecha: HOY });
  return montarApi({
    ...sesionDePrueba(),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    [`GET /establecimientos/${EST}/animales/${V102}`]: { cuerpo: animal102 },
    [RUTA_POST]: { status: 201, cuerpo: { evento_id: 'nuevo', proyeccion: animal102.proyeccion } },
    ...cambios,
  });
}

/** Lo último que se mandó al POST de eventos. */
const mandado = (falsa: ApiFalsa): Record<string, unknown> =>
  falsa.cuerpoDe(RUTA_POST) as Record<string, unknown>;

const esperarFormulario = () => screen.findByLabelText('Tipo de evento');

describe('el formulario', () => {
  it('propone hoy y manda el tipo con su fecha', async () => {
    const falsa = montarCarga();
    render(<App />);
    await esperarFormulario();

    // La fecha por default sale del `fecha` que trajo una respuesta de la API,
    // no del reloj del celular (decisiones 52 y 62).
    expect(screen.getByLabelText('Cuándo')).toHaveValue(HOY);

    await userEvent.selectOptions(screen.getByLabelText('Tipo de evento'), 'celo');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar el evento' }));

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    expect(mandado(falsa)['tipo']).toBe('celo');
    expect(mandado(falsa)['fecha_evento']).toBe(HOY);
    expect(mandado(falsa)['forzado']).toBeUndefined();
  });

  it('el payload de la inseminación lleva toro, pajuela e IATF', async () => {
    const falsa = montarCarga();
    render(<App />);
    await esperarFormulario();

    await userEvent.selectOptions(screen.getByLabelText('Tipo de evento'), 'inseminacion');
    await userEvent.type(screen.getByLabelText('Toro'), 'Urubó');
    await userEvent.type(screen.getByLabelText('Pajuela'), 'HOL-4521');
    await userEvent.click(screen.getByLabelText(/tiempo fijo/i));
    await userEvent.click(screen.getByRole('button', { name: 'Cargar el evento' }));

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    expect(mandado(falsa)['payload']).toEqual({
      iatf: true,
      toro: 'Urubó',
      pajuela: 'HOL-4521',
    });
  });

  it('el parto junta las crías, y la melliza es un botón', async () => {
    const falsa = montarCarga();
    render(<App />);
    await esperarFormulario();

    await userEvent.selectOptions(screen.getByLabelText('Tipo de evento'), 'parto');
    await userEvent.selectOptions(screen.getByLabelText('Cría 1 — sexo'), 'macho');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar melliza' }));
    await userEvent.selectOptions(screen.getByLabelText('Cría 2 — sexo'), 'hembra');
    await userEvent.selectOptions(screen.getAllByLabelText('Resultado')[1] as HTMLElement, 'muerta');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar el evento' }));

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    expect(mandado(falsa)['payload']).toEqual({
      crias: [
        { sexo: 'macho', resultado: 'viva' },
        { sexo: 'hembra', resultado: 'muerta' },
      ],
    });
  });

  it('el control lechero manda los opcionales solo si se llenaron', async () => {
    const falsa = montarCarga();
    render(<App />);
    await esperarFormulario();

    await userEvent.selectOptions(screen.getByLabelText('Tipo de evento'), 'control_lechero');
    await userEvent.type(screen.getByLabelText('Litros del día'), '24.5');
    await userEvent.type(screen.getByLabelText('RCS (miles/ml)'), '160');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar el evento' }));

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    // Sin grasa ni proteína: un campo vacío no viaja como 0, que sería decir que
    // se midió y dio cero.
    expect(mandado(falsa)['payload']).toEqual({ litros: 24.5, rcs: 160 });
  });

  it('vuelve a la ficha cuando la carga entra', async () => {
    montarCarga();
    render(<App />);
    await esperarFormulario();

    await userEvent.click(screen.getByRole('button', { name: 'Cargar el evento' }));

    await waitFor(() => expect(window.location.hash).toBe(`#/animales/${V102}`));
  });
});

describe('el flujo del rechazo', () => {
  it('muestra el mensaje del núcleo tal cual, con su código', async () => {
    montarCarga({ [RUTA_POST]: { status: 422, cuerpo: rechazoNoForzable } });
    render(<App />);
    await esperarFormulario();

    await userEvent.click(screen.getByRole('button', { name: 'Cargar el evento' }));

    expect(await screen.findByText(rechazoNoForzable.mensaje)).toBeInTheDocument();
    expect(screen.getByText('SIN_LACTANCIA_ABIERTA')).toBeInTheDocument();
    // No forzable: no se ofrece un botón que la API va a rechazar igual.
    expect(screen.queryByRole('button', { name: 'Confirmar igual' })).not.toBeInTheDocument();
    // Y no se navegó a ningún lado: el formulario sigue con lo cargado.
    expect(window.location.hash).toBe(`#/animales/${V102}/cargar`);
  });

  it('un rechazo forzable ofrece "Confirmar igual" y reenvía con forzado y observaciones', async () => {
    let intentos = 0;
    const falsa = montarCarga({
      [RUTA_POST]: () => {
        intentos += 1;
        return intentos === 1
          ? { status: 422, cuerpo: rechazoForzable }
          : { status: 201, cuerpo: { evento_id: 'nuevo', proyeccion: animal102.proyeccion } };
      },
    });
    render(<App />);
    await esperarFormulario();

    await userEvent.selectOptions(screen.getByLabelText('Tipo de evento'), 'inseminacion');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar el evento' }));

    expect(await screen.findByText(rechazoForzable.mensaje)).toBeInTheDocument();
    const confirmar = screen.getByRole('button', { name: 'Confirmar igual' });
    // Sin observaciones no se puede: la API las va a exigir igual.
    expect(confirmar).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText('Por qué se carga igual'),
      'La vi en celo ayer y no lo anoté.',
    );
    expect(confirmar).toBeEnabled();
    await userEvent.click(confirmar);

    await waitFor(() => expect(window.location.hash).toBe(`#/animales/${V102}`));
    const cuerpo = mandado(falsa);
    expect(cuerpo['forzado']).toBe(true);
    expect(cuerpo['observaciones']).toBe('La vi en celo ayer y no lo anoté.');
    // Y es el MISMO evento: mismo tipo y mismo payload que el rechazado.
    expect(cuerpo['tipo']).toBe('inseminacion');
  });

  it('el reintento va con el mismo id, así un corte de red no duplica el evento', async () => {
    let intentos = 0;
    const falsa = montarCarga({
      [RUTA_POST]: () => {
        intentos += 1;
        return intentos === 1
          ? { status: 422, cuerpo: rechazoForzable }
          : { status: 201, cuerpo: { evento_id: 'nuevo', proyeccion: animal102.proyeccion } };
      },
    });
    render(<App />);
    await esperarFormulario();

    await userEvent.click(screen.getByRole('button', { name: 'Cargar el evento' }));
    await screen.findByText(rechazoForzable.mensaje);
    await userEvent.type(screen.getByLabelText('Por qué se carga igual'), 'Pasó igual.');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar igual' }));
    await waitFor(() => expect(window.location.hash).toBe(`#/animales/${V102}`));

    const posts = falsa.pedidos.filter((p) => p.metodo === 'POST');
    const ids = posts.map((p) => (p.cuerpo as Record<string, unknown>)['id']);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[0]).toEqual(expect.any(String));
  });

  it('si la red se cae, lo dice sin inventar un código de dominio', async () => {
    montarCarga({
      [RUTA_POST]: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    render(<App />);
    await esperarFormulario();

    await userEvent.click(screen.getByRole('button', { name: 'Cargar el evento' }));

    expect(await screen.findByText(/no se pudo hablar con el servidor/i)).toBeInTheDocument();
    expect(screen.getByText('SIN_RESPUESTA')).toBeInTheDocument();
  });
});

// ── Lo que la Parte 3 le sacó de encima a esta pantalla ──────────────────────

/** La misma carga, pero llegando como llega de verdad: desde una lista o la ficha. */
function montarCargaDesde(hash: string, cambios: Record<string, Manejador> = {}): ApiFalsa {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = hash;
  anotarFechaDeLaRespuesta({ fecha: HOY });
  return montarApi({
    ...sesionDePrueba(),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    [`GET /establecimientos/${EST}/animales/${V102}`]: { cuerpo: animal102 },
    [RUTA_POST]: { status: 201, cuerpo: { evento_id: 'nuevo', proyeccion: animal102.proyeccion } },
    ...cambios,
  });
}

describe('lo que ya sabía quien la abrió', () => {
  it('con la caravana en la dirección, no pide el animal', async () => {
    // Antes esta pantalla traía la proyección entera —el estado, los ciclos, la
    // genealogía— para escribir un número en el encabezado.
    const falsa = montarCargaDesde(aCargar(V102, { desde: aTablero(), caravana: '102' }));
    render(<App />);
    await esperarFormulario();

    expect(screen.getByRole('heading', { name: 'Cargar — 102' })).toBeInTheDocument();
    const delAnimal = falsa.pedidos.filter((p) => p.ruta.endsWith(`/animales/${V102}`));
    expect(delAnimal).toHaveLength(0);
  });

  it('sin caravana la va a buscar: un enlace pelado sigue andando', async () => {
    const falsa = montarCargaDesde(`#/animales/${V102}/cargar`);
    render(<App />);
    await esperarFormulario();

    expect(screen.getByRole('heading', { name: 'Cargar — 102' })).toBeInTheDocument();
    expect(falsa.pedidos.filter((p) => p.ruta.endsWith(`/animales/${V102}`))).toHaveLength(1);
  });

  it('vuelve a donde se vino, que no siempre es la ficha', async () => {
    // Quien entró por el atajo de una lista de trabajo vuelve a la lista, ya sin
    // el animal que acaba de cargar — y no a la ficha, que sería un desvío.
    montarCargaDesde(aCargar(V102, { desde: aTablero(), caravana: '102' }), {
      ...rutasDelTablero,
    });
    render(<App />);
    await esperarFormulario();

    await userEvent.click(screen.getByRole('button', { name: 'Cargar el evento' }));

    await waitFor(() => expect(window.location.hash).toBe(aTablero()));
  });

  it('la flecha de volver apunta a lo mismo', async () => {
    montarCargaDesde(aCargar(V102, { desde: aTablero(), caravana: '102' }));
    render(<App />);
    await esperarFormulario();

    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', aTablero());
  });
});

describe('la fecha, a un toque', () => {
  it('"Ayer" la cambia sin abrir el calendario', async () => {
    const falsa = montarCargaDesde(aCargar(V102, { caravana: '102' }));
    render(<App />);
    await esperarFormulario();

    // Arranca en hoy, y eso se dice con `aria-pressed` y no solo con color.
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Ayer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cargar el evento' }));

    await waitFor(() => expect(mandado(falsa)['fecha_evento']).toBe('2026-07-28'));
  });

  it('una fecha de hace tres días no deja ninguno de los dos puesto', async () => {
    montarCargaDesde(aCargar(V102, { caravana: '102' }));
    render(<App />);
    await esperarFormulario();

    // Es la diferencia con un segmentado, que obligaría a que uno esté elegido.
    await userEvent.clear(screen.getByLabelText('Cuándo'));
    await userEvent.type(screen.getByLabelText('Cuándo'), '2026-07-26');

    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Ayer' })).toHaveAttribute('aria-pressed', 'false');
  });
});
