// La corrida: un tipo de evento, muchos animales.
//
// Lo que hay que probar acá **no** es que un tacto sea válido —de eso hay 237
// tests en `mu/`— sino las cuatro decisiones que hacen que una corrida sea una
// corrida y no la pantalla de carga repetida: que la lista se congele, que un
// rechazo no la frene, que los pedidos vayan de a uno, y que la sesión caída
// corte la cola en vez de tirar veinte 401 seguidos.

import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { anotarFechaDeLaRespuesta } from '../src/reloj';
import type { RespuestaAlertas } from '../src/api/tipos';
import { montarApi, type ApiFalsa, type Manejador } from './servidor';
import {
  EST,
  HOY,
  V101,
  V103,
  V104,
  animal102,
  establecimiento,
  rechazoForzable,
  sesionDePrueba,
  usuarioLectura,
} from './fixtures';

/** Tres para revisar: con una sola no se ve que la corrida siga después de un rechazo. */
const tresParaRevisar: RespuestaAlertas = {
  fecha: HOY,
  para_revisar: [
    { animal_id: V104, caravana: '104' },
    { animal_id: V103, caravana: '103' },
    { animal_id: V101, caravana: '101' },
  ],
  para_secar: [],
};

const postDe = (animal: string) => `POST /establecimientos/${EST}/animales/${animal}/eventos`;

const CARGADO = {
  status: 201,
  cuerpo: { evento_id: 'nuevo', proyeccion: animal102.proyeccion },
};

function montarCorrida(cambios: Record<string, Manejador> = {}): ApiFalsa {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = '#/corrida/para-revisar';
  // Se llega desde el tablero, que ya vio el `hoy` del servidor. Se simula eso
  // en vez de dejar que el default caiga en el reloj del dispositivo, que haría
  // al test depender del día en que se corre (decisión 62).
  anotarFechaDeLaRespuesta({ fecha: HOY });
  return montarApi({
    ...sesionDePrueba(),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    [`GET /establecimientos/${EST}/alertas`]: { cuerpo: tresParaRevisar },
    [postDe(V104)]: CARGADO,
    [postDe(V103)]: CARGADO,
    [postDe(V101)]: CARGADO,
    ...cambios,
  });
}

/** La fila de una caravana dentro de la lista de la corrida. */
const fila = (caravana: string): HTMLElement => {
  const encontrada = [...document.querySelectorAll('.lista > li')].find((li) =>
    li.querySelector('.caravana')?.textContent?.includes(caravana),
  );
  if (encontrada === undefined) throw new Error(`No hay fila para la caravana ${caravana}`);
  return encontrada as HTMLElement;
};

const esperarLaLista = () => screen.findByRole('heading', { name: 'La lista' });

const cifra = (rotulo: string): string =>
  document.querySelector(`.cifra:has(.rotulo)`) !== null
    ? ([...document.querySelectorAll('.cifra')]
        .find((c) => c.querySelector('.rotulo')?.textContent === rotulo)
        ?.querySelector('.valor')?.textContent ?? '')
    : '';

