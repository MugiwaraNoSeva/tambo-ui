// ─────────────────────────────────────────────────────────────────────────────
// Los parámetros del tambo: la pantalla más peligrosa del panel.
//
// Lo que se prueba no es que los inputs guarden —eso es un formulario— sino las
// cuatro cosas que la hacen distinta:
//
//   · que **avise qué cambia** cuando se toca un número, que es la mitad del
//     trabajo de esta pantalla;
//   · que mande la `Config` **entera**, porque los diecisiete se validan entre
//     ellos y un campo suelto no se puede juzgar solo;
//   · que los valores de fábrica vengan **de la API** y no de una copia local;
//   · que el historial conteste bajo qué reglas se decidió cada cosa.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { anotarFechaDeLaRespuesta } from '../src/reloj';
import { aPanelTamboConfig } from '../src/ruteo';
import { montarApi, type Manejador } from './servidor';
import {
  EST,
  HOY,
  configDeFabrica,
  establecimiento,
  historialDeConfig,
  losDosTambos,
  personas,
  sesionDePrueba,
  usuarioAdmin,
} from './fixtures';

const montarConfig = (cambios: Record<string, Manejador> = {}) => {
  window.location.hash = aPanelTamboConfig(EST);
  anotarFechaDeLaRespuesta({ fecha: HOY });
  return montarApi({
    ...sesionDePrueba(usuarioAdmin, losDosTambos),
    'GET /usuarios': { cuerpo: personas },
    'GET /config-default': { cuerpo: configDeFabrica },
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    [`GET /establecimientos/${EST}/configuraciones`]: { cuerpo: historialDeConfig },
    ...cambios,
  });
};

