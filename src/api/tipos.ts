// ─────────────────────────────────────────────────────────────────────────────
// El contrato de §9, escrito una sola vez.
//
// Regla del archivo: **lo que ya es del núcleo viene de `./nucleo`, no se
// reescribe acá.** `Proyeccion`, `ResumenKPIs`, `ControlLechero`, `Cria`… son el
// vocabulario del dominio y viven en un solo lugar de este paquete.
//
// Hasta la mudanza a su propio repo eso era `import type … from 'tambo-reglas'`;
// hoy `nucleo.ts` es una copia de esas declaraciones, con el porqué escrito en
// su encabezado (decisión 66). Lo que no cambió es lo que importa: son **tipos**,
// que TypeScript borra al compilar, así que el browser no se lleva ni un byte
// del motor de dominio (decisión 51).
//
// Lo que sí se escribe acá es **el sobre**: los campos que la API le agrega a
// esas entidades al servirlas (`fecha`, `animal_id`, la caravana de las listas
// de trabajo). Eso no existe en el núcleo — nace en §9 y muere en §9.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CategoriaAlimentacion,
  CausaBaja,
  Config,
  ControlLechero,
  Cria,
  EstadoInicial,
  EstadoProductivo,
  EstadoReproductivo,
  EstadoVida,
  EvaluacionDeToros,
  GradoDistocia,
  MotivoBaja,
  MotivoTratamiento,
  Proyeccion,
  RegistroTanque,
  RepartoDeLote,
  ResumenDeDistocia,
  ResumenDeSalidas,
  ResumenDeServicios,
  ResumenKPIs,
  ResumenPrenez,
  ResumenRodeo,
  TipoEvento,
} from './nucleo';

export type {
  CategoriaAlimentacion,
  CausaBaja,
  Ciclo,
  ComposicionRodeo,
  Config,
  ConteoPrenez,
  ControlLechero,
  Cria,
  DistociaPorGrado,
  EstadisticaToro,
  EstadoAnimal,
  EstadoInicial,
  EstadoProductivo,
  EstadoReproductivo,
  EstadoVida,
  EvaluacionDeToros,
  GradoDistocia,
  Lactancia,
  Medicion,
  MotivoBaja,
  MotivoTratamiento,
  OrigenCiclo,
  PayloadAnulacion,
  PayloadBaja,
  PayloadControlLechero,
  PayloadCorreccion,
  PayloadInseminacion,
  PayloadMedicion,
  PayloadParto,
  PayloadTactoPositivo,
  PayloadTratamiento,
  PayloadTraslado,
  Proyeccion,
  RegistroTanque,
  RepartoDeLote,
  ResumenDeDistocia,
  ResumenDeSalidas,
  ResumenDeServicios,
  ResumenKPIs,
  ResumenPrenez,
  ResumenRodeo,
  ResultadoCiclo,
  ResultadoCria,
  SalidaPorCausa,
  ServicioDelCiclo,
  SexoCria,
  Tasas,
  TipoEvento,
  Tratamiento,
  VentanaPrenez,
} from './nucleo';

// ── Quién soy y qué puedo (`/auth`) ──────────────────────────────────────────
//
// Esto se escribe acá y **no** en `nucleo.ts`, que es la copia del vocabulario
// del dominio. Un token y un permiso no son del tambo: en un tambo no hay
// "usuarios con rol de lectura", hay vacas, celos y partos. La cerradura es de
// la aplicación, así que su vocabulario nace en §9 igual que el resto del sobre.

/** Los dos niveles por tambo, y no hay más. No existe un rol de dueño. */
export type Rol = 'escritura' | 'lectura';

export interface Permiso {
  establecimiento_id: string;
  rol: Rol;
}

/**
 * El usuario, con la forma exacta que devuelven `/auth/login` y `/auth/yo`.
 *
 * **`es_admin: true` viene con `permisos: []`**, y no es un descuido: el admin
 * puede todo en todos los tambos, así que no necesita que le den permiso sobre
 * ninguno. Leer `permisos` sin mirar `es_admin` deja al admin sin tambos y con
 * una UI de solo lectura — es el error que la Parte 4 pone en un único lugar.
 *
 * Los permisos se leen de la base en cada pedido y **no viajan adentro del
 * token**: lo que devuelve `/auth/yo` es el estado de ahora, no el de cuando se
 * logueó, y por eso una revocación se siente en el pedido siguiente.
 */
