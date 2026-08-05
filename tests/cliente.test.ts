// El cliente: que arme la ruta de §9 que corresponde, que mande lo que le dan y
// que un rechazo llegue entero —código, mensaje y `forzable`— a quien lo muestre.

import { describe, expect, it } from 'vitest';
import { ErrorApi, ErrorDeRed, api } from '../src/api/cliente';
import { guardarToken } from '../src/sesion';
import { montarApi, montarApiCaida } from './servidor';
import {
  EST,
  TOKEN,
  V102,
  alertas,
  animal102,
  animales,
  animalesConBajas,
  establecimiento,
  partosDelRodeo,
  personas,
  prenez,
  razas,
  rechazoForzable,
  rechazoNoForzable,
  reparto,
  rodeo,
  salidas,
  servicios,
  tanque,
  tanqueDelPeriodo,
  toros,
  usuarioDesactivado,
  usuarioEscritura,
} from './fixtures';

describe('las rutas de §9', () => {
  it('pega en la ruta del establecimiento', async () => {
    const falsa = montarApi({ [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento } });
    await api.establecimiento(EST);
    expect(falsa.pedidos[0]?.ruta).toBe(`/establecimientos/${EST}`);
  });

  it('cuelga las rutas del animal de su establecimiento', async () => {
    const falsa = montarApi({
      [`GET /establecimientos/${EST}/animales/${V102}/kpis`]: { cuerpo: {} },
    });
    await api.kpis(EST, V102);
    expect(falsa.pedidos[0]?.metodo).toBe('GET');
  });

  it('el listado del rodeo pide `todas` solo cuando se lo piden', async () => {
    const falsa = montarApi({
      [`GET /establecimientos/${EST}/animales`]: { cuerpo: animales },
      [`GET /establecimientos/${EST}/animales?todas=true`]: { cuerpo: animalesConBajas },
    });

    const activas = await api.animales(EST);
    const todas = await api.animales(EST, true);

    expect(falsa.pedidos.map((p) => p.ruta)).toEqual([
      `/establecimientos/${EST}/animales`,
      `/establecimientos/${EST}/animales?todas=true`,
    ]);
    expect(activas.animales).toHaveLength(7);
    expect(activas.animales.every((a) => a.vida === 'ACTIVA')).toBe(true);
    expect(todas.animales).toHaveLength(8);
    // La de baja llega con su `vida` y sin categoría: no se la esconde, se la
    // distingue (decisión 53).
    const vendida = todas.animales.find((a) => a.vida === 'BAJA');
    expect(vendida?.caravana).toBe('107');
    expect(vendida?.categoria).toBeNull();
  });

  it('arma el período del tanque como query, y sin período no manda query', async () => {
    const falsa = montarApi({
      [`GET /establecimientos/${EST}/tanque?desde=2026-07-20&hasta=2026-07-29`]: {
        cuerpo: tanqueDelPeriodo,
      },
      [`GET /establecimientos/${EST}/tanque`]: { cuerpo: tanque },
    });
    await api.tanque(EST, { desde: '2026-07-20', hasta: '2026-07-29' });
    await api.tanque(EST);
    expect(falsa.pedidos[0]?.ruta).toContain('?desde=2026-07-20&hasta=2026-07-29');
    expect(falsa.pedidos[1]?.ruta).not.toContain('?');
  });

  // ── Las lecturas que la API sumó entre las decisiones 96 y 109 ─────────────
  //
  // Ninguna existía de este lado, y el costo de eso no era un error visible sino
  // una pantalla que no se podía escribir. Lo que estos tests fijan es la ruta y
  // la forma de la cola, que es todo lo que el cliente decide.

  it('el catálogo de razas no cuelga de ningún establecimiento', async () => {
    // Es lo que lo hace útil (decisión 109): que "Jersey" sea la misma Jersey en
    // todos los tambos. Colgarlo del establecimiento sería un catálogo por tambo,
    // que es exactamente el campo libre que vino a reemplazar.
    const falsa = montarApi({ 'GET /razas': { cuerpo: razas } });
    const traidas = await api.razas();
    expect(falsa.pedidos[0]?.ruta).toBe('/razas');
    expect(traidas.razas.map((r) => r.codigo)).toEqual(['HOL', 'JER', 'HXJ']);
  });

  it('la ficha y el rodeo aceptan `fecha`, y sin ella no la mandan', async () => {
    const falsa = montarApi({
      [`GET /establecimientos/${EST}/animales/${V102}`]: { cuerpo: animal102 },
      [`GET /establecimientos/${EST}/animales/${V102}?fecha=2026-03-01`]: { cuerpo: animal102 },
      [`GET /establecimientos/${EST}/rodeo`]: { cuerpo: rodeo },
      [`GET /establecimientos/${EST}/rodeo?fecha=2026-03-01`]: { cuerpo: rodeo },
    });

    await api.animal(EST, V102);
    await api.animal(EST, V102, '2026-03-01');
    await api.rodeo(EST);
    await api.rodeo(EST, '2026-03-01');

    expect(falsa.pedidos.map((p) => p.ruta)).toEqual([
      `/establecimientos/${EST}/animales/${V102}`,
      `/establecimientos/${EST}/animales/${V102}?fecha=2026-03-01`,
      `/establecimientos/${EST}/rodeo`,
      `/establecimientos/${EST}/rodeo?fecha=2026-03-01`,
    ]);
  });

  it('los indicadores del rodeo van cada uno a su ruta, con su período', async () => {
    const falsa = montarApi({
      [`GET /establecimientos/${EST}/servicios?desde=2025-08-01&hasta=2026-07-29`]: {
        cuerpo: servicios,
      },
      [`GET /establecimientos/${EST}/toros`]: { cuerpo: toros },
      [`GET /establecimientos/${EST}/prenez?ventanas=26`]: { cuerpo: prenez },
      [`GET /establecimientos/${EST}/salidas?desde=2025-08-01`]: { cuerpo: salidas },
      [`GET /establecimientos/${EST}/partos`]: { cuerpo: partosDelRodeo },
      [`GET /establecimientos/${EST}/reparto`]: { cuerpo: reparto },
    });

    await api.servicios(EST, { desde: '2025-08-01', hasta: '2026-07-29' });
    // `/toros` no acepta período **y es deliberado**: la fertilidad de un toro es
    // una propiedad suya que no cambia con el año.
    await api.toros(EST);
    await api.prenez(EST, { ventanas: 26 });
    // Media ventana: el `hasta` que no vino no se cuela como `hasta=undefined`,
    // que la API contestaría con un 400 por un string de más.
    await api.salidas(EST, { desde: '2025-08-01' });
    await api.partosDelRodeo(EST);
    await api.reparto(EST);

    expect(falsa.pedidos.map((p) => p.ruta)).toEqual([
      `/establecimientos/${EST}/servicios?desde=2025-08-01&hasta=2026-07-29`,
      `/establecimientos/${EST}/toros`,
      `/establecimientos/${EST}/prenez?ventanas=26`,
      `/establecimientos/${EST}/salidas?desde=2025-08-01`,
      `/establecimientos/${EST}/partos`,
      `/establecimientos/${EST}/reparto`,
    ]);
  });

  it('el tanque filtra por lote, que es lo que hace comparable el litro por vaca', async () => {
    // Sin `lote` suma solo los registros sin lote —el total del tambo por
    // definición, decisión 33—; con él se filtran los dos lados.
    const falsa = montarApi({
      [`GET /establecimientos/${EST}/tanque?lote=Orde%C3%B1e+1`]: { cuerpo: tanque },
    });
    await api.tanque(EST, { lote: 'Ordeñe 1' });
    expect(falsa.pedidos[0]?.ruta).toBe(`/establecimientos/${EST}/tanque?lote=Orde%C3%B1e+1`);
  });

  it('devuelve el cuerpo tal cual lo trae la API', async () => {
    montarApi({ [`GET /establecimientos/${EST}/alertas`]: { cuerpo: alertas } });
    const r = await api.alertas(EST);
    expect(r.para_revisar[0]?.caravana).toBe('104');
    expect(r.para_secar[0]?.caravana).toBe('103');
  });
});