describe('los parámetros del tambo', () => {
  it('avisa qué cambia y qué no, antes que cualquier campo', async () => {
    montarConfig();
    render(<App />);

    // Es la mitad del trabajo de esta pantalla: cambiar estos números no toca el
    // log, pero cambia al instante lo que el sistema concluye de él.
    expect(
      await screen.findByRole('heading', { name: /Qué cambia cuando los cambiás/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/listas de la mañana/i)).toBeInTheDocument();
    expect(screen.getByText(/El historial de eventos no se toca/i)).toBeInTheDocument();
  });

  it('los muestra agrupados y con el nombre que usa la gente', async () => {
    montarConfig();
    render(<App />);

    // No `dias_pve` sino lo que significa, con su unidad.
    expect(
      await screen.findByLabelText('Período voluntario de espera (días)'),
    ).toHaveValue(45);
    expect(screen.getByLabelText('Techo de litros por control (litros)')).toHaveValue(80);
    expect(screen.getByRole('heading', { name: 'Gestación y parto' })).toBeInTheDocument();
    // Y la regla que ata a los de cada grupo, dicha en criollo.
    expect(screen.getByText(/tiene que caer entre la mínima y la máxima/i)).toBeInTheDocument();
  });

  it('manda los diecisiete enteros, no el que cambió', async () => {
    const falsa = montarConfig({
      [`PATCH /establecimientos/${EST}`]: { cuerpo: establecimiento },
    });
    render(<App />);

    const campo = await screen.findByLabelText('Período voluntario de espera (días)');
    await userEvent.clear(campo);
    await userEvent.type(campo, '60');
    await userEvent.type(screen.getByLabelText(/Por qué se cambia/), 'Charla con el veterinario.');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar los parámetros' }));

    await waitFor(() => {
      const cuerpo = falsa.cuerpoDe(`PATCH /establecimientos/${EST}`) as {
        config: Record<string, number>;
        motivo: string;
      };
      // Los diecisiete: se validan entre ellos, así que uno solo no se puede
      // juzgar.
      expect(Object.keys(cuerpo.config)).toHaveLength(17);
      expect(cuerpo.config['dias_pve']).toBe(60);
      expect(cuerpo.config['dias_gestacion']).toBe(283);
      expect(cuerpo.motivo).toBe('Charla con el veterinario.');
    });
  });

  it('sin cambios el botón no se puede tocar', async () => {
    montarConfig();
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Guardar los parámetros' })).toBeDisabled();
  });

  it('el motivo es opcional y no viaja vacío', async () => {
    const falsa = montarConfig({
      [`PATCH /establecimientos/${EST}`]: { cuerpo: establecimiento },
    });
    render(<App />);

    const campo = await screen.findByLabelText('Validez del celo (días)');
    await userEvent.clear(campo);
    await userEvent.type(campo, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar los parámetros' }));

    await waitFor(() =>
      expect(falsa.cuerpoDe(`PATCH /establecimientos/${EST}`)).not.toHaveProperty('motivo'),
    );
  });

  it('una combinación imposible muestra el mensaje del núcleo tal cual', async () => {
    const mensaje =
      'La gestación promedio (283) tiene que caer entre el mínimo (400) y el máximo (295) plausibles.';
    montarConfig({
      [`PATCH /establecimientos/${EST}`]: {
        status: 422,
        cuerpo: { codigo: 'CONFIG_INVALIDA', mensaje },
      },
    });
    render(<App />);

    const campo = await screen.findByLabelText('Gestación mínima (días)');
    await userEvent.clear(campo);
    await userEvent.type(campo, '400');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar los parámetros' }));

    // Redactado para explicar por qué no cierra: reescribirlo acá sería duplicar
    // el dominio en el lugar que nadie mira.
    expect(await screen.findByText(mensaje)).toBeInTheDocument();
  });

  describe('los valores de fábrica', () => {
    it('vienen de la API, no de una copia de este lado', async () => {
      const falsa = montarConfig();
      render(<App />);

      await screen.findByLabelText('Validez del celo (días)');
      // La decisión 51 le prohíbe a esta UI importar valores del núcleo.
      expect(falsa.pedidos.some((p) => p.ruta === '/config-default')).toBe(true);
    });

    it('rellenan el formulario pero no guardan solos', async () => {
      const falsa = montarConfig({
        [`GET /establecimientos/${EST}`]: {
          cuerpo: { ...establecimiento, config: { ...establecimiento.config, dias_pve: 60 } },
        },
      });
      render(<App />);

      expect(await screen.findByLabelText('Período voluntario de espera (días)')).toHaveValue(60);
      await userEvent.click(screen.getByRole('button', { name: /Volver a los valores de fábrica/ }));

      expect(screen.getByLabelText('Período voluntario de espera (días)')).toHaveValue(45);
      // Quien vuelve a fábrica igual tiene que mirar lo que queda y confirmarlo.
      expect(falsa.pedidos.some((p) => p.metodo === 'PATCH')).toBe(false);
    });

    it('marcan lo que este tambo tiene distinto de lo estándar', async () => {
      montarConfig({
        [`GET /establecimientos/${EST}`]: {
          cuerpo: { ...establecimiento, config: { ...establecimiento.config, dias_pve: 60 } },
        },
      });
      render(<App />);

      expect(await screen.findByText(/De fábrica son 45/)).toBeInTheDocument();
    });
  });

  describe('el historial, que es para lo que existe todo esto', () => {
    it('muestra cada versión con su fecha, quién y por qué', async () => {
      montarConfig();
      render(<App />);

      await screen.findByRole('heading', { name: 'El historial de reglas' });
      expect(screen.getByText('01/06/2026')).toBeInTheDocument();
      expect(screen.getByText(`La puso: ${usuarioAdmin.nombre}`)).toBeInTheDocument();
      expect(screen.getByText(/charla con el veterinario/i)).toBeInTheDocument();
      // La vigente se distingue con su palabra, no solo por estar primera.
      expect(screen.getByText('vigente')).toBeInTheDocument();
    });

    it('la primera versión no se le atribuye a nadie', async () => {
      montarConfig();
      render(<App />);

      // No la puso nadie: vino con el sistema. Inventar un usuario sería mentir
      // justo en la pantalla que existe para saber quién hizo qué.
      expect(await screen.findByText('La puso: vino con el sistema')).toBeInTheDocument();
    });

    it('si el historial no vino, el formulario se sigue pudiendo usar', async () => {
      montarConfig({
        [`GET /establecimientos/${EST}/configuraciones`]: { status: 502, ilegible: true },
      });
      render(<App />);

      expect(await screen.findByLabelText('Validez del celo (días)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    });
  });
});
