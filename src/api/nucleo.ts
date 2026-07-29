// ─────────────────────────────────────────────────────────────────────────────
// EL VOCABULARIO DEL NÚCLEO — COPIA. No lo edites para "arreglar" nada.
//
// Original: `mu/src/tipos.ts`, `alimentacion.ts`, `rodeo.ts` y `kpis.ts` del
// paquete `tambo-reglas`, en el repo del backend. **Acá solo hay declaraciones
// de tipo**: ni una línea de lógica, ni una constante, ni una función.
//
// ── Por qué es una copia y no un import ─────────────────────────────────────
//
// Hasta que la UI salió a su propio repo, esto era `import type … from
// 'tambo-reglas'` y el paquete entraba por `file:../mu`. Fuera del monorepo esa
// ruta no existe, y npm no sabe instalar desde un subdirectorio de un repo git.
//
// Se pudo copiar sin culpa por una razón concreta: **la UI importa tipos del
// núcleo y nunca valores** (decisión 51). `import type` lo borra el compilador,
// así que al browser no viajaba una sola línea del motor de dominio ni antes ni
// ahora. Lo que se copió es lo que el compilador ya borraba.
//
// ── Cómo no se despega ──────────────────────────────────────────────────────
//
// Nada garantiza que esta copia siga al original, y conviene decirlo en vez de
// fingir lo contrario. Lo que sí la ata:
//
//   · Los `Record<X, string>` de `formato.ts` (el vocabulario en castellano) no
//     compilan si acá aparece un valor nuevo de `TipoEvento`, `MotivoBaja` o
//     `CategoriaAlimentacion`. Es la misma atadura barata que ya usaba
//     `NOMBRE_CATEGORIA` cuando era la única duplicación deliberada.
//   · Las fixtures de la suite están tipadas contra esto, así que un campo que
//     el backend renombre y acá no rompe los tests en vez de pasar en silencio.
//
// Lo que **no** cubre ninguna de las dos: un campo que el backend agregue y acá
// falte. Eso lo encuentra usar la app contra la demo, que es el método de las
// decisiones 49 y 65. Es el costo conocido de la mudanza (decisión 66).
// ─────────────────────────────────────────────────────────────────────────────

// ── Eventos ──────────────────────────────────────────────────────────────────

export type TipoEvento =
  | 'alta'
  | 'celo'
  | 'inseminacion'
  | 'tacto_positivo'
  | 'tacto_negativo'
  | 'parto'
  | 'aborto'
  | 'secado'
  | 'control_lechero'
  | 'baja'
  | 'anulacion';

export type EstadoVida = 'SIN_ALTA' | 'ACTIVA' | 'BAJA';
export type EstadoReproductivo = 'VACIA' | 'INSEMINADA' | 'PRENADA';
export type EstadoProductivo = 'SECA' | 'EN_LACTANCIA';

/** Estado inicial opcional del payload del `alta` (animal comprado preñado,
 *  migración de un rodeo existente). Defaults: VACIA + SECA + lactancia 0. */
export interface EstadoInicial {
  reproductivo?: EstadoReproductivo;
  productivo?: EstadoProductivo;
  /** Si arranca INSEMINADA o PRENADA: fecha estimada del servicio. */
  fecha_servicio_estimada?: string | null;
  /** Alternativa directa si arranca PRENADA y no se conoce el servicio. */
  fecha_parto_probable?: string | null;
  /** Nº de lactancia ya cursadas (o en curso si arranca EN_LACTANCIA). */
  numero_lactancia?: number;
}

export type SexoCria = 'hembra' | 'macho';
/** Nacida viva o muerta: la diferencia es la mortalidad perinatal. */
export type ResultadoCria = 'viva' | 'muerta';

export interface Cria {
  sexo: SexoCria;
  resultado: ResultadoCria;
}

export type MotivoBaja = 'venta' | 'muerte' | 'descarte' | 'otro';

// ── Entidades derivadas (proyecciones) ───────────────────────────────────────

/**
 * `perdida` ≠ `aborto`: el aborto es un hecho observado (con fecha conocida),
 * la pérdida es un diagnóstico — un tacto negativo sobre una preñez ya
 * confirmada. Se cuentan por separado.
 */
export type ResultadoCiclo = 'parto' | 'aborto' | 'perdida' | 'baja' | 'abierto';

/** Qué abrió el ciclo. `alta` es el primero de todo animal. */
export type OrigenCiclo = 'alta' | 'parto' | 'aborto' | 'perdida';

export interface Ciclo {
  numero: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  /**
   * Distingue el ciclo que arranca con un parto de los demás: solo esos miden
   * el intervalo parto–primer servicio.
   */
  origen: OrigenCiclo;
  resultado: ResultadoCiclo;
  /** Inseminaciones registradas en el ciclo (base de servicios por concepción). */
  servicios: number;
  /** Primer servicio del ciclo. Null si todavía no se sirvió. */
  fecha_primer_servicio: string | null;
  /** true si el ciclo contiene al menos un evento forzado → se excluye de KPIs. */
  datos_incompletos: boolean;
}

/** Un control ya plegado dentro de su lactancia, con el DEL resuelto. */
export interface ControlLechero {
  evento_id: string;
  fecha: string;
  /** Días en leche a la fecha del control: la abscisa de la curva. */
  del: number;
  litros: number;
  grasa?: number;
  proteina?: number;
  rcs?: number;
}

