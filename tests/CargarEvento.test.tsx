// La carga de un evento: el menú de los nueve tipos, el formulario de cada uno,
// y el flujo del rechazo — que es el único lugar donde la UI "sabe" algo de
// dominio: que un rechazo forzable se puede confirmar (decisión 50).
//
// Lo que se prueba es **qué manda el formulario** y **qué hace con lo que la API
// contesta**. Si el celo era válido o no lo deciden 237 tests del otro lado.
//
// Desde que la pantalla se partió en dos, se prueba además la puerta: que el
// menú liste los nueve, que cada uno lleve a su ruta, y que un `:tipo` que no se
// entiende caiga en el menú en vez de romper.

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import type { TipoEvento } from '../src/api/tipos';
import { anotarFechaDeLaRespuesta } from '../src/reloj';
import { aCargar, aTablero } from '../src/ruteo';
import { montarApi, type ApiFalsa, type Manejador } from './servidor';
import {
  EST,
  HOY,
  V102,
  V104,
  animal102,
  establecimiento,
  rechazoForzable,
  rechazoNoForzable,
  rutasDelTablero,
  sesionDePrueba,
  usuarioLectura,
} from './fixtures';

const RUTA_POST = `POST /establecimientos/${EST}/animales/${V102}/eventos`;

/** La carga, llegando como llega de verdad: con la caravana y el origen puestos. */
function montarCarga(hash: string, cambios: Record<string, Manejador> = {}): ApiFalsa {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = hash;
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

/** El formulario de un tipo, abierto derecho y con el origen en el tablero. */
const montarTipo = (tipo: TipoEvento, cambios: Record<string, Manejador> = {}): ApiFalsa =>
  montarCarga(aCargar(V102, { tipo, desde: aTablero(), caravana: '102' }), cambios);

const menu = aCargar(V102, { desde: aTablero(), caravana: '102' });

/** Lo último que se mandó al POST de eventos. */
const mandado = (falsa: ApiFalsa): Record<string, unknown> =>
  falsa.cuerpoDe(RUTA_POST) as Record<string, unknown>;

describe('el menú de los nueve tipos', () => {
  it('los lista a los nueve, agrupados y en el orden del trabajo', async () => {
    montarCarga(menu);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Cargarle a 102' })).toBeInTheDocument();
    const entradas = [...document.querySelectorAll('.indice .fila strong')].map(
      (e) => e.textContent,
    );
    expect(entradas).toEqual([
      'Celo',
      'Inseminación',
      'Tacto positivo',
      'Tacto negativo',
      'Parto',
      'Aborto',
      'Control lechero',
      'Secado',
      'Baja',
    ]);
    // Los tres grupos, con su título.
    expect(screen.getByRole('heading', { name: 'Reproducción' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Producción' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Salida' })).toBeInTheDocument();
  });

  it('cada entrada dice qué es en un renglón', async () => {
    // Sin el renglón, "Tacto positivo" y "Tacto negativo" son dos puertas iguales
    // y hay que abrirlas para saber cuál es cuál.
    montarCarga(menu);
    render(<App />);
    await screen.findByRole('heading', { name: 'Cargarle a 102' });

    expect(screen.getByRole('link', { name: /^Tacto positivo/ })).toHaveTextContent('Preñada');
    expect(screen.getByRole('link', { name: /^Tacto negativo/ })).toHaveTextContent('Vacía');
    expect(screen.getByRole('link', { name: /^Parto/ })).toHaveTextContent(
      'Las crías, con su sexo y su resultado',
    );
  });

  it('cada uno lleva a su ruta, con el origen y la caravana adentro', async () => {
    montarCarga(menu);
    render(<App />);
    await screen.findByRole('heading', { name: 'Cargarle a 102' });

    // El origen viaja en el enlace: el formulario tiene que saber a dónde volver
    // al terminar, y no es este menú.
    expect(screen.getByRole('link', { name: /^Parto/ })).toHaveAttribute(
      'href',
      aCargar(V102, { tipo: 'parto', desde: aTablero(), caravana: '102' }),
    );
    expect(screen.getByRole('link', { name: /^Control lechero/ })).toHaveAttribute(
      'href',
      aCargar(V102, { tipo: 'control_lechero', desde: aTablero(), caravana: '102' }),
    );
  });

  it('un `:tipo` que no se entiende cae en el menú, no en un error', async () => {
    // Mismo criterio con que `deParametros` descarta un filtro desconocido: un
    // cartel de "eso no existe" para una dirección mal tipeada no le sirve a
    // nadie, y de acá se sale eligiendo.
    montarCarga(`#/animales/${V102}/cargar/tacto_de_verano?c=102`);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Cargarle a 102' })).toBeInTheDocument();
  });

  it('la flecha del menú vuelve al origen', async () => {
    montarCarga(menu);
    render(<App />);
    await screen.findByRole('heading', { name: 'Cargarle a 102' });

    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', aTablero());
  });

  it('el atajo ＋ de una fila del rodeo llega al menú', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    window.location.hash = aTablero();
    montarApi({
      ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
    });
    render(<App />);

    const atajo = await screen.findByRole('link', { name: /Cargar un evento a 104/ });
    await userEvent.click(atajo);

    // Y llega con la caravana puesta, así que el menú no pide el animal.
    expect(await screen.findByRole('heading', { name: 'Cargarle a 104' })).toBeInTheDocument();
    expect(window.location.hash).toBe(aCargar(V104, { desde: aTablero(), caravana: '104' }));
  });
});

