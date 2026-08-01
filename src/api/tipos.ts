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
  Config,
  ControlLechero,
  Cria,
  EstadoInicial,
  EstadoProductivo,
  EstadoReproductivo,
  EstadoVida,
  MotivoBaja,
  Proyeccion,
  RegistroTanque,
  ResumenKPIs,
  ResumenRodeo,
  TipoEvento,
} from './nucleo';

export type {
  CategoriaAlimentacion,
  Ciclo,
  ComposicionRodeo,
  Config,
  ControlLechero,
  Cria,
  EstadoAnimal,
  EstadoInicial,
  EstadoProductivo,
  EstadoReproductivo,
  EstadoVida,
  Lactancia,
  MotivoBaja,
  OrigenCiclo,
  Proyeccion,
  RegistroTanque,
  ResumenKPIs,
  ResumenRodeo,
  ResultadoCiclo,
  ResultadoCria,
  SexoCria,
  TipoEvento,
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

/** Un tambo del selector: lo justo para dibujar la lista (`GET /establecimientos`). */
export interface EstablecimientoDeLaLista {
  id: string;
  nombre: string;
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
}

// ── Animales ─────────────────────────────────────────────────────────────────

/**
 * Una fila del listado del rodeo (`GET …/animales`, decisión 53). Es lo justo
 * para elegir cuál abrir: lo demás está en la ficha.
 */
export interface FilaAnimal {
  animal_id: string;
  caravana: string | null;
  vida: EstadoVida;
  reproductivo: EstadoReproductivo | null;
  productivo: EstadoProductivo | null;
  /** Null en las de baja: al que ya no está en el rodeo no se le da dieta. */
  categoria: CategoriaAlimentacion | null;
  fecha_ultimo_parto: string | null;
}

export interface RespuestaAnimales {
  fecha: string;
  animales: FilaAnimal[];
}

/** La ficha: la proyección cacheada con la caravana y la versión de la fila. */
export interface RespuestaAnimal {
  animal_id: string;
  caravana: string;
  version: number;
  proyeccion: Proyeccion;
}

/**
 * Sin `usuario`: el evento se firma con el token y solo con el token. La API
 * saca de ahí quién lo cargó, y un `usuario` en el cuerpo es **400** — no se
 * ignora en silencio. Nadie firma en nombre de otro.
 */
export interface CuerpoAlta {
  caravana: string;
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
  vigente: boolean;
}

export interface RespuestaEventos {
  animal_id: string;
  eventos: EventoHistorial[];
}

// ── KPIs y lactancias ────────────────────────────────────────────────────────

export interface RespuestaKPIs {
  animal_id: string;
  fecha: string;
  kpis: ResumenKPIs;
}

/** Una lactancia con sus números ya calculados por el núcleo. */
export interface LactanciaConNumeros {
  numero: number;
  parto_evento_id: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  datos_incompletos: boolean;
  crias: Cria[];
  curva: ControlLechero[];
  pico: ControlLechero | null;
  promedio_controles: number | null;
  rcs_maximo: number | null;
  /** Null —nunca 0— cuando no hay con qué calcularla (decisión 37). */
  acumulada: number | null;
  estandarizada_305: number | null;
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

/** El resumen del núcleo con las dos listas ya enriquecidas. */
export type ResumenRodeoApi = Omit<ResumenRodeo, 'para_revisar' | 'para_secar'> & {
  para_revisar: AnimalDeLista[];
  para_secar: AnimalDeLista[];
};

export interface RespuestaRodeo {
  fecha: string;
  resumen: ResumenRodeoApi;
}

export interface RespuestaAlertas {
  fecha: string;
  para_revisar: AnimalDeLista[];
  para_secar: AnimalDeLista[];
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
  registros: RegistroTanque[];
  litros_totales: number;
  promedio_diario: number | null;
  /** Null si el período no vino acotado: sin bordes no hay días faltantes (decisión 49). */
  dias_sin_registro: string[] | null;
  litros_por_vaca_en_ordene: number | null;
}

/** Motivos de baja, para el desplegable. El tipo del núcleo manda. */
export const MOTIVOS_BAJA: readonly MotivoBaja[] = ['venta', 'muerte', 'descarte', 'otro'];