describe('armar la corrida', () => {
  it('arranca con el tipo que sugiere el origen, no siempre en celo', async () => {
    montarCorrida();
    render(<App />);
    await esperarLaLista();

    // El defecto que esta pantalla vino a arreglar: el formulario de carga
    // volvía a `celo` en cada evento, así que tactar costaba abrir un
    // desplegable y elegir, veinticinco veces. Quien entra por "para revisar"
    // viene a tactar.
    expect(screen.getByRole('radio', { name: 'Tacto positivo' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Celo' })).not.toBeChecked();
  });

  it('el de lectura no entra: se le dice por qué, no se le muestra la lista', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    window.location.hash = '#/corrida/para-revisar';
    montarApi({
      ...sesionDePrueba(usuarioLectura),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    });
    render(<App />);

    expect(await screen.findByText(/Tu permiso acá es de lectura/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'La lista' })).not.toBeInTheDocument();
  });

  it('una lista vacía lo dice y no dibuja una corrida de cero animales', async () => {
    montarCorrida({
      [`GET /establecimientos/${EST}/alertas`]: {
        cuerpo: { fecha: HOY, para_revisar: [], para_secar: [] },
      },
    });
    render(<App />);

    expect(await screen.findByText(/Ninguna para revisar/)).toBeInTheDocument();
  });
});

describe('cargar', () => {
  it('manda el tipo, la fecha de la corrida y el id del cliente', async () => {
    const falsa = montarCorrida();
    render(<App />);
    await esperarLaLista();

    await userEvent.click(within(fila('104')).getByRole('button'));

    await waitFor(() => expect(falsa.cuerpoDe(postDe(V104))).toBeDefined());
    const cuerpo = falsa.cuerpoDe(postDe(V104)) as Record<string, unknown>;
    expect(cuerpo['tipo']).toBe('tacto_positivo');
    expect(cuerpo['fecha_evento']).toBe(HOY);
    // El id del cliente es lo que hace que un reintento después de un pozo de
    // señal vuelva como EVENTO_DUPLICADO en vez de cargar dos veces (63 y 67).
    expect(cuerpo['id']).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
  });

  it('lo cargado queda marcado EN SU LUGAR y la lista no se vuelve a pedir', async () => {
    const falsa = montarCorrida();
    render(<App />);
    await esperarLaLista();

    await userEvent.click(within(fila('104')).getByRole('button'));
    await waitFor(() => expect(within(fila('104')).getByText(/cargado/)).toBeInTheDocument());

    // La 104 ya no está "para revisar", pero sigue donde estaba: sacarla
    // mientras el dedo baja por la lista es perder el lugar, que es justo el
    // defecto que esta pantalla vino a arreglar.
    const caravanas = [...document.querySelectorAll('.lista .caravana')].map((e) => e.textContent);
    expect(caravanas).toEqual(['104', '103', '101']);
    // Y la marca lleva su palabra, no un tilde ni un color solo.
    expect(within(fila('104')).getByText(/cargado — Tacto positivo/)).toBeInTheDocument();

    const pedidosDeAlertas = falsa.pedidos.filter((p) => p.ruta.endsWith('/alertas'));
    expect(pedidosDeAlertas).toHaveLength(1);
  });

  it('el contador dice cuántas van, cuántas quedan y cuántas se apartaron', async () => {
    montarCorrida();
    render(<App />);
    await esperarLaLista();

    expect(cifra('Cargadas')).toBe('0');
    expect(cifra('Quedan')).toBe('3');

    await userEvent.click(within(fila('104')).getByRole('button'));
    await waitFor(() => expect(cifra('Cargadas')).toBe('1'));
    expect(cifra('Quedan')).toBe('2');
  });

  it('cambiar de tipo a mitad de corrida cuesta un toque', async () => {
    const falsa = montarCorrida();
    render(<App />);
    await esperarLaLista();

    // La mayoría de una corrida de tactos son positivos y de vez en cuando cae
    // una vacía: pasar a negativo y volver tiene que costar dos toques.
    await userEvent.click(screen.getByRole('radio', { name: 'Tacto negativo' }));
    await userEvent.click(within(fila('104')).getByRole('button'));

    await waitFor(() => expect(falsa.cuerpoDe(postDe(V104))).toBeDefined());
    expect((falsa.cuerpoDe(postDe(V104)) as Record<string, unknown>)['tipo']).toBe(
      'tacto_negativo',
    );
  });

  it('se busca por caravana, porque en el corral no vienen en el orden de la lista', async () => {
    montarCorrida();
    render(<App />);
    await esperarLaLista();

    await userEvent.type(screen.getByLabelText('Buscar una caravana'), '10');
    expect([...document.querySelectorAll('.lista .caravana')]).toHaveLength(3);

    await userEvent.type(screen.getByLabelText('Buscar una caravana'), '3');
    const caravanas = [...document.querySelectorAll('.lista .caravana')].map((e) => e.textContent);
    expect(caravanas).toEqual(['103']);
  });
});

describe('el control lechero', () => {
  it('pide su número por animal, y sin él no se manda', async () => {
    const falsa = montarCorrida();
    render(<App />);
    await esperarLaLista();

    await userEvent.click(screen.getByRole('radio', { name: 'Control lechero' }));

    const suFila = fila('104');
    expect(within(suFila).getByRole('button', { name: 'Cargar' })).toBeDisabled();

    await userEvent.type(within(suFila).getByLabelText('Litros de 104'), '24.5');
    await userEvent.click(within(suFila).getByRole('button', { name: 'Cargar' }));

    await waitFor(() => expect(falsa.cuerpoDe(postDe(V104))).toBeDefined());
    const cuerpo = falsa.cuerpoDe(postDe(V104)) as Record<string, unknown>;
    expect(cuerpo['payload']).toEqual({ litros: 24.5 });
  });
});

describe('un rechazo', () => {
  it('aparta ese animal y la corrida sigue con el siguiente', async () => {
    const falsa = montarCorrida({
      [postDe(V104)]: { status: 422, cuerpo: rechazoForzable },
    });
    render(<App />);
    await esperarLaLista();

    await userEvent.click(within(fila('104')).getByRole('button'));
    // `/^apartada —/` y no `/apartada/`: la fila también dice "Se atiende abajo,
    // en «Las apartadas»", y las dos matchearían.
    await waitFor(() => expect(within(fila('104')).getByText(/^apartada —/)).toBeInTheDocument());

    // Lo que importa: la 103 sigue cargable. Un rechazo no frena la mañana.
    await userEvent.click(within(fila('103')).getByRole('button'));
    await waitFor(() => expect(within(fila('103')).getByText(/cargado/)).toBeInTheDocument());
    expect(falsa.cuerpoDe(postDe(V103))).toBeDefined();
  });

  it('se atiende al final, con el mensaje de la API tal cual y su código', async () => {
    montarCorrida({ [postDe(V104)]: { status: 422, cuerpo: rechazoForzable } });
    render(<App />);
    await esperarLaLista();

    await userEvent.click(within(fila('104')).getByRole('button'));

    const apartadas = await screen.findByRole('heading', { name: /Las apartadas \(1\)/ });
    const tarjeta = apartadas.closest('.tarjeta') as HTMLElement;
    // El mensaje de §5.6 se muestra tal cual: reescribirlo acá sería duplicar el
    // dominio en el peor lugar posible.
    expect(within(tarjeta).getByText(rechazoForzable.mensaje)).toBeInTheDocument();
    expect(within(tarjeta).getByText(rechazoForzable.codigo)).toBeInTheDocument();
  });

  it('"Confirmar igual" reusa el mismo id del cliente y manda forzado', async () => {
    const falsa = montarCorrida({
      [postDe(V104)]: (cuerpo) => {
        const c = cuerpo as Record<string, unknown>;
        return c['forzado'] === true ? CARGADO : { status: 422, cuerpo: rechazoForzable };
      },
    });
    render(<App />);
    await esperarLaLista();

    await userEvent.click(within(fila('104')).getByRole('button'));
    await screen.findByRole('heading', { name: /Las apartadas \(1\)/ });
    const primerId = (falsa.cuerpoDe(postDe(V104)) as Record<string, unknown>)['id'];

    await userEvent.type(
      screen.getByLabelText('Por qué se carga igual'),
      'Parió en el campo.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar igual' }));

    await waitFor(() => expect(within(fila('104')).getByText(/cargado/)).toBeInTheDocument());
    const segundo = falsa.cuerpoDe(postDe(V104)) as Record<string, unknown>;
    expect(segundo['forzado']).toBe(true);
    expect(segundo['observaciones']).toBe('Parió en el campo.');
    // El mismo id: es el mismo hecho, insistido. Uno nuevo lo convertiría en un
    // evento distinto y perdería la protección contra el duplicado.
    expect(segundo['id']).toBe(primerId);
  });
});

