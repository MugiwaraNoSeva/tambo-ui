// ─────────────────────────────────────────────────────────────────────────────
// El panel del admin: los tambos, la gente de cada uno, y entrar a usarlos.
//
// Lo que se prueba es lo que la pantalla **muestra** de lo que la respuesta trae
// y lo que **manda** de lo que el formulario junta. La cerradura no se prueba
// acá: está en la API, que contesta 403, y hay 179 tests del otro lado del
// `fetch` que la miran.
//
// Los tres casos que la respuesta obvia no ve tienen cada uno su test con
// nombre: el admin que entra sin figurar en el reparto, el desactivado que
// figura y no entra, y el panel que el selector se comía cuando había un solo
// tambo.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { anotarFechaDeLaRespuesta } from '../src/reloj';
import { aPanel, aPanelTambo, aPanelTamboGente, aPanelUsuarios } from '../src/ruteo';
import { montarApi, type Manejador } from './servidor';
import {
  EST,
  EST2,
  HOY,
  TOKEN,
  establecimiento,
  losDosTambos,
  personas,
  rutasDelTablero,
  sesionDePrueba,
  usuarioAdmin,
  usuarioDesactivado,
  usuarioEscritura,
  usuarioLectura,
  usuarioSinTambos,
} from './fixtures';

const montarPanel = (hash = aPanel(), cambios: Record<string, Manejador> = {}) => {
  window.location.hash = hash;
  anotarFechaDeLaRespuesta({ fecha: HOY });
  return montarApi({
    ...sesionDePrueba(usuarioAdmin, losDosTambos),
    'GET /usuarios': { cuerpo: personas },
    // La pantalla de la gente pide los tambos **con los archivados**: es la que
    // escribe en qué tambo entra cada uno, y un permiso sobre un tambo archivado
    // sigue siendo un permiso que hay que poder leer.
    'GET /establecimientos?archivados=true': { cuerpo: { establecimientos: losDosTambos } },
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    ...rutasDelTablero,
    ...cambios,
  });
};

