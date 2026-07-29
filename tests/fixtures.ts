// ─────────────────────────────────────────────────────────────────────────────
// Las respuestas de §9, escritas con su forma exacta.
//
// Los datos son los de `api/scripts/demo.ts` —La Esperanza, la 102 en ordeñe,
// la 104 sin diagnóstico, la 103 para secar— para que lo que se ve en el test
// sea lo mismo que se ve en la pantalla al correr la demo. Cuando algo no
// cierra, el camino más corto es levantar la demo y comparar.
//
// Están tipadas contra los tipos del cliente a propósito: una fixture que se
// desalinee del contrato no compila, que es la única forma de que un mock no
// envejezca en silencio.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CuerpoError,
  RespuestaAlertas,
  RespuestaAnimal,
  RespuestaAnimales,
  RespuestaEstablecimiento,
  RespuestaEventos,
  RespuestaKPIs,
  RespuestaLactancias,
  RespuestaRodeo,
  RespuestaTanque,
} from '../src/api/tipos';
// El `Config` viene del núcleo como VALOR y no copiado: en la suite el import
// no cuesta nada (Vitest resuelve el fuente de `mu/` igual que `api/`), y así
// una fixture no puede quedar con parámetros que el tambo ya no usa. En la app
// que va al browser, en cambio, de `tambo-reglas` solo se importan tipos
// (decisión 51).
import { CONFIG_DEFAULT } from 'tambo-reglas';
import type { RespuestaFalsa } from './servidor';

export const EST = '11111111-1111-1111-1111-111111111111';
export const V102 = '22222222-2222-2222-2222-222222222222';
export const V103 = '33333333-3333-3333-3333-333333333333';
export const V104 = '44444444-4444-4444-4444-444444444444';
export const V107 = '77777777-7777-7777-7777-777777777777';
export const HOY = '2026-07-29';

export const establecimiento: RespuestaEstablecimiento = {
  id: EST,
  nombre: 'La Esperanza',
  config: CONFIG_DEFAULT,
};

export const animales: RespuestaAnimales = {
  fecha: HOY,
  animales: [
    {
      animal_id: V102,
      caravana: '102',
      vida: 'ACTIVA',
      reproductivo: 'VACIA',
      productivo: 'EN_LACTANCIA',
      categoria: 'LACTANCIA_MEDIA',
      fecha_ultimo_parto: '2026-01-13',
    },
    {
      animal_id: V103,
      caravana: '103',
      vida: 'ACTIVA',
      reproductivo: 'PRENADA',
      productivo: 'EN_LACTANCIA',
      categoria: 'LACTANCIA_TARDIA',
      fecha_ultimo_parto: '2025-10-05',
    },
    {
      animal_id: V104,
      caravana: '104',
      vida: 'ACTIVA',
      reproductivo: 'INSEMINADA',
      productivo: 'SECA',
      categoria: 'RECRIA',
      fecha_ultimo_parto: null,
    },
  ],
};

/** La vendida del mes pasado: solo aparece con `?todas=true`. */
export const animalesConBajas: RespuestaAnimales = {
  fecha: HOY,
  animales: [
    ...animales.animales,
    {
      animal_id: V107,
      caravana: '107',
      vida: 'BAJA',
      reproductivo: null,
      productivo: null,
      categoria: null,
      fecha_ultimo_parto: null,
    },
  ],
};

export const alertas: RespuestaAlertas = {
  fecha: HOY,
  para_revisar: [{ animal_id: V104, caravana: '104' }],
  para_secar: [{ animal_id: V103, caravana: '103' }],
};

export const alertasVacias: RespuestaAlertas = {
  fecha: HOY,
  para_revisar: [],
  para_secar: [],
};

export const rodeo: RespuestaRodeo = {
  fecha: HOY,
  resumen: {
    composicion: { activas: 7, en_ordene: 3, secas: 4, vacias: 4, inseminadas: 2, prenadas: 1 },
    // Las tasas del núcleo son **fracciones 0–1**, no números 0–100. Se escriben
    // como la cuenta y no como el resultado —1 preñada sobre 7 activas— porque
    // un número mágico en una fixture es una afirmación sin fundamento a la que
    // después se le da la razón: así salió el "0 %" de la decisión 57.
    porcentaje_prenez: 1 / 7,
    dias_abiertos_promedio: 127,
    intervalo_entre_partos_promedio: null,
    tasa_descarte: 0.125,
    // Un 0 de verdad: nadie se murió. Se muestra "0 %" y no "sin datos", que es
    // la otra mitad de la decisión 37.
    tasa_mortalidad: 0,
    categorias: {
      RECRIA: 3,
      LACTANCIA_TEMPRANA: 1,
      LACTANCIA_MEDIA: 1,
      LACTANCIA_TARDIA: 1,
      PREPARTO: 0,
      SECA: 1,
    },
    para_revisar: [{ animal_id: V104, caravana: '104' }],
    para_secar: [{ animal_id: V103, caravana: '103' }],
  },
};

