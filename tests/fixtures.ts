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
  RespuestaConfigDefault,
  RespuestaConfiguraciones,
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
  RespuestaPartosDelRodeo,
  RespuestaPrenez,
  RespuestaRazas,
  RespuestaReparto,
  RespuestaRodeo,
  RespuestaSalidas,
  RespuestaServicios,
  RespuestaTanque,
  RespuestaToros,
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
  dias_tolerancia_gestacion: 21,
  dias_pve: 45,
  dias_edad_min_primer_servicio: 390,
  dias_min_secado_preparto: 40,
  dias_alerta_sin_diagnostico: 40,
  del_lactancia_temprana: 100,
  del_lactancia_media: 200,
  dias_preparto: 21,
  litros_max_control: 80,
  peso_max_medicion: 1200,
  dias_lactancia_estandar: 305,
  factores_madurez: [1.32, 1.16, 1.08, 1.03, 1.0],
  edad_referencia_primer_parto: 730,
  ajuste_por_dia_edad_primer_parto: 0.0005,
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
  archivado: false,
};

/** El mismo, cerrado: se mira entero y no acepta una carga más. */
export const establecimientoArchivado: RespuestaEstablecimiento = {
  ...establecimiento,
  archivado: true,
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
  // El nombre es el de verdad: así lo siembra la migración 002 y así lo muestra
  // la demo. Decía "Administración" y lo encontró el humo, que es exactamente
  // para lo que está — una fixture que se despega no la agarra ningún mock.
  nombre: 'Administrador',
  email: 'admin@tambo.local',
  es_admin: true,
  permisos: [],
};

