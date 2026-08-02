// La regla que ordena la navegación: **la barra vive en los lugares, no en las
// tareas**.
//
//   · llevan barra y no llevan flecha: el tablero, el rodeo y el tanque;
//   · llevan flecha y no llevan barra: la ficha, la carga, el alta, la corrida,
//     mi cuenta, y el panel del admin entero.
//
// Con eso nunca hay que decidir si el "atrás" saca de la pestaña o del
// formulario, y un pulgar sucio no puede abandonar una corrida de veinticinco
// tactos de un toque mal dado. Se prueba pantalla por pantalla porque la regla
// solo sirve si no tiene excepciones: la primera que se olvide vuelve a hacer
// que haya que pensar antes de tocar atrás.

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { App } from '../src/App';
import { anotarFechaDeLaRespuesta } from '../src/reloj';
import { montarApi } from './servidor';
import {
  EST,
  HOY,
  V102,
  alertas,
  animal102,
  animales,
  establecimiento,
  eventos102,
  historialDeConfig,
  losDosTambos,
  rodeo,
  sesionDePrueba,
  tanque,
  tanqueDelPeriodo,
  usuarioAdmin,
} from './fixtures';

/** Todas las rutas que cualquiera de las pantallas de abajo pueda pedir. */
function montar(hash: string, admin = false): void {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = hash;
  anotarFechaDeLaRespuesta({ fecha: HOY });
  montarApi({
    ...sesionDePrueba(admin ? usuarioAdmin : undefined, admin ? losDosTambos : undefined),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    [`GET /establecimientos/${EST}/alertas`]: { cuerpo: alertas },
    [`GET /establecimientos/${EST}/rodeo`]: { cuerpo: rodeo },
    [`GET /establecimientos/${EST}/tanque`]: { cuerpo: tanque },
    [`GET /establecimientos/${EST}/tanque?desde=2026-07-01&hasta=${HOY}`]: {
      cuerpo: tanqueDelPeriodo,
    },
    [`GET /establecimientos/${EST}/animales`]: { cuerpo: animales },
    [`GET /establecimientos/${EST}/animales/${V102}`]: { cuerpo: animal102 },
    [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: eventos102 },
    [`GET /establecimientos/${EST}/configuraciones`]: { cuerpo: historialDeConfig },
  });
}

const barra = () => screen.queryByRole('navigation', { name: 'Secciones' });
const flecha = () => screen.queryByRole('link', { name: 'Volver' });

describe('los lugares llevan barra y no llevan flecha', () => {
  it.each([
    ['el tablero', '#/', 'La Esperanza', 'Inicio'],
    ['el rodeo', '#/rodeo', 'El rodeo', 'Rodeo'],
    ['el tanque', '#/tanque', 'El tanque', 'Tanque'],
  ])('%s', async (_nombre, hash, titulo, pestania) => {
    montar(hash);
    render(<App />);
    await screen.findByRole('heading', { name: titulo });

    const nav = barra();
    expect(nav).toBeInTheDocument();
    // Las tres pestañas, con su palabra. Sin íconos: no hay pictograma que diga
    // "tanque" sin que haya que aprenderlo.
    expect(within(nav as HTMLElement).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Inicio',
      'Rodeo',
      'Tanque',
    ]);
    // Y la que se está mirando lo dice para quien no ve la pantalla — las otras
    // tres señales (el borde de arriba, el peso y la tinta) son CSS.
    expect(within(nav as HTMLElement).getByRole('link', { name: pestania })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(nav as HTMLElement)
        .getAllByRole('link')
        .filter((a) => a.getAttribute('aria-current') === 'page'),
    ).toHaveLength(1);

    expect(flecha()).not.toBeInTheDocument();
  });

  it('el rodeo filtrado sigue siendo el rodeo: la pestaña queda marcada', async () => {
    // Se compara el camino y no el hash entero, o un `?cat=` apagaría la pestaña.
    montar('#/rodeo?cat=LACTANCIA_TEMPRANA');
    render(<App />);
    await screen.findByRole('heading', { name: 'El rodeo' });

    expect(
      within(barra() as HTMLElement).getByRole('link', { name: 'Rodeo' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('y las tres llevan "Mi cuenta" en el encabezado, que es el criterio inverso', async () => {
    // Lo que se hace todo el día va abajo, en la zona del pulgar; lo que se hace
    // una vez por turno va arriba y lejos, donde el dedo no llega solo.
    montar('#/');
    render(<App />);
    await screen.findByRole('heading', { name: 'La Esperanza' });

    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Mi cuenta' }),
    ).toBeInTheDocument();
  });
});

describe('las tareas llevan flecha y no llevan barra', () => {
  it.each([
    ['la ficha', `#/animales/${V102}`, '102'],
    ['la carga', `#/animales/${V102}/cargar`, /102/],
    ['el alta', '#/alta', 'Dar de alta'],
    ['la corrida', '#/corrida/para-revisar', /^Corrida/],
    ['mi cuenta', '#/cuenta', 'Mi cuenta'],
  ])('%s', async (_nombre, hash, titulo) => {
    montar(hash);
    render(<App />);
    await screen.findByRole('heading', { name: titulo });

    expect(flecha()).toBeInTheDocument();
    expect(barra()).not.toBeInTheDocument();
  });

  it('el panel del admin tampoco la lleva, y eso es a propósito', async () => {
    // Ahí la jerarquía es el punto y está argumentada por frecuencia: entrar es
    // de todos los días, repartir permisos de vez en cuando, archivar un tambo
    // una vez en la vida. Una barra plana las pondría a las tres al mismo nivel.
    montar('#/admin', true);
    render(<App />);
    await screen.findByRole('heading', { name: 'Administración' });

    expect(barra()).not.toBeInTheDocument();
  });
});
