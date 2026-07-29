// ─────────────────────────────────────────────────────────────────────────────
// El contrato de §9, escrito una sola vez.
//
// Regla del archivo: **lo que ya es del núcleo se importa, no se copia.**
// `Proyeccion`, `ResumenKPIs`, `ControlLechero`, `Cria`… vienen de
// `tambo-reglas` con `import type`, que TypeScript borra al compilar: el
// vocabulario es uno solo y el browser no se lleva ni un byte del motor de
// dominio (decisión 51).
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
} from 'tambo-reglas';

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
} from 'tambo-reglas';

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

export interface CuerpoAlta {
  caravana: string;
  fecha_evento?: string;
  usuario?: string;
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

export interface CuerpoEvento {
  /** Opcional: si viene, es la idempotencia del reintento (decisión 41). */
  id?: string;
  tipo: TipoEvento;
  fecha_evento?: string;
  payload?: unknown;
  usuario?: string;
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
