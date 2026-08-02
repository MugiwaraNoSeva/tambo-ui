// El arranque: entrar, saber quién soy, elegir tambo y quedar conectado.
//
// Es el orden de los tres estados de `App`, y el orden importa: sin token no se
// pide nada, con token lo primero que se pregunta es `/auth/yo`, y recién con
// usuario se dibuja el tambo. Se prueba lo que la pantalla muestra y lo que
// manda — el dominio ya está probado del otro lado del `fetch`.
//
// "Quedar conectado" se afirma sobre el **nombre en el encabezado**: es lo que
// queda en pantalla cuando la tarjeta de bienvenida le deja el lugar al
// tablero, y lo que el tambero mira para saber que está en su tambo y no en el
// del vecino.

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { anotarFechaDeLaRespuesta } from '../src/reloj';
import { montarApi } from './servidor';
import {
  EST,
  HOY,
  TOKEN,
  animales,
  establecimiento,
  loginRechazado,
  rutasDelTablero,
  sesionDePrueba,
  sesionVencida,
  tanqueDelPeriodo,
  usuarioEscritura,
} from './fixtures';

const escribirLogin = async (password = 'demo-escritura') => {
  await userEvent.type(screen.getByLabelText('Email'), usuarioEscritura.email);
  await userEvent.type(screen.getByLabelText('Contraseña'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
};

describe('la puerta', () => {
  it('sin token, lo primero que se ve es el login y no se pide nada', () => {
    const falsa = montarApi({});
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(falsa.pedidos).toHaveLength(0);
  });

  it('entrar guarda el token y no vuelve a preguntar quién soy', async () => {
    const falsa = montarApi({
      'POST /auth/login': { cuerpo: { token: TOKEN, usuario: usuarioEscritura } },
      'GET /establecimientos': { cuerpo: { establecimientos: [{ id: EST, nombre: 'La Esperanza' }] } },
      'GET /auth/yo': { cuerpo: { usuario: usuarioEscritura } },
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
    });
    window.localStorage.setItem('tambo.establecimiento', EST);
    render(<App />);

    await escribirLogin();

    expect(await screen.findByRole('heading', { name: 'La Esperanza' })).toBeInTheDocument();
    expect(falsa.cuerpoDe('POST /auth/login')).toEqual({
      email: usuarioEscritura.email,
      password: 'demo-escritura',
    });
    expect(window.localStorage.getItem('tambo.token')).toBe(TOKEN);
    // El login ya trajo el usuario con sus permisos: pedir `/auth/yo` sería un
    // viaje para preguntar lo que se acaba de recibir.
    expect(falsa.pedidos.some((p) => p.ruta === '/auth/yo')).toBe(false);
  });

  it('el mensaje del login errado se muestra tal cual, sin decir cuál de los dos falló', async () => {
    montarApi({ 'POST /auth/login': { status: 401, cuerpo: loginRechazado } });
    render(<App />);

    await escribirLogin('la-que-no-es');

    expect(await screen.findByText('Email o contraseña incorrectos.')).toBeInTheDocument();
    expect(window.localStorage.getItem('tambo.token')).toBeNull();
    // Sigue en el login, con el botón listo para otro intento.
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('la contraseña nunca se ve en pantalla', async () => {
    montarApi({ 'POST /auth/login': { status: 401, cuerpo: loginRechazado } });
    render(<App />);

    await escribirLogin('secreta-de-verdad');

    await screen.findByText('Email o contraseña incorrectos.');
    expect(document.body.textContent).not.toContain('secreta-de-verdad');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });
});

describe('con token guardado, la app pregunta quién soy', () => {
  it('`/auth/yo` es el primer pedido y de ahí sale el usuario', async () => {
    const falsa = montarApi({
      ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
    });
    window.localStorage.setItem('tambo.establecimiento', EST);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'La Esperanza' })).toBeInTheDocument();
    expect(falsa.pedidos[0]?.ruta).toBe('/auth/yo');
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('un token de ayer vuelve al login **sin** mostrar ningún error', async () => {
    sesionDePrueba();
    montarApi({ 'GET /auth/yo': { status: 401, cuerpo: sesionVencida } });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    // Venció durmiendo: no hizo nada y no hay nada que explicarle.
    expect(screen.queryByText(sesionVencida.mensaje)).not.toBeInTheDocument();
    expect(window.localStorage.getItem('tambo.token')).toBeNull();
  });

  it('sin señal al arrancar no manda al login: ofrece reintentar', async () => {
    sesionDePrueba();
    montarApi({
      'GET /auth/yo': { status: 502, ilegible: true },
      'GET /establecimientos': { cuerpo: { establecimientos: [] } },
    });
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    // La sesión no se tocó: un servidor caído no es un token vencido.
    expect(window.localStorage.getItem('tambo.token')).toBe(TOKEN);
  });
});

describe('la sesión que se cae adentro', () => {
  // El caso que manda: se cumplen las 8 horas con la app abierta. El aviso no
  // puede quedar en la pantalla de turno, porque la pantalla de turno se va.
  const montarCargaDelTanque = () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    window.location.hash = '#/tanque';
    anotarFechaDeLaRespuesta({ fecha: HOY });
    return montarApi({
      ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      [`GET /establecimientos/${EST}/tanque?desde=2026-07-01&hasta=${HOY}`]: {
        cuerpo: tanqueDelPeriodo,
      },
      [`POST /establecimientos/${EST}/tanque`]: { status: 401, cuerpo: sesionVencida },
    });
  };

  it('a mitad de una carga vuelve al login y avisa que eso no se guardó', async () => {
    montarCargaDelTanque();
    render(<App />);
    await screen.findByText('Litros del período');

    await userEvent.type(screen.getByLabelText('Litros'), '72');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar' }));

    // El login, con el mensaje de la API tal cual y la advertencia que importa.
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByText(/Tu sesión venció: dura 8 horas/)).toBeInTheDocument();
    expect(screen.getByText(/no llegó a guardarse/)).toBeInTheDocument();
    expect(window.localStorage.getItem('tambo.token')).toBeNull();
  });

  it('en una lectura avisa, pero no habla de nada perdido', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    montarApi({
      ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
      [`GET /establecimientos/${EST}/alertas`]: { status: 401, cuerpo: sesionVencida },
    });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByText(/Tu sesión venció: dura 8 horas/)).toBeInTheDocument();
    expect(screen.queryByText(/no llegó a guardarse/)).not.toBeInTheDocument();
  });

  it('volver a entrar limpia el aviso', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    montarApi({
      ...sesionDePrueba(),
      'POST /auth/login': { cuerpo: { token: TOKEN, usuario: usuarioEscritura } },
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
      [`GET /establecimientos/${EST}/alertas`]: { status: 401, cuerpo: sesionVencida },
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Entrar' });

    await escribirLogin();

    await waitFor(() =>
      expect(screen.queryByText(/Tu sesión venció/)).not.toBeInTheDocument(),
    );
  });
});

