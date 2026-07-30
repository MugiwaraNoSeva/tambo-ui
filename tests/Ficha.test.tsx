// La ficha del animal. Se prueba que muestre lo que las cuatro respuestas
// traen —incluidos los `null`, que son el caso interesante (decisión 37)— y que
// el historial distinga un evento anulado de la anulación que lo deshizo.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { montarApi, type ApiFalsa, type Manejador } from './servidor';
import {
  EST,
  V102,
  V106,
  animal102,
  establecimiento,
  eventos105,
  eventos106,
  kpis102,
  kpis106,
  lactanciasSinControles,
  rutasDeLaFicha,
  sesionDePrueba,
} from './fixtures';

function montarFicha(cambios: Record<string, Manejador> = {}): ApiFalsa {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = `#/animales/${V102}`;
  return montarApi({
    ...sesionDePrueba(),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    ...rutasDeLaFicha,
    ...cambios,
  });
}

const cifra = (rotulo: string): string => {
  const caja = screen.getByText(rotulo).closest('.cifra');
  return caja?.querySelector('.valor')?.textContent ?? '';
};

const dato = (rotulo: string): string => {
  const caja = screen.getByText(rotulo).closest('.dato');
  return caja?.querySelector('dd')?.textContent ?? '';
};

const esperarFicha = () => screen.findByText('Días abiertos');

describe('el estado del animal', () => {
  it('pone la caravana en el encabezado y los dos ejes con palabras', async () => {
    montarFicha();
    render(<App />);

    // La caravana, y no el uuid, en la barra de arriba: es lo que identifica al
    // animal para quien lo está mirando.
    expect(await screen.findByRole('heading', { name: '102' })).toBeInTheDocument();
    expect(screen.getByText('Vacía')).toBeInTheDocument();
    expect(screen.getByText('En ordeñe')).toBeInTheDocument();
  });

  it('muestra las fechas en DD/MM/AAAA y dice "sin datos" donde no hay', async () => {
    montarFicha();
    render(<App />);
    await esperarFicha();

    expect(dato('Nacimiento')).toBe('12/03/2022');
    expect(dato('Último parto')).toBe('13/01/2026');
    // La 102 está vacía: no hay celo ni inseminación registrados, y eso se dice.
    expect(dato('Último celo')).toBe('sin datos');
    expect(dato('Última inseminación')).toBe('sin datos');
  });
});

describe('los números', () => {
  it('muestra los KPIs y nunca convierte un null en 0 (decisión 37)', async () => {
    montarFicha();
    render(<App />);
    await esperarFicha();

    expect(cifra('Días abiertos')).toBe('197 días');
    expect(cifra('Servicios por preñez')).toBe('1,0');
    expect(cifra('Hembras nacidas vivas')).toBe('1');
    // 1600 días son 4,4 años, que es como se lee una edad.
    expect(cifra('Edad')).toBe('4,4 años');
    // Todavía no hay un segundo parto ni un primer servicio de este ciclo.
    expect(cifra('Entre partos')).toBe('sin datos');
    expect(cifra('Parto a 1er servicio')).toBe('sin datos');
    expect(cifra('Edad al primer parto')).toBe('sin datos');
  });

  it('avisa cuando hay ciclos forzados que quedan fuera de la cuenta', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/kpis`]: { cuerpo: kpis106 },
    });
    render(<App />);

    expect(await screen.findByText(/hay ciclos que no cuentan/i)).toBeInTheDocument();
    expect(screen.getByText(/1 ciclo tiene/)).toBeInTheDocument();
  });
});

describe('la lactancia y su curva', () => {
  it('dibuja un punto por control y marca el pico con su número', async () => {
    montarFicha();
    render(<App />);
    await esperarFicha();

    expect(
      screen.getByRole('heading', { name: 'Lactancia 3 (en curso)' }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('.curva .punto')).toHaveLength(6);
    expect(document.querySelectorAll('.curva .punto.pico')).toHaveLength(1);
    // El pico dice su número: buscarlo contando cuadraditos no es buscarlo.
    expect(document.querySelector('.curva .rotulo-pico')?.textContent).toBe('28,0 L');
  });

  it('cuenta la curva en palabras, que es lo único que se lee sin verla', async () => {
    montarFicha();
    render(<App />);
    await esperarFicha();

    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Curva de lactancia con 6 controles, del día 30 al 180 en leche, con el pico de 28,0 L al día 60.',
    );
  });

  it('muestra el pico y la acumulada afuera del dibujo', async () => {
    montarFicha();
    render(<App />);
    await esperarFicha();

    expect(cifra('Pico')).toBe('28,0 L');
    expect(cifra('Al día en leche')).toBe('60');
    expect(cifra('Acumulada')).toBe('4666 L');
    expect(cifra('RCS máximo')).toBe('320');
  });

  it('una lactancia sin controles no dibuja una curva vacía: lo dice', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/lactancias`]: {
        cuerpo: lactanciasSinControles,
      },
    });
    render(<App />);

    expect(await screen.findByText(/todavía no hay controles lecheros/i)).toBeInTheDocument();
    expect(document.querySelector('.curva')).toBeNull();
    // Y la acumulada de una lactancia sin controles es "sin datos", no 0.
    expect(cifra('Acumulada')).toBe('sin datos');
  });
});

