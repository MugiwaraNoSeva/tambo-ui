// El selector de tambo, armado con `GET /establecimientos`.
//
// Los cuatro casos, y ninguno es adorno: uno solo entra derecho, varios eligen,
// ninguno no es una lista vacía sino alguien esperando que le den acceso, y el
// guardado que ya no está no puede dejar la app pegada contra un tambo al que no
// puede entrar. **El `localStorage` propone; la lista de la API decide.**
//
// Esta es la pantalla **del tambero**. El admin no pasa por acá: su inicio es el
// panel, y lo suyo se prueba en `Panel.test.tsx` — incluido el vacío del primer
// arranque, que era el caso que esta pantalla tenía que resolver mientras él
// pasaba por acá.

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { montarApi, type Manejador } from './servidor';
import {
  EST,
  EST2,
  TOKEN,
  establecimiento,
  rutasDelTablero,
  sesionDePrueba,
  sinPermiso,
  usuarioEscritura,
} from './fixtures';

const LOS_DOS = [
  { id: EST, nombre: 'La Esperanza' },
  { id: EST2, nombre: 'El Ombú' },
];

const elOmbu = { ...establecimiento, id: EST2, nombre: 'El Ombú' };

/** Las rutas del tablero del segundo tambo, que son las mismas con otro id. */
const rutasDelTableroDe = (est: string): Record<string, Manejador> =>
  Object.fromEntries(
    Object.entries(rutasDelTablero).map(([clave, valor]) => [clave.replace(EST, est), valor]),
  );

describe('un solo tambo', () => {
  it('entra derecho, sin pantalla de peaje', async () => {
    montarApi({
      ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
    });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'La Esperanza' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /en qué tambo estás/i })).not.toBeInTheDocument();
    // Y no hay a dónde cambiar, así que el botón tampoco está.
    expect(screen.queryByRole('button', { name: /cambiar de tambo/i })).not.toBeInTheDocument();
  });

  it('entra derecho aunque el guardado sea de otra demo', async () => {
    window.localStorage.setItem('tambo.establecimiento', 'un-id-de-otra-demo');
    montarApi({
      ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
    });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'La Esperanza' })).toBeInTheDocument();
  });
});

describe('varios tambos', () => {
  const montarDos = (cambios: Record<string, Manejador> = {}, usuario = usuarioEscritura) =>
    montarApi({
      ...sesionDePrueba(usuario, LOS_DOS),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      [`GET /establecimientos/${EST2}`]: { cuerpo: elOmbu },
      ...rutasDelTablero,
      ...rutasDelTableroDe(EST2),
      ...cambios,
    });

  it('los muestra por nombre y se elige tocando', async () => {
    montarDos();
    render(<App />);

    await screen.findByRole('heading', { name: /en qué tambo estás/i });
    // Por nombre, no por uuid: el uuid no le dice nada a nadie.
    expect(screen.queryByText(EST)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'El Ombú' }));

    expect(await screen.findByRole('heading', { name: 'El Ombú' })).toBeInTheDocument();
    expect(window.localStorage.getItem('tambo.establecimiento')).toBe(EST2);
  });

  it('el guardado entra sin volver a preguntar', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST2);
    montarDos();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'El Ombú' })).toBeInTheDocument();
  });

  it('cambiar de tambo vuelve a la lista y no cierra la sesión', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    montarDos();
    render(<App />);

    await screen.findByRole('heading', { name: 'La Esperanza' });
    await userEvent.click(screen.getByRole('button', { name: /cambiar de tambo/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /en qué tambo estás/i })).toBeInTheDocument(),
    );
    expect(window.localStorage.getItem('tambo.establecimiento')).toBeNull();
    expect(window.localStorage.getItem('tambo.token')).toBe(TOKEN);
  });

});

describe('ningún tambo', () => {
  it('al tambero le dice a quién pedírselo, sin lista vacía ni error', async () => {
    montarApi({ ...sesionDePrueba(usuarioEscritura, []) });
    render(<App />);

    expect(await screen.findByText(/pedíselo a un administrador/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // La única salida que le queda tiene que estar.
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
  });
});

describe('el guardado que ya no me corresponde', () => {
  it('le revocaron el permiso: al selector, con el porqué, y sin quedar pegado', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    montarApi({
      // La lista ya no lo trae: se lo revocaron esta mañana.
      ...sesionDePrueba(usuarioEscritura, LOS_DOS.filter((t) => t.id !== EST)),
      [`GET /establecimientos/${EST2}`]: { cuerpo: elOmbu },
      ...rutasDelTableroDe(EST2),
    });
    render(<App />);

    // Con uno solo en la lista entra derecho a ese, que es lo correcto: no lo
    // deja mirando el tambo que perdió.
    expect(await screen.findByRole('heading', { name: 'El Ombú' })).toBeInTheDocument();
    expect(window.localStorage.getItem('tambo.token')).toBe(TOKEN);
  });

  it('con varios, avisa por qué está eligiendo de nuevo', async () => {
    window.localStorage.setItem('tambo.establecimiento', 'el-de-la-demo-de-ayer');
    montarApi({
      ...sesionDePrueba(usuarioEscritura, LOS_DOS),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
    });
    render(<App />);

    expect(await screen.findByText(/ya no está entre los tuyos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'La Esperanza' })).toBeInTheDocument();
  });

  it('un 403 en la puerta del tambo vuelve al selector, no al login', async () => {
    // La lista lo trae, pero la puerta contesta 403: se lo revocaron entre los
    // dos pedidos. Un tambo sin permiso contesta 403 exista o no, así que este
    // caso y el del id inventado son el mismo, y se arreglan igual.
    window.localStorage.setItem('tambo.establecimiento', EST);
    montarApi({
      ...sesionDePrueba(usuarioEscritura, LOS_DOS),
      [`GET /establecimientos/${EST}`]: { status: 403, cuerpo: sinPermiso },
      [`GET /establecimientos/${EST2}`]: { cuerpo: elOmbu },
      ...rutasDelTableroDe(EST2),
    });
    render(<App />);

    expect(await screen.findByText(/No tenés permiso sobre ese tambo/i)).toBeInTheDocument();
    // La sesión está intacta: un 403 no es un 401.
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('tambo.token')).toBe(TOKEN);
  });

  it('con un solo tambo que rebota, no se queda en un ida y vuelta infinito', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    const falsa = montarApi({
      ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { status: 403, cuerpo: sinPermiso },
    });
    render(<App />);

    expect(await screen.findByText(/No tenés permiso sobre ese tambo/i)).toBeInTheDocument();
    // Entrar vuelve a ser un toque, y la puerta se golpeó una sola vez.
    await waitFor(() =>
      expect(falsa.pedidos.filter((p) => p.ruta === `/establecimientos/${EST}`)).toHaveLength(1),
    );
    expect(screen.getByRole('button', { name: 'La Esperanza' })).toBeInTheDocument();
  });
});