export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  es_admin: boolean;
  permisos: Permiso[];
}

export interface CuerpoLogin {
  email: string;
  password: string;
}

export interface RespuestaLogin {
  token: string;
  usuario: Usuario;
}

export interface RespuestaYo {
  usuario: Usuario;
}

export interface CuerpoPassword {
  actual: string;
  nueva: string;
}

// ── La administración: las personas y el reparto (§9) ────────────────────────
//
// El vocabulario del panel del admin. Va acá abajo y no en otro archivo por lo
// mismo que lo de arriba: es el sobre de §9, y §9 se escribe una sola vez.

/**
 * El usuario **visto por un admin**: lo mismo que `Usuario` más si está activo.
 *
 * Se escribe como extensión y no copiando los cinco campos a propósito: el día
 * que a `Usuario` le agreguen uno, este se entera solo. Del otro lado son dos
 * funciones (`vistaUsuario` y `vistaAdmin`) con la misma relación.
 *
 * **`activo` es la mitad de la información de la lista**, no un detalle: un
 * usuario desactivado con permiso de escritura sobre un tambo sigue figurando en
 * su reparto y **no entra**. Esconderlo dejaría al admin sin poder volver a
 * entrarlo, que es lo único que se hace con alguien desactivado.
 */
export interface UsuarioAdmin extends Usuario {
  activo: boolean;
}

/** `GET /usuarios`: **todos** los del sistema, desactivados incluidos, por nombre. */
export interface RespuestaUsuarios {
  usuarios: UsuarioAdmin[];
}

/**
 * `POST /usuarios`. La contraseña es **obligatoria** aunque la base admita
 * cuentas sin ninguna (así nacen el admin inicial y los que convirtió la
 * migración): crear a alguien sin contraseña es crear a alguien que no puede
 * entrar y que va a llamar por teléfono.
 */
export interface CuerpoAltaUsuario {
  nombre: string;
  email: string;
  password: string;
  es_admin?: boolean;
}

/**
 * `PATCH /usuarios/{id}`: todos opcionales, **y hay que mandar al menos uno**.
 * Un `{}` es 400 y un campo que la ruta no conoce también (decisión 78), así que
 * quien arma este cuerpo manda lo que cambió y nada más.
 */
export interface CuerpoPatchUsuario {
  nombre?: string;
  activo?: boolean;
  es_admin?: boolean;
  password?: string;
}

/** `PUT …/permisos/{est}`: otorga o cambia, que es el mismo pedido. */
export interface CuerpoPermiso {
  rol: Rol;
}

/**
 * Un tambo del selector: lo justo para dibujar la lista
 * (`GET /establecimientos`).
 *
 * `archivado` viene siempre, y en el listado normal es siempre `false`: la API
 * no devuelve los archivados salvo que se los pidan. Está igual porque la misma
 * fila se usa con `?archivados=true`, y entonces es lo único que distingue una
 * de otra.
 */
export interface EstablecimientoDeLaLista {
  id: string;
  nombre: string;
  archivado: boolean;
}

export interface RespuestaEstablecimientos {
  establecimientos: EstablecimientoDeLaLista[];
}

/**
 * `POST /establecimientos`. **Sin `config`**: la API le pone `CONFIG_DEFAULT`, y
 * no hay `PATCH /establecimientos/{est}` que la cambie después — ni por acá ni
 * por `curl`. Un formulario que ofreciera editarla estaría prometiendo algo que
 * la API no puede cumplir.
 */
export interface CuerpoEstablecimiento {
  nombre: string;
}

/** Lo que devuelve el alta: el id nuevo y el nombre, nada más. */
export interface RespuestaEstablecimientoCreado {
  id: string;
  nombre: string;
}

/**
 * `PATCH /establecimientos/{est}`: el nombre y archivar.
 *
 * **`config` no está**, aunque la API lo acepte. Ajustar los parámetros del
 * dominio —días de gestación, período voluntario de espera, umbral de secado— es
 * otra conversación y otra pantalla: son diecisiete números que se validan entre
 * ellos, y un formulario que los ofrezca al pasar, al lado del nombre, es un
 * formulario donde alguien cambia sin querer lo que decide si una preñez es
 * plausible. Cuando haga falta, se hace en serio.
 *
 * Igual que el de usuarios: **al menos un campo**, y uno desconocido es 400.
 */