describe('el tambo elegido', () => {
  it('con un tambo ya elegido arranca conectada, sin volver a preguntar', async () => {
    montarApi({
      ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
    });
    window.localStorage.setItem('tambo.establecimiento', EST);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'La Esperanza' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /en qué tambo estás/i })).not.toBeInTheDocument();
  });

  it('lo saluda por su nombre, que es lo que el tambero reconoce (decisión 53)', async () => {
    montarApi({
      ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { cuerpo: { ...establecimiento, nombre: 'El Ombú' } },
      ...rutasDelTablero,
    });
    window.localStorage.setItem('tambo.establecimiento', EST);
    render(<App />);

    // El nombre, y no el uuid, en la barra de arriba de todas las pantallas.
    expect(await screen.findByRole('heading', { name: 'El Ombú' })).toBeInTheDocument();
    expect(screen.queryByText(EST)).not.toBeInTheDocument();
  });
});

describe('cambiar de pantalla', () => {
  // La otra mitad de esto —volver arriba— no se puede afirmar acá: jsdom no
  // scrollea, así que `window.scrollTo` está stubeado en la preparación y
  // pedirle al test que lo espíe probaría que lo llamamos, no que sirvió. Lo que
  // sí se puede probar es lo que le importa a quien no ve la pantalla: que el
  // foco aterrice en el encabezado nuevo, que es lo que hace que el cambio se
  // anuncie en vez de pasar en silencio.
  it('al navegar, el foco queda en el encabezado de la pantalla nueva', async () => {
    montarApi({
      ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
      [`GET /establecimientos/${EST}/animales`]: { cuerpo: animales },
    });
    window.localStorage.setItem('tambo.establecimiento', EST);
    render(<App />);

    await screen.findByRole('heading', { name: 'La Esperanza' });
    window.location.hash = '#/rodeo';

    const titulo = await screen.findByRole('heading', { name: 'El rodeo' });
    await waitFor(() => expect(titulo).toHaveFocus());
  });
});

describe('salir', () => {
  it('borra el token y vuelve al login, pero no olvida el tambo', async () => {
    montarApi({
      ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
    });
    window.localStorage.setItem('tambo.establecimiento', EST);
    render(<App />);

    await screen.findByRole('heading', { name: 'La Esperanza' });
    // Salir se hace una vez por turno, así que se fue del pie del tablero al
    // lugar más lejos del pulgar: adentro de "Mi cuenta". Que sea incómodo es la
    // idea — antes pesaba exactamente lo mismo que "Dar de alta".
    await userEvent.click(screen.getByRole('link', { name: 'Mi cuenta' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Salir' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument());
    expect(window.localStorage.getItem('tambo.token')).toBeNull();
    // El tambo elegido no es un secreto: el que sale y vuelve entra donde estaba.
    expect(window.localStorage.getItem('tambo.establecimiento')).toBe(EST);
  });

  // "Cambiar de tambo" —que no cierra la sesión, y que con un solo tambo ni
  // aparece— se prueba en `Conexion.test.tsx`, junto al selector que lo recibe.
});
