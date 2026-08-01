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

import { guardarToken } from '../src/sesion';
import type {
  Config,
  CuerpoError,
  EstablecimientoDeLaLista,
  RespuestaEstablecimientos,
  RespuestaUsuarios,
  Usuario,
  UsuarioAdmin,
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
import type { RespuestaFalsa } from './servidor';

/**
 * La `Config` por default del núcleo, **copiada**.
 *
 * Hasta la mudanza esto era `import { CONFIG_DEFAULT } from 'tambo-reglas'` —el
 * valor de verdad, que en la suite no costaba nada—. Fuera del monorepo el
 * paquete no está, así que queda el literal (decisión 66). Lo que sostiene que
 * no se despegue es el tipo: está anotado como `Config`, y un parámetro que el
 * núcleo agregue o renombre rompe el typecheck acá.
 *
 * Ninguna pantalla lee estos números —la UI no calcula nada del dominio—, así
 * que su único trabajo es que el `Config` de las respuestas tenga forma de
 * `Config`. Si algún día importan de verdad, hay que traerlos de la API.
 */
const CONFIG_DEFAULT: Config = {
  dias_validez_celo: 3,
  dias_gestacion: 283,
  dias_secado_preparto: 60,
  dias_retorno_celo: 21,
  dias_gestacion_min: 265,
  dias_gestacion_max: 295,
  dias_min_para_tacto: 28,
  dias_min_entre_celos: 17,
  dias_pve: 45,
  dias_edad_min_primer_servicio: 390,
  dias_min_secado_preparto: 40,
  dias_alerta_sin_diagnostico: 40,
  del_lactancia_temprana: 100,
  del_lactancia_media: 200,
  dias_preparto: 21,
  litros_max_control: 80,
  dias_lactancia_estandar: 305,
};

export const EST = '11111111-1111-1111-1111-111111111111';
export const V101 = '11111111-aaaa-aaaa-aaaa-111111111111';
export const V102 = '22222222-2222-2222-2222-222222222222';
export const V103 = '33333333-3333-3333-3333-333333333333';
export const V104 = '44444444-4444-4444-4444-444444444444';
export const V105 = '55555555-5555-5555-5555-555555555555';
export const V106 = '66666666-6666-6666-6666-666666666666';
export const V107 = '77777777-7777-7777-7777-777777777777';
export const V150 = '15000000-1500-1500-1500-150000000000';
export const HOY = '2026-07-29';

export const establecimiento: RespuestaEstablecimiento = {
  id: EST,
  nombre: 'La Esperanza',
  config: CONFIG_DEFAULT,
};

// ── La sesión ────────────────────────────────────────────────────────────────
//
// Los tres usuarios de la demo, con la forma exacta que devuelven `/auth/login`
// y `/auth/yo`. El del medio es el caso normal; los otros dos son los que se
// rompen: el de `lectura`, que nadie prueba, y el admin, que **no tiene
// permisos** y aun así puede todo.

/** Un token cualquiera. No se parsea en ningún lado: la UI no lo abre. */
export const TOKEN = 'un.token.de.mentira';

export const EST2 = '22222222-cccc-cccc-cccc-222222222222';

export const usuarioEscritura: Usuario = {
  id: 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
  nombre: 'Paulo',
  email: 'paulo@demo.local',
  es_admin: false,
  permisos: [{ establecimiento_id: EST, rol: 'escritura' }],
};

export const usuarioLectura: Usuario = {
  id: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
  nombre: 'Vet',
  email: 'vet@demo.local',
  es_admin: false,
  permisos: [{ establecimiento_id: EST, rol: 'lectura' }],
};

/** El admin: `permisos` vacío y puede todo, que es la mitad que se olvida. */
export const usuarioAdmin: Usuario = {
  id: 'cccccccc-3333-3333-3333-cccccccccccc',
  nombre: 'Administración',
  email: 'admin@tambo.local',
  es_admin: true,
  permisos: [],
};

export const misEstablecimientos: RespuestaEstablecimientos = {
  establecimientos: [{ id: EST, nombre: 'La Esperanza' }],
};

// ── El panel del admin ───────────────────────────────────────────────────────
//
// La gente del sistema, con los cinco casos que la pantalla tiene que saber
// distinguir. Ninguno está de adorno:
//
//   · **el admin**, que viene con `permisos: []` y entra a los dos tambos igual:
//     el filtro por establecimiento no lo devuelve nunca y una lista que lo
//     omita miente sobre quién entra;
//   · **el de escritura** y **el de lectura**, que son el caso normal;
//   · **el desactivado**, que sigue figurando en el reparto de La Esperanza y
//     **no entra** — es la mitad de la información que `activo` trae;
//   · **la que no tiene ningún permiso**, que es a quien se le da acceso sin
//     tener que crearla de nuevo.
//
// Vienen ordenados por nombre, que es como los devuelve la API.

/** El nombre del segundo tambo, para el panel: dos filas y no una. */
export const establecimiento2: EstablecimientoDeLaLista = { id: EST2, nombre: 'El Ombú' };

/** Los dos que ve el admin, en el orden de la API (por nombre). */
export const losDosTambos: EstablecimientoDeLaLista[] = [
  establecimiento2,
  { id: EST, nombre: 'La Esperanza' },
];

/** El que se fue: su permiso sigue ahí y aun así no entra. */
export const usuarioDesactivado: UsuarioAdmin = {
  id: 'dddddddd-4444-4444-4444-dddddddddddd',
  nombre: 'Tomás',
  email: 'tomas@demo.local',
  es_admin: false,
  permisos: [{ establecimiento_id: EST, rol: 'escritura' }],
  activo: false,
};

/** La que existe y todavía no entra a ningún lado: se le da acceso, no se la crea. */
export const usuarioSinTambos: UsuarioAdmin = {
  id: 'eeeeeeee-5555-5555-5555-eeeeeeeeeeee',
  nombre: 'Rosa',
  email: 'rosa@demo.local',
  es_admin: false,
  permisos: [],
  activo: true,
};

/** `GET /usuarios`: todos, con sus permisos y con los desactivados, por nombre. */
export const personas: RespuestaUsuarios = {
  usuarios: [
    { ...usuarioAdmin, activo: true },
    { ...usuarioEscritura, activo: true },
    usuarioSinTambos,
    usuarioDesactivado,
    { ...usuarioLectura, activo: true },
  ],
};

/**
 * Una sesión abierta, que es la premisa de casi todos los tests.
 *
 * Devuelve las dos rutas que la `App` pide al arrancar —`/auth/yo` para saber
 * quién soy, `GET /establecimientos` para el selector— y de paso **deja el token
 * guardado**, que es la otra mitad de "hay sesión". Va todo junto en una función
 * a propósito: son tres líneas de andamio que no le importan a ningún test, y
 * repartidas en cada archivo se despegan la primera vez que la app pida algo más
 * al arrancar.
 *
 * Se usa esparcida adentro del `montarApi` de cada archivo:
 *
 * ```ts
 * montarApi({ ...sesionDePrueba(), [`GET /establecimientos/${EST}`]: … });
 * ```
 */
export function sesionDePrueba(
  usuario: Usuario = usuarioEscritura,
  tambos: EstablecimientoDeLaLista[] = misEstablecimientos.establecimientos,
): Record<string, RespuestaFalsa> {
  guardarToken(TOKEN);
  return {
    'GET /auth/yo': { cuerpo: { usuario } },
    'GET /establecimientos': { cuerpo: { establecimientos: tambos } },
  };
}

/** El rechazo del login: un mensaje único, que no dice cuál de los dos falló. */
export const loginRechazado: CuerpoError = {
  codigo: 'NO_AUTENTICADO',
  mensaje: 'Email o contraseña incorrectos.',
  forzable: false,
};

/** El de las 8 horas, que llega con la sesión abierta y a mitad de cualquier cosa. */
export const sesionVencida: CuerpoError = {
  codigo: 'NO_AUTENTICADO',
  mensaje: 'Tu sesión venció: dura 8 horas. Volvé a entrar.',
  forzable: false,
};

/** Y el que no hay que confundir con el anterior: la sesión está bien. */
export const sinPermiso: CuerpoError = {
  codigo: 'SIN_PERMISO',
  mensaje: 'No tenés permiso sobre este establecimiento.',
  forzable: false,
};

/** El rodeo de la demo, ordenado por caravana como lo devuelve la API. */
export const animales: RespuestaAnimales = {
  fecha: HOY,
  animales: [
    {
      animal_id: V101,
      caravana: '101',
      vida: 'ACTIVA',
      reproductivo: 'VACIA',
      productivo: 'SECA',
      categoria: 'RECRIA',
      fecha_ultimo_parto: null,
    },
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
      categoria: 'SECA',
      fecha_ultimo_parto: null,
    },
    {
      animal_id: V105,
      caravana: '105',
      vida: 'ACTIVA',
      reproductivo: 'INSEMINADA',
      productivo: 'SECA',
      categoria: 'RECRIA',
      fecha_ultimo_parto: null,
    },
    {
      animal_id: V106,
      caravana: '106',
      vida: 'ACTIVA',
      reproductivo: 'VACIA',
      productivo: 'EN_LACTANCIA',
      categoria: 'LACTANCIA_TEMPRANA',
      fecha_ultimo_parto: '2026-07-04',
    },
    {
      animal_id: V150,
      caravana: '150',
      vida: 'ACTIVA',
      reproductivo: 'VACIA',
      productivo: 'SECA',
      categoria: 'RECRIA',
      fecha_ultimo_parto: null,
    },
  ],
};