export const animal102: RespuestaAnimal = {
  animal_id: V102,
  caravana: '102',
  version: 11,
  proyeccion: {
    estado: {
      animal_id: V102,
      vida: 'ACTIVA',
      reproductivo: 'VACIA',
      productivo: 'EN_LACTANCIA',
      fecha_nacimiento: '2022-03-12',
      madre_id: null,
      parto_origen_id: null,
      motivo_baja: null,
      fecha_ultimo_celo: null,
      fecha_ultima_inseminacion: null,
      ultima_inseminacion_id: null,
      fecha_inseminacion_efectiva: null,
      inseminacion_efectiva_id: null,
      fecha_parto_probable_inicial: null,
      fecha_ultimo_parto: '2026-01-13',
      ultimo_numero_lactancia: 3,
    },
    ciclos: [
      {
        numero: 1,
        fecha_inicio: '2025-03-17',
        fecha_fin: '2026-01-13',
        origen: 'alta',
        resultado: 'parto',
        servicios: 1,
        fecha_primer_servicio: '2025-04-05',
        datos_incompletos: false,
      },
      {
        numero: 2,
        fecha_inicio: '2026-01-13',
        fecha_fin: null,
        origen: 'parto',
        resultado: 'abierto',
        servicios: 0,
        fecha_primer_servicio: null,
        datos_incompletos: false,
      },
    ],
    lactancias: [
      {
        numero: 3,
        parto_evento_id: 'aaaaaaaa-0000-0000-0000-000000000001',
        fecha_inicio: '2026-01-13',
        fecha_fin: null,
        datos_incompletos: false,
        crias: [{ sexo: 'hembra', resultado: 'viva' }],
        controles: [],
      },
    ],
  },
};

export const kpis102: RespuestaKPIs = {
  animal_id: V102,
  fecha: HOY,
  kpis: {
    dias_abiertos: 197,
    intervalo_parto_primer_servicio: null,
    intervalo_entre_partos: null,
    servicios_por_concepcion: 1,
    tasa_perdida_prenez: 0,
    tasa_mortalidad_perinatal: 0,
    hembras_nacidas_vivas: 1,
    edad_dias: 1600,
    edad_al_primer_parto: null,
    ciclos_excluidos: 0,
  },
};

export const lactancias102: RespuestaLactancias = {
  animal_id: V102,
  fecha: HOY,
  lactancias: [
    {
      numero: 3,
      parto_evento_id: 'aaaaaaaa-0000-0000-0000-000000000001',
      fecha_inicio: '2026-01-13',
      fecha_fin: null,
      datos_incompletos: false,
      crias: [{ sexo: 'hembra', resultado: 'viva' }],
      curva: [
        { evento_id: 'c1', fecha: '2026-02-12', del: 30, litros: 24.5, grasa: 3.9, proteina: 3.2, rcs: 160 },
        { evento_id: 'c2', fecha: '2026-03-14', del: 60, litros: 28, grasa: 3.7, proteina: 3.3, rcs: 145 },
        { evento_id: 'c3', fecha: '2026-04-13', del: 90, litros: 26 },
        { evento_id: 'c4', fecha: '2026-05-13', del: 120, litros: 23.5, grasa: 3.8, proteina: 3.4, rcs: 210 },
        { evento_id: 'c5', fecha: '2026-06-12', del: 150, litros: 21 },
        { evento_id: 'c6', fecha: '2026-07-12', del: 180, litros: 19, grasa: 4, proteina: 3.5, rcs: 320 },
      ],
      pico: { evento_id: 'c2', fecha: '2026-03-14', del: 60, litros: 28, grasa: 3.7, proteina: 3.3, rcs: 145 },
      promedio_controles: 23.666666666666668,
      rcs_maximo: 320,
      acumulada: 4685.5,
      estandarizada_305: 6900.25,
    },
  ],
};