export interface CuerpoPatchEstablecimiento {
  nombre?: string;
  archivado?: boolean;
  /** Los diecisiete parámetros, **enteros**: se validan entre ellos. */
  config?: Config;
  /** Por qué se cambian las reglas. Va al historial, no al establecimiento. */
  motivo?: string;
}

/**
 * Una versión de la `Config`, tal como quedó en el log del tambo.
 *
 * `usuario_id` es null en la primera de cada tambo: esa configuración no la puso
 * nadie, vino con el sistema. Es "no se sabe", que es la verdad, y no un usuario
 * inventado.
 */
export interface VersionDeConfig {
  id: string;
  config: Config;
  /** Instante ISO: la API lo serializa desde un `timestamptz`. */
  vigente_desde: string;
  usuario_id: string | null;
  motivo: string | null;
}

export interface RespuestaConfiguraciones {
  configuraciones: VersionDeConfig[];
}

/** `GET /config-default`: los valores del núcleo, que la UI no puede importar. */
export interface RespuestaConfigDefault {
  config: Config;
}

// ── El sobre de los errores (§9.1) ───────────────────────────────────────────

/**
 * Un rechazo, con la forma única de §9.1.
 *
 * `forzable` es la columna "¿Forzable?" de §5.6 servida por HTTP (decisión 54):
 * lo único que la UI necesita saber para ofrecer "Confirmar igual", y viene del
 * servidor justamente para no tener que mantener esa tabla acá. Se declara
 * opcional aunque la API lo mande siempre, porque un rechazo puede venir de un
 * proxy o de un servidor viejo — y ausente se lee como "no forzable", que es el
 * lado seguro.
 */
export interface CuerpoError {
  codigo: string;
  mensaje: string;
  evento_id?: string;
  forzable?: boolean;
  conflictos?: ConflictoPosterior[];
}

export interface ConflictoPosterior {
  evento_id: string;
  codigo: string;
  mensaje: string;
}

// ── Establecimiento ──────────────────────────────────────────────────────────

export interface RespuestaEstablecimiento {
  id: string;
  nombre: string;
  config: Config;
  /** Archivado se mira y no se carga: la API contesta 409 a cualquier carga. */
  archivado: boolean;
}

// ── Animales ─────────────────────────────────────────────────────────────────

/**
 * Una fila del listado del rodeo (`GET …/animales`, decisión 53). Es lo justo
 * para elegir cuál abrir: lo demás está en la ficha.
 */
export interface FilaAnimal {
  animal_id: string;
  caravana: string | null;
  /**
   * El nombre de la raza, ya resuelto contra el catálogo (decisión 109). Es
   * **descriptiva**: no entra en ninguna regla, y el núcleo ni la conoce. Viaja
   * en la lista por lo mismo que la caravana — es de lo poco que distingue a un
   * animal de otro cuando se los mira en una pantalla.
   */
  raza: string | null;
  raza_codigo: string | null;
  vida: EstadoVida;
  reproductivo: EstadoReproductivo | null;
  productivo: EstadoProductivo | null;
  /** Null en las de baja: al que ya no está en el rodeo no se le da dieta. */
  categoria: CategoriaAlimentacion | null;
  /**
   * En qué corral está (decisión 100). Va en la lista y no solo en la ficha
   * porque es con lo que se recorre el tambo: se abre la pantalla parado en un
   * corral, no pensando en un animal.
   */
  lote: string | null;
  fecha_ultimo_parto: string | null;
}

export interface RespuestaAnimales {
  fecha: string;
  animales: FilaAnimal[];
}

/**
 * La ficha: la proyección cacheada con la caravana, la raza y la versión.
 *
 * **`version` es opcional porque con `?fecha` no viene**, y eso no es un olvido de
 * la API: la versión es el contador con el que se resuelve la concurrencia al
 * escribir, o sea una propiedad de la fila de hoy. Devolverla junto a un estado
 * de marzo sería ofrecer el número con el que escribir sobre una foto. La raza sí
 * viaja en las dos, y es la de hoy: es un atributo del animal y no un estado que
 * el log reconstruya.
 */