/**
 * Medición diaria del tanque o del lote. **No es un evento**: no pertenece al
 * log de ningún animal.
 */
export interface RegistroTanque {
  fecha: string;
  litros: number;
  /** Null o ausente = el tambo entero. */
  lote?: string | null;
}

export interface Lactancia {
  numero: number;
  /** null si la lactancia viene del estado inicial del alta. */
  parto_evento_id: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  /** true si la abrió un parto forzado. Espeja el flag de `Ciclo`. */
  datos_incompletos: boolean;
  /** Las crías del parto que abrió esta lactancia. Vacío si no las declaró. */
  crias: Cria[];
  /** Controles lecheros registrados durante esta lactancia, en orden. */
  controles: ControlLechero[];
}

export interface EstadoAnimal {
  /** De qué animal es esta proyección. Null antes del alta. */
  animal_id: string | null;
  vida: EstadoVida;
  reproductivo: EstadoReproductivo | null;
  productivo: EstadoProductivo | null;
  /** Del payload del alta. Null si no se conoce (animal comprado). */
  fecha_nacimiento: string | null;
  /** Madre, si es una cría nacida en el rodeo. */
  madre_id: string | null;
  /** Parto del que salió. Con él y el log de la madre se llega al toro. */
  parto_origen_id: string | null;
  /** Motivo de la salida del rodeo. Null mientras no haya baja. */
  motivo_baja: MotivoBaja | null;
  /** Último celo registrado (habilita la inseminación por X días). */
  fecha_ultimo_celo: string | null;
  /** Último servicio del ciclo en curso (null si no está INSEMINADA). */
  fecha_ultima_inseminacion: string | null;
  /** Id de ese último servicio: trazabilidad de toro/pajuela. */
  ultima_inseminacion_id: string | null;
  /** Servicio que resultó en la preñez confirmada (base del parto probable). */
  fecha_inseminacion_efectiva: string | null;
  /** Id del servicio efectivo → paternidad de la cría. */
  inseminacion_efectiva_id: string | null;
  /** Parto probable declarado en el alta (si no se conoce el servicio). */
  fecha_parto_probable_inicial: string | null;
  /** Último parto ocurrido (base de días abiertos e intervalo entre partos). */
  fecha_ultimo_parto: string | null;
  /** Contador para numerar la próxima lactancia. */
  ultimo_numero_lactancia: number;
}

export interface Proyeccion {
  estado: EstadoAnimal;
  ciclos: Ciclo[];
  lactancias: Lactancia[];
}

// ── Alimentación ─────────────────────────────────────────────────────────────

export type CategoriaAlimentacion =
  | 'RECRIA'
  | 'LACTANCIA_TEMPRANA'
  | 'LACTANCIA_MEDIA'
  | 'LACTANCIA_TARDIA'
  | 'PREPARTO'
  | 'SECA';

// ── Rodeo ────────────────────────────────────────────────────────────────────

export interface ComposicionRodeo {
  activas: number;
  en_ordene: number;
  secas: number;
  vacias: number;
  inseminadas: number;
  prenadas: number;
}

export interface ResumenRodeo {
  composicion: ComposicionRodeo;
  /** **Fracción 0–1**, no 0–100: es `prenadas / activas` (decisión 57). */
  porcentaje_prenez: number | null;
  /** Promedio de días abiertos de las que ya parieron. */
  dias_abiertos_promedio: number | null;
  /** Promedio del intervalo entre partos de las que tienen dos partos limpios. */
  intervalo_entre_partos_promedio: number | null;
  /** Fracción 0–1, igual que las demás tasas. */
  tasa_descarte: number | null;
  tasa_mortalidad: number | null;
  categorias: Record<CategoriaAlimentacion, number>;
  para_revisar: string[];
  para_secar: string[];
}

// ── KPIs por animal ──────────────────────────────────────────────────────────

export interface ResumenKPIs {
  dias_abiertos: number | null;
  intervalo_parto_primer_servicio: number | null;
  intervalo_entre_partos: number | null;
  servicios_por_concepcion: number | null;
  /** Fracción 0–1. */
  tasa_perdida_prenez: number | null;
  /** Fracción 0–1. */
  tasa_mortalidad_perinatal: number | null;
  hembras_nacidas_vivas: number;
  edad_dias: number | null;
  edad_al_primer_parto: number | null;
  /** Ciclos excluidos por contener eventos forzados. */
  ciclos_excluidos: number;
}

// ── Configuración del establecimiento ────────────────────────────────────────

export interface Config {
  /** Días de validez del celo previo a la inseminación. */
  dias_validez_celo: number;
  /** Gestación bovina promedio. */
  dias_gestacion: number;
  /** Días de secado previos al parto probable. */
  dias_secado_preparto: number;
  /** Días esperados para el celo de retorno post-servicio. */
  dias_retorno_celo: number;

  // Ventanas de plausibilidad temporal: biología, no política del tambo.
  dias_gestacion_min: number;
  dias_gestacion_max: number;
  dias_min_para_tacto: number;
  dias_min_entre_celos: number;

  // Ventanas de manejo: política del establecimiento.
  dias_pve: number;
  dias_edad_min_primer_servicio: number;
  dias_min_secado_preparto: number;
  dias_alerta_sin_diagnostico: number;
  del_lactancia_temprana: number;
  del_lactancia_media: number;
  dias_preparto: number;
  litros_max_control: number;
  dias_lactancia_estandar: number;
}
