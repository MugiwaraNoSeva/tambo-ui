// ─────────────────────────────────────────────────────────────────────────────
// EL VOCABULARIO DEL NÚCLEO — COPIA. No lo edites para "arreglar" nada.
//
// Original: `mu/src/tipos.ts`, `alimentacion.ts`, `rodeo.ts`, `kpis.ts`,
// `servicios.ts`, `prenez.ts` y `toros.ts` del paquete `tambo-reglas`, en el repo
// del backend. **Acá solo hay declaraciones de tipo**: ni una línea de lógica, ni
// una constante, ni una función.
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
//
// **Y se cobró.** Entre las decisiones 96 y 112 el backend agregó cuatro tipos de
// evento, dos dimensiones enteras —la sanitaria y el cuerpo—, la raza, el lote y
// cinco parámetros de `Config`, y esta copia no se enteró de ninguno: la app
// seguía compilando y andando, porque un campo de más en una respuesta JSON no
// rompe nada. Lo que se pierde no es la compilación, es la pantalla — el retiro de
// leche estaba contestado por la API y no lo veía nadie. Al agregar acá lo que
// falta, `formato.ts` deja de compilar hasta nombrar los tipos nuevos, que es el
// único mecanismo que empuja a mostrarlos.
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
  | 'medicion'
  | 'tratamiento'
  | 'traslado'
  | 'baja'
  | 'anulacion'
  | 'correccion';

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
  /**
   * Cuándo parió por última vez, si ya parió alguna vez (decisión 94). Sin él, la
   * lactancia de una comprada en ordeñe arranca en la fecha del alta y el DEL
   * queda corrido tantos días como llevaba en leche al comprarla.
   */
  fecha_ultimo_parto?: string | null;
  /** A qué lote entra (decisión 100). Sin esto, al rodeo general. */
  lote?: string | null;
}

export type SexoCria = 'hembra' | 'macho';
/** Nacida viva o muerta: la diferencia es la mortalidad perinatal. */
export type ResultadoCria = 'viva' | 'muerta';

export interface Cria {
  sexo: SexoCria;
  resultado: ResultadoCria;
}

/**
 * Cuánta ayuda necesitó el parto (decisión 107).
 *
 * La escala se nombra por **quién tuvo que estar** y no por un número del 1 al 5:
 * el que la carga es el que estuvo ahí, y "asistencia fuerte" se decide sin
 * consultar una tabla. `veterinario` junta la cesárea y todo lo que requiere
 * intervención profesional.
 */
export type GradoDistocia = 'normal' | 'asistencia_leve' | 'asistencia_fuerte' | 'veterinario';

/**
 * Por qué se trató al animal (decisión 99). Lista cerrada y corta: es lo que
 * después permite preguntar de qué se enferma este rodeo. `otro` existe para que
 * la lista no fuerce una mentira.
 */
export type MotivoTratamiento =
  | 'mastitis'
  | 'metritis'
  | 'podal'
  | 'respiratorio'
  | 'reproductivo'
  | 'parasitario'
  | 'otro';

export type MotivoBaja = 'venta' | 'muerte' | 'descarte' | 'otro';

/**
 * **Por qué** se fue el animal (decisión 106), que es otra pregunta que `motivo`
 * —cómo salió— y es la que decide qué arreglar en el tambo. `mastitis` y `podal`
 * se llaman igual que en `MotivoTratamiento` a propósito, para que las dos
 * preguntas se puedan leer juntas.
 */
export type CausaBaja =
  | 'reproduccion'
  | 'mastitis'
  | 'podal'
  | 'produccion'
  | 'edad'
  | 'enfermedad'
  | 'accidente'
  | 'otro';

// ── Los payloads, tal como los define el núcleo ──────────────────────────────
//
// La API los sirve como `unknown` —hace bien: no los reinterpreta— así que del
// lado de la lectura se leen defensivamente en `formato.ts`. Del lado de la
// **escritura** sí se tipan: es lo que hace que un campo que el backend renombre
// rompa el typecheck de los formularios en vez de viajar en silencio y ser
// ignorado por el fold. Es la misma atadura barata que el encabezado describe
// para los `Record<TipoEvento, string>`.

export interface PayloadInseminacion {
  /** true = inseminación a tiempo fijo (no requiere celo previo). */
  iatf?: boolean;
  toro?: string;
  pajuela?: string;
}

/**
 * Lo que el veterinario ve al tactar (decisión 111): **el dato que le faltaba al
 * sistema cuando el servicio no está anotado.** Sin servicio no hay fecha de
 * concepción, y sin ella no hay parto probable ni secado ni dieta de preparto.
 */