/**
 * Envuelve el `fetch` que ya montó `montarApi` para demorar los POST y medir
 * cuántos hay en vuelo a la vez. Sin la demora no se puede observar nada: con un
 * mock instantáneo, serie y paralelo se ven igual.
 */
function conPostDemorados(ms: number): { pico: () => number } {
  const original = globalThis.fetch;
  let enVuelo = 0;
  let pico = 0;
  vi.stubGlobal('fetch', async (entrada: unknown, init?: RequestInit) => {
    if ((init?.method ?? 'GET') !== 'POST') return original(entrada as string, init);
    enVuelo += 1;
    pico = Math.max(pico, enVuelo);
    try {
      await new Promise((resolver) => setTimeout(resolver, ms));
      return await original(entrada as string, init);
    } finally {
      enVuelo -= 1;
    }
  });
  return { pico: () => pico };
}

describe('la cola', () => {
  it('manda de a uno aunque el dedo vaya más rápido que la red', async () => {
    const falsa = montarCorrida();
    const medida = conPostDemorados(20);
    render(<App />);
    await esperarLaLista();

    // Tres toques seguidos sin esperar a que vuelva ninguno. Contra una API que
    // duerme, tres POST simultáneos es la forma más rápida de que fallen todos.
    const usuario = userEvent.setup();
    await usuario.click(within(fila('104')).getByRole('button'));
    await usuario.click(within(fila('103')).getByRole('button'));
    await usuario.click(within(fila('101')).getByRole('button'));

    await waitFor(
      () => expect(within(fila('101')).getByText(/cargado/)).toBeInTheDocument(),
      { timeout: 3000 },
    );

    expect(medida.pico()).toBe(1);
    const posts = falsa.pedidos.filter((p) => p.metodo === 'POST');
    expect(posts).toHaveLength(3);
  });

  it('la sesión caída corta la cola en vez de tirar 401 en fila', async () => {
    const falsa = montarCorrida({
      [postDe(V104)]: { status: 401, cuerpo: { codigo: 'NO_AUTENTICADO', mensaje: 'Tu sesión venció: dura 8 horas.' } },
    });
    conPostDemorados(20);
    render(<App />);
    await esperarLaLista();

    const usuario = userEvent.setup();
    await usuario.click(within(fila('104')).getByRole('button'));
    await usuario.click(within(fila('103')).getByRole('button'));

    // El 401 devuelve al login, y el aviso dice que lo que se estaba cargando
    // no entró — que es lo único que se perdió: lo anterior ya está guardado.
    expect(await screen.findByText(/Tu sesión venció/)).toBeInTheDocument();

    const posts = falsa.pedidos.filter((p) => p.metodo === 'POST');
    expect(posts).toHaveLength(1);
  });
});