export interface RespuestaAnimal {
  animal_id: string;
  caravana: string;
  raza: string | null;
  raza_codigo: string | null;
  version?: number;
  /** Solo con `?fecha`: qué día es esta foto. Ausente en la ficha de hoy. */
  fecha?: string;
  proyeccion: Proyeccion;
}

// ── El catálogo de razas (decisión 109) ──────────────────────────────────────

/**
 * Una raza del catálogo. **No cuelga de ningún establecimiento**, y es lo que la
 * hace útil: que "Jersey" sea la misma Jersey en todos los tambos es el punto de
 * que exista la tabla. Es lo que permite ofrecer una lista en vez de un campo
 * libre, que es lo único que de verdad mantiene limpio un dato así.
 */
export interface Raza {
  codigo: string;
  nombre: string;
}

export interface RespuestaRazas {
  razas: Raza[];
}

/**
 * Sin `usuario`: el evento se firma con el token y solo con el token. La API
 * saca de ahí quién lo cargó, y un `usuario` en el cuerpo es **400** — no se
 * ignora en silencio. Nadie firma en nombre de otro.
 */
export interface CuerpoAlta {
  caravana: string;
  /**
   * El código del catálogo (decisión 109). Va **al lado** de `caravana` y no
   * adentro del payload a propósito: es un atributo de la fila del animal, como
   * la caravana, y no un dato del evento `alta` que el fold vaya a leer.
   */
  raza_codigo?: string | null;
  fecha_evento?: string;
  observaciones?: string | null;
  forzado?: boolean;
  payload?: PayloadAltaApi;
}

export interface PayloadAltaApi {
  fecha_nacimiento?: string | null;
  estado_inicial?: EstadoInicial;
  madre_id?: string;
  parto_evento_id?: string;
}

export interface RespuestaAlta {
  animal_id: string;
  caravana: string;
  evento_alta_id: string;
  proyeccion: Proyeccion;
}

// ── Eventos ──────────────────────────────────────────────────────────────────

/** Sin `usuario`, por lo mismo que `CuerpoAlta`: la firma sale del token. */
export interface CuerpoEvento {
  /** Opcional: si viene, es la idempotencia del reintento (decisión 41). */
  id?: string;
  tipo: TipoEvento;
  fecha_evento?: string;
  payload?: unknown;
  observaciones?: string | null;
  forzado?: boolean;
}

export interface RespuestaEvento {
  evento_id: string;
  proyeccion: Proyeccion;
}

/**
 * Un evento del historial. Es el evento del núcleo más las dos columnas de
 * cache de la Fase 3 (`ciclo_id`, `anulado_por`, decisión 44) y el `vigente`
 * que la API deriva de ellas.
 */
export interface EventoHistorial {
  id: string;
  tipo: TipoEvento;
  fecha_evento: string;
  fecha_registro: string;
  payload: unknown;
  usuario: string | null;
  observaciones: string | null;
  forzado: boolean;
  ciclo_id: string | null;
  anulado_por: string | null;
  /**
   * La última corrección que lo tocó, o null (decisión 102).
   *
   * El evento se muestra **como se cargó** —el log es append-only— y este campo
   * es lo que le dice a la pantalla que lo que está viendo ya no es lo que vale.
   * Sin mostrarlo, un renglón corregido y uno intacto se leen igual, que es la
   * única forma en que la corrección puede hacer daño.
   */
  corregido_por: string | null;
  vigente: boolean;
  /**
   * Con qué versión de la `Config` se juzgó este evento. Es el id y no los
   * diecisiete números —repetirlos en cada renglón sería mandar lo mismo cuarenta
   * veces— y se cruza con `GET …/configuraciones`.
   *
   * Null solo en un evento anterior a la primera versión del historial, que en la
   * práctica no existe: es "no se sabe", y se dice así.
   */
  configuracion_id: string | null;
}

export interface RespuestaEventos {
  animal_id: string;
  eventos: EventoHistorial[];
}

// ── KPIs y lactancias ────────────────────────────────────────────────────────

/**
 * Los KPIs del núcleo **más el cuerpo** (decisión 108), que es lo que los
 * explica: la condición al parto es el mejor predictor del desempeño
 * reproductivo, y la ganancia en recría es por qué la edad al primer parto es la
 * que es. Los cuatro nacen en §9 y no en el núcleo, que los sirve por separado.
 */
