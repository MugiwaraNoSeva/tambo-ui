// El entregable visible de la Parte 1: elegir tambo, conectarse y quedar
// conectado. Se prueba lo que la pantalla muestra y lo que manda — el dominio
// ya está probado del otro lado del `fetch`.

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { montarApi } from './servidor';
import { EST, establecimiento } from './fixtures';

describe('conexión con el tambo', () => {
  it('sin tambo elegido, pide el id', () => {
    montarApi({});
    render(<App />);
    expect(screen.getByRole('heading', { name: /en qué tambo estás/i })).toBeInTheDocument();
  });

  it('verifica el id contra la API antes de guardarlo, y queda conectado', async () => {
    const falsa = montarApi({ [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento } });
    render(<App />);

    await userEvent.type(screen.getByLabelText(/id del establecimiento/i), EST);
    await userEvent.click(screen.getByRole('button', { name: 'Conectar' }));

    expect(await screen.findByText('Conectado a La Esperanza')).toBeInTheDocument();
    expect(falsa.pedidos[0]?.ruta).toBe(`/establecimientos/${EST}`);
    expect(window.localStorage.getItem('tambo.establecimiento')).toBe(EST);
  });

  it('un id que no existe no se guarda, y el mensaje de la API se muestra tal cual', async () => {
    const mensaje = `No existe el establecimiento con id ${EST}.`;
    montarApi({
      [`GET /establecimientos/${EST}`]: {
        status: 404,
        cuerpo: { codigo: 'NO_ENCONTRADO', mensaje },
      },
    });
    render(<App />);

    await userEvent.type(screen.getByLabelText(/id del establecimiento/i), EST);
    await userEvent.click(screen.getByRole('button', { name: 'Conectar' }));

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(window.localStorage.getItem('tambo.establecimiento')).toBeNull();
  });

  it('con un tambo ya elegido arranca conectada, sin volver a preguntar', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    montarApi({ [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento } });
    render(<App />);

    expect(await screen.findByText('Conectado a La Esperanza')).toBeInTheDocument();
    expect(screen.queryByLabelText(/id del establecimiento/i)).not.toBeInTheDocument();
  });

  it('lo saluda por su nombre, que es lo que el tambero reconoce (decisión 53)', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    montarApi({
      [`GET /establecimientos/${EST}`]: { cuerpo: { ...establecimiento, nombre: 'El Ombú' } },
    });
    render(<App />);

    // El nombre, y no el uuid: en el encabezado y en la tarjeta.
    expect(await screen.findByText('Conectado a El Ombú')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'El Ombú' })).toBeInTheDocument();
  });

  it('cambiar de tambo olvida el guardado y vuelve a preguntar', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    montarApi({ [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento } });
    render(<App />);

    await screen.findByText('Conectado a La Esperanza');
    await userEvent.click(screen.getByRole('button', { name: /cambiar de tambo/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/id del establecimiento/i)).toBeInTheDocument(),
    );
    expect(window.localStorage.getItem('tambo.establecimiento')).toBeNull();
  });
});