describe('los formularios por tipo', () => {
  it('el celo es fecha y observaciones: no tiene un campo más', async () => {
    const falsa = montarTipo('celo');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Celo — 102' })).toBeInTheDocument();
    // La fecha por default sale del `fecha` que trajo una respuesta de la API,
    // no del reloj del celular (decisiones 52 y 62).
    expect(screen.getByLabelText('Cuándo')).toHaveValue(HOY);
    // Los dos campos y nada más: se acabaron los condicionales de los otros ocho.
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryByLabelText('Toro')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Litros del día')).not.toBeInTheDocument();
    // Y el desplegable de nueve tipos ya no existe en ningún lado.
    expect(screen.queryByLabelText('Tipo de evento')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cargar el celo' }));

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    expect(mandado(falsa)['tipo']).toBe('celo');
    expect(mandado(falsa)['fecha_evento']).toBe(HOY);
    expect(mandado(falsa)['payload']).toEqual({});
    expect(mandado(falsa)['forzado']).toBeUndefined();
  });

  it.each([
    ['tacto_positivo', 'Tacto positivo — 102', 'Cargar el tacto'],
    ['tacto_negativo', 'Tacto negativo — 102', 'Cargar el tacto'],
    ['aborto', 'Aborto — 102', 'Cargar el aborto'],
    ['secado', 'Secado — 102', 'Cargar el secado'],
  ] as const)('%s comparte el mismo componente, con su título y su botón', async (
    tipo,
    titulo,
    boton,
  ) => {
    // Cinco de los nueve no llevan payload. Cinco pantallas idénticas con el
    // título cambiado serían cinco lugares donde arreglar lo mismo.
    const falsa = montarTipo(tipo);
    render(<App />);

    expect(await screen.findByRole('heading', { name: titulo })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: boton }));

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    expect(mandado(falsa)['tipo']).toBe(tipo);
    expect(mandado(falsa)['payload']).toEqual({});
  });

  it('el payload de la inseminación lleva toro, pajuela e IATF', async () => {
    const falsa = montarTipo('inseminacion');
    render(<App />);
    await screen.findByRole('heading', { name: 'Inseminación — 102' });

    await userEvent.type(screen.getByLabelText('Toro'), 'Urubó');
    await userEvent.type(screen.getByLabelText('Pajuela'), 'HOL-4521');
    await userEvent.click(screen.getByLabelText(/tiempo fijo/i));
    await userEvent.click(screen.getByRole('button', { name: 'Cargar la inseminación' }));

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    expect(mandado(falsa)['payload']).toEqual({
      iatf: true,
      toro: 'Urubó',
      pajuela: 'HOL-4521',
    });
  });

  it('el parto junta las crías, y la melliza es un botón', async () => {
    const falsa = montarTipo('parto');
    render(<App />);
    await screen.findByRole('heading', { name: 'Parto — 102' });

    await userEvent.selectOptions(screen.getByLabelText('Cría 1 — sexo'), 'macho');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar melliza' }));
    await userEvent.selectOptions(screen.getByLabelText('Cría 2 — sexo'), 'hembra');
    await userEvent.selectOptions(screen.getAllByLabelText('Resultado')[1] as HTMLElement, 'muerta');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar el parto' }));

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    expect(mandado(falsa)['payload']).toEqual({
      crias: [
        { sexo: 'macho', resultado: 'viva' },
        { sexo: 'hembra', resultado: 'muerta' },
      ],
    });
  });

  it('el control lechero manda los opcionales solo si se llenaron', async () => {
    const falsa = montarTipo('control_lechero');
    render(<App />);
    await screen.findByRole('heading', { name: 'Control lechero — 102' });

    await userEvent.type(screen.getByLabelText('Litros del día'), '24.5');
    await userEvent.type(screen.getByLabelText('RCS (miles/ml)'), '160');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar el control' }));

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    // Sin grasa ni proteína: un campo vacío no viaja como 0, que sería decir que
    // se midió y dio cero.
    expect(mandado(falsa)['payload']).toEqual({ litros: 24.5, rcs: 160 });
  });

  it('la baja manda su motivo, y su botón es el de peligro', async () => {
    const falsa = montarTipo('baja');
    render(<App />);
    await screen.findByRole('heading', { name: 'Baja — 102' });

    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'muerte');
    const boton = screen.getByRole('button', { name: 'Dar de baja' });
    // Lo que hace no se parece a lo demás y el color lo dice — junto con la
    // palabra, que sigue siendo la señal que manda.
    expect(boton.className).toContain('peligro');
    await userEvent.click(boton);

    await waitFor(() => expect(mandado(falsa)).toBeDefined());
    expect(mandado(falsa)['payload']).toEqual({ motivo: 'muerte' });
  });

  it('la flecha del formulario vuelve al menú, con el origen adentro', async () => {
    // El paso que se deshace es "elegí mal el tipo", no "no quería cargar nada".
    montarTipo('parto');
    render(<App />);
    await screen.findByRole('heading', { name: 'Parto — 102' });

    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', menu);
  });

  it('al cargar se vuelve al origen, que no es el menú ni siempre la ficha', async () => {
    montarTipo('celo', { ...rutasDelTablero });
    render(<App />);
    await screen.findByRole('heading', { name: 'Celo — 102' });

    await userEvent.click(screen.getByRole('button', { name: 'Cargar el celo' }));

    await waitFor(() => expect(window.location.hash).toBe(aTablero()));
  });
});

