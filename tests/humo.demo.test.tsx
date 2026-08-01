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
    await screen.findByRole('button', { name: /Entrar al tambo/ }, { timeout: 10000 }),
  );
  await screen.findByRole('heading', { name: 'La Esperanza' }, { timeout: 10000 });
}

/** Del panel al menú de La Esperanza, y de ahí a la pantalla de su gente. */
async function irALaGenteDelTambo() {
  await userEvent.click(
    await screen.findByRole('link', { name: /La Esperanza/ }, { timeout: 10000 }),
  );
  await userEvent.click(await screen.findByRole('link', { name: /Su gente/ }, { timeout: 10000 }));
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
      await screen.findByRole('link', { name: 'Todas las personas' }, { timeout: 10000 }),
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
    await irALaGenteDelTambo();
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

  /**
   * El CRUD del tambo contra la API de verdad: crear, renombrar, archivar —y ver
   * que archivado **frena una carga**, que es lo único que ningún mock puede
   * probar—, y desarchivar para dejar la demo como estaba.
   */
  it('el CRUD de tambos: crea uno, lo renombra, lo archiva y lo desarchiva', async () => {
    const sufijo = String(Date.now()).slice(-6);
    await entrar('admin');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Crear un tambo' }, { timeout: 10000 }),
    );
    await userEvent.type(
      await screen.findByLabelText('Nombre del tambo', {}, { timeout: 10000 }),
      `El Ombú ${sufijo}`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Crear el tambo' }));

    // Aparece en la lista, con nadie adentro.
    const fila = await screen.findByRole(
      'link',
      { name: new RegExp(`El Ombú ${sufijo}`) },
      { timeout: 10000 },
    );
    await userEvent.click(fila);

    // Renombrarlo.
    await userEvent.click(
      await screen.findByRole('button', { name: 'Editar el tambo' }, { timeout: 10000 }),
    );
    const campo = screen.getByLabelText('Nombre');
    await userEvent.clear(campo);
    await userEvent.type(campo, `El Ombú Viejo ${sufijo}`);
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar el nombre' }));
    expect(
      await screen.findByRole('heading', { name: `El Ombú Viejo ${sufijo}` }, { timeout: 10000 }),
    ).toBeInTheDocument();

    // Archivarlo, y que lo diga.
    await userEvent.click(screen.getByRole('button', { name: 'Archivar el tambo' }));
    expect(
      await screen.findByText(/Este tambo está archivado/i, {}, { timeout: 10000 }),
    ).toBeInTheDocument();

    // Sale de la lista, y aparece si se lo va a buscar.
    window.location.hash = '#/admin';
    await waitFor(
      () => expect(screen.queryByText(new RegExp(`El Ombú Viejo ${sufijo}`))).not.toBeInTheDocument(),
      { timeout: 10000 },
    );
    // `findBy` y no `getBy`: venimos de un cambio de hash y la lista puede estar
    // todavía pidiendo sus tambos, y mientras pide no dibuja ningún botón.
    await userEvent.click(
      await screen.findByRole('button', { name: 'Ver también los archivados' }, { timeout: 10000 }),
    );
    expect(
      await screen.findByText(new RegExp(`El Ombú Viejo ${sufijo}`), {}, { timeout: 10000 }),
    ).toBeInTheDocument();

    // Y lo que ningún mock prueba: archivado, la API **no deja cargar**. Se
    // entra al tambo y el alta se come el 409 con su mensaje.
    await userEvent.click(screen.getByRole('link', { name: new RegExp(`El Ombú Viejo ${sufijo}`) }));
    await userEvent.click(
      await screen.findByRole('button', { name: /Entrar al tambo/ }, { timeout: 10000 }),
    );
    window.location.hash = '#/alta';
    await userEvent.type(
      await screen.findByLabelText('Caravana', {}, { timeout: 10000 }),
      `8${sufijo.slice(-3)}`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Dar de alta' }));
    expect(
      await screen.findByText(/está archivado/i, {}, { timeout: 10000 }),
    ).toBeInTheDocument();
  }, 60000);

  /**
   * Los parámetros contra la API de verdad, que es donde se ve lo único que
   * ningún mock puede probar: que el cambio **queda en el historial**, firmado
   * con quien lo hizo y con su porqué.
   */
  it('los parámetros: los cambia, quedan en el historial, y vuelve a fábrica', async () => {
    // El motivo lleva el reloj adentro por lo mismo que la caravana y el email de
    // los otros dos: el historial es append-only, así que la corrida de hoy
    // encuentra la de recién, y un texto repetido hace que la búsqueda encuentre
    // dos. Que se acumulen está bien — es un log.
    const marca = `Humo ${String(Date.now()).slice(-6)}`;
    await entrar('admin');
    await userEvent.click(
      await screen.findByRole('link', { name: /La Esperanza/ }, { timeout: 10000 }),
    );
    await userEvent.click(
      await screen.findByRole('link', { name: /Sus parámetros/ }, { timeout: 10000 }),
    );

    // La demo nace con la config del núcleo y una sola versión: la inicial, que
    // no puso nadie.
    expect(
      await screen.findByText('La puso: vino con el sistema', {}, { timeout: 10000 }),
    ).toBeInTheDocument();

    // **No se asume el valor de partida.** Este test se puede correr dos veces
    // contra la misma demo, y la segunda arranca con lo que dejó la primera; peor
    // todavía, si la primera se cae a la mitad deja el tambo con el valor de
    // prueba puesto. Se lee lo que hay, se cambia a otra cosa, y se termina
    // volviendo a fábrica, que es un estado conocido pase lo que pase.
    const pve = await screen.findByLabelText('Período voluntario de espera (días)', {}, { timeout: 10000 });
    const antes = Number((pve as HTMLInputElement).value);
    const nuevo = antes === 60 ? 55 : 60;

    await userEvent.clear(pve);
    await userEvent.type(pve, String(nuevo));
    await userEvent.type(
      screen.getByLabelText(/Por qué se cambia/),
      `${marca}: subimos el PVE para probar el historial.`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar los parámetros' }));

    // **Se busca adentro de la tarjeta del historial y no en la pantalla entera**:
    // el motivo que se acaba de escribir sigue un instante en el textarea, y
    // `findByText` lo encontraba ahí y daba por bueno algo que todavía no se
    // había guardado. La pregunta es si quedó en el log, no si está en pantalla.
    const tarjeta = (await screen.findByRole(
      'heading',
      { name: 'El historial de reglas' },
      { timeout: 10000 },
    )).parentElement as HTMLElement;

    // Quedó, y quedó firmado: es la pregunta que toda esta tabla vino a contestar.
    expect(
      await within(tarjeta).findByText(new RegExp(`${marca}: subimos el PVE`), {}, { timeout: 10000 }),
    ).toBeInTheDocument();
    // Adentro de **su** renglón del historial y no en cualquiera: el log se
    // acumula entre corridas, así que "La puso: Administrador" está tantas veces
    // como veces se corrió esto. Lo que se afirma es que el cambio de recién
    // quedó firmado, no que exista una firma en algún lado.
    const suRenglon = within(tarjeta)
      .getByText(new RegExp(`${marca}: subimos el PVE`))
      .closest('li') as HTMLElement;
    expect(within(suRenglon).getByText('La puso: Administrador')).toBeInTheDocument();
    expect(screen.getByLabelText('Período voluntario de espera (días)')).toHaveValue(nuevo);

    // Y la vuelta a fábrica, que deja el tambo en un estado conocido para la
    // próxima corrida. Los valores los trae la API: si esta línea deja 45, es que
    // `GET /config-default` contestó lo que el núcleo tiene.
    await userEvent.click(screen.getByRole('button', { name: /Volver a los valores de fábrica/ }));
    expect(screen.getByLabelText('Período voluntario de espera (días)')).toHaveValue(45);
    await userEvent.type(screen.getByLabelText(/Por qué se cambia/), `${marca}: vuelta a fábrica.`);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar los parámetros' }));

    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Guardar los parámetros' })).toBeDisabled(),
      { timeout: 10000 },
    );
  }, 60000);

  /**
   * El ciclo completo de la decisión 92 contra la API de verdad: se carga un
   * evento, se cambian las reglas, y la ficha dice que ese evento se juzgó con
   * las de antes. Es lo único que ningún mock puede probar — que el join por
   * tiempo del backend le pegue al evento correcto.
   */
  it('la ficha dice con qué reglas se juzgó un evento viejo', async () => {
    const caravana = `8${String(Date.now()).slice(-4)}`;

    // 1. Un animal nuevo, cargado con las reglas de ahora.
    await entrar('escritura');
    window.location.hash = '#/alta';
    await userEvent.type(await screen.findByLabelText('Caravana', {}, { timeout: 10000 }), caravana);
    await userEvent.click(screen.getByRole('button', { name: 'Dar de alta' }));
    const ficha = await screen.findByRole('heading', { name: caravana }, { timeout: 10000 });
    expect(ficha).toBeInTheDocument();
    const suHash = window.location.hash;
    // Todavía no hay nada que decir: se cargó con lo que está puesto.
    expect(document.body.textContent).not.toContain('otras reglas');

    // 2. El admin cambia las reglas.
    window.localStorage.clear();
    document.body.innerHTML = '';
    await entrar('admin');
    await userEvent.click(
      await screen.findByRole('link', { name: /La Esperanza/ }, { timeout: 10000 }),
    );
    await userEvent.click(
      await screen.findByRole('link', { name: /Sus parámetros/ }, { timeout: 10000 }),
    );
    const celo = await screen.findByLabelText('Validez del celo (días)', {}, { timeout: 10000 });
    // Lo que regía cuando se cargó el alta, que es contra lo que la ficha va a
    // comparar. No se asume: la corrida anterior pudo dejar otro número.
    const regia = Number((celo as HTMLInputElement).value);
    const nuevo = regia === 4 ? 5 : 4;
    await userEvent.clear(celo);
    await userEvent.type(celo, String(nuevo));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar los parámetros' }));
    await screen.findByText(/Parámetros guardados/i, {}, { timeout: 10000 });

    // 3. Y la ficha lo dice, con el número y no con un id. Se vuelve a entrar
    // **como el tambero**: es quien mira el rodeo y no encuentra una vaca donde
    // la esperaba, y por eso el historial de reglas es de `lectura` y no de
    // admin. (Además, al admin el hash no le abre ningún tambo por su cuenta.)
    window.localStorage.clear();
    document.body.innerHTML = '';
    await entrar('escritura');
    window.location.hash = suHash;
    expect(await screen.findByText(/otras reglas/, {}, { timeout: 10000 })).toBeInTheDocument();
    expect(
      await screen.findByText(new RegExp(`validez del celo: ${regia} en vez de ${nuevo}`)),
    ).toBeInTheDocument();
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