/**
 * La vendida el mes pasado: solo aparece con `?todas=true`, y sigue trayendo sus
 * dos ejes —lo que se apaga es la `categoria`, porque al que ya no está en el
 * rodeo no se le da dieta (decisión 53)—.
 */
export const animalesConBajas: RespuestaAnimales = {
  fecha: HOY,
  animales: [
    ...animales.animales.filter((a) => a.caravana !== '150'),
    {
      animal_id: V107,
      caravana: '107',
      vida: 'BAJA',
      reproductivo: 'VACIA',
      productivo: 'SECA',
      categoria: null,
      fecha_ultimo_parto: null,
    },
    ...animales.animales.filter((a) => a.caravana === '150'),
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
        fecha_inicio: '2025-03-16',
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
      // Los números de la demo, no inventados: la lactancia está abierta, así
      // que la estandarizada a 305 días coincide con la acumulada.
      acumulada: 4665.5,
      estandarizada_305: 4665.5,
    },
  ],
};

/**
 * El log de la 102: el ciclo completo desde el alta hasta los controles. Sirve
 * para ver el historial con payloads de todos los tipos.
 */
export const eventos102: RespuestaEventos = {
  animal_id: V102,
  eventos: [
    {
      id: 'e102-1',
      tipo: 'alta',
      fecha_evento: '2025-03-16',
      fecha_registro: '2025-03-16T12:00:00.000Z',
      payload: { fecha_nacimiento: '2022-03-12', estado_inicial: { numero_lactancia: 2 } },
      usuario: null,
      observaciones: null,
      forzado: false,
      ciclo_id: 'ciclo-1',
      anulado_por: null,
      vigente: true,
    },
    {
      id: 'e102-2',
      tipo: 'inseminacion',
      fecha_evento: '2025-04-05',
      fecha_registro: '2025-04-05T12:00:00.000Z',
      payload: { toro: 'Urubó', pajuela: 'HOL-4521' },
      usuario: null,
      observaciones: null,
      forzado: false,
      ciclo_id: 'ciclo-1',
      anulado_por: null,
      vigente: true,
    },
    {
      id: 'e102-3',
      tipo: 'parto',
      fecha_evento: '2026-01-13',
      fecha_registro: '2026-01-13T12:00:00.000Z',
      payload: { crias: [{ sexo: 'hembra', resultado: 'viva' }] },
      usuario: null,
      observaciones: null,
      forzado: false,
      ciclo_id: 'ciclo-1',
      anulado_por: null,
      vigente: true,
    },
    {
      id: 'e102-4',
      tipo: 'control_lechero',
      fecha_evento: '2026-07-12',
      fecha_registro: '2026-07-12T12:00:00.000Z',
      payload: { litros: 19, grasa: 4, proteina: 3.5, rcs: 320 },
      usuario: null,
      observaciones: null,
      forzado: false,
      ciclo_id: 'ciclo-2',
      anulado_por: null,
      vigente: true,
    },
  ],
};