export interface PayloadTactoPositivo {
  /**
   * A cuál de los servicios del ciclo corresponde esta preñez (decisión 112).
   * Sin esto el sistema la atribuye al último, que es lo correcto casi siempre y
   * es exactamente lo que falla con el celo falso.
   */
  inseminacion_id?: string;
  /** Edad de la preñez **en días**, tal como la estima quien palpa o ecografía. */
  dias_gestacion?: number;
}

export interface PayloadParto {
  crias?: Cria[];
  /** Si hubo que ayudar, y cuánto. Lo no declarado se cuenta aparte. */
  distocia?: GradoDistocia;
}

export interface PayloadControlLechero {
  litros: number;
  grasa?: number;
  proteina?: number;
  rcs?: number;
}

/**
 * La medición del cuerpo (decisión 108). Los dos campos son opcionales pero
 * **uno tiene que venir**: una medición vacía no mide nada.
 */
export interface PayloadMedicion {
  /** Escala de 1 a 5. Una vaca al parto va entre 3 y 3,5. */
  condicion_corporal?: number;
  /** Peso en kilos. El de la recría es el que explica la edad al primer parto. */
  peso?: number;
}

/**
 * Un tratamiento sanitario (decisión 99). Los tres obligatorios lo son por lo que
 * cada uno habilita: sin `producto` no hay trazabilidad, sin `motivo` no se puede
 * preguntar de qué se enferma el rodeo, y **sin `retiro_leche_dias` no se sabe qué
 * leche no puede ir al tanque**, que es la razón por la que este evento existe.
 */
export interface PayloadTratamiento {
  producto: string;
  motivo: MotivoTratamiento;
  retiro_leche_dias: number;
  retiro_carne_dias?: number;
  detalle?: string;
}

/** Cambio de lote (decisión 100). `null` es sacarlo del lote: vuelve al general. */
export interface PayloadTraslado {
  lote: string | null;
}

export interface PayloadBaja {
  /** Obligatorio: sin esto no hay tasa de descarte ni de mortalidad. */
  motivo: MotivoBaja;
  /** Opcional, a diferencia de `motivo` (decisión 106): la libreta casi nunca la anotó. */
  causa?: CausaBaja;
  detalle?: string;
}

export interface PayloadAnulacion {
  evento_anulado_id: string;
}

/**
 * Corrección de un evento ya cargado (decisión 102). **No lo reemplaza: lo
 * supersede.** El original se queda en el log y esto dice con qué valores hay que
 * plegarlo; el `id` no cambia, que es la mitad del punto — anular y recargar le
 * da al hecho un id nuevo y deja colgado a todo lo que apuntaba al viejo.
 *
 * El `payload` se reemplaza **entero** cuando viene: es opaco para el núcleo, así
 * que no hay forma de mezclarlo campo a campo.
 */
export interface PayloadCorreccion {
  evento_corregido_id: string;
  fecha_evento?: string;
  payload?: unknown;
  observaciones?: string | null;
  forzado?: boolean;
}

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
  /**
   * true si lo que se forzó pone en duda **la fecha** del parto (decisión 110).
   *
   * Es un subconjunto de `datos_incompletos` y contesta otra pregunta. Un parto
   * forzado porque falta el precedente —la montó un toro y nunca figuró PRENADA—
   * tiene una fecha perfectamente confiable: la vieron parir. Es lo que devolvió
   * la edad al primer parto a las vaquillonas que parieron de monta.
   */
  fecha_incierta: boolean;
  /** Las crías del parto que abrió esta lactancia. Vacío si no las declaró. */
  crias: Cria[];
  /** Cuánta ayuda necesitó ese parto (decisión 107). Null si no se declaró. */
  distocia: GradoDistocia | null;
  /** Controles lecheros registrados durante esta lactancia, en orden. */
  controles: ControlLechero[];
}

/** Un servicio del ciclo abierto, con lo justo para poder apuntarle (decisión 112). */
export interface ServicioDelCiclo {
  evento_id: string;
  fecha: string;
}

/**
 * Un tratamiento ya plegado, con las fechas de retiro **resueltas** (decisión 99).
 *
 * `leche_apta_desde` es el **primer día apto** y no el último retirado: es la
 * forma que no tiene un ±1 adentro. Con `retiro_leche_dias: 3` y tratamiento del
 * día 10, la leche del 10, 11 y 12 se descarta y la del 13 va al tanque.
 */
export interface Tratamiento {
  evento_id: string;
  fecha: string;
  producto: string;
  motivo: MotivoTratamiento;
  retiro_leche_dias: number;
  /** Primer día en que la leche vuelve al tanque. */
  leche_apta_desde: string;
  /** Primer día en que el animal puede ir a faena. Ausente si no se declaró. */
  carne_apta_desde?: string;
  detalle?: string;
}

/**
 * Una medición del cuerpo ya plegada (decisión 108): condición corporal y peso.
 * Vive suelta en la `Proyeccion` y no adentro de la lactancia, por lo mismo que
 * el tratamiento — a una vaquillona de recría se la pesa todos los meses y no
 * tiene ninguna lactancia donde guardarlo.
 */
