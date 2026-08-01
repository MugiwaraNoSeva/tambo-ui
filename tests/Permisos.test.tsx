// Qué ve y qué no ve cada rol.
//
// **Nada de esto es seguridad.** La cerradura está en la API, que contesta 403;
// esto es una cortesía con el que mira, para que no se le ofrezca un formulario
// cuyo único final posible es un rechazo. Por eso se prueba lo que **está en
// pantalla** y no lo que se puede o no se puede hacer.
//
// Los tres roles, y el que importa es el que nadie prueba: el de `lectura`. El
// admin es el otro: viene con `permisos: []` y puede todo, así que una cuenta
// que mire solo los permisos lo deja mirando una UI de solo lectura.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import type { Usuario } from '../src/api/tipos';
import { anotarFechaDeLaRespuesta } from '../src/reloj';
import { aPanelTambo } from '../src/ruteo';
import { montarApi } from './servidor';
import {
  EST,
  HOY,
  V102,
  establecimiento,
  personas,
  rutasDeLaFicha,
  rutasDelTablero,
  sesionDePrueba,
  tanqueDelPeriodo,
  tanqueSinHoy,
  usuarioAdmin,
  usuarioEscritura,
  usuarioLectura,
} from './fixtures';

function montarTodo(usuario: Usuario, hash = '') {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = hash;
  anotarFechaDeLaRespuesta({ fecha: HOY });
  return montarApi({
    ...sesionDePrueba(usuario),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    // Del panel, que es por donde entra el admin.
    'GET /usuarios': { cuerpo: personas },
    ...rutasDelTablero,
    ...rutasDeLaFicha,
    // Sin el registro de hoy a propósito: es el estado en que el tablero ofrece
    // "Cargar el tanque de hoy". Con el tanque ya cargado, el test del de
    // lectura pasaría solo porque el botón no le toca a nadie.
    [`GET /establecimientos/${EST}/tanque`]: { cuerpo: tanqueSinHoy },
    [`GET /establecimientos/${EST}/tanque?desde=2026-07-01&hasta=${HOY}`]: {
      cuerpo: tanqueDelPeriodo,
    },
  });
}

describe('el rol de lectura', () => {
  it('en el tablero no ve las puertas de carga', async () => {
    montarTodo(usuarioLectura);
    render(<App />);

    await screen.findByText('Preñez del rodeo');
    // Mira todo lo que hay para mirar…
    expect(screen.getByRole('link', { name: /ver el rodeo entero/i })).toBeInTheDocument();
    expect(await screen.findByText('Litros del día')).toBeInTheDocument();
    // …y no ve ninguna puerta de carga. Que no estén, no que estén y fallen.
    expect(screen.queryByRole('link', { name: /dar de alta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /cargar el tanque/i })).not.toBeInTheDocument();
  });

  it('en la ficha no ve ni cargar ni anular, pero ve el historial entero', async () => {
    montarTodo(usuarioLectura, `#/animales/${V102}`);
    render(<App />);

    await screen.findByText(/toro Urubó/);
    expect(screen.queryByRole('link', { name: /cargar un evento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anular/i })).not.toBeInTheDocument();
    // El log se mira igual: es lectura, y es lo que explica por qué el animal
    // está como está.
    expect(screen.getByText(/El historial/)).toBeInTheDocument();
  });

  it('si igual llega al alta a mano, le dice por qué no puede', async () => {
    montarTodo(usuarioLectura, '#/alta');
    render(<App />);

    expect(await screen.findByText(/Tu permiso acá es de lectura/i)).toBeInTheDocument();
    expect(screen.getByText(/No podés dar de alta animales/i)).toBeInTheDocument();
    // Y no hay formulario que llenar para comerse un 403 al final.
    expect(screen.queryByRole('button', { name: 'Dar de alta' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Caravana')).not.toBeInTheDocument();
  });

  it('si igual llega a la carga de un evento, lo mismo', async () => {
    montarTodo(usuarioLectura, `#/animales/${V102}/cargar`);
    render(<App />);

    expect(await screen.findByText(/No podés cargar eventos/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cargar' })).not.toBeInTheDocument();
  });

  it('en el tanque ve el período y no el formulario', async () => {
    montarTodo(usuarioLectura, '#/tanque');
    render(<App />);

    expect(await screen.findByText(/No podés cargar el tanque/i)).toBeInTheDocument();
    // El período es una lectura y se mira igual.
    expect(await screen.findByText('Litros del período')).toBeInTheDocument();
    expect(screen.queryByLabelText('Litros')).not.toBeInTheDocument();
  });
});

describe('el rol de escritura', () => {
  it('ve todas las puertas de carga', async () => {
    montarTodo(usuarioEscritura);
    render(<App />);

    await screen.findByText('Preñez del rodeo');
    expect(screen.getByRole('link', { name: /dar de alta/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /cargar el tanque/i })).toBeInTheDocument();
  });

  it('en la ficha puede cargar y anular', async () => {
    montarTodo(usuarioEscritura, `#/animales/${V102}`);
    render(<App />);

    await screen.findByText(/toro Urubó/);
    expect(screen.getByRole('link', { name: /cargar un evento/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anular este evento/i })).toBeInTheDocument();
  });
});

describe('el admin, que no tiene permisos y puede todo', () => {
  /**
   * El admin **no pasa por el selector**: entra al tambo desde su panel. Lo que
   * estos dos tests prueban no cambió —que `permisos: []` no lo deja mirando una
   * UI de solo lectura— pero se prueba por la puerta que ahora usa, que es la
   * única que tiene.
   */
  async function entrarAlTambo(hash = '') {
    montarTodo(usuarioAdmin, aPanelTambo(EST));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /Entrar al tambo/ }));
    if (hash !== '') window.location.hash = hash;
  }

  it('ve las puertas de carga aunque su lista de permisos venga vacía', async () => {
    expect(usuarioAdmin.permisos).toEqual([]);
    await entrarAlTambo();

    await screen.findByText('Preñez del rodeo');
    expect(screen.getByRole('link', { name: /dar de alta/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /cargar el tanque/i })).toBeInTheDocument();
  });

  it('y también puede anular', async () => {
    await entrarAlTambo(`#/animales/${V102}`);

    await screen.findByText(/toro Urubó/);
    expect(screen.getByRole('button', { name: /anular este evento/i })).toBeInTheDocument();
  });
});