describe('el inicio del admin', () => {
  it('es el panel, y no el tablero de un tambo', async () => {
    montarPanel('');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Administración' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /en qué tambo estás/i })).not.toBeInTheDocument();
  });

  /**
   * El defecto que se llevaba puesto el panel entero. El selector entra derecho
   * cuando hay **un solo** tambo, y una base recién instalada tiene exactamente
   * uno: el admin habría entrado derecho a él y no habría visto el panel nunca.
   */
  it('con un solo tambo tampoco entra derecho: el atajo es del tambero', async () => {
    montarPanel('', {
      'GET /establecimientos': { cuerpo: { establecimientos: [{ id: EST, nombre: 'La Esperanza' }] } },
    });
    render(<App />);

    expect(await screen.findByRole('link', { name: /La Esperanza/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Administración' })).toBeInTheDocument();
    expect(screen.queryByText('Preñez del rodeo')).not.toBeInTheDocument();
  });

  it('el hash de una pantalla de tambo no abre ningún tambo por su cuenta', async () => {
    // Igual que al tambero que todavía no eligió: lo que hay es el lugar donde
    // se elige, y el enlace profundo espera.
    montarPanel('#/rodeo');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Administración' })).toBeInTheDocument();
  });

  it('los tambos van por nombre y con cuánta gente entra a cada uno', async () => {
    montarPanel();
    render(<App />);

    expect(await screen.findByRole('link', { name: /El Ombú/ })).toBeInTheDocument();
    // La Esperanza tiene tres con permiso propio: el de escritura, el de lectura
    // y el desactivado, que sigue figurando.
    expect(screen.getByText('3 personas con permiso')).toBeInTheDocument();
    expect(screen.getByText('Nadie con permiso todavía')).toBeInTheDocument();
    expect(screen.queryByText(EST)).not.toBeInTheDocument();
  });

  it('si la gente no vino, la lista de tambos se dibuja igual', async () => {
    montarPanel(aPanel(), { 'GET /usuarios': { status: 502, ilegible: true } });
    render(<App />);

    // Lo que se vino a buscar es el tambo: perderlo por el dato de al lado sería
    // la pantalla equivocada.
    expect(await screen.findByRole('link', { name: /La Esperanza/ })).toBeInTheDocument();
  });
});

// ── El primer arranque de producción ─────────────────────────────────────────
//
// En una base recién instalada no existe ningún establecimiento y el único
// usuario es el admin: esta es, literalmente, la primera pantalla que alguien
// ve. Hasta esta tanda le decía "pedíselo a un administrador" —a él— y después
// le imprimía tres `curl`. Ahora le da el formulario.

describe('la primera pantalla de producción', () => {
  const montarVacio = (cambios: Record<string, Manejador> = {}) =>
    montarApi({
      ...sesionDePrueba(usuarioAdmin, []),
      'GET /usuarios': { cuerpo: { usuarios: [{ ...usuarioAdmin, activo: true }] } },
      ...cambios,
    });

  it('no le pide que le pida permiso a un administrador: es él', async () => {
    montarVacio();
    render(<App />);

    await screen.findByText(/Todavía no hay ningún tambo/i);
    expect(screen.queryByText(/pedíselo a un administrador/i)).not.toBeInTheDocument();
    // Y tampoco le quedan comandos para copiar: la pantalla lo hace.
    expect(screen.queryByText('POST /establecimientos')).not.toBeInTheDocument();
  });

  it('crea el primer tambo desde el formulario, y vuelve a pedir la lista', async () => {
    const falsa = montarVacio({
      'POST /establecimientos': { status: 201, cuerpo: { id: EST, nombre: 'La Querencia' } },
    });
    render(<App />);

    await userEvent.type(await screen.findByLabelText('Nombre del tambo'), 'La Querencia');
    await userEvent.click(screen.getByRole('button', { name: 'Crear el primer tambo' }));

    await waitFor(() =>
      expect(falsa.cuerpoDe('POST /establecimientos')).toEqual({ nombre: 'La Querencia' }),
    );
    // Sin `config`: la pone la API y después no la cambia nadie.
    expect(falsa.pedidos.filter((p) => p.ruta === '/establecimientos' && p.metodo === 'GET'))
      .toHaveLength(2);
  });

  it('puede cambiar su propia contraseña sin que exista un solo tambo', async () => {
    // Es lo primero que el despliegue le manda a hacer, y hasta acá la única
    // pantalla que lo hacía colgaba de un tambo.
    montarVacio();
    window.location.hash = '#/cuenta';
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Mi cuenta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument();
  });
});

// ── El menú del tambo, y su CRUD ─────────────────────────────────────────────

describe('el menú de un tambo', () => {
  it('ofrece las tres cosas que se pueden hacer con él', async () => {
    montarPanel(aPanelTambo(EST));
    render(<App />);

    // Entrar es lo de todos los días y va primero; su gente es de vez en cuando;
    // editarlo, una vez en la vida.
    expect(await screen.findByRole('button', { name: /Entrar al tambo/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Su gente/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar el tambo' })).toBeInTheDocument();
  });

  it('le cambia el nombre con un PATCH de un solo campo', async () => {
    const falsa = montarPanel(aPanelTambo(EST), {
      [`PATCH /establecimientos/${EST}`]: { cuerpo: { ...establecimiento, nombre: 'La Esperanza S.A.' } },
    });
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Editar el tambo' }));
    const campo = screen.getByLabelText('Nombre');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'La Esperanza S.A.');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar el nombre' }));

    await waitFor(() =>
      expect(falsa.cuerpoDe(`PATCH /establecimientos/${EST}`)).toEqual({
        nombre: 'La Esperanza S.A.',
      }),
    );
  });

  it('los parámetros son su propia pantalla, no un campo más del nombre', async () => {
    montarPanel(aPanelTambo(EST));
    render(<App />);

    // Cambiar el nombre y cambiar con qué números decide el sistema no son la
    // misma clase de cosa, así que no comparten formulario.
    expect(await screen.findByRole('link', { name: /Sus parámetros/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Editar el tambo' }));
    expect(screen.queryByLabelText(/gestación/i)).not.toBeInTheDocument();
  });

  it('archiva, que es la baja que este sistema tiene: no hay borrar', async () => {
    const falsa = montarPanel(aPanelTambo(EST), {
      [`PATCH /establecimientos/${EST}`]: { cuerpo: { ...establecimiento, archivado: true } },
    });
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Editar el tambo' }));
    // Ni "eliminar" ni "borrar" en ningún lado: de un tambo cuelga su historial.
    expect(screen.queryByRole('button', { name: /eliminar|borrar/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Archivar el tambo' }));

    await waitFor(() =>
      expect(falsa.cuerpoDe(`PATCH /establecimientos/${EST}`)).toEqual({ archivado: true }),
    );
  });

  it('el archivado avisa que se mira y no se carga, y se puede desarchivar', async () => {
    const falsa = montarPanel(aPanelTambo(EST), {
      [`GET /establecimientos/${EST}`]: { cuerpo: { ...establecimiento, archivado: true } },
      [`PATCH /establecimientos/${EST}`]: { cuerpo: establecimiento },
    });
    render(<App />);

    expect(await screen.findByText(/Este tambo está archivado/i)).toBeInTheDocument();
    expect(screen.getByText(/no cargar nada nuevo/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Editar el tambo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Desarchivar el tambo' }));

    await waitFor(() =>
      expect(falsa.cuerpoDe(`PATCH /establecimientos/${EST}`)).toEqual({ archivado: false }),
    );
  });
});

describe('los archivados en la lista', () => {
  it('no vienen, hasta que alguien los va a buscar', async () => {
    const falsa = montarPanel(aPanel(), {
      'GET /establecimientos?archivados=true': {
        cuerpo: { establecimientos: [...losDosTambos, { id: 'z', nombre: 'La Que Cerró', archivado: true }] },
      },
    });
    render(<App />);

    await screen.findByRole('link', { name: /El Ombú/ });
    expect(screen.queryByText('La Que Cerró')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ver también los archivados' }));

    expect(await screen.findByText('La Que Cerró')).toBeInTheDocument();
    expect(screen.getByText('archivado')).toBeInTheDocument();
    // El default es el listado de todos los días, y la query lo dice.
    expect(falsa.pedidos.some((p) => p.ruta === '/establecimientos')).toBe(true);
    expect(falsa.pedidos.some((p) => p.ruta === '/establecimientos?archivados=true')).toBe(true);
  });
});

// ── El tambo por dentro ──────────────────────────────────────────────────────

describe('quién entra a este tambo', () => {
  it('los muestra con su permiso, y al desactivado como lo que es', async () => {
    montarPanel(aPanelTamboGente(EST));
    render(<App />);

    await screen.findByRole('heading', { name: 'La Esperanza' });
    const reparto = screen.getByRole('heading', { name: 'Quién entra a este tambo' })
      .parentElement as HTMLElement;

    expect(within(reparto).getByText(usuarioEscritura.nombre)).toBeInTheDocument();
    expect(within(reparto).getByText(usuarioLectura.nombre)).toBeInTheDocument();
    // El que se fue figura, y dice que no entra: esconderlo dejaría al admin sin
    // poder volver a entrarlo.
    expect(within(reparto).getByText(usuarioDesactivado.nombre)).toBeInTheDocument();
    expect(within(reparto).getByText('desactivado')).toBeInTheDocument();
    expect(within(reparto).getByText(/No entra: está desactivado/)).toBeInTheDocument();
  });

  /**
   * La trampa: un admin viene con `permisos: []` a propósito, así que el filtro
   * por establecimiento no lo devuelve nunca. Una pantalla que diga "quién entra
   * a este tambo" y lo omita está mintiendo.
   */
  it('los administradores aparecen, aunque no figuren en el reparto', async () => {
    montarPanel(aPanelTamboGente(EST));
    render(<App />);

    await screen.findByRole('heading', { name: 'La Esperanza' });
    const ajeno = screen.getByRole('heading', { name: 'Y además, los administradores' })
      .parentElement as HTMLElement;

    expect(within(ajeno).getByText(usuarioAdmin.nombre)).toBeInTheDocument();
    expect(within(ajeno).getByText(/sin figurar en el reparto/i)).toBeInTheDocument();
  });

  it('un tambo sin nadie lo dice, y no muestra una lista vacía', async () => {
    montarPanel(aPanelTamboGente(EST2), {
      [`GET /establecimientos/${EST2}`]: { cuerpo: { ...establecimiento, id: EST2, nombre: 'El Ombú' } },
    });
    render(<App />);

    expect(await screen.findByText(/Nadie tiene permiso sobre este tambo/i)).toBeInTheDocument();
  });

  it('un id que no existe cae en el mensaje de la API, con la vuelta al panel', async () => {
    // Para el admin la puerta contesta 404 y no 403: el 403 parejo está para no
    // decirle a un extraño qué tambos hay, y él no es un extraño.
    montarPanel(aPanelTambo('11111111-9999-9999-9999-111111111111'), {
      [`GET /establecimientos/11111111-9999-9999-9999-111111111111`]: {
        status: 404,
        cuerpo: { codigo: 'NO_ENCONTRADO', mensaje: 'No existe el establecimiento.' },
      },
    });
    render(<App />);

    expect(await screen.findByText('No existe el establecimiento.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al panel' })).toBeInTheDocument();
  });
});

describe('repartir el acceso', () => {
  it('cambiar de rol es un PUT sobre la misma ruta, sin revocar antes', async () => {
    const falsa = montarPanel(aPanelTamboGente(EST), {
      [`PUT /usuarios/${usuarioLectura.id}/permisos/${EST}`]: {
        cuerpo: { ...usuarioLectura, activo: true },
      },
    });
    render(<App />);

    await screen.findByRole('heading', { name: 'Quién entra a este tambo' });
    await userEvent.click(screen.getByRole('button', { name: 'Pasar a escritura' }));

    await waitFor(() =>
      expect(falsa.cuerpoDe(`PUT /usuarios/${usuarioLectura.id}/permisos/${EST}`)).toEqual({
        rol: 'escritura',
      }),
    );
    // Nada de revocar y volver a otorgar: eso abriría un hueco en el medio.
    expect(falsa.pedidos.some((p) => p.metodo === 'DELETE')).toBe(false);
    // Y lo que quedó lo dice el servidor, no la pantalla.
    expect(falsa.pedidos.filter((p) => p.ruta === '/usuarios')).toHaveLength(2);
  });

  it('sacar el acceso manda el DELETE de esa persona en este tambo', async () => {
    const falsa = montarPanel(aPanelTamboGente(EST), {
      [`DELETE /usuarios/${usuarioEscritura.id}/permisos/${EST}`]: { status: 204 },
    });
    render(<App />);

    await screen.findByRole('heading', { name: 'Quién entra a este tambo' });
    const fila = screen.getByText(usuarioEscritura.nombre).closest('li') as HTMLElement;
    await userEvent.click(within(fila).getByRole('button', { name: 'Sacar el acceso' }));

    await waitFor(() =>
      expect(
        falsa.pedidos.some(
          (p) =>
            p.metodo === 'DELETE' &&
            p.ruta === `/usuarios/${usuarioEscritura.id}/permisos/${EST}`,
        ),
      ).toBe(true),
    );
  });

  it('darle acceso a alguien que ya existe no pide la lista de nuevo', async () => {
    const falsa = montarPanel(aPanelTamboGente(EST), {
      [`PUT /usuarios/${usuarioSinTambos.id}/permisos/${EST}`]: {
        cuerpo: { ...usuarioSinTambos, permisos: [{ establecimiento_id: EST, rol: 'lectura' }] },
      },
    });
    render(<App />);

    await screen.findByRole('heading', { name: 'Dar acceso' });
    // Los candidatos salen de la misma respuesta que ya vino.
    await userEvent.selectOptions(screen.getByLabelText('Quién'), usuarioSinTambos.id);
    await userEvent.selectOptions(screen.getByLabelText('Con qué permiso'), 'lectura');
    await userEvent.click(screen.getByRole('button', { name: 'Dar el acceso' }));

    await waitFor(() =>
      expect(falsa.cuerpoDe(`PUT /usuarios/${usuarioSinTambos.id}/permisos/${EST}`)).toEqual({
        rol: 'lectura',
      }),
    );
  });

  it('los que ya entran no están entre los candidatos, ni los administradores', async () => {
    montarPanel(aPanelTamboGente(EST));
    render(<App />);

    const quien = await screen.findByLabelText('Quién');
    const opciones = within(quien).getAllByRole('option').map((o) => o.textContent);
    expect(opciones.some((o) => o?.includes(usuarioSinTambos.nombre))).toBe(true);
    // Ya entra: ofrecerle "dar acceso" sería ofrecer lo que ya tiene.
    expect(opciones.some((o) => o?.includes(usuarioEscritura.nombre))).toBe(false);
    // Y el admin entra a todos: darle permiso no cambiaría nada.
    expect(opciones.some((o) => o?.includes(usuarioAdmin.nombre))).toBe(false);
  });

  it('un rechazo se muestra con el mensaje de la API y la lista queda como estaba', async () => {
    montarPanel(aPanelTamboGente(EST), {
      [`DELETE /usuarios/${usuarioEscritura.id}/permisos/${EST}`]: {
        status: 403,
        cuerpo: { codigo: 'SIN_PERMISO', mensaje: 'Esto lo hace un administrador.' },
      },
    });
    render(<App />);

    await screen.findByRole('heading', { name: 'Quién entra a este tambo' });
    const fila = screen.getByText(usuarioEscritura.nombre).closest('li') as HTMLElement;
    await userEvent.click(within(fila).getByRole('button', { name: 'Sacar el acceso' }));

    expect(await screen.findByText('Esto lo hace un administrador.')).toBeInTheDocument();
    expect(screen.getByText(usuarioEscritura.nombre)).toBeInTheDocument();
  });
});

// ── Entrar y volver ──────────────────────────────────────────────────────────

describe('entrar al tambo y volver', () => {
  it('entra y es la app de siempre, con la vuelta al panel adentro de Mi cuenta', async () => {
    montarPanel(aPanelTambo(EST));
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Entrar al tambo/ }));

    // El tablero del tambo, con su nombre arriba: la misma puerta del tambero.
    expect(await screen.findByRole('heading', { name: 'La Esperanza' })).toBeInTheDocument();
    expect(await screen.findByText('Preñez del rodeo')).toBeInTheDocument();
    // Y el tablero **no** lleva la barra del admin: entró al tambo como un
    // usuario más, con los tres lugares abajo y ninguna puerta al panel a la
    // vista. La salida está donde ahora viven todas, y dice a dónde lleva:
    // "Cambiar de tambo" llevaría a otro lado.
    await userEvent.click(screen.getByRole('link', { name: 'Mi cuenta' }));
    expect(await screen.findByRole('button', { name: 'Volver al panel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cambiar de tambo/i })).not.toBeInTheDocument();
  });

  it('vuelve al panel sin cerrar la sesión', async () => {
    montarPanel(aPanelTambo(EST));
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Entrar al tambo/ }));
    await screen.findByText('Preñez del rodeo');
    await userEvent.click(screen.getByRole('link', { name: 'Mi cuenta' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Volver al panel' }));

    expect(await screen.findByRole('heading', { name: 'Administración' })).toBeInTheDocument();
    expect(window.localStorage.getItem('tambo.token')).toBe(TOKEN);
  });

  it('el tambo abierto no se guarda entre visitas: el inicio sigue siendo el panel', async () => {
    montarPanel(aPanelTambo(EST));
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Entrar al tambo/ }));
    await screen.findByText('Preñez del rodeo');

    // Una preferencia que se escribe y nadie lee es un valor que envejece hasta
    // que alguien le cree.
    expect(window.localStorage.getItem('tambo.establecimiento')).toBeNull();
  });
});

// ── Las personas ─────────────────────────────────────────────────────────────

describe('las personas', () => {
  it('las muestra a todas, con los desactivados y en qué tambo entra cada una', async () => {
    montarPanel(aPanelUsuarios());
    render(<App />);

    await screen.findByRole('heading', { name: 'Todas' });
    expect(screen.getByText(usuarioSinTambos.nombre)).toBeInTheDocument();
    expect(screen.getByText('No entra a ningún tambo todavía.')).toBeInTheDocument();
    // Con el nombre del tambo y no con su uuid. Son dos —el de escritura y el
    // desactivado, que conserva el suyo— y por eso se cuentan.
    expect(await screen.findAllByText('La Esperanza (escritura)')).toHaveLength(2);
    expect(screen.getByText('La Esperanza (lectura)')).toBeInTheDocument();
    expect(screen.getByText('Entra a todos los tambos.')).toBeInTheDocument();
  });

  it('crear una persona muestra su contraseña una vez, para poder decírsela', async () => {
    const falsa = montarPanel(aPanelUsuarios(), {
      'POST /usuarios': { status: 201, cuerpo: { ...usuarioSinTambos } },
    });
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Crear una persona' }));
    await userEvent.type(screen.getByLabelText('Nombre'), 'Rosa');
    await userEvent.type(screen.getByLabelText('Email'), 'rosa@demo.local');
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'la-inicial');
    await userEvent.click(screen.getByRole('button', { name: 'Crear la persona' }));

    expect(await screen.findByText(/Rosa ya puede entrar/)).toBeInTheDocument();
    // Del otro lado no hay correo que mandar: si no se muestra, no la sabe nadie.
    expect(screen.getByText('la-inicial')).toBeInTheDocument();
    expect(falsa.cuerpoDe('POST /usuarios')).toEqual({
      nombre: 'Rosa',
      email: 'rosa@demo.local',
      password: 'la-inicial',
      es_admin: false,
    });
  });

  it('el email repetido no le borra lo que escribió', async () => {
    montarPanel(aPanelUsuarios(), {
      'POST /usuarios': {
        status: 409,
        cuerpo: { codigo: 'EMAIL_EN_USO', mensaje: 'Ya hay una cuenta con ese email.' },
      },
    });
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Crear una persona' }));
    await userEvent.type(screen.getByLabelText('Nombre'), 'Rosa');
    await userEvent.type(screen.getByLabelText('Email'), 'paulo@demo.local');
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'la-inicial');
    await userEvent.click(screen.getByRole('button', { name: 'Crear la persona' }));

    expect(await screen.findByText('Ya hay una cuenta con ese email.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Rosa');
  });

  it('desactivar manda solo ese campo, que es lo que saca a alguien ahora', async () => {
    const falsa = montarPanel(aPanelUsuarios(), {
      [`PATCH /usuarios/${usuarioEscritura.id}`]: {
        cuerpo: { ...usuarioEscritura, activo: false },
      },
    });
    render(<App />);

    await screen.findByRole('heading', { name: 'Todas' });
    const fila = screen.getByText(usuarioEscritura.nombre).closest('li') as HTMLElement;
    await userEvent.click(within(fila).getByRole('button', { name: 'Editar' }));
    await userEvent.click(within(fila).getByRole('button', { name: 'Desactivar' }));

    await waitFor(() =>
      expect(falsa.cuerpoDe(`PATCH /usuarios/${usuarioEscritura.id}`)).toEqual({ activo: false }),
    );
  });

  it('el reseteo avisa que NO cierra las sesiones abiertas', async () => {
    montarPanel(aPanelUsuarios(), {
      [`PATCH /usuarios/${usuarioEscritura.id}`]: { cuerpo: { ...usuarioEscritura, activo: true } },
    });
    render(<App />);

    await screen.findByRole('heading', { name: 'Todas' });
    const fila = screen.getByText(usuarioEscritura.nombre).closest('li') as HTMLElement;
    await userEvent.click(within(fila).getByRole('button', { name: 'Editar' }));

    // Es lo que todo el mundo asume al revés, y asumirlo al revés es creer que
    // echaste a alguien que sigue adentro.
    expect(within(fila).getByText(/no cierra/i)).toBeInTheDocument();
    expect(within(fila).getByText(/Para sacarlo ahora, desactivalo/)).toBeInTheDocument();
  });

  /**
   * Las dos que la API prohíbe sobre uno mismo (`AUTOBLOQUEO`). No se ofrecen:
   * un botón cuyo único final posible es un 422 es una promesa que la pantalla
   * no puede cumplir.
   */
  it('sobre sí mismo no ofrece ni desactivarse ni sacarse el rol', async () => {
    montarPanel(aPanelUsuarios());
    render(<App />);

    await screen.findByRole('heading', { name: 'Todas' });
    const fila = screen.getByText(usuarioAdmin.nombre).closest('li') as HTMLElement;
    await userEvent.click(within(fila).getByRole('button', { name: 'Editar' }));

    expect(within(fila).queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
    expect(
      within(fila).queryByRole('button', { name: 'Quitar administrador' }),
    ).not.toBeInTheDocument();
    // Y la salida se dice con palabras, que es lo que sirve.
    expect(within(fila).getByText(/nombrá administrador a otra persona/i)).toBeInTheDocument();
  });

  it('el ULTIMO_ADMIN sí se muestra: esa cuenta la lleva el servidor', async () => {
    montarPanel(aPanelUsuarios(), {
      [`PATCH /usuarios/${usuarioEscritura.id}`]: {
        status: 422,
        cuerpo: {
          codigo: 'ULTIMO_ADMIN',
          mensaje: 'Es el último administrador: nombrá a otro antes de sacarle el rol.',
        },
      },
    });
    render(<App />);

    await screen.findByRole('heading', { name: 'Todas' });
    const fila = screen.getByText(usuarioEscritura.nombre).closest('li') as HTMLElement;
    await userEvent.click(within(fila).getByRole('button', { name: 'Editar' }));
    await userEvent.click(within(fila).getByRole('button', { name: 'Hacer administrador' }));

    expect(await screen.findByText(/Es el último administrador/)).toBeInTheDocument();
  });

  it('no hay forma de borrar a nadie, y la pantalla dice por qué', async () => {
    montarPanel(aPanelUsuarios());
    render(<App />);

    await screen.findByRole('heading', { name: 'Todas' });
    const fila = screen.getByText(usuarioEscritura.nombre).closest('li') as HTMLElement;
    await userEvent.click(within(fila).getByRole('button', { name: 'Editar' }));

    expect(within(fila).queryByRole('button', { name: /borrar|eliminar/i })).not.toBeInTheDocument();
    expect(within(fila).getByText(/Nadie se borra/)).toBeInTheDocument();
  });
});

describe('la puerta del panel', () => {
  it('el que no es admin no tiene panel: `#/admin` le cae en su tambo', async () => {
    window.location.hash = aPanel();
    anotarFechaDeLaRespuesta({ fecha: HOY });
    montarApi({
      ...sesionDePrueba(usuarioEscritura),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      ...rutasDelTablero,
    });
    render(<App />);

    // Su tablero, no el panel. Y nada de esto es la cerradura: si igual pidiera
    // `/usuarios`, la API le contesta 403.
    expect(await screen.findByRole('heading', { name: 'La Esperanza' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Administración' })).not.toBeInTheDocument();
  });
});