export interface Medicion {
  evento_id: string;
  fecha: string;
  condicion_corporal?: number;
  peso?: number;
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
  /** Por qué se fue (decisión 106). Null si no hay baja o no se declaró. */
  causa_baja: CausaBaja | null;
  /** Último celo registrado (habilita la inseminación por X días). */
  fecha_ultimo_celo: string | null;
  /** Último servicio del ciclo en curso (null si no está INSEMINADA). */
  fecha_ultima_inseminacion: string | null;
  /** Id de ese último servicio: trazabilidad de toro/pajuela. */
  ultima_inseminacion_id: string | null;
  /**
   * **Todos** los servicios del ciclo abierto, en orden (decisión 112).
   *
   * Los dos campos de arriba son el caso degenerado de esta lista —el último— y
   * no alcanzaban para el **celo falso**: una preñada que muestra celo y se
   * re-sirve pierde el puntero al servicio que sí prendió, porque el celo de
   * retorno lo limpia. Es lo que la pantalla de tacto lista para que el que tacta
   * pueda apuntarle al servicio correcto.
   */
  servicios_del_ciclo: ServicioDelCiclo[];
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
  /**
   * En qué lote está (decisión 100). Null = rodeo general, que es donde nacen
   * todos. Es un estado y no una lista —un animal está en exactamente un lote a
   * la vez— y por eso vive acá y el retiro sanitario no.
   */
  lote: string | null;
}

export interface Proyeccion {
  estado: EstadoAnimal;
  ciclos: Ciclo[];
  lactancias: Lactancia[];
  /**
   * Los tratamientos del animal, en orden. Es la cuarta dimensión del modelo —la
   * sanitaria— y es ortogonal a las otras tres: un tratamiento no cambia el
   * estado reproductivo ni el productivo. Lo que produce es una fecha, y la
   * pregunta que contesta es hasta cuándo su leche no va al tanque.
   */
  tratamientos: Tratamiento[];
  /** Condición corporal y peso a lo largo de la vida del animal (decisión 108). */
  mediciones: Medicion[];
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
  /**
   * En ordeñe y con la leche en período de retiro: hoy **no van al tanque**
   * (decisión 99).
   *
   * Es de otra naturaleza que las dos de arriba y conviene que se note: aquellas
   * avisan de un problema de manejo y esta de uno **legal**. La leche de una vaca
   * en retiro no arruina su tarro, arruina la carga entera del tambo.
   */
  para_descartar_leche: string[];
}

// ── El reparto por lote (decisión 100) ───────────────────────────────────────

export interface RepartoDeLote {
  /** Null = rodeo general: los que no están en ningún lote. Va último. */
  lote: string | null;
  animales: number;
  categorias: Record<CategoriaAlimentacion, number>;
}

// ── Por qué se van las vacas (decisión 106) ──────────────────────────────────

export interface SalidaPorCausa {
  causa: CausaBaja;
  animales: number;
  /** Cómo salieron esas: vendidas, muertas, descartadas. */
  por_motivo: Record<MotivoBaja, number>;
}

export interface ResumenDeSalidas {
  bajas: number;
  /** El rodeo que hubo: activas + bajas del período. */
  base: number;
  tasa_salida: number | null;
  /** De la causa más frecuente a la menos: lo primero que hay que arreglar. */
  causas: SalidaPorCausa[];
  /**
   * Bajas sin causa declarada. Van aparte y **no** repartidas entre las conocidas:
   * si son la mitad del período, el orden de las otras no significa nada.
   */
  sin_causa: number;
}

// ── Cuánto costaron los partos (decisión 107) ────────────────────────────────

export interface DistociaPorGrado {
  grado: GradoDistocia;
  partos: number;
  /** De esos, cuántos fueron **primer parto**: es donde la distocia se concentra. */
  primer_parto: number;
  /**
   * Promedio de días de ese parto al primer servicio siguiente. **Es el número
   * por el que existe registrar la distocia**: un parto que costó deja metritis,
   * y eso se ve como una vaca que tarda en volver a servirse.
   */
  intervalo_parto_primer_servicio: number | null;
}

export interface ResumenDeDistocia {
  /** Partos del período **con grado declarado**: la base de la tasa. */
  partos: number;
  /** Partos del período que no declararon grado. Aparte, no contados como normales. */
  sin_declarar: number;
  tasa_asistencia: number | null;
  /** En orden de la escala, no por frecuencia: es ordinal y se lee de corrido. */
  grados: DistociaPorGrado[];
}

// ── La tasa de concepción del rodeo (decisión 98) ────────────────────────────