export const misEstablecimientos: RespuestaEstablecimientos = {
  establecimientos: [{ id: EST, nombre: 'La Esperanza', archivado: false }],
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
export const establecimiento2: EstablecimientoDeLaLista = {
  id: EST2,
  nombre: 'El Ombú',
  archivado: false,
};

/** Los dos que ve el admin, en el orden de la API (por nombre). */
export const losDosTambos: EstablecimientoDeLaLista[] = [
  establecimiento2,
  { id: EST, nombre: 'La Esperanza', archivado: false },
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

// ── El historial de configuraciones ──────────────────────────────────────────
//
// Dos versiones: la que vino con el sistema —sin usuario, porque no la puso
// nadie— y la que alguien cambió, con su porqué. La pregunta que contesta esta
// tabla es bajo qué reglas se decidió cada cosa, así que las fixtures tienen que
// tener las dos mitades: el número y la explicación.

export const configDeFabrica: RespuestaConfigDefault = { config: CONFIG_DEFAULT };

export const historialDeConfig: RespuestaConfiguraciones = {
  configuraciones: [
    {
      id: 'cfg-2',
      config: { ...CONFIG_DEFAULT, dias_pve: 60 },
      vigente_desde: '2026-06-01T12:00:00.000Z',
      usuario_id: usuarioAdmin.id,
      motivo: 'Subimos el PVE después de la charla con el veterinario.',
    },
    {
      id: 'cfg-1',
      config: CONFIG_DEFAULT,
      // Anterior a todos los eventos de las fixtures: así el historial de la
      // ficha puede decir con cuál se juzgó cada uno sin que ninguno quede en
      // "no se sabe".
      vigente_desde: '2025-01-10T12:00:00.000Z',
      usuario_id: null,
      motivo: 'Configuración con la que se creó el tambo.',
    },
  ],
};

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

/**
 * El rodeo de la demo, ordenado por caravana como lo devuelve la API.
 *
 * La raza y el lote llegaron con las decisiones 109 y 100, y **no están en todas
 * las filas a propósito**: las dos son opcionales del lado del modelo, y una
 * fixture donde todas las traen no prueba que la pantalla sepa dibujar la fila que
 * no las tiene — que es el caso normal de un tambo que recién empieza a usarlas.
 * La 150 y la 101 quedan sin lote, y la 105 sin raza.
 */
export const animales: RespuestaAnimales = {
  fecha: HOY,
  animales: [
    {
      animal_id: V101,
      caravana: '101',
      raza: 'Holando',
      raza_codigo: 'HOL',
      vida: 'ACTIVA',
      reproductivo: 'VACIA',
      productivo: 'SECA',
      categoria: 'RECRIA',
      lote: null,
      fecha_ultimo_parto: null,
    },
    {
      animal_id: V102,
      caravana: '102',
      raza: 'Holando',
      raza_codigo: 'HOL',
      vida: 'ACTIVA',
      reproductivo: 'VACIA',
      productivo: 'EN_LACTANCIA',
      categoria: 'LACTANCIA_MEDIA',
      lote: 'Ordeñe 1',
      fecha_ultimo_parto: '2026-01-13',
    },
    {
      animal_id: V103,
      caravana: '103',
      raza: 'Jersey',
      raza_codigo: 'JER',
      vida: 'ACTIVA',
      reproductivo: 'PRENADA',
      productivo: 'EN_LACTANCIA',
      categoria: 'LACTANCIA_TARDIA',
      lote: 'Ordeñe 2',
      fecha_ultimo_parto: '2025-10-05',
    },
    {
      animal_id: V104,
      caravana: '104',
      raza: 'Holando',
      raza_codigo: 'HOL',
      vida: 'ACTIVA',
      reproductivo: 'INSEMINADA',
      productivo: 'SECA',
      categoria: 'SECA',
      lote: 'Secas',
      fecha_ultimo_parto: null,
    },
    {
      animal_id: V105,
      caravana: '105',
      raza: null,
      raza_codigo: null,
      vida: 'ACTIVA',
      reproductivo: 'INSEMINADA',
      productivo: 'SECA',
      categoria: 'RECRIA',
      lote: 'Recría',
      fecha_ultimo_parto: null,
    },
    {
      animal_id: V106,
      caravana: '106',
      raza: 'Holando',
      raza_codigo: 'HOL',
      vida: 'ACTIVA',
      reproductivo: 'VACIA',
      productivo: 'EN_LACTANCIA',
      categoria: 'LACTANCIA_TEMPRANA',
      lote: 'Ordeñe 1',
      fecha_ultimo_parto: '2026-07-04',
    },
    {
      animal_id: V150,
      caravana: '150',
      raza: 'Cruza HxJ',
      raza_codigo: 'HXJ',
      vida: 'ACTIVA',
      reproductivo: 'VACIA',
      productivo: 'SECA',
      categoria: 'RECRIA',
      lote: null,
      fecha_ultimo_parto: null,
    },
  ],
};

/** `GET /razas`: el catálogo global, que no cuelga de ningún tambo (decisión 109). */
export const razas: RespuestaRazas = {
  razas: [
    { codigo: 'HOL', nombre: 'Holando' },
    { codigo: 'JER', nombre: 'Jersey' },
    { codigo: 'HXJ', nombre: 'Cruza HxJ' },
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
      raza: 'Holando',
      raza_codigo: 'HOL',
      vida: 'BAJA',
      reproductivo: 'VACIA',
      productivo: 'SECA',
      categoria: null,
      // Al que ya no está en el rodeo tampoco se le da corral: sale del lote con
      // la baja, igual que se apaga su categoría.
      lote: null,
      fecha_ultimo_parto: null,
    },
    ...animales.animales.filter((a) => a.caravana === '150'),
  ],
};

/**
 * Las tres listas del tablero. La tercera es la de la decisión 99 y trae a la
 * 106: está en ordeñe y con un tratamiento en curso, así que **su leche no va al
 * tanque**. Es la única de las tres con consecuencia legal.
 */
export const alertas: RespuestaAlertas = {
  fecha: HOY,
  para_revisar: [{ animal_id: V104, caravana: '104' }],
  para_secar: [{ animal_id: V103, caravana: '103' }],
  para_descartar_leche: [{ animal_id: V106, caravana: '106' }],
};

export const alertasVacias: RespuestaAlertas = {
  fecha: HOY,
  para_revisar: [],
  para_secar: [],
  para_descartar_leche: [],
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
    para_descartar_leche: [{ animal_id: V106, caravana: '106' }],
  },
};

