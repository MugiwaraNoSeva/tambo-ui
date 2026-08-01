// Los dos controles que estrena la remodelación: el chip y el segmentado.
//
// Todavía no los usa ninguna pantalla —los estrenan la corrida y el rodeo— así
// que se prueban solos, montados sobre un estado de mentira. Lo que hay que
// probar acá no es que se vean bien: es que **digan lo que muestran** sin
// depender del color (convención 3) y que un filtro se pueda soltar, que es la
// diferencia entre los dos.

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chips, Segmentado, type Opcion } from '../src/componentes/formulario';

const ESTADOS: readonly Opcion<'VACIA' | 'INSEMINADA' | 'PRENADA'>[] = [
  { valor: 'VACIA', rotulo: 'Vacías' },
  { valor: 'INSEMINADA', rotulo: 'Inseminadas' },
  { valor: 'PRENADA', rotulo: 'Preñadas' },
];

type Estado = (typeof ESTADOS)[number]['valor'];

/** Un chip controlado, como lo va a usar el rodeo. */
function FiltroDePrueba({ alElegir }: { alElegir?: (v: Estado | null) => void } = {}) {
  const [elegida, setElegida] = useState<Estado | null>(null);
  return (
    <Chips
      etiqueta="Reproductivo"
      opciones={ESTADOS}
      elegida={elegida}
      alElegir={(v) => {
        setElegida(v);
        alElegir?.(v);
      }}
    />
  );
}

describe('los chips', () => {
  it('muestran cada opción con su palabra y ninguna elegida al empezar', () => {
    render(<FiltroDePrueba />);

    for (const { rotulo } of ESTADOS) {
      expect(screen.getByRole('button', { name: rotulo })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
  });

  it('el grupo se nombra, así se sabe qué se está filtrando sin ver la pantalla', () => {
    render(<FiltroDePrueba />);

    const grupo = screen.getByRole('group', { name: 'Reproductivo' });
    expect(within(grupo).getAllByRole('button')).toHaveLength(3);
  });

  it('tocar uno lo elige, y lo dice con `aria-pressed` y no solo con color', async () => {
    render(<FiltroDePrueba />);

    await userEvent.click(screen.getByRole('button', { name: 'Inseminadas' }));

    expect(screen.getByRole('button', { name: 'Inseminadas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Los otros dos quedan sueltos: es excluyente aunque no sea un radio.
    expect(screen.getByRole('button', { name: 'Vacías' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Preñadas' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('tocar el que ya está puesto lo suelta: es la forma de dejar de filtrar', async () => {
    const alElegir = vi.fn();
    render(<FiltroDePrueba alElegir={alElegir} />);

    const inseminadas = screen.getByRole('button', { name: 'Inseminadas' });
    await userEvent.click(inseminadas);
    await userEvent.click(inseminadas);

    expect(alElegir).toHaveBeenNthCalledWith(1, 'INSEMINADA');
    // `null` y no un valor centinela: es lo que hace innecesaria una opción
    // "Todas" al principio de la lista.
    expect(alElegir).toHaveBeenNthCalledWith(2, null);
    expect(inseminadas).toHaveAttribute('aria-pressed', 'false');
  });

  it('cambiar de chip reemplaza al anterior', async () => {
    render(<FiltroDePrueba />);

    await userEvent.click(screen.getByRole('button', { name: 'Vacías' }));
    await userEvent.click(screen.getByRole('button', { name: 'Preñadas' }));

    expect(screen.getByRole('button', { name: 'Vacías' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Preñadas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

/** Un segmentado controlado, como lo va a usar la corrida. */
function TipoDePrueba({
  etiqueta = 'Tipo de evento',
  inicial = 'celo',
  alElegir,
}: {
  etiqueta?: string;
  inicial?: string;
  alElegir?: (v: string) => void;
} = {}) {
  const [elegida, setElegida] = useState(inicial);
  return (
    <Segmentado
      etiqueta={etiqueta}
      opciones={[
        { valor: 'celo', rotulo: 'Celo' },
        { valor: 'tacto_positivo', rotulo: 'Tacto positivo' },
        { valor: 'secado', rotulo: 'Secado' },
      ]}
      elegida={elegida}
      alElegir={(v) => {
        setElegida(v);
        alElegir?.(v);
      }}
    />
  );
}

describe('el segmentado', () => {
  it('es un grupo de radios de verdad, y siempre hay uno elegido', () => {
    render(<TipoDePrueba />);

    const grupo = screen.getByRole('group', { name: 'Tipo de evento' });
    expect(within(grupo).getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Celo' })).toBeChecked();
  });

  it('el input sigue existiendo para el foco y el lector de pantalla', () => {
    render(<TipoDePrueba />);

    // Escondido de la vista con posición y opacidad, **nunca** con
    // `display: none`: eso lo sacaría también del foco y de los roles.
    const celo = screen.getByRole('radio', { name: 'Celo' });
    expect(celo).toBeVisible();
    celo.focus();
    expect(celo).toHaveFocus();
  });

  it('elegir otro avisa y deja de estar el anterior', async () => {
    const alElegir = vi.fn();
    render(<TipoDePrueba alElegir={alElegir} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Tacto positivo' }));

    expect(alElegir).toHaveBeenCalledTimes(1);
    expect(alElegir).toHaveBeenCalledWith('tacto_positivo');
    expect(screen.getByRole('radio', { name: 'Tacto positivo' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Celo' })).not.toBeChecked();
  });

  it('no se puede soltar el elegido: acá siempre hay uno, a diferencia del chip', async () => {
    const alElegir = vi.fn();
    render(<TipoDePrueba alElegir={alElegir} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Celo' }));

    expect(screen.getByRole('radio', { name: 'Celo' })).toBeChecked();
  });

  it('dos en la misma pantalla no se pisan', async () => {
    // Sin el `useId` compartirían el `name` y el browser los trataría como un
    // solo grupo de radios: elegir en el segundo apagaría el primero.
    render(
      <>
        <TipoDePrueba etiqueta="El de arriba" inicial="celo" />
        <TipoDePrueba etiqueta="El de abajo" inicial="celo" />
      </>,
    );

    const abajo = screen.getByRole('group', { name: 'El de abajo' });
    await userEvent.click(within(abajo).getByRole('radio', { name: 'Secado' }));

    const arriba = screen.getByRole('group', { name: 'El de arriba' });
    expect(within(arriba).getByRole('radio', { name: 'Celo' })).toBeChecked();
    expect(within(abajo).getByRole('radio', { name: 'Secado' })).toBeChecked();
  });
});
