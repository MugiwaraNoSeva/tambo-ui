// Humo contra la demo de VERDAD: sin `fetch` mockeado, contra la API en
// 127.0.0.1:3000. No va al CI —necesita la demo levantada— y se corre a mano:
//
//   DEMO_PORT=3000 npm run demo --prefix api    (en el repo del backend)
//   npm run test:demo                           (acá)
//
// Lo que prueba y la suite mockeada no puede: que las respuestas de verdad
// tengan la forma que los tipos declaran, y que la pantalla que sale de ellas
// sea la que corresponde a cada rol.
//
// **Se puede correr las veces que haga falta contra la misma demo.** El test que
// escribe da de alta su propio animal con una caravana sacada del reloj, en vez
// de cargarle un evento a uno de la demo: si tocara uno de la demo, la segunda
// corrida se encontraría el evento ya cargado y el dominio lo rechazaría, con
// razón, y el test estaría rojo por lo que hizo la corrida anterior.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';

/**
 * Contra la demo de verdad, no contra el mismo origen. Se pone acá y no en una
 * variable de entorno para que el comando sea uno solo y ande igual en cualquier
 * consola — `VITE_API_URL=…` delante del comando es sintaxis de sh y en
 * PowerShell no existe.
 */
const API = 'http://127.0.0.1:3000';

const CREDENCIALES = {
  admin: ['admin@tambo.local', 'demo-admin'],
  escritura: ['paulo@demo.local', 'demo-escritura'],
  lectura: ['vet@demo.local', 'demo-lectura'],
} as const;

/**
 * Entrar, y quedar donde a cada uno le corresponde: el tambero en el tablero de
 * su tambo —con uno solo se entra derecho— y el admin en su panel. Que sean dos
 * destinos distintos es la mitad de lo que esta tanda cambió.
 */
async function entrar(rol: keyof typeof CREDENCIALES) {
  const [email, password] = CREDENCIALES[rol];
  render(<App />);
  await screen.findByRole('heading', { name: 'Entrar' });
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Contraseña'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  await screen.findByRole(
    'heading',
    { name: rol === 'admin' ? 'Administración' : 'La Esperanza' },
    { timeout: 10000 },
  );
}

/** El admin entra a La Esperanza por su panel, que es la única puerta que tiene. */
async function entrarAlTamboComoAdmin() {
  await entrar('admin');
  await userEvent.click(
    await screen.findByRole('link', { name: /La Esperanza/ }, { timeout: 10000 }),
  );
  await userEvent.click(
    await screen.findByRole('button', { name: 'Entrar al tambo' }, { timeout: 10000 }),
  );
  await screen.findByRole('heading', { name: 'La Esperanza' }, { timeout: 10000 });
}

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API);
  window.localStorage.clear();
  window.location.hash = '';
});