export const animal102: RespuestaAnimal = {
  animal_id: V102,
  caravana: '102',
  raza: 'Holando',
  raza_codigo: 'HOL',
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
      causa_baja: null,
      fecha_ultimo_celo: null,
      fecha_ultima_inseminacion: null,
      ultima_inseminacion_id: null,
      servicios_del_ciclo: [],
      fecha_inseminacion_efectiva: null,
      inseminacion_efectiva_id: null,
      fecha_parto_probable_inicial: null,
      fecha_ultimo_parto: '2026-01-13',
      ultimo_numero_lactancia: 3,
      lote: 'Ordeñe 1',
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
        fecha_incierta: false,
        crias: [{ sexo: 'hembra', resultado: 'viva' }],
        distocia: 'normal',
        controles: [],
      },
    ],
    // Un tratamiento **ya vencido**: la leche volvió al tanque en enero. Es el
    // caso que la ficha tiene que saber distinguir del que sigue en retiro, y por
    // eso la fixture lo trae — si el único tratamiento de la suite estuviera
    // vigente, un aviso que apareciera siempre pasaría por correcto.
    tratamientos: [
      {
        evento_id: 't102-1',
        fecha: '2026-01-14',
        producto: 'Mastijet',
        motivo: 'mastitis',
        retiro_leche_dias: 4,
        leche_apta_desde: '2026-01-18',
        carne_apta_desde: '2026-01-28',
        detalle: 'Un tubo por cuarto, dos días.',
      },
    ],
    mediciones: [
      { evento_id: 'm102-1', fecha: '2026-01-10', condicion_corporal: 3.25, peso: 585 },
      { evento_id: 'm102-2', fecha: '2026-06-15', condicion_corporal: 2.75 },
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
    // El cuerpo (decisión 108). `ganancia_diaria_recria` viene null a propósito:
    // la 102 entró al tambo hecha, así que no tiene pesadas de recría con las que
    // calcularla — y eso es "no hay con qué", que se dice y no se dibuja como 0.
    condicion_corporal: 2.75,
    peso: 585,
    condicion_al_parto: 3.25,
    ganancia_diaria_recria: null,
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
      fecha_incierta: false,
      crias: [{ sexo: 'hembra', resultado: 'viva' }],
      distocia: 'asistencia_leve',
      condicion_al_parto: 3.25,
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
      // Tercera lactancia: el factor de la 105 la corrige poco, que es todo el
      // punto del equivalente maduro — una vaquillona se corrige 1,32 y una vaca
      // hecha casi nada, y por eso se pueden mirar en la misma columna.
      factor_madurez: 1.08,
      equivalente_maduro_305: 5038.74,
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
      corregido_por: null,
      vigente: true,
      configuracion_id: 'cfg-1',
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
      corregido_por: null,
      vigente: true,
      configuracion_id: 'cfg-1',
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
      corregido_por: null,
      vigente: true,
      configuracion_id: 'cfg-1',
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
      corregido_por: null,
      vigente: true,
      configuracion_id: 'cfg-2',
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
      corregido_por: null,
      vigente: true,
      configuracion_id: 'cfg-1',
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
      corregido_por: null,
      vigente: false,
      configuracion_id: 'cfg-1',
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
      corregido_por: null,
      vigente: true,
      configuracion_id: 'cfg-2',
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
      corregido_por: null,
      vigente: true,
      configuracion_id: 'cfg-2',
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
      corregido_por: null,
      vigente: false,
      configuracion_id: 'cfg-2',
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
      corregido_por: null,
      vigente: true,
      configuracion_id: 'cfg-2',
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
    condicion_corporal: null,
    peso: null,
    condicion_al_parto: null,
    ganancia_diaria_recria: null,
  },
};

/**
 * Una lactancia recién abierta: sin controles todavía, no hay curva que dibujar.
 *
 * Y el caso de la decisión 110: la abrió un parto **forzado** —la 106 parió de
 * monta y nunca figuró preñada— pero su fecha es perfectamente confiable, porque
 * la vieron parir. Por eso `datos_incompletos: true` con `fecha_incierta: false`,
 * que es la combinación que esa decisión separó y la que la pantalla tiene que
 * saber contar sin decir que la curva no se puede leer.
 */
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
      fecha_incierta: false,
      crias: [{ sexo: 'hembra', resultado: 'muerta' }],
      distocia: null,
      condicion_al_parto: null,
      curva: [],
      pico: null,
      promedio_controles: null,
      rcs_maximo: null,
      acumulada: null,
      estandarizada_305: null,
      factor_madurez: null,
      equivalente_maduro_305: null,
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
  // Sin `?lote`: el total del tambo, que suma solo los registros sin lote
  // (decisión 33). El campo viaja igual y dice cuál se pidió.
  lote: null,
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

// ── Los indicadores del rodeo ────────────────────────────────────────────────
//
// Los cinco endpoints que la API sumó entre las decisiones 96 y 107 y que hasta
// ahora ningún cliente pedía. Las fixtures se escriben con **los números que se
// llevan bien entre ellos** —los servicios de `/toros` suman con los de
// `/servicios`, la tasa es la división de verdad— porque un mock donde los
// números no cierran deja pasar una pantalla que los suma mal.