export interface ResumenDeServicios {
  servicios: number;
  concepciones: number;
  fallidos: number;
  /** Todavía sin diagnóstico. No cuentan para la tasa. */
  sin_diagnostico: number;
  /** Concepciones sobre servicios **con diagnóstico**. Null si ninguno lo tiene. */
  tasa_concepcion: number | null;
  animales_servidos: number;
  /** Servicios excluidos por caer en un ciclo con `datos_incompletos`. */
  servicios_excluidos: number;
}

// ── Qué rinde cada toro (decisión 96) ────────────────────────────────────────

export interface EstadisticaToro {
  toro: string;
  servicios: number;
  concepciones: number;
  fallidos: number;
  sin_diagnostico: number;
  /** Null si ningún servicio suyo tiene diagnóstico todavía. */
  tasa_concepcion: number | null;
  animales: number;
  partos: number;
  crias_vivas: number;
  crias_hembras: number;
}

export interface EvaluacionDeToros {
  /** De más servicios a menos; a igual cantidad, alfabético. */
  toros: EstadisticaToro[];
  /** Servicios computables que no declararon toro: lo que esto **no puede ver**. */
  servicios_sin_toro: number;
  servicios_excluidos: number;
}

// ── La tasa de preñez a 21 días (decisión 104) ───────────────────────────────

/** Lo que se cuenta en una ventana. El resumen suma exactamente lo mismo. */
export interface ConteoPrenez {
  /** Animales que podían quedar preñadas al **inicio** de la ventana. */
  elegibles: number;
  servidas: number;
  servicios: number;
  /** Cuántos de esos fueron IATF: sin esto la tasa de servicio no se puede leer. */
  servicios_iatf: number;
  prenadas: number;
  sin_diagnostico: number;
  /** Elegibles que esta ventana no puede juzgar (ciclo forzado, o servida en otro tambo). */
  excluidas: number;
  /** Activas sin fecha de nacimiento y sin partos: no hay con qué juzgarlas. */
  edad_desconocida: number;
}

export interface Tasas {
  /** Preñadas sobre elegibles: el indicador. Null en una ventana sin madurar. */
  tasa_prenez: number | null;
  /** Servidas sobre elegibles. No se llama "detección de celo" porque hay IATF. */
  tasa_servicio: number | null;
  /** Preñadas sobre servidas, **por vaca**: es lo que hace exacta la descomposición. */
  tasa_concepcion: number | null;
}

export interface VentanaPrenez extends ConteoPrenez, Tasas {
  desde: string;
  /** Último día, inclusive. */
  hasta: string;
  /**
   * true si los servicios de la ventana ya tuvieron tiempo de diagnosticarse.
   * Mientras es false las tres tasas son `null` — **y es la mitad del valor del
   * endpoint**: calculadas darían casi cero y el gráfico terminaría en una caída
   * que no ocurrió.
   */
  madura: boolean;
}

export interface ResumenPrenez extends ConteoPrenez, Tasas {
  /** Días de cada ventana. Fijo en 21: es el ciclo estral. */
  dias_ventana: number;
  /** De la más vieja a la más reciente; la última termina en la fecha pedida. */
  ventanas: VentanaPrenez[];
  /** Cuántas maduraron. Los totales son solo sobre esas. */
  ventanas_maduras: number;
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
  /**
   * Cuánto puede diferir la edad de preñez que declara el veterinario de la que
   * sale del servicio anotado, antes de que el sistema desconfíe (decisión 111).
   * Un ciclo estral: el error que importa es estar corrido un ciclo entero.
   */
  dias_tolerancia_gestacion: number;

  // Ventanas de manejo: política del establecimiento.
  dias_pve: number;
  dias_edad_min_primer_servicio: number;
  dias_min_secado_preparto: number;
  dias_alerta_sin_diagnostico: number;
  del_lactancia_temprana: number;
  del_lactancia_media: number;
  dias_preparto: number;
  litros_max_control: number;
  /** Techo de kilos de una pesada (decisión 108). Espeja a `litros_max_control`. */
  peso_max_medicion: number;
  dias_lactancia_estandar: number;

  // ── Equivalente maduro (decisión 105) ──────────────────────────────────────
  // Lo que permite comparar la lactancia de una vaquillona con la de una vaca
  // hecha. Son de raza y no de manejo, y por eso viven en la `Config` del tambo.

  /**
   * Cuánto hay que corregir la producción de cada número de lactancia para
   * expresarla como la de una vaca madura. El primer valor es la lactancia 1 y
   * **el último se aplica a todas las siguientes** (el "5+" de las tablas).
   */
  factores_madurez: number[];
  /** Edad al primer parto, en días, para la que vale `factores_madurez[0]` tal cual. */
  edad_referencia_primer_parto: number;
  /** Cuánto **baja** ese factor por cada día de edad al parto sobre la referencia. */
  ajuste_por_dia_edad_primer_parto: number;
}