/**
 * El log de la 105: el error de carga corregido como manda el event sourcing —el
 * celo equivocado no se edita, se **anula**, y el correcto se carga aparte—.
 * Es el caso que la ficha tiene que saber dibujar con sus tres marcas.
 */
export const eventos105: RespuestaEventos = {
  animal_id: V105,
  eventos: [
    {
      id: 'e105-1',
      tipo: 'alta',
      fecha_evento: '2025-10-02',
      fecha_registro: '2025-10-02T12:00:00.000Z',
      payload: { fecha_nacimiento: '2023-04-16' },
      usuario: null,
      observaciones: null,
      forzado: false,
      ciclo_id: 'ciclo-1',
      anulado_por: null,
      vigente: true,
    },
    {
      id: 'e105-2',
      tipo: 'celo',
      fecha_evento: '2026-04-30',
      fecha_registro: '2026-04-30T12:00:00.000Z',
      payload: {},
      usuario: null,
      observaciones: null,
      forzado: false,
      ciclo_id: 'ciclo-1',
      anulado_por: 'e105-5',
      vigente: false,
    },
    {
      id: 'e105-3',
      tipo: 'celo',
      fecha_evento: '2026-07-21',
      fecha_registro: '2026-07-21T12:00:00.000Z',
      payload: {},
      usuario: null,
      observaciones: null,
      forzado: false,
      ciclo_id: 'ciclo-1',
      anulado_por: null,
      vigente: true,
    },
    {
      id: 'e105-4',
      tipo: 'inseminacion',
      fecha_evento: '2026-07-21',
      fecha_registro: '2026-07-21T12:00:00.000Z',
      payload: {},
      usuario: null,
      observaciones: null,
      forzado: false,
      ciclo_id: 'ciclo-1',
      anulado_por: null,
      vigente: true,
    },
    {
      // La anulación también viene con `vigente: false` —no forma parte del
      // estado— pero no está anulada: son dos cosas distintas y la ficha las
      // tiene que distinguir.
      id: 'e105-5',
      tipo: 'anulacion',
      fecha_evento: HOY,
      fecha_registro: `${HOY}T12:00:00.000Z`,
      payload: { evento_anulado_id: 'e105-2' },
      usuario: null,
      observaciones: 'Fecha equivocada al pasar de la libreta: el celo fue este mes, no hace tres.',
      forzado: false,
      ciclo_id: null,
      anulado_por: null,
      vigente: false,
    },
  ],
};