describe('el historial', () => {
  it('va del último al primero y describe lo que el evento trae adentro', async () => {
    montarFicha();
    render(<App />);
    await esperarFicha();

    const eventos = [...document.querySelectorAll('.historial > li')];
    expect(eventos[0]?.textContent).toContain('12/07/2026 — Control lechero');
    expect(eventos[0]?.textContent).toContain('19,0 L · grasa 4,0 % · proteína 3,5 % · RCS 320');
    expect(eventos[eventos.length - 1]?.textContent).toContain('16/03/2025 — Alta');
    expect(eventos[eventos.length - 1]?.textContent).toContain(
      'nacida el 12/03/2022 · entra con 2 lactancias',
    );
    expect(screen.getByText(/toro Urubó · pajuela HOL-4521/)).toBeInTheDocument();
    // La misma frase sale también en la tarjeta de la lactancia; acá se afirma
    // sobre la del historial.
    const parto = eventos.find((e) => e.textContent?.includes('— Parto'));
    expect(parto?.textContent).toContain('1 cría: hembra, nacida viva');
  });

  it('distingue el evento anulado de la anulación que lo deshizo', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: eventos105 },
    });
    render(<App />);
    await esperarFicha();

    const eventos = [...document.querySelectorAll('.historial > li')];
    // Arriba de todo, la anulación: no está anulada, deshace.
    expect(eventos[0]?.textContent).toContain('Anulación');
    expect(eventos[0]?.className).not.toContain('anulado');
    expect(eventos[0]?.textContent).toContain('deshace un evento anterior');
    expect(eventos[0]?.textContent).toContain('Fecha equivocada al pasar de la libreta');

    // Y el celo del 30/04 sí quedó anulado, dicho con la palabra.
    const anulado = eventos.find((e) => e.textContent?.includes('30/04/2026'));
    expect(anulado?.className).toContain('anulado');
    expect(anulado?.textContent).toContain('anulado');
  });

  it('marca los forzados: el que se cargó con "confirmar igual"', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: eventos106 },
    });
    render(<App />);
    await esperarFicha();

    expect(screen.getByText('cargado con "confirmar igual"')).toBeInTheDocument();
    expect(screen.getByText(/1 cría: hembra, nacida muerta/)).toBeInTheDocument();
  });
});

describe('los ciclos', () => {
  it('van del último al primero con su resultado en palabras', async () => {
    montarFicha();
    render(<App />);
    await esperarFicha();

    const ciclos = [...document.querySelectorAll('.tarjeta')].find((t) =>
      t.querySelector('h2')?.textContent?.includes('Los ciclos'),
    );
    const filas = [...(ciclos?.querySelectorAll('li') ?? [])];
    expect(filas[0]?.textContent).toContain('Ciclo 2 — En curso');
    expect(filas[1]?.textContent).toContain('Ciclo 1 — Terminó en parto');
    expect(filas[1]?.textContent).toContain('1 servicio');
  });
});

describe('cuando una lectura de la ficha no vuelve', () => {
  it('la proyección es la única que voltea la pantalla: de ella sale la caravana', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}`]: {
        status: 404,
        cuerpo: { codigo: 'NO_ENCONTRADO', mensaje: `No existe el animal con id ${V102}.` },
      },
    });
    render(<App />);

    expect(await screen.findByText(`No existe el animal con id ${V102}.`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ficha del animal' })).toBeInTheDocument();
  });

  it('las otras tres se caen solas y se reintentan sin recargar la ficha', async () => {
    let intentos = 0;
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/kpis`]: () => {
        intentos += 1;
        return intentos === 1
          ? { status: 500, cuerpo: { codigo: 'ERROR_INTERNO', mensaje: 'Se cayó la base.' } }
          : { cuerpo: kpis102 };
      },
    });
    render(<App />);

    expect(await screen.findByText('Se cayó la base.')).toBeInTheDocument();
    // El historial y la curva llegaron igual (decisión 56).
    expect(await screen.findByText(/toro Urubó/)).toBeInTheDocument();
    expect(document.querySelectorAll('.curva .punto')).toHaveLength(6);

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await esperarFicha()).toBeInTheDocument();
  });
});

describe('el animal de baja', () => {
  it('lo dice con un aviso, no solo con una etiqueta', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    window.location.hash = `#/animales/${V106}`;
    const deBaja = {
      ...animal102,
      animal_id: V106,
      caravana: '107',
      proyeccion: {
        ...animal102.proyeccion,
        estado: { ...animal102.proyeccion.estado, vida: 'BAJA' as const, motivo_baja: 'venta' as const },
      },
    };
    montarApi({
    ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      [`GET /establecimientos/${EST}/animales/${V106}`]: { cuerpo: deBaja },
      [`GET /establecimientos/${EST}/animales/${V106}/kpis`]: { cuerpo: kpis106 },
      [`GET /establecimientos/${EST}/animales/${V106}/lactancias`]: {
        cuerpo: lactanciasSinControles,
      },
      [`GET /establecimientos/${EST}/animales/${V106}/eventos`]: { cuerpo: eventos106 },
    });
    render(<App />);

    expect(await screen.findByText(/fuera del rodeo/i)).toBeInTheDocument();
    expect(screen.getByText(/salió por venta/i)).toBeInTheDocument();
    expect(screen.getByText('De baja')).toBeInTheDocument();

    // Y no se le ofrece cargar eventos: la baja es terminal (decisión 7), así
    // que el botón sería un formulario entero cuyo único final es un rechazo
    // que ni siquiera se puede forzar. Lo encontró la auditoría de cierre
    // (decisión 65). La salida sí está: anular la baja desde el historial.
    expect(screen.queryByRole('link', { name: 'Cargar un evento' })).not.toBeInTheDocument();
    expect(screen.getByText(/anulá la baja desde el historial/i)).toBeInTheDocument();
  });
});