/** `GET …/reparto`: qué corral come qué (decisión 100). El general va último. */
export const reparto: RespuestaReparto = {
  fecha: HOY,
  lotes: [
    {
      lote: 'Ordeñe 1',
      animales: 2,
      categorias: {
        RECRIA: 0,
        LACTANCIA_TEMPRANA: 1,
        LACTANCIA_MEDIA: 1,
        LACTANCIA_TARDIA: 0,
        PREPARTO: 0,
        SECA: 0,
      },
    },
    {
      lote: 'Ordeñe 2',
      animales: 1,
      categorias: {
        RECRIA: 0,
        LACTANCIA_TEMPRANA: 0,
        LACTANCIA_MEDIA: 0,
        LACTANCIA_TARDIA: 1,
        PREPARTO: 0,
        SECA: 0,
      },
    },
    {
      lote: 'Recría',
      animales: 1,
      categorias: {
        RECRIA: 1,
        LACTANCIA_TEMPRANA: 0,
        LACTANCIA_MEDIA: 0,
        LACTANCIA_TARDIA: 0,
        PREPARTO: 0,
        SECA: 0,
      },
    },
    {
      lote: 'Secas',
      animales: 1,
      categorias: {
        RECRIA: 0,
        LACTANCIA_TEMPRANA: 0,
        LACTANCIA_MEDIA: 0,
        LACTANCIA_TARDIA: 0,
        PREPARTO: 0,
        SECA: 1,
      },
    },
    // El resto, y va al final: no es un corral, son los que no están en ninguno.
    {
      lote: null,
      animales: 2,
      categorias: {
        RECRIA: 2,
        LACTANCIA_TEMPRANA: 0,
        LACTANCIA_MEDIA: 0,
        LACTANCIA_TARDIA: 0,
        PREPARTO: 0,
        SECA: 0,
      },
    },
  ],
};

/**
 * `GET …/servicios`: la tasa de concepción del rodeo (decisión 98).
 *
 * 5 de 8 con diagnóstico prendieron, y los otros 4 **no cuentan para la tasa**:
 * son los servicios recientes que todavía no se pueden diagnosticar. Es el borde
 * que hace que la tasa de un período reciente no se hunda sola.
 */
export const servicios: RespuestaServicios = {
  fecha: HOY,
  desde: '2025-08-01',
  hasta: HOY,
  servicios: 12,
  concepciones: 5,
  fallidos: 3,
  sin_diagnostico: 4,
  tasa_concepcion: 5 / 8,
  animales_servidos: 6,
  servicios_excluidos: 1,
};

/** `GET …/toros`: qué rinde cada uno (decisión 96). De más servicios a menos. */
export const toros: RespuestaToros = {
  fecha: HOY,
  toros: [
    {
      toro: 'URUBÓ',
      servicios: 7,
      concepciones: 3,
      fallidos: 2,
      sin_diagnostico: 2,
      tasa_concepcion: 3 / 5,
      animales: 5,
      partos: 3,
      crias_vivas: 3,
      crias_hembras: 2,
    },
    {
      // El que todavía no se puede juzgar: dos servicios y ninguno diagnosticado.
      // La tasa viene `null` y **no cero**, que es la diferencia entre "no se
      // sabe" y "no prendió ninguno" (decisión 37).
      toro: 'NAPOLEÓN',
      servicios: 2,
      concepciones: 0,
      fallidos: 0,
      sin_diagnostico: 2,
      tasa_concepcion: null,
      animales: 2,
      partos: 0,
      crias_vivas: 0,
      crias_hembras: 0,
    },
  ],
  // Lo que esta evaluación **no puede ver**, y por eso viaja al lado.
  servicios_sin_toro: 3,
  servicios_excluidos: 1,
};

/**
 * `GET …/prenez`: la tasa de preñez a 21 días (decisión 104).
 *
 * Tres ventanas, y **la última sin madurar**: sus tres tasas vienen en `null`
 * porque sus servicios todavía no tuvieron tiempo de diagnosticarse. Es la mitad
 * del valor del endpoint y el caso que la pantalla tiene que saber dibujar —
 * calculada daría casi cero y el gráfico terminaría en una caída que no ocurrió.
 */
