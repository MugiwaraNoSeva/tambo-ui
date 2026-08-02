// El tanque: cargar los litros del día y mirar el período. Acá el período **sí**
// va acotado —el default es el mes en curso— y por eso aparecen los días sin
// cargar, que sin bordes la API no puede calcular (decisión 49).

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { anotarFechaDeLaRespuesta } from '../src/reloj';
import { montarApi, type ApiFalsa, type Manejador } from './servidor';
import { EST, HOY, establecimiento, tanqueDelPeriodo, sesionDePrueba } from './fixtures';

const PERIODO = `/establecimientos/${EST}/tanque?desde=2026-07-01&hasta=${HOY}`;
const RUTA_POST = `POST /establecimientos/${EST}/tanque`;

// Los otros dos períodos que los atajos pueden pedir, contados sobre el
// 29/07/2026 del servidor: siete días que terminan hoy, y treinta.
const ULTIMOS_7 = `/establecimientos/${EST}/tanque?desde=2026-07-23&hasta=${HOY}`;
const ULTIMOS_30 = `/establecimientos/${EST}/tanque?desde=2026-06-30&hasta=${HOY}`;

function montarTanque(cambios: Record<string, Manejador> = {}): ApiFalsa {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = '#/tanque';
  anotarFechaDeLaRespuesta({ fecha: HOY });
  return montarApi({
    ...sesionDePrueba(),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    [`GET ${PERIODO}`]: { cuerpo: tanqueDelPeriodo },
    [`GET ${ULTIMOS_7}`]: { cuerpo: tanqueDelPeriodo },
    [`GET ${ULTIMOS_30}`]: { cuerpo: tanqueDelPeriodo },
    [RUTA_POST]: { status: 201, cuerpo: { id: 'r1', fecha: HOY, litros: 72, lote: null } },
    ...cambios,
  });
}

/** Un atajo del período, buscado por el nombre de su grupo. */
const atajo = (rotulo: string): HTMLElement =>
  within(screen.getByRole('group', { name: 'El período: atajos' })).getByRole('button', {
    name: rotulo,
  });

const cifra = (rotulo: string): string => {
  const caja = screen.getByText(rotulo).closest('.cifra');
  return caja?.querySelector('.valor')?.textContent ?? '';
};