describe('las rutas del admin', () => {
  it('trae a todas las personas, con los desactivados adentro', async () => {
    const falsa = montarApi({ 'GET /usuarios': { cuerpo: personas } });

    const r = await api.usuarios();

    expect(falsa.pedidos[0]?.ruta).toBe('/usuarios');
    expect(r.usuarios).toHaveLength(5);
    // `activo` es la mitad de la información de esta lista: el que se fue sigue
    // figurando con su permiso y aun así no entra.
    expect(r.usuarios.find((u) => u.nombre === 'Tomás')?.activo).toBe(false);
    expect(r.usuarios.filter((u) => u.activo)).toHaveLength(4);
  });

  it('crea la persona con la contraseña inicial adentro del cuerpo', async () => {
    const falsa = montarApi({
      'POST /usuarios': { status: 201, cuerpo: { ...usuarioEscritura, activo: true } },
    });

    await api.crearUsuario({
      nombre: 'Rosa',
      email: 'rosa@demo.local',
      password: 'la-inicial',
      es_admin: false,
    });

    expect(falsa.cuerpoDe('POST /usuarios')).toEqual({
      nombre: 'Rosa',
      email: 'rosa@demo.local',
      password: 'la-inicial',
      es_admin: false,
    });
  });

  it('el PATCH manda solo lo que cambió: un campo de más es 400 (decisión 78)', async () => {
    const id = usuarioDesactivado.id;
    const falsa = montarApi({
      [`PATCH /usuarios/${id}`]: { cuerpo: { ...usuarioDesactivado, activo: true } },
    });

    await api.editarUsuario(id, { activo: true });

    expect(falsa.pedidos[0]?.metodo).toBe('PATCH');
    expect(falsa.cuerpoDe(`PATCH /usuarios/${id}`)).toEqual({ activo: true });
  });

  it('otorgar y cambiar el permiso son el mismo PUT sobre la misma ruta', async () => {
    const id = usuarioEscritura.id;
    const falsa = montarApi({
      [`PUT /usuarios/${id}/permisos/${EST}`]: { cuerpo: { ...usuarioEscritura, activo: true } },
    });

    await api.otorgarPermiso(id, EST, 'lectura');
    await api.otorgarPermiso(id, EST, 'escritura');

    expect(falsa.pedidos.map((p) => p.ruta)).toEqual([
      `/usuarios/${id}/permisos/${EST}`,
      `/usuarios/${id}/permisos/${EST}`,
    ]);
    expect(falsa.cuerpoDe(`PUT /usuarios/${id}/permisos/${EST}`)).toEqual({ rol: 'escritura' });
  });

  it('revocar contesta 204 sin cuerpo, y eso no revienta al parsear', async () => {
    const id = usuarioEscritura.id;
    const falsa = montarApi({ [`DELETE /usuarios/${id}/permisos/${EST}`]: { status: 204 } });

    await expect(api.revocarPermiso(id, EST)).resolves.toBeUndefined();

    expect(falsa.pedidos[0]?.metodo).toBe('DELETE');
    expect(falsa.pedidos[0]?.cuerpo).toBeUndefined();
  });

  it('crea el tambo con el nombre y sin `config`: la pone la API', async () => {
    const falsa = montarApi({
      'POST /establecimientos': { status: 201, cuerpo: { id: EST, nombre: 'La Querencia' } },
    });

    const r = await api.crearEstablecimiento({ nombre: 'La Querencia' });

    expect(r.id).toBe(EST);
    expect(falsa.cuerpoDe('POST /establecimientos')).toEqual({ nombre: 'La Querencia' });
  });

  it('el token viaja en todas, también en las que no llevan cuerpo', async () => {
    const id = usuarioEscritura.id;
    guardarToken(TOKEN);
    const falsa = montarApi({
      'GET /usuarios': { cuerpo: personas },
      [`DELETE /usuarios/${id}/permisos/${EST}`]: { status: 204 },
    });

    await api.usuarios();
    await api.revocarPermiso(id, EST);

    expect(falsa.autorizacionDe('GET /usuarios')).toBe(`Bearer ${TOKEN}`);
    expect(falsa.autorizacionDe(`DELETE /usuarios/${id}/permisos/${EST}`)).toBe(`Bearer ${TOKEN}`);
  });

  it('el email repetido llega como 409 con su mensaje entero', async () => {
    montarApi({
      'POST /usuarios': {
        status: 409,
        cuerpo: {
          codigo: 'EMAIL_EN_USO',
          mensaje: 'Ya hay una cuenta con ese email. Si es la misma persona, dale permiso.',
          forzable: false,
        },
      },
    });

    const error = (await api
      .crearUsuario({ nombre: 'Rosa', email: 'rosa@demo.local', password: 'la-inicial' })
      .catch((e: unknown) => e)) as ErrorApi;

    expect(error.status).toBe(409);
    expect(error.cuerpo.codigo).toBe('EMAIL_EN_USO');
    expect(error.message).toContain('Ya hay una cuenta con ese email');
  });
});

