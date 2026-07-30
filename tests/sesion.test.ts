// El token: que viaje en todos los pedidos menos el login, y que un 401 —y solo
// un 401 de los que no llevan una contraseña adentro— borre la sesión y avise.
//
// Es la prueba del andamio de toda la tanda: si el header no sale de acá, no
// sale de ningún lado, porque `cliente.ts` es el único que lo pone.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi, api } from '../src/api/cliente';
import {
  alCaerLaSesion,
  guardarToken,
  olvidarToken,
  tokenGuardado,
  type CaidaDeSesion,
} from '../src/sesion';
import { montarApi } from './servidor';
import {
  EST,
  TOKEN,
  V102,
  establecimiento,
  loginRechazado,
  misEstablecimientos,
  sesionVencida,
  sinPermiso,
  usuarioEscritura,
} from './fixtures';

// Las escuchas viven en una variable de módulo y el módulo se comparte entre
// tests: una que quede registrada le contesta a la de al lado.
const bajas: (() => void)[] = [];
const escuchar = (escucha: (caida: CaidaDeSesion) => void) => {
  bajas.push(alCaerLaSesion(escucha));
};

afterEach(() => {
  for (const baja of bajas.splice(0)) baja();
});

describe('dónde vive el token', () => {
  it('se guarda, se lee y se olvida', () => {
    expect(tokenGuardado()).toBeNull();
    guardarToken(TOKEN);
    expect(tokenGuardado()).toBe(TOKEN);
    expect(window.localStorage.getItem('tambo.token')).toBe(TOKEN);
    olvidarToken();
    expect(tokenGuardado()).toBeNull();
  });

  it('sin almacenamiento la app sigue andando', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('modo privado');
    });
    expect(() => guardarToken(TOKEN)).not.toThrow();
  });
});

describe('el header en cada pedido', () => {
  it('viaja en un GET, que no lleva cuerpo', async () => {
    guardarToken(TOKEN);
    const falsa = montarApi({ [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento } });

    await api.establecimiento(EST);

    expect(falsa.autorizacionDe(`GET /establecimientos/${EST}`)).toBe(`Bearer ${TOKEN}`);
  });

  it('viaja en un POST, junto con el content-type', async () => {
    guardarToken(TOKEN);
    const ruta = `POST /establecimientos/${EST}/animales/${V102}/eventos`;
    const falsa = montarApi({ [ruta]: { status: 201, cuerpo: { evento_id: 'e9' } } });

    await api.cargarEvento(EST, V102, { tipo: 'celo', fecha_evento: '2026-07-29' });

    expect(falsa.autorizacionDe(ruta)).toBe(`Bearer ${TOKEN}`);
    expect(falsa.pedidos[0]?.cabeceras['content-type']).toBe('application/json');
  });

  it('sin token no se manda un header vacío', async () => {
    const falsa = montarApi({ [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento } });
    await api.establecimiento(EST);
    expect(falsa.autorizacionDe(`GET /establecimientos/${EST}`)).toBeUndefined();
  });

  it('el login no lo manda, ni siquiera con uno viejo guardado', async () => {
    guardarToken('el.token.de.ayer');
    const falsa = montarApi({
      'POST /auth/login': { cuerpo: { token: TOKEN, usuario: usuarioEscritura } },
    });

    const r = await api.login({ email: 'paulo@demo.local', password: 'demo-escritura' });

    expect(falsa.autorizacionDe('POST /auth/login')).toBeUndefined();
    expect(r.token).toBe(TOKEN);
    expect(r.usuario.permisos[0]?.rol).toBe('escritura');
  });

  it('`/auth/yo` y `GET /establecimientos` lo llevan como cualquier otro', async () => {
    guardarToken(TOKEN);
    const falsa = montarApi({
      'GET /auth/yo': { cuerpo: { usuario: usuarioEscritura } },
      'GET /establecimientos': { cuerpo: misEstablecimientos },
    });

    await api.yo();
    await api.establecimientos();

    expect(falsa.autorizacionDe('GET /auth/yo')).toBe(`Bearer ${TOKEN}`);
    expect(falsa.autorizacionDe('GET /establecimientos')).toBe(`Bearer ${TOKEN}`);
  });
});

