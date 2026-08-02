// El tablero de la mañana. Se prueba lo que la pantalla **muestra** de lo que la
// respuesta trae, y no el dominio: que la 104 esté para revisar lo deciden 237
// tests de `mu/` del otro lado del `fetch`.
//
// Se renderiza la `App` entera y no el `Tablero` suelto: así el test pasa por
// el ruteo, por la verificación del establecimiento y por el cliente HTTP de
// verdad, que es donde estarían los errores de armado de URL.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { aAnimal, aCargar, aRodeo, aTablero } from '../src/ruteo';
import { montarApi, type Manejador } from './servidor';
import {
  EST,
  V103,
  V104,
  alertasVacias,
  establecimiento,
  rodeo,
  rutasDelTablero,
  sesionDePrueba,
  usuarioLectura,
  tanqueSinHoy,
} from './fixtures';

/** Monta la API con el tablero completo y lo que el test quiera cambiarle. */
function montarTablero(cambios: Record<string, Manejador> = {}) {
  window.localStorage.setItem('tambo.establecimiento', EST);
  return montarApi({
    ...sesionDePrueba(),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    ...rutasDelTablero,
    ...cambios,
  });
}

// El título de una tarjeta está en pantalla desde que se pide —la tarjeta se
// dibuja con su "cargando" adentro—, así que esperar el título no espera nada.
// Se espera una cifra, que existe solo con la respuesta ya puesta.
const esperarRodeo = () => screen.findByText('Preñez del rodeo');
const esperarTanque = () => screen.findByText('Litros del día');

/** El valor de una cifra, buscándola por su rótulo. */
function cifra(rotulo: string): string {
  const caja = screen.getByText(rotulo).closest('.cifra');
  return caja?.querySelector('.valor')?.textContent ?? '';
}

