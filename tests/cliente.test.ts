// El cliente: que arme la ruta de §9 que corresponde, que mande lo que le dan y
// que un rechazo llegue entero —código, mensaje y `forzable`— a quien lo muestre.

import { describe, expect, it } from 'vitest';
import { ErrorApi, ErrorDeRed, api } from '../src/api/cliente';
import { montarApi, montarApiCaida } from './servidor';
import { EST, V102, alertas, establecimiento, rechazoForzable, tanque } from './fixtures';

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
      [`GET /establecimientos/${EST}/animales`]: { cuerpo: { fecha: '2026-07-29', animales: [] } },
      [`GET /establecimientos/${EST}/animales?todas=true`]: {
        cuerpo: { fecha: '2026-07-29', animales: [] },
      },
    });
    await api.animales(EST);
    await api.animales(EST, true);
    expect(falsa.pedidos.map((p) => p.ruta)).toEqual([
      `/establecimientos/${EST}/animales`,
      `/establecimientos/${EST}/animales?todas=true`,
    ]);
  });

  it('arma el período del tanque como query, y sin período no manda query', async () => {
    const falsa = montarApi({
      [`GET /establecimientos/${EST}/tanque?desde=2026-07-20&hasta=2026-07-29`]: { cuerpo: tanque },
      [`GET /establecimientos/${EST}/tanque`]: { cuerpo: tanque },
    });
    await api.tanque(EST, { desde: '2026-07-20', hasta: '2026-07-29' });
    await api.tanque(EST);
    expect(falsa.pedidos[0]?.ruta).toContain('?desde=2026-07-20&hasta=2026-07-29');
    expect(falsa.pedidos[1]?.ruta).not.toContain('?');
  });

  it('devuelve el cuerpo tal cual lo trae la API', async () => {
    montarApi({ [`GET /establecimientos/${EST}/alertas`]: { cuerpo: alertas } });
    const r = await api.alertas(EST);
    expect(r.para_revisar[0]?.caravana).toBe('104');
    expect(r.para_secar[0]?.caravana).toBe('103');
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