describe('el 401, que vuelve al login', () => {
  it('borra el token y avisa con el mensaje de la API', async () => {
    guardarToken(TOKEN);
    const avisos: CaidaDeSesion[] = [];
    escuchar((caida) => avisos.push(caida));
    montarApi({ [`GET /establecimientos/${EST}/alertas`]: { status: 401, cuerpo: sesionVencida } });

    await expect(api.alertas(EST)).rejects.toBeInstanceOf(ErrorApi);

    expect(tokenGuardado()).toBeNull();
    // El mensaje se muestra tal cual: es el que explica que fueron 8 horas. Y
    // era una lectura, así que no hay nada perdido de qué avisar.
    expect(avisos).toEqual([{ mensaje: sesionVencida.mensaje, seEstabaCargando: false }]);
  });

  it('avisa también cuando llega a mitad de una carga', async () => {
    guardarToken(TOKEN);
    const avisos: CaidaDeSesion[] = [];
    escuchar((caida) => avisos.push(caida));
    montarApi({
      [`POST /establecimientos/${EST}/animales/${V102}/eventos`]: {
        status: 401,
        cuerpo: sesionVencida,
      },
    });

    await expect(api.cargarEvento(EST, V102, { tipo: 'celo' })).rejects.toBeInstanceOf(ErrorApi);

    // Y avisa que **se estaba cargando**: el celo que el tambero cree guardado
    // no está, y eso hay que decirlo, no dejarlo adivinar.
    expect(avisos).toEqual([{ mensaje: sesionVencida.mensaje, seEstabaCargando: true }]);
    expect(tokenGuardado()).toBeNull();
  });

  it('el token se borra ANTES de avisar: el que reaccione no lo vuelve a mandar', async () => {
    guardarToken(TOKEN);
    let habiaToken: string | null = TOKEN;
    escuchar(() => {
      habiaToken = tokenGuardado();
    });
    montarApi({ 'GET /auth/yo': { status: 401, cuerpo: sesionVencida } });

    await expect(api.yo()).rejects.toBeInstanceOf(ErrorApi);

    expect(habiaToken).toBeNull();
  });
});

describe('los 401 que NO son la sesión', () => {
  it('el login errado no borra nada ni avisa: no había sesión que perder', async () => {
    const avisos: CaidaDeSesion[] = [];
    escuchar((caida) => avisos.push(caida));
    montarApi({ 'POST /auth/login': { status: 401, cuerpo: loginRechazado } });

    const error = (await api
      .login({ email: 'paulo@demo.local', password: 'mal' })
      .catch((e: unknown) => e)) as ErrorApi;

    // El mensaje único llega entero, para mostrarlo tal cual.
    expect(error.message).toBe('Email o contraseña incorrectos.');
    expect(avisos).toEqual([]);
  });

  it('errarle a la contraseña actual no echa al tambero de la sesión', async () => {
    guardarToken(TOKEN);
    const avisos: CaidaDeSesion[] = [];
    escuchar((caida) => avisos.push(caida));
    const mensaje = 'La contraseña actual no coincide. Probá de nuevo.';
    const falsa = montarApi({
      'POST /auth/password': { status: 401, cuerpo: { codigo: 'NO_AUTENTICADO', mensaje } },
    });

    const error = (await api
      .cambiarPassword({ actual: 'mal', nueva: 'la-nueva-larga' })
      .catch((e: unknown) => e)) as ErrorApi;

    expect(error.status).toBe(401);
    expect(error.message).toBe(mensaje);
    // La sesión sigue viva: el 401 hablaba de la contraseña del cuerpo.
    expect(tokenGuardado()).toBe(TOKEN);
    expect(avisos).toEqual([]);
    // Y el header viajó igual: el endpoint necesita saber quién cambia la suya.
    expect(falsa.autorizacionDe('POST /auth/password')).toBe(`Bearer ${TOKEN}`);
  });

  it('un 403 tampoco: la sesión está bien y lo que falta es permiso', async () => {
    guardarToken(TOKEN);
    const avisos: CaidaDeSesion[] = [];
    escuchar((caida) => avisos.push(caida));
    montarApi({ [`GET /establecimientos/${EST}`]: { status: 403, cuerpo: sinPermiso } });

    const error = (await api.establecimiento(EST).catch((e: unknown) => e)) as ErrorApi;

    expect(error.cuerpo.codigo).toBe('SIN_PERMISO');
    expect(tokenGuardado()).toBe(TOKEN);
    expect(avisos).toEqual([]);
  });
});

describe('el 204 del cambio de contraseña', () => {
  it('no trae cuerpo y no se lo pide', async () => {
    guardarToken(TOKEN);
    const falsa = montarApi({ 'POST /auth/password': { status: 204 } });

    await expect(
      api.cambiarPassword({ actual: 'demo-escritura', nueva: 'la-nueva-larga' }),
    ).resolves.toBeUndefined();

    expect(falsa.cuerpoDe('POST /auth/password')).toEqual({
      actual: 'demo-escritura',
      nueva: 'la-nueva-larga',
    });
  });
});