describe('las dos listas de trabajo', () => {
  it('muestran la caravana y llevan a la ficha del animal', async () => {
    montarTablero();
    render(<App />);

    // `/^104/` y no `/104/`: al lado de la fila hay ahora un atajo de carga que
    // lleva la caravana en su nombre accesible ("Cargar un evento a 104"), y sin
    // anclar matchean los dos.
    const revisar = await screen.findByRole('link', { name: /^104/ });
    // La dirección lleva de dónde se vino, para que la flecha de la ficha
    // vuelva al tablero y no al rodeo. Se arma con la constructora y no a mano:
    // así el test dice qué se espera y no cómo se codifica.
    expect(revisar).toHaveAttribute('href', aAnimal(V104, aTablero()));

    const secar = screen.getByRole('link', { name: /^103/ });
    expect(secar).toHaveAttribute('href', aAnimal(V103, aTablero()));
  });

  it('cada fila tiene su atajo, que va derecho a la carga', async () => {
    montarTablero();
    render(<App />);

    // El atajo lleva de dónde se vino **y la caravana**: con eso la pantalla de
    // carga no tiene que pedir el animal entero para escribirla en su
    // encabezado, y al terminar vuelve acá y no a la ficha.
    const atajo = await screen.findByRole('link', { name: 'Cargar un evento a 104' });
    expect(atajo).toHaveAttribute(
      'href',
      aCargar(V104, { desde: aTablero(), caravana: '104' }),
    );

    // Y la fila sigue llevando a la ficha: la caravana entera sigue siendo el
    // target grande y la acción principal no se movió.
    expect(screen.getByRole('link', { name: /^104/ })).toHaveAttribute(
      'href',
      aAnimal(V104, aTablero()),
    );
  });

  it('el de lectura no ve el atajo: no puede cargar', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    window.location.hash = '';
    montarApi({
      ...sesionDePrueba(usuarioLectura),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
    });
    render(<App />);

    // La fila sí: el rodeo se mira entero con cualquier permiso.
    expect(await screen.findByRole('link', { name: /^104/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Cargar un evento a 104' }),
    ).not.toBeInTheDocument();
  });

  it('dicen cuántas hay en el título, que es lo que se mira primero', async () => {
    montarTablero();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Para revisar (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Para secar (1)' })).toBeInTheDocument();
  });

  it('la lista con trabajo pendiente se destaca; la vacía no', async () => {
    montarTablero();
    render(<App />);

    // El tablero tiene que leerse como una lista de tareas y no como un informe:
    // "Para revisar (1)" no puede pesar lo mismo que el reparto de dietas.
    const revisar = (await screen.findByRole('heading', { name: 'Para revisar (1)' })).closest(
      '.tarjeta',
    );
    expect(revisar).toHaveClass('tarea');
    // Y la composición del rodeo, que es referencia, no se destaca.
    expect(screen.getByRole('heading', { name: 'El rodeo hoy' }).closest('.tarjeta')).not.toHaveClass(
      'tarea',
    );
  });

  it('el número se resalta sin cambiar cómo se lee el rótulo', async () => {
    montarTablero();
    render(<App />);

    // El paréntesis se estiliza, no se saca: para quien no ve la pantalla el
    // encabezado tiene que seguir diciendo "Para revisar (1)" y no "1 Para
    // revisar", que es lo que pasaría si el número se moviera adelante.
    const titulo = await screen.findByRole('heading', { name: 'Para revisar (1)' });
    expect(titulo.querySelector('.cuanto')?.textContent).toBe('(1)');
  });

  it('una lista vacía dice "ninguna": es una buena noticia, no un hueco', async () => {
    montarTablero({
      [`GET /establecimientos/${EST}/alertas`]: { cuerpo: alertasVacias },
    });
    render(<App />);

    expect(await screen.findByText(/ninguna para revisar/i)).toBeInTheDocument();
    expect(screen.getByText(/ninguna para secar/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^104/ })).not.toBeInTheDocument();
    // Sin nada que hacer no se destaca: una mañana tranquila se tiene que ver
    // distinta de una con cuatro vacas esperando, antes de leer una palabra.
    expect(
      screen.getByRole('heading', { name: 'Para revisar (0)' }).closest('.tarjeta'),
    ).not.toHaveClass('tarea');
  });
});

describe('la composición del rodeo', () => {
  it('muestra la foto del rodeo con las palabras de cada estado', async () => {
    montarTablero();
    render(<App />);

    await esperarRodeo();
    expect(cifra('Activas')).toBe('7');
    expect(cifra('En ordeñe')).toBe('3');
    expect(cifra('Secas')).toBe('4');
    expect(cifra('Vacías')).toBe('4');
    expect(cifra('Inseminadas')).toBe('2');
    expect(cifra('Preñadas')).toBe('1');
  });

  it('el porcentaje de preñez sale de la fracción del núcleo (decisión 57)', async () => {
    montarTablero();
    render(<App />);

    // 1 preñada sobre 7 activas: el núcleo manda 0,1428… y la pantalla escribe
    // 14 %. Sin multiplicar decía "0 %", que es lo que mostraba la demo.
    await esperarRodeo();
    expect(cifra('Preñez del rodeo')).toBe('14 %');
    expect(cifra('Descarte')).toBe('13 %');
  });

  it('un promedio que el núcleo no pudo calcular dice "sin datos", nunca 0', async () => {
    montarTablero();
    render(<App />);

    await esperarRodeo();
    expect(cifra('Días abiertos')).toBe('127 días');
    // `intervalo_entre_partos_promedio` viene null: ninguna tiene dos partos
    // limpios todavía, y eso no es un cero.
    expect(cifra('Entre partos')).toBe('sin datos');
    // Y la mortalidad sí es cero de verdad, que se dice "0 %": las dos mitades
    // de la decisión 37 en la misma tarjeta.
    expect(cifra('Mortalidad')).toBe('0 %');
  });

  it('reparte las dietas en el orden del ciclo productivo', async () => {
    montarTablero();
    render(<App />);

    await esperarRodeo();
    // La categoría y su cuenta, sin la flecha: lo que se afirma acá es el orden
    // —el del ciclo productivo y no el alfabético— y a dónde lleva cada renglón
    // se prueba abajo.
    const dietas = [...document.querySelectorAll('.reparto li')].map(
      (li) =>
        `${li.querySelector('span')?.textContent ?? ''}${li.querySelector('.cuenta')?.textContent ?? ''}`,
    );
    expect(dietas).toEqual([
      'Recría3',
      'Lactancia temprana1',
      'Lactancia media1',
      'Lactancia tardía1',
      'Preparto0',
      'Vaca seca1',
    ]);
  });

  it('y cada renglón lleva al rodeo filtrado por esa categoría', async () => {
    // El filtro ya existía —el chip, la cuenta y el parámetro `cat`— y lo único
    // que faltaba era la puerta. Quien planta la ración lee el número y toca
    // para ver cuáles son.
    montarTablero();
    render(<App />);

    await esperarRodeo();
    const destinos = [...document.querySelectorAll('.reparto.tocable a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(destinos).toEqual([
      aRodeo({ cat: 'RECRIA' }),
      aRodeo({ cat: 'LACTANCIA_TEMPRANA' }),
      aRodeo({ cat: 'LACTANCIA_MEDIA' }),
      aRodeo({ cat: 'LACTANCIA_TARDIA' }),
      aRodeo({ cat: 'PREPARTO' }),
      aRodeo({ cat: 'SECA' }),
    ]);
  });
});

describe('el tanque de hoy', () => {
  it('muestra los litros del día y los litros por vaca en ordeñe', async () => {
    montarTablero();
    render(<App />);

    await esperarTanque();
    expect(cifra('Litros del día')).toBe('72 L');
    expect(cifra('Por vaca en ordeñe')).toBe('24,0 L');
  });

  it('lo pide sin período, porque el día lo tiene que decir el servidor', async () => {
    const falsa = montarTablero();
    render(<App />);

    await esperarTanque();
    // Acotar el período con el reloj del celular podría correr el borde un día
    // y mandar a cargar un tanque que ya está cargado (decisión 52).
    expect(falsa.pedidos.map((p) => p.ruta)).toContain(`/establecimientos/${EST}/tanque`);
  });

  it('si falta el de hoy, lo dice y ofrece cargarlo a un toque', async () => {
    montarTablero({
      [`GET /establecimientos/${EST}/tanque`]: { cuerpo: tanqueSinHoy },
    });
    render(<App />);

    expect(await screen.findByText(/todavía no cargaste el tanque/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cargar el tanque de hoy/i })).toHaveAttribute(
      'href',
      '#/tanque',
    );
    // Y los litros faltantes se dicen faltantes, no cero.
    expect(cifra('Litros del día')).toBe('sin datos');
    expect(cifra('Por vaca en ordeñe')).toBe('sin datos');
  });
});

describe('cuando una lectura no vuelve', () => {
  it('la tarjeta caída no se lleva puesta la pantalla, y se puede reintentar', async () => {
    let intentos = 0;
    montarTablero({
      [`GET /establecimientos/${EST}/rodeo`]: () => {
        intentos += 1;
        return intentos === 1
          ? { status: 500, cuerpo: { codigo: 'ERROR_INTERNO', mensaje: 'Se cayó la base.' } }
          : { cuerpo: rodeo };
      },
    });
    render(<App />);

    // La tarjeta del rodeo se cayó…
    expect(await screen.findByText('Se cayó la base.')).toBeInTheDocument();
    // …y las otras dos siguieron su camino (decisión 56).
    await esperarTanque();
    expect(screen.getByRole('link', { name: /^104/ })).toBeInTheDocument();
    expect(cifra('Litros del día')).toBe('72 L');

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Preñez del rodeo')).toBeInTheDocument();
    expect(cifra('Activas')).toBe('7');
  });
});