export const prenez: RespuestaPrenez = {
  fecha: HOY,
  hasta: HOY,
  dias_ventana: 21,
  ventanas_maduras: 2,
  elegibles: 12,
  servidas: 7,
  servicios: 8,
  servicios_iatf: 3,
  prenadas: 4,
  sin_diagnostico: 1,
  excluidas: 1,
  edad_desconocida: 0,
  tasa_prenez: 4 / 12,
  tasa_servicio: 7 / 12,
  tasa_concepcion: 4 / 7,
  ventanas: [
    {
      desde: '2026-05-27',
      hasta: '2026-06-16',
      elegibles: 6,
      servidas: 4,
      servicios: 4,
      servicios_iatf: 2,
      prenadas: 3,
      sin_diagnostico: 0,
      excluidas: 1,
      edad_desconocida: 0,
      tasa_prenez: 0.5,
      tasa_servicio: 4 / 6,
      tasa_concepcion: 0.75,
      madura: true,
    },
    {
      desde: '2026-06-17',
      hasta: '2026-07-07',
      elegibles: 6,
      servidas: 3,
      servicios: 3,
      servicios_iatf: 1,
      prenadas: 1,
      sin_diagnostico: 1,
      excluidas: 0,
      edad_desconocida: 0,
      tasa_prenez: 1 / 6,
      tasa_servicio: 0.5,
      tasa_concepcion: 1 / 3,
      madura: true,
    },
    {
      desde: '2026-07-08',
      hasta: HOY,
      elegibles: 5,
      servidas: 2,
      servicios: 2,
      servicios_iatf: 0,
      prenadas: 0,
      sin_diagnostico: 2,
      excluidas: 0,
      edad_desconocida: 1,
      tasa_prenez: null,
      tasa_servicio: null,
      tasa_concepcion: null,
      madura: false,
    },
  ],
};

/**
 * `GET …/salidas`: por qué se van las vacas (decisión 106).
 *
 * Con una baja **sin causa declarada**, que va aparte y no repartida entre las
 * conocidas: es lo que el informe no puede explicar.
 */
export const salidas: RespuestaSalidas = {
  fecha: HOY,
  desde: '2025-08-01',
  hasta: HOY,
  bajas: 4,
  base: 11,
  tasa_salida: 4 / 11,
  causas: [
    {
      causa: 'reproduccion',
      animales: 2,
      por_motivo: { venta: 1, muerte: 0, descarte: 1, otro: 0 },
    },
    { causa: 'podal', animales: 1, por_motivo: { venta: 0, muerte: 0, descarte: 1, otro: 0 } },
  ],
  sin_causa: 1,
};

/**
 * `GET …/partos`: cuánta ayuda necesitaron (decisión 107).
 *
 * Los grados vienen **en orden de la escala** y no por frecuencia, que es cómo se
 * leen; y hay un parto sin declarar, que se cuenta aparte y no como normal.
 */
export const partosDelRodeo: RespuestaPartosDelRodeo = {
  fecha: HOY,
  desde: '2025-08-01',
  hasta: HOY,
  partos: 6,
  sin_declarar: 2,
  tasa_asistencia: 2 / 6,
  grados: [
    {
      grado: 'normal',
      partos: 4,
      primer_parto: 1,
      intervalo_parto_primer_servicio: 62,
    },
    {
      grado: 'asistencia_leve',
      partos: 1,
      primer_parto: 1,
      intervalo_parto_primer_servicio: 78,
    },
    {
      grado: 'asistencia_fuerte',
      partos: 0,
      primer_parto: 0,
      intervalo_parto_primer_servicio: null,
    },
    {
      // El que justifica registrar todo esto: el intervalo al primer servicio se
      // va treinta días arriba del de las que parieron solas. Eso son días
      // abiertos que el sistema calculaba sin poder explicar.
      grado: 'veterinario',
      partos: 1,
      primer_parto: 1,
      intervalo_parto_primer_servicio: 95,
    },
  ],
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
 * Las lecturas de la ficha de la 102. Mismo criterio que `rutasDelTablero`:
 * cada tarjeta pide la suya, así que un test que abra la ficha las necesita
 * todas o ve tarjetas caídas en vez de fallar.
 *
 * **`/lactancias` no está**, y eso es parte de la afirmación: se fue entera a su
 * pantalla y la ficha no la pide nunca más. Si alguien la vuelve a pedir desde
 * acá, el servidor de mentira tira en vez de contestar — que es exactamente lo
 * que hay que enterarse. Sus fixtures viven en `Partos.test.tsx`.
 */
export const rutasDeLaFicha: Record<string, RespuestaFalsa> = {
  [`GET /establecimientos/${EST}/animales/${V102}`]: { cuerpo: animal102 },
  [`GET /establecimientos/${EST}/animales/${V102}/kpis`]: { cuerpo: kpis102 },
  [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: eventos102 },
  // El historial la pide para poder decir con qué reglas se juzgó cada evento.
  // Va acá y no en cada test: una ruta que la pantalla pide y el mock no prevé
  // se ve como un dato que no vino, no como un test que falla.
  [`GET /establecimientos/${EST}/configuraciones`]: { cuerpo: historialDeConfig },
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