describe('lo que ya sabía quien la abrió', () => {
  it('con la caravana en la dirección, no pide el animal', async () => {
    // Antes esta pantalla traía la proyección entera —el estado, los ciclos, la
    // genealogía— para escribir un número en el encabezado.
    const falsa = montarCarga(menu);
    render(<App />);
    await screen.findByRole('heading', { name: 'Cargarle a 102' });

    expect(falsa.pedidos.filter((p) => p.ruta.endsWith(`/animales/${V102}`))).toHaveLength(0);
  });

  it('sin caravana la va a buscar: un enlace pelado sigue andando', async () => {
    const falsa = montarCarga(`#/animales/${V102}/cargar`);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Cargarle a 102' })).toBeInTheDocument();
    expect(falsa.pedidos.filter((p) => p.ruta.endsWith(`/animales/${V102}`))).toHaveLength(1);
  });

  it('y un enlace pelado a un tipo también: cae en su formulario', async () => {
    montarCarga(`#/animales/${V102}/cargar/parto`);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Parto — 102' })).toBeInTheDocument();
  });
});

describe('la fecha, a un toque', () => {
  it('"Ayer" la cambia sin abrir el calendario', async () => {
    const falsa = montarTipo('celo');
    render(<App />);
    await screen.findByRole('heading', { name: 'Celo — 102' });

    // Arranca en hoy, y eso se dice con `aria-pressed` y no solo con color.
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Ayer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cargar el celo' }));

    await waitFor(() => expect(mandado(falsa)['fecha_evento']).toBe('2026-07-28'));
  });

  it('una fecha de hace tres días no deja ninguno de los dos puesto', async () => {
    montarTipo('celo');
    render(<App />);
    await screen.findByRole('heading', { name: 'Celo — 102' });

    // Es la diferencia con un segmentado, que obligaría a que uno esté elegido.
    await userEvent.clear(screen.getByLabelText('Cuándo'));
    await userEvent.type(screen.getByLabelText('Cuándo'), '2026-07-26');

    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Ayer' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('el flujo del rechazo', () => {
  it('muestra el mensaje del núcleo tal cual, con su código', async () => {
    montarTipo('celo', { [RUTA_POST]: { status: 422, cuerpo: rechazoNoForzable } });
    render(<App />);
    await screen.findByRole('heading', { name: 'Celo — 102' });

    await userEvent.click(screen.getByRole('button', { name: 'Cargar el celo' }));

    expect(await screen.findByText(rechazoNoForzable.mensaje)).toBeInTheDocument();
    expect(screen.getByText('SIN_LACTANCIA_ABIERTA')).toBeInTheDocument();
    // No forzable: no se ofrece un botón que la API va a rechazar igual.
    expect(screen.queryByRole('button', { name: 'Confirmar igual' })).not.toBeInTheDocument();
    // Y no se navegó a ningún lado: el formulario sigue con lo cargado.
    expect(window.location.hash).toBe(
      aCargar(V102, { tipo: 'celo', desde: aTablero(), caravana: '102' }),
    );
  });

  it('un rechazo forzable ofrece "Confirmar igual" y reenvía con forzado y observaciones', async () => {
    let intentos = 0;
    const falsa = montarTipo('inseminacion', {
      ...rutasDelTablero,
      [RUTA_POST]: () => {
        intentos += 1;
        return intentos === 1
          ? { status: 422, cuerpo: rechazoForzable }
          : { status: 201, cuerpo: { evento_id: 'nuevo', proyeccion: animal102.proyeccion } };
      },
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Inseminación — 102' });

    await userEvent.click(screen.getByRole('button', { name: 'Cargar la inseminación' }));

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

    await waitFor(() => expect(window.location.hash).toBe(aTablero()));
    const cuerpo = mandado(falsa);
    expect(cuerpo['forzado']).toBe(true);
    expect(cuerpo['observaciones']).toBe('La vi en celo ayer y no lo anoté.');
    // Y es el MISMO evento: mismo tipo que el rechazado.
    expect(cuerpo['tipo']).toBe('inseminacion');
  });

  it('el reintento va con el mismo id, así un corte de red no duplica el evento', async () => {
    let intentos = 0;
    const falsa = montarTipo('celo', {
      ...rutasDelTablero,
      [RUTA_POST]: () => {
        intentos += 1;
        return intentos === 1
          ? { status: 422, cuerpo: rechazoForzable }
          : { status: 201, cuerpo: { evento_id: 'nuevo', proyeccion: animal102.proyeccion } };
      },
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Celo — 102' });

    await userEvent.click(screen.getByRole('button', { name: 'Cargar el celo' }));
    await screen.findByText(rechazoForzable.mensaje);
    await userEvent.type(screen.getByLabelText('Por qué se carga igual'), 'Pasó igual.');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar igual' }));
    await waitFor(() => expect(window.location.hash).toBe(aTablero()));

    const posts = falsa.pedidos.filter((p) => p.metodo === 'POST');
    const ids = posts.map((p) => (p.cuerpo as Record<string, unknown>)['id']);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[0]).toEqual(expect.any(String));
  });

  it('si la red se cae, lo dice sin inventar un código de dominio', async () => {
    montarTipo('celo', {
      [RUTA_POST]: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Celo — 102' });

    await userEvent.click(screen.getByRole('button', { name: 'Cargar el celo' }));

    expect(await screen.findByText(/no se pudo hablar con el servidor/i)).toBeInTheDocument();
    expect(screen.getByText('SIN_RESPUESTA')).toBeInTheDocument();
  });
});

describe('el de lectura', () => {
  it('ni el menú ni un formulario: un renglón que explica por qué no puede', async () => {
    // Lo mismo que ya pasaba antes de partir la pantalla, y con las dos puertas.
    for (const hash of [menu, aCargar(V102, { tipo: 'parto', caravana: '102' })]) {
      window.localStorage.setItem('tambo.establecimiento', EST);
      window.location.hash = hash;
      montarApi({
        ...sesionDePrueba(usuarioLectura),
        [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      });
      const { unmount } = render(<App />);

      expect(
        await screen.findByText(/no podés cargar eventos en este tambo/i),
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Cargarle a/ })).not.toBeInTheDocument();
      unmount();
    }
  });
});