export interface KPIsApi extends ResumenKPIs {
  /** La última medida a la fecha de hoy, en la escala de 1 a 5. */
  condicion_corporal: number | null;
  /** El último peso conocido, en kilos. */
  peso: number | null;
  /** Con qué condición llegó al último parto. */
  condicion_al_parto: number | null;
  /** Kilos por día ganados en la recría: la meta de la decisión 22, medida. */
  ganancia_diaria_recria: number | null;
}

export interface RespuestaKPIs {
  animal_id: string;
  fecha: string;
  kpis: KPIsApi;
}

/** Una lactancia con sus números ya calculados por el núcleo. */
export interface LactanciaConNumeros {
  numero: number;
  parto_evento_id: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  datos_incompletos: boolean;
  /** Distinto de lo anterior (decisión 110): el payload puede estar a medias sin
   *  que la fecha del parto esté en discusión. */
  fecha_incierta: boolean;
  crias: Cria[];
  /** Cuánta ayuda necesitó el parto que la abrió (decisión 107). */
  distocia: GradoDistocia | null;
  /** Con qué cuerpo llegó a ese parto (decisión 108). Va al lado de la distocia
   *  porque las dos contestan lo mismo: cómo entró a esta lactancia. */
  condicion_al_parto: number | null;
  curva: ControlLechero[];
  pico: ControlLechero | null;
  promedio_controles: number | null;
  rcs_maximo: number | null;
  /** Null —nunca 0— cuando no hay con qué calcularla (decisión 37). */
  acumulada: number | null;
  /** Compara vacas **de la misma lactancia**. */
  estandarizada_305: number | null;
  /**
   * Por cuánto se multiplicó para llegar al equivalente maduro. Viaja al lado del
   * número a propósito: uno que se multiplicó por 1,32 tiene que poder decir por
   * qué (decisión 105).
   */
  factor_madurez: number | null;
  /** Y esta es la que compara **entre** lactancias: la vaquillona contra la vaca hecha. */
  equivalente_maduro_305: number | null;
}

export interface RespuestaLactancias {
  animal_id: string;
  fecha: string;
  lactancias: LactanciaConNumeros[];
}

// ── Rodeo y alertas ──────────────────────────────────────────────────────────

/** Cómo viajan las listas de trabajo: con caravana, no con ids (decisión 49). */
export interface AnimalDeLista {
  animal_id: string;
  caravana: string | null;
}

/** El resumen del núcleo con las **tres** listas ya enriquecidas. */
export type ResumenRodeoApi = Omit<
  ResumenRodeo,
  'para_revisar' | 'para_secar' | 'para_descartar_leche'
> & {
  para_revisar: AnimalDeLista[];
  para_secar: AnimalDeLista[];
  para_descartar_leche: AnimalDeLista[];
};

export interface RespuestaRodeo {
  fecha: string;
  resumen: ResumenRodeoApi;
}

export interface RespuestaAlertas {
  fecha: string;
  para_revisar: AnimalDeLista[];
  para_secar: AnimalDeLista[];
  /**
   * Las que hoy **no van al tanque**: su leche está en período de retiro
   * (decisión 99).
   *
   * Es la tercera desde esa decisión y es de otra naturaleza que las dos de
   * arriba: aquellas avisan de un problema de manejo y esta de uno **legal**.
   * Viene en `/alertas` y no solo en la ficha de cada animal porque quien ordeña
   * necesita la lista antes de empezar, no ir a fijarse una por una.
   */
  para_descartar_leche: AnimalDeLista[];
}

// ── El reparto por corral (decisión 100) ─────────────────────────────────────

/**
 * `GET …/reparto` — **qué corral come qué**.
 *
 * `resumen.categorias` contesta cuántos animales del tambo caen en cada
 * categoría, y con eso se pide la ración; para **entregarla** hace falta el
 * desglose por corral, que es la unidad en que se reparte la comida.
 */
export interface RespuestaReparto {
  fecha: string;
  lotes: RepartoDeLote[];
}