export const eventos105: RespuestaEventos = {
  animal_id: V102,
  eventos: [
    {
      id: 'e1',
      tipo: 'alta',
      fecha_evento: '2025-10-02',
      fecha_registro: '2025-10-02T12:00:00.000Z',
      payload: {},
      usuario: null,
      observaciones: null,
      forzado: false,
      ciclo_id: 'ciclo-1',
      anulado_por: null,
      vigente: true,
    },
    {
      id: 'e2',
      tipo: 'celo',
      fecha_evento: '2026-04-30',
      fecha_registro: '2026-04-30T12:00:00.000Z',
      payload: {},
      usuario: null,
      observaciones: null,
      forzado: false,
      ciclo_id: 'ciclo-1',
      anulado_por: 'e3',
      vigente: false,
    },
    {
      id: 'e3',
      tipo: 'anulacion',
      fecha_evento: HOY,
      fecha_registro: `${HOY}T12:00:00.000Z`,
      payload: { evento_anulado_id: 'e2' },
      usuario: null,
      observaciones: 'Fecha equivocada al pasar de la libreta.',
      forzado: false,
      ciclo_id: null,
      anulado_por: null,
      vigente: false,
    },
  ],
};

/**
 * `GET /tanque` **sin período**, que es como lo pide el tablero (decisión 56):
 * los diez días de la demo con el 25 olvidado, y sin `dias_sin_registro` —sin
 * bordes no hay días faltantes definidos (decisión 49)—.
 */
export const tanque: RespuestaTanque = {
  fecha: HOY,
  desde: null,
  hasta: null,
  registros: [
    { fecha: '2026-07-20', litros: 68, lote: null },
    { fecha: '2026-07-21', litros: 72, lote: null },
    { fecha: '2026-07-22', litros: 70, lote: null },
    { fecha: '2026-07-23', litros: 69, lote: null },
    { fecha: '2026-07-24', litros: 71, lote: null },
    { fecha: '2026-07-26', litros: 74, lote: null },
    { fecha: '2026-07-27', litros: 73, lote: null },
    { fecha: '2026-07-28', litros: 70, lote: null },
    { fecha: HOY, litros: 72, lote: null },
  ],
  litros_totales: 639,
  promedio_diario: 71,
  dias_sin_registro: null,
  litros_por_vaca_en_ordene: 24,
};

/** El mismo período, pero pedido con bordes: ahí sí aparece el día olvidado. */
export const tanqueDelPeriodo: RespuestaTanque = {
  ...tanque,
  desde: '2026-07-20',
  hasta: HOY,
  dias_sin_registro: ['2026-07-25'],
};

/** El mismo tanque antes del ordeñe de la tarde: todavía sin el registro de hoy. */
export const tanqueSinHoy: RespuestaTanque = {
  ...tanque,
  registros: tanque.registros.filter((r) => r.fecha !== HOY),
  litros_totales: 567,
  promedio_diario: 70.875,
  // Sin registro de hoy no hay litros por vaca: es un dato que falta, no un día
  // sin leche (decisión 37).
  litros_por_vaca_en_ordene: null,
};

/**
 * Las tres lecturas que el tablero dispara apenas queda conectado. Van juntas
 * porque cualquier test que llegue al tablero las necesita a las tres: cada
 * tarjeta pide la suya (decisión 56), y una ruta que el mock no prevea se ve
 * como una tarjeta caída en vez de como un test que falla.
 */
export const rutasDelTablero: Record<string, RespuestaFalsa> = {
  [`GET /establecimientos/${EST}/alertas`]: { cuerpo: alertas },
  [`GET /establecimientos/${EST}/rodeo`]: { cuerpo: rodeo },
  [`GET /establecimientos/${EST}/tanque`]: { cuerpo: tanque },
};

/** Un rechazo forzable, tal como lo devuelve la API (§5.6 + decisión 52). */
export const rechazoForzable: CuerpoError = {
  codigo: 'CELO_NO_VIGENTE',
  mensaje:
    'No hay un celo registrado dentro de los 3 días previos. Cargá el celo primero, ' +
    'o marcá la inseminación como IATF si fue a tiempo fijo.',
  forzable: true,
};

/** Y uno que no admite confirmación. */
export const rechazoNoForzable: CuerpoError = {
  codigo: 'SIN_LACTANCIA_ABIERTA',
  mensaje: 'El animal no tiene una lactancia abierta donde registrar el control.',
  forzable: false,
};