describe('el período', () => {
  it('arranca en el mes en curso, cortando el día del servidor sin calcular fechas', async () => {
    const falsa = montarTanque();
    render(<App />);

    await screen.findByText('Litros del período');
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-07-01');
    expect(screen.getByLabelText('Hasta')).toHaveValue(HOY);
    expect(falsa.pedidos.map((p) => p.ruta)).toContain(PERIODO);
  });

  it('muestra los totales y los días que quedaron sin cargar', async () => {
    montarTanque();
    render(<App />);

    await screen.findByText('Litros del período');
    expect(cifra('Litros del período')).toBe('639 L');
    expect(cifra('Promedio por día')).toBe('71,0 L');
    expect(cifra('Por vaca en ordeñe hoy')).toBe('24,0 L');
    expect(cifra('Días cargados')).toBe('9');

    // El hueco silencioso de la decisión 33, dicho con su fecha.
    expect(screen.getByText('1 día sin cargar en este período')).toBeInTheDocument();
    expect(screen.getByText('25/07/2026')).toBeInTheDocument();
    expect(cifra('Días sin cargar')).toBe('1');
  });

  /**
   * Los tres períodos que se piden siempre, a un toque. Antes cambiarlo costaba
   * seis —tres por calendario nativo— para llegar a uno de estos tres.
   */
  it('cada atajo deja los dos calendarios en su rango y se marca como puesto', async () => {
    montarTanque();
    render(<App />);
    await screen.findByText('Litros del período');

    // "Este mes" es el default con el que abre la pantalla, así que ya viene
    // puesto sin que nadie lo toque.
    expect(atajo('Este mes')).toHaveAttribute('aria-pressed', 'true');
    expect(atajo('Últimos 7 días')).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(atajo('Últimos 7 días'));
    // Siete días **con hoy adentro**: del 23 al 29, no del 22.
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-07-23');
    expect(screen.getByLabelText('Hasta')).toHaveValue(HOY);
    expect(atajo('Últimos 7 días')).toHaveAttribute('aria-pressed', 'true');
    expect(atajo('Este mes')).toHaveAttribute('aria-pressed', 'false');

    // Y treinta cruzan el borde del mes sin `new Date`: del 30 de junio.
    await userEvent.click(atajo('Últimos 30'));
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-06-30');
    expect(atajo('Últimos 30')).toHaveAttribute('aria-pressed', 'true');
  });

  it('un rango escrito a mano no deja ninguno puesto, y eso es correcto', async () => {
    // Igual que "Hoy" y "Ayer" cuando la fecha es de hace tres días: son atajos,
    // no un segmentado que obligue a que una opción esté elegida.
    montarTanque({
      [`GET /establecimientos/${EST}/tanque?desde=2026-07-15&hasta=${HOY}`]: {
        cuerpo: tanqueDelPeriodo,
      },
    });
    render(<App />);
    await screen.findByText('Litros del período');

    await userEvent.clear(screen.getByLabelText('Desde'));
    await userEvent.type(screen.getByLabelText('Desde'), '2026-07-15');

    await waitFor(() => expect(atajo('Este mes')).toHaveAttribute('aria-pressed', 'false'));
    expect(atajo('Últimos 7 días')).toHaveAttribute('aria-pressed', 'false');
    expect(atajo('Últimos 30')).toHaveAttribute('aria-pressed', 'false');
  });

  it('con muchos días faltantes resume en vez de escupir una pared de fechas', async () => {
    // Lo encontró la auditoría de cierre: el período por default es el mes en
    // curso, y un tambo que empezó a cargar a mitad de mes mostraba veinte
    // fechas seguidas en un renglón (decisión 65).
    const faltantes = [
      '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05',
      '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10',
      '2026-07-11', '2026-07-25',
    ];
    montarTanque({
      [`GET ${PERIODO}`]: {
        cuerpo: { ...tanqueDelPeriodo, dias_sin_registro: faltantes },
      },
    });
    render(<App />);

    await screen.findByText('Litros del período');
    expect(cifra('Días sin cargar')).toBe('12');
    expect(screen.getByText('12 días sin cargar en este período')).toBeInTheDocument();
    // Ocho fechas y el resumen del resto.
    expect(screen.getByText(/01\/07\/2026 · .* · 08\/07\/2026 y 4 más\./)).toBeInTheDocument();
    expect(screen.queryByText(/25\/07\/2026/)).not.toBeInTheDocument();
  });
});

describe('cargar el tanque', () => {
  it('manda la fecha de hoy y los litros, y el lote solo si se escribió', async () => {
    const falsa = montarTanque();
    render(<App />);
    await screen.findByText('Litros del período');

    expect(screen.getByLabelText('Fecha')).toHaveValue(HOY);
    await userEvent.type(screen.getByLabelText('Litros'), '72');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar' }));

    await waitFor(() => expect(falsa.cuerpoDe(RUTA_POST)).toBeDefined());
    expect(falsa.cuerpoDe(RUTA_POST)).toEqual({ fecha: HOY, litros: 72 });
  });

  it('confirma lo que quedó cargado y vuelve a pedir el período', async () => {
    const falsa = montarTanque();
    render(<App />);
    await screen.findByText('Litros del período');
    const antes = falsa.pedidos.filter((p) => p.ruta === PERIODO).length;

    await userEvent.type(screen.getByLabelText('Litros'), '72');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar' }));

    expect(await screen.findByText(/quedaron cargados 72 l del 29\/07\/2026/i)).toBeInTheDocument();
    // Los totales los calcula el servidor: se vuelven a pedir, no se adivinan.
    await waitFor(() =>
      expect(falsa.pedidos.filter((p) => p.ruta === PERIODO).length).toBe(antes + 1),
    );
  });

  it('un día repetido muestra el mensaje de la API y no ofrece confirmar igual', async () => {
    const mensaje = `Ya hay un registro de tanque para el ${HOY} sin lote. Anulá el anterior o cargá el lote.`;
    montarTanque({
      [RUTA_POST]: {
        status: 409,
        // Aunque el servidor dijera que es forzable, esta pantalla no lo
        // ofrecería: el cuerpo de POST /tanque no lleva `forzado`.
        cuerpo: { codigo: 'TANQUE_DUPLICADO', mensaje, forzable: true },
      },
    });
    render(<App />);
    await screen.findByText('Litros del período');

    await userEvent.type(screen.getByLabelText('Litros'), '70');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar' }));

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(screen.getByText('TANQUE_DUPLICADO')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar igual' })).not.toBeInTheDocument();
  });
});