describe('lo que se manda', () => {
  it('serializa el evento con el content-type que la API espera', async () => {
    const falsa = montarApi({
      [`POST /establecimientos/${EST}/animales/${V102}/eventos`]: {
        status: 201,
        cuerpo: { evento_id: 'e9' },
      },
    });
    await api.cargarEvento(EST, V102, { tipo: 'celo', fecha_evento: '2026-07-29' });
    expect(falsa.cuerpoDe(`POST /establecimientos/${EST}/animales/${V102}/eventos`)).toEqual({
      tipo: 'celo',
      fecha_evento: '2026-07-29',
    });
  });
});

describe('los rechazos', () => {
  it('un 422 llega como ErrorApi con el cuerpo de §9.1 entero', async () => {
    montarApi({
      [`POST /establecimientos/${EST}/animales/${V102}/eventos`]: {
        status: 422,
        cuerpo: rechazoForzable,
      },
    });

    const error = await api
      .cargarEvento(EST, V102, { tipo: 'inseminacion' })
      .then(() => null, (e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorApi);
    const apiError = error as ErrorApi;
    expect(apiError.status).toBe(422);
    expect(apiError.cuerpo.codigo).toBe('CELO_NO_VIGENTE');
    // El mensaje del núcleo viaja SIN tocar: está redactado para el tambero.
    expect(apiError.message).toBe(rechazoForzable.mensaje);
    expect(apiError.forzable).toBe(true);
  });

  it('un rechazo que la API marca no forzable no se ofrece confirmar', async () => {
    montarApi({
      [`POST /establecimientos/${EST}/animales/${V102}/eventos`]: {
        status: 422,
        cuerpo: rechazoNoForzable,
      },
    });
    const error = (await api
      .cargarEvento(EST, V102, { tipo: 'control_lechero' })
      .catch((e: unknown) => e)) as ErrorApi;
    expect(error.cuerpo.codigo).toBe('SIN_LACTANCIA_ABIERTA');
    expect(error.forzable).toBe(false);
  });

  it('sin `forzable` en el cuerpo, no se ofrece confirmar', async () => {
    montarApi({
      [`GET /establecimientos/${EST}`]: { status: 404, cuerpo: { codigo: 'NO_ENCONTRADO', mensaje: 'No existe.' } },
    });
    const error = (await api.establecimiento(EST).catch((e: unknown) => e)) as ErrorApi;
    expect(error.forzable).toBe(false);
  });

  it('una respuesta ilegible no se hace pasar por un error de dominio', async () => {
    montarApi({
      [`GET /establecimientos/${EST}`]: { status: 502, ilegible: true },
    });
    const error = (await api.establecimiento(EST).catch((e: unknown) => e)) as ErrorApi;
    expect(error.cuerpo.codigo).toBe('RESPUESTA_ILEGIBLE');
    expect(error.status).toBe(502);
  });

  it('sin red, el mensaje habla de señal y no de HTTP', async () => {
    montarApiCaida();
    const error = (await api.alertas(EST).catch((e: unknown) => e)) as ErrorDeRed;
    expect(error).toBeInstanceOf(ErrorDeRed);
    expect(error.message).toContain('señal');
  });
});