// ── Los indicadores del rodeo ────────────────────────────────────────────────
//
// Cinco endpoints con la misma forma de sobre: el `fecha` del servidor y, los que
// aceptan ventana, el período que efectivamente se usó — `null` cuando no se
// acotó. Eso último no es decorativo: una tasa sobre la vida entera del log
// promedia años de manejo distinto y no se parece a ninguna meta, así que la
// pantalla tiene que poder decir sobre qué está hablando.

/** `GET …/servicios?desde&hasta` — la tasa de concepción del rodeo (decisión 98). */
export interface RespuestaServicios extends ResumenDeServicios {
  fecha: string;
  desde: string | null;
  hasta: string | null;
}

/** `GET …/toros` — qué rinde cada toro (decisión 96). **No acepta período.** */
export interface RespuestaToros extends EvaluacionDeToros {
  fecha: string;
}

/** `GET …/prenez?hasta&ventanas` — la tasa de preñez a 21 días (decisión 104). */
export interface RespuestaPrenez extends ResumenPrenez {
  fecha: string;
  /** El último día de la última ventana: lo pedido, o hoy. */
  hasta: string;
}

/** `GET …/salidas?desde&hasta` — por qué se van las vacas (decisión 106). */
export interface RespuestaSalidas extends ResumenDeSalidas {
  fecha: string;
  desde: string | null;
  hasta: string | null;
}

/** `GET …/partos?desde&hasta` — cuánto costaron los partos (decisión 107). */
export interface RespuestaPartosDelRodeo extends ResumenDeDistocia {
  fecha: string;
  desde: string | null;
  hasta: string | null;
}

// ── Tanque ───────────────────────────────────────────────────────────────────

export interface CuerpoTanque {
  fecha?: string;
  litros: number;
  lote?: string | null;
}

export interface RespuestaTanquePost extends RegistroTanque {
  id: string;
}

export interface RespuestaTanque {
  fecha: string;
  desde: string | null;
  hasta: string | null;
  /**
   * Qué lote se pidió, o `null` por el tambo entero (decisión 100).
   *
   * Sin él se suman **solo los registros sin lote**, que es el total por
   * definición (decisión 33); con él se filtran los dos lados —la leche de ese
   * lote sobre las vacas en ordeñe de ese lote—, que es lo que hace comparable el
   * `litros_por_vaca_en_ordene` de un corral.
   */
  lote: string | null;
  registros: RegistroTanque[];
  litros_totales: number;
  promedio_diario: number | null;
  /** Null si el período no vino acotado: sin bordes no hay días faltantes (decisión 49). */
  dias_sin_registro: string[] | null;
  litros_por_vaca_en_ordene: number | null;
}

// ── Las listas cerradas, para los desplegables ───────────────────────────────
//
// Son **valores** y no tipos, así que no vienen de `nucleo.ts`: la decisión 51
// prohíbe importar valores del núcleo y la 66 se llevó el paquete. Lo que las ata
// al original es la anotación — un valor que el backend saque de la unión deja de
// compilar acá, y uno que agregue lo encuentra el `Record` de `formato.ts`.

/** Motivos de baja: **cómo** salió. Obligatorio en el payload. */
export const MOTIVOS_BAJA: readonly MotivoBaja[] = ['venta', 'muerte', 'descarte', 'otro'];

/**
 * Causas de baja: **por qué** se fue (decisión 106). Opcional, a diferencia del
 * motivo — un rodeo se migra desde una libreta que casi nunca la anotó.
 */
export const CAUSAS_BAJA: readonly CausaBaja[] = [
  'reproduccion',
  'mastitis',
  'podal',
  'produccion',
  'edad',
  'enfermedad',
  'accidente',
  'otro',
];

/** Por qué se trató al animal (decisión 99). */
export const MOTIVOS_TRATAMIENTO: readonly MotivoTratamiento[] = [
  'mastitis',
  'metritis',
  'podal',
  'respiratorio',
  'reproductivo',
  'parasitario',
  'otro',
];

/**
 * La escala de distocia **en orden, de menos a más ayuda** (decisión 107). El
 * orden importa: es ordinal y se lee de corrido, no por frecuencia ni alfabético.
 */
export const GRADOS_DISTOCIA: readonly GradoDistocia[] = [
  'normal',
  'asistencia_leve',
  'asistencia_fuerte',
  'veterinario',
];