/** El parto forzado de la 106: la cría nació muerta y el ciclo queda excluido. */
export const eventos106: RespuestaEventos = {
  animal_id: V106,
  eventos: [
    {
      id: 'e106-1',
      tipo: 'parto',
      fecha_evento: '2026-07-04',
      fecha_registro: '2026-07-04T12:00:00.000Z',
      payload: { crias: [{ sexo: 'hembra', resultado: 'muerta' }] },
      usuario: null,
      observaciones: 'Parió en el campo: la preñez nunca se había registrado.',
      forzado: true,
      ciclo_id: 'ciclo-1',
      anulado_por: null,
      vigente: true,
    },
  ],
};

/** Los KPIs de la 106, con un ciclo excluido por el parto forzado. */
export const kpis106: RespuestaKPIs = {
  animal_id: V106,
  fecha: HOY,
  kpis: {
    dias_abiertos: 25,
    intervalo_parto_primer_servicio: null,
    intervalo_entre_partos: null,
    servicios_por_concepcion: null,
    tasa_perdida_prenez: null,
    tasa_mortalidad_perinatal: 1,
    hembras_nacidas_vivas: 0,
    edad_dias: 1700,
    edad_al_primer_parto: null,
    ciclos_excluidos: 1,
  },
};

/** Una lactancia recién abierta: sin controles todavía, no hay curva que dibujar. */
export const lactanciasSinControles: RespuestaLactancias = {
  animal_id: V106,
  fecha: HOY,
  lactancias: [
    {
      numero: 2,
      parto_evento_id: 'e106-1',
      fecha_inicio: '2026-07-04',
      fecha_fin: null,
      datos_incompletos: true,
      crias: [{ sexo: 'hembra', resultado: 'muerta' }],
      curva: [],
      pico: null,
      promedio_controles: null,
      rcs_maximo: null,
      acumulada: null,
      estandarizada_305: null,
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

/**
 * Las cuatro lecturas de la ficha de la 102. Mismo criterio que
 * `rutasDelTablero`: cada tarjeta pide la suya, así que un test que abra la
 * ficha las necesita a las cuatro o ve tarjetas caídas en vez de fallar.
 */
export const rutasDeLaFicha: Record<string, RespuestaFalsa> = {
  [`GET /establecimientos/${EST}/animales/${V102}`]: { cuerpo: animal102 },
  [`GET /establecimientos/${EST}/animales/${V102}/kpis`]: { cuerpo: kpis102 },
  [`GET /establecimientos/${EST}/animales/${V102}/lactancias`]: { cuerpo: lactancias102 },
  [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: eventos102 },
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
