// Mi cuenta: lo único de administración que vive en la UI, porque es del
// tambero y no del admin. Lo que importa probar es que el 401 de "esa no es tu
// contraseña actual" **no** lo eche de la sesión: es el mismo status y el mismo
// código que un token vencido, y confundirlos manda al login a alguien que solo
// se equivocó tipeando.

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { montarApi, type ApiFalsa, type Manejador } from './servidor';
import {
  EST,
  TOKEN,
  establecimiento,
  rutasDelTablero,
  sesionDePrueba,
  usuarioAdmin,
  usuarioEscritura,
} from './fixtures';

function montarCuenta(cambios: Record<string, Manejador> = {}, usuario = usuarioEscritura): ApiFalsa {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = '#/cuenta';
  return montarApi({
    ...sesionDePrueba(usuario),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    ...rutasDelTablero,
    'POST /auth/password': { status: 204 },
    ...cambios,
  });
}

const cambiar = async (actual: string, nueva: string) => {
  await userEvent.type(screen.getByLabelText('Contraseña actual'), actual);
  await userEvent.type(screen.getByLabelText(/contraseña nueva/i), nueva);
  await userEvent.click(screen.getByRole('button', { name: 'Cambiar la contraseña' }));
};

describe('quién soy', () => {
  it('muestra el nombre y el email de la sesión', async () => {
    montarCuenta();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Paulo' })).toBeInTheDocument();
    expect(screen.getByText('paulo@demo.local')).toBeInTheDocument();
  });

  it('al admin le dice que entra a todos los tambos, aunque no tenga permisos', async () => {
    montarCuenta({}, usuarioAdmin);
    render(<App />);

    expect(await screen.findByText(/entrás a todos los tambos/i)).toBeInTheDocument();
  });

  it('se llega desde el tablero', async () => {
    montarCuenta();
    window.location.hash = '';
    render(<App />);

    await screen.findByRole('heading', { name: 'La Esperanza' });
    await userEvent.click(screen.getByRole('link', { name: 'Mi cuenta' }));

    expect(await screen.findByRole('heading', { name: 'Mi cuenta' })).toBeInTheDocument();
  });
});

describe('cambiar mi contraseña', () => {
  it('manda la actual y la nueva, y avisa que quedó cambiada', async () => {
    const falsa = montarCuenta();
    render(<App />);
    await screen.findByRole('heading', { name: 'Cambiar mi contraseña' });

    await cambiar('demo-escritura', 'la-nueva-larga');

    expect(await screen.findByText(/La próxima vez que entres, usá la nueva/)).toBeInTheDocument();
    expect(falsa.cuerpoDe('POST /auth/password')).toEqual({
      actual: 'demo-escritura',
      nueva: 'la-nueva-larga',
    });
    // Los campos quedan vacíos: no se deja una contraseña escrita en pantalla.
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('');
    expect(screen.getByLabelText(/contraseña nueva/i)).toHaveValue('');
    // Y la sesión sigue abierta: quien la cambió es quien está usando la app.
    expect(window.localStorage.getItem('tambo.token')).toBe(TOKEN);
  });

  it('errarle a la actual muestra el mensaje y NO cierra la sesión', async () => {
    const mensaje = 'La contraseña actual no coincide. Probá de nuevo.';
    montarCuenta({
      'POST /auth/password': { status: 401, cuerpo: { codigo: 'NO_AUTENTICADO', mensaje } },
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Cambiar mi contraseña' });

    await cambiar('la-que-no-era', 'la-nueva-larga');

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    // Sigue en su cuenta, no en el login: el 401 hablaba de lo que escribió acá.
    expect(screen.getByRole('heading', { name: 'Mi cuenta' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('tambo.token')).toBe(TOKEN);
  });

  it('las contraseñas no se ven, ni siquiera después de mandarlas', async () => {
    montarCuenta();
    render(<App />);
    await screen.findByRole('heading', { name: 'Cambiar mi contraseña' });

    await cambiar('demo-escritura', 'la-nueva-larga');

    await waitFor(() => expect(screen.getByText(/usá la nueva/)).toBeInTheDocument());
    expect(document.body.textContent).not.toContain('la-nueva-larga');
    expect(screen.getByLabelText(/contraseña nueva/i)).toHaveAttribute('type', 'password');
  });

  it('el formulario declara el mínimo de 8 que la API exige', async () => {
    montarCuenta();
    render(<App />);
    await screen.findByRole('heading', { name: 'Cambiar mi contraseña' });

    // Es validación de **forma** y no de dominio: el largo lo dice §9 y quien
    // lo hace cumplir de verdad es la API con su 400. El campo lo declara para
    // que el browser lo diga antes, en el corral y sin gastar un viaje. (jsdom
    // no implementa `tooShort`, así que lo que se afirma es la declaración.)
    expect(screen.getByLabelText(/contraseña nueva/i)).toHaveAttribute('minLength', '8');
    expect(screen.getByText('De 8 caracteres para arriba.')).toBeInTheDocument();
  });
});