describe('la demo, con los tres usuarios', () => {
  it('el de escritura entra, ve el tambo y todas las puertas de carga', async () => {
    await entrar('escritura');

    expect(await screen.findByText('Preñez del rodeo', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dar de alta/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
  }, 30000);

  it('el de lectura entra, ve el tambo y ninguna puerta de carga', async () => {
    await entrar('lectura');

    expect(await screen.findByText('Preñez del rodeo', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /dar de alta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /cargar el tanque/i })).not.toBeInTheDocument();
  }, 30000);

  it('el admin entra sin tener un solo permiso, y puede cargar', async () => {
    await entrarAlTamboComoAdmin();

    expect(await screen.findByText('Preñez del rodeo', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dar de alta/i })).toBeInTheDocument();
    // Y la salida lo devuelve al panel, que es de donde vino.
    expect(screen.getByRole('button', { name: 'Volver al panel' })).toBeInTheDocument();
  }, 30000);

  it('la contraseña equivocada da el mensaje único de la API', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Entrar' });
    await userEvent.type(screen.getByLabelText('Email'), 'paulo@demo.local');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'la-que-no-es');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Email o contraseña incorrectos.')).toBeInTheDocument();
    expect(window.localStorage.getItem('tambo.token')).toBeNull();
  }, 30000);

  it('el de lectura que llega a la carga a mano recibe el aviso, no un formulario', async () => {
    await entrar('lectura');
    // El primer animal del rodeo de verdad, sacado de la pantalla y no inventado.
    window.location.hash = '#/rodeo';
    await screen.findByRole('heading', { name: 'El rodeo' }, { timeout: 10000 });
    const filas = await screen.findAllByRole('link', { name: /^1\d\d/ }, { timeout: 10000 });
    window.location.hash = `${filas[0]?.getAttribute('href')?.slice(1) ?? ''}/cargar`;

    expect(await screen.findByText(/No podés cargar eventos/i)).toBeInTheDocument();
  }, 30000);

  it('el de escritura da de alta y carga un evento, firmados con el token', async () => {
    await entrar('escritura');

    // Se da de alta un animal nuevo en vez de tocar uno de la demo: así el test
    // no depende de lo que ya se cargó y se puede correr dos veces seguidas sin
    // que el dominio rechace, con razón, un celo repetido. La caravana sale del
    // reloj para que sea libre.
    const caravana = `9${String(Date.now()).slice(-4)}`;
    window.location.hash = '#/alta';
    await userEvent.type(await screen.findByLabelText('Caravana', {}, { timeout: 10000 }), caravana);
    await userEvent.click(screen.getByRole('button', { name: 'Dar de alta' }));

    // Cae en la ficha del animal recién creado, con su caravana en el encabezado.
    expect(
      await screen.findByRole('heading', { name: caravana }, { timeout: 10000 }),
    ).toBeInTheDocument();

    // Y de ahí, un celo: el evento más frecuente del corral y el que no pide
    // nada más que la fecha, que ya viene propuesta con el día del servidor.
    await userEvent.click(
      await screen.findByRole('link', { name: /cargar un evento/i }, { timeout: 10000 }),
    );
    await screen.findByLabelText('Tipo de evento', {}, { timeout: 10000 });
    await userEvent.click(screen.getByRole('button', { name: 'Cargar el evento' }));

    // Vuelve a la ficha con el evento en el historial: lo guardó, y lo firmó con
    // el token —el cuerpo no lleva `usuario`, que la API rechazaría con 400—.
    expect(await screen.findByText(/El historial/, {}, { timeout: 10000 })).toBeInTheDocument();
    expect(await screen.findByText(/Celo/, {}, { timeout: 10000 })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /anular este evento/i })).toBeInTheDocument();
  }, 30000);

  /**
   * El panel entero contra la API de verdad, que es lo que la suite mockeada no
   * puede: que `GET /usuarios` traiga lo que los tipos declaran, que el `PUT`
   * cambie el permiso en su lugar y que el `DELETE` conteste 204 sin cuerpo.
   *
   * Crea **su propia persona**, con un email sacado del reloj, por lo mismo que
   * el test que da de alta un animal: tocar a Paulo o a Vet dejaría la segunda
   * corrida trabajando sobre lo que hizo la primera.
   */
  it('el panel: crea una persona, le da acceso, se lo cambia y se lo saca', async () => {
    const sufijo = String(Date.now()).slice(-6);
    const nombre = `Rosa ${sufijo}`;
    const email = `rosa-${sufijo}@demo.local`;

    await entrar('admin');

    // ── Crearla ────────────────────────────────────────────────────────────
    await userEvent.click(
      await screen.findByRole('link', { name: 'Las personas' }, { timeout: 10000 }),
    );
    await screen.findByRole('heading', { name: 'Todas' }, { timeout: 10000 });
    await userEvent.click(screen.getByRole('button', { name: 'Crear una persona' }));
    await userEvent.type(screen.getByLabelText('Nombre'), nombre);
    await userEvent.type(screen.getByLabelText('Email'), email);
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'la-inicial');
    await userEvent.click(screen.getByRole('button', { name: 'Crear la persona' }));

    // La contraseña, una vez y para decírsela: del otro lado no hay correo.
    expect(
      await screen.findByText(new RegExp(`${nombre} ya puede entrar`), {}, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('la-inicial')).toBeInTheDocument();

    // ── Darle acceso a La Esperanza ────────────────────────────────────────
    window.location.hash = '#/admin';
    await userEvent.click(
      await screen.findByRole('link', { name: /La Esperanza/ }, { timeout: 10000 }),
    );
    const quien = await screen.findByLabelText('Quién', {}, { timeout: 10000 });
    await userEvent.selectOptions(
      quien,
      within(quien).getByRole('option', { name: new RegExp(email) }),
    );
    await userEvent.selectOptions(screen.getByLabelText('Con qué permiso'), 'lectura');
    await userEvent.click(screen.getByRole('button', { name: 'Dar el acceso' }));

    const suFila = async (): Promise<HTMLElement> =>
      (await screen.findByText(nombre, {}, { timeout: 10000 })).closest('li') as HTMLElement;

    expect(within(await suFila()).getByText('lectura')).toBeInTheDocument();

    // ── Cambiárselo: el mismo PUT, sin revocar en el medio ─────────────────
    await userEvent.click(
      within(await suFila()).getByRole('button', { name: 'Pasar a escritura' }),
    );
    await waitFor(
      async () => expect(within(await suFila()).getByText('escritura')).toBeInTheDocument(),
      { timeout: 10000 },
    );

    // ── Y sacárselo ────────────────────────────────────────────────────────
    await userEvent.click(within(await suFila()).getByRole('button', { name: 'Sacar el acceso' }));
    await waitFor(() => expect(screen.queryByText(nombre)).not.toBeInTheDocument(), {
      timeout: 10000,
    });

    // El admin sigue apareciendo aparte: entra a este tambo sin figurar en el
    // reparto, que es la trampa que ninguna lista filtrada por permiso ve.
    expect(screen.getByRole('heading', { name: 'Y además, los administradores' })).toBeInTheDocument();
  }, 60000);

  it('el de lectura no tiene panel: `#/admin` le cae en su tablero', async () => {
    await entrar('lectura');
    window.location.hash = '#/admin';

    expect(await screen.findByText('Preñez del rodeo', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Administración' })).not.toBeInTheDocument();
  }, 30000);

  it('recargar con la sesión abierta no vuelve a pedir la contraseña', async () => {
    await entrar('escritura');
    const token = window.localStorage.getItem('tambo.token');
    expect(token).not.toBeNull();

    // "Recargar" es montar la app de cero con lo que quedó en `localStorage`.
    // Es el camino del paso 2: hay token y se pregunta `/auth/yo`.
    screen.getByRole('button', { name: 'Salir' });
    document.body.innerHTML = '';
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'La Esperanza' }, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();
  }, 30000);
});
