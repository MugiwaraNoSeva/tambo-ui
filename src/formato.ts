// ─────────────────────────────────────────────────────────────────────────────
// Presentación: de lo que dice la API a lo que lee el tambero.
//
// **Un solo archivo, y nada de dominio adentro.** Acá se traduce forma, no
// significado: una fecha ISO a DD/MM/AAAA, un `PRENADA` a "Preñada", un número
// con demasiados decimales a uno que se lee de un vistazo. Ninguna de estas
// funciones decide nada — si alguna empieza a preguntar "¿y si está preñada
// hace más de…?", se mudó al lado equivocado del contrato.
//
// Las fechas se manipulan **como strings**, nunca con `new Date`. `new
// Date('2026-03-01')` se parsea como medianoche UTC y en UTC−3 se muestra como
// el 28 de febrero: exactamente la corrupción que el núcleo evita haciendo toda
// su aritmética en UTC (decisión 26) y que la decisión 47 encontró en los
// parsers de `pg`. Un `split('-')` no tiene zona horaria.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CategoriaAlimentacion,
  CausaBaja,
  Cria,
  EstadoProductivo,
  EstadoReproductivo,
  EstadoVida,
  GradoDistocia,
  MotivoBaja,
  MotivoTratamiento,
  OrigenCiclo,
  ResultadoCiclo,
  ResultadoCria,
  SexoCria,
  TipoEvento,
} from './api/tipos';

/** `2026-03-01` → `01/03/2026`. Devuelve el original si no tiene esa forma. */
export function fechaCorta(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '';
  const partes = iso.slice(0, 10).split('-');
  const [anio, mes, dia] = partes;
  if (partes.length !== 3 || anio === undefined || mes === undefined || dia === undefined) {
    return iso;
  }
  return `${dia}/${mes}/${anio}`;
}

/** Lo mismo, pero para donde el vacío tiene que decirse. */
export const fechaOSinDato = (iso: string | null | undefined): string =>
  iso === null || iso === undefined || iso === '' ? SIN_DATO : fechaCorta(iso);

/**
 * Lo que se muestra donde el número es `null`.
 *
 * Nunca 0 y nunca en blanco (decisión 37): un cero dice "medimos y dio cero" y
 * un blanco dice "acá no va nada", cuando lo que pasa es que no hay con qué
 * calcularlo.
 */
export const SIN_DATO = 'sin datos';

/** Un número con los decimales justos, o "sin datos" si es null. */
export function numero(valor: number | null | undefined, decimales = 0): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return SIN_DATO;
  return valor.toFixed(decimales).replace('.', ',');
}

/**
 * Un porcentaje a partir de la **fracción 0–1** que devuelve el núcleo.
 *
 * La unidad está en el nombre del parámetro y en este comentario porque ya
 * costó una vez: `porcentajePrenez` es `prenadas / activas` —0,43, no 43— y lo
 * mismo `tasa_descarte` y `tasa_mortalidad`. La primera pantalla que las mostró
 * las escribía sin multiplicar (decisión 57).
 */
export const porcentaje = (fraccion: number | null | undefined, decimales = 0): string =>
  fraccion === null || fraccion === undefined ? SIN_DATO : `${numero(fraccion * 100, decimales)} %`;

/** Días, con la unidad pegada porque un número pelado no dice de qué. */
export const dias = (valor: number | null | undefined): string =>
  valor === null || valor === undefined ? SIN_DATO : `${numero(valor)} ${valor === 1 ? 'día' : 'días'}`;

/**
 * Días convertidos a años, con un decimal. Una edad de 1.600 días no se lee: el
 * tambero piensa en años. La cuenta exacta en días la sigue teniendo la API, así
 * que esto es presentación y no pierde nada — se divide por 365,25 y se muestra.
 */
export const anios = (valor: number | null | undefined): string =>
  valor === null || valor === undefined ? SIN_DATO : `${numero(valor / 365.25, 1)} años`;

export const litros = (valor: number | null | undefined, decimales = 1): string =>
  valor === null || valor === undefined ? SIN_DATO : `${numero(valor, decimales)} L`;

/** Kilos: el peso de una pesada, y la ganancia diaria de la recría (decisión 108). */
export const kilos = (valor: number | null | undefined, decimales = 0): string =>
  valor === null || valor === undefined ? SIN_DATO : `${numero(valor, decimales)} kg`;

/**
 * La condición corporal, en la escala de 1 a 5.
 *
 * Dos decimales y no uno: se califica de a cuartos —3, 3,25, 3,5— y con un
 * decimal un 3,25 se muestra como 3,3, que es un número que nadie escribió.
 */
export const condicion = (valor: number | null | undefined): string =>
  valor === null || valor === undefined ? SIN_DATO : numero(valor, 2);

// ── El vocabulario, en castellano ────────────────────────────────────────────
//
// Los estados se escriben SIEMPRE con su texto, nunca solo con un color: en el
// corral hay sol de frente y apuro, y media población masculina distingue mal el
// rojo del verde.

export const REPRODUCTIVO: Record<EstadoReproductivo, string> = {
  VACIA: 'Vacía',
  INSEMINADA: 'Inseminada',
  PRENADA: 'Preñada',
};

export const PRODUCTIVO: Record<EstadoProductivo, string> = {
  SECA: 'Seca',
  EN_LACTANCIA: 'En ordeñe',
};

export const VIDA: Record<EstadoVida, string> = {
  SIN_ALTA: 'Sin alta',
  ACTIVA: 'Activa',
  BAJA: 'De baja',
};

/**
 * Las categorías de alimentación, en castellano. Espeja `NOMBRE_CATEGORIA` del
 * núcleo: cuando la UI vivía en el monorepo, importarlo habría obligado a un
 * `import` de valor —no de tipo— y con él viajaba al bundle el motor de dominio
 * entero por seis strings (decisión 51); hoy el paquete directamente no está
 * (decisión 66). Lo que lo ata al original es el tipo: si mañana aparece una
 * categoría nueva en `nucleo.ts`, este `Record` no compila.
 */
export const CATEGORIA: Record<CategoriaAlimentacion, string> = {
  RECRIA: 'Recría',
  LACTANCIA_TEMPRANA: 'Lactancia temprana',
  LACTANCIA_MEDIA: 'Lactancia media',
  LACTANCIA_TARDIA: 'Lactancia tardía',
  PREPARTO: 'Preparto',
  SECA: 'Vaca seca',
};

/**
 * En qué orden se muestran las categorías: el del ciclo productivo —de la
 * recría al secado— y no el alfabético ni el del `Record`, que es el orden en
 * que alguien las escribió. Así el reparto de dietas se lee como el recorrido
 * de un animal por el tambo.
 */
export const ORDEN_CATEGORIAS: readonly CategoriaAlimentacion[] = [
  'RECRIA',
  'LACTANCIA_TEMPRANA',
  'LACTANCIA_MEDIA',
  'LACTANCIA_TARDIA',
  'PREPARTO',
  'SECA',
];

export const TIPO_EVENTO: Record<TipoEvento, string> = {
  alta: 'Alta',
  celo: 'Celo',
  inseminacion: 'Inseminación',
  tacto_positivo: 'Tacto positivo',
  tacto_negativo: 'Tacto negativo',
  parto: 'Parto',
  aborto: 'Aborto',
  secado: 'Secado',
  control_lechero: 'Control lechero',
  // Los tres que el backend agregó entre las decisiones 99 y 108. Se nombran por
  // lo que el tambero hace y no por el tipo del modelo: nadie "carga una
  // medición", pesa una vaquillona o le pone la condición corporal.
  medicion: 'Peso y condición',
  tratamiento: 'Tratamiento',
  traslado: 'Cambio de lote',
  baja: 'Baja',
  anulacion: 'Anulación',
  correccion: 'Corrección',
};

export const MOTIVO_BAJA: Record<MotivoBaja, string> = {
  venta: 'Venta',
  muerte: 'Muerte',
  descarte: 'Descarte',
  otro: 'Otro',
};

/**
 * **Por qué** se fue, que es otra pregunta que cómo salió (decisión 106).
 *
 * `mastitis` y `podal` se llaman igual que en `MOTIVO_TRATAMIENTO` a propósito,
 * porque son la misma cosa: de qué se enferma el rodeo y por qué se van las vacas
 * se leen juntas, y dos nombres distintos para lo mismo romperían esa lectura.
 */
export const CAUSA_BAJA: Record<CausaBaja, string> = {
  reproduccion: 'Reproducción',
  mastitis: 'Mastitis',
  podal: 'Problemas de patas',
  produccion: 'Baja producción',
  edad: 'Edad',
  enfermedad: 'Otra enfermedad',
  accidente: 'Accidente',
  otro: 'Otro',
};

export const MOTIVO_TRATAMIENTO: Record<MotivoTratamiento, string> = {
  mastitis: 'Mastitis',
  metritis: 'Metritis',
  podal: 'Patas',
  respiratorio: 'Respiratorio',
  reproductivo: 'Reproductivo',
  parasitario: 'Parasitario',
  otro: 'Otro',
};

/**
 * La escala de distocia, nombrada por **quién tuvo que estar** (decisión 107).
 *
 * Es la del núcleo traducida y no una reinterpretación: el que la carga es el que
 * estuvo ahí, así que "la tuvo que sacar el veterinario" se elige sin consultar
 * ninguna tabla del 1 al 5.
 */
export const DISTOCIA: Record<GradoDistocia, string> = {
  normal: 'Parió sola',
  asistencia_leve: 'Con una mano',
  asistencia_fuerte: 'Con fuerza o aparejo',
  veterinario: 'Tuvo que venir el veterinario',
};

export const SEXO_CRIA: Record<SexoCria, string> = {
  hembra: 'Hembra',
  macho: 'Macho',
};

export const RESULTADO_CRIA: Record<ResultadoCria, string> = {
  viva: 'Nacida viva',
  muerta: 'Nacida muerta',
};

export const RESULTADO_CICLO: Record<ResultadoCiclo, string> = {
  parto: 'Terminó en parto',
  aborto: 'Terminó en aborto',
  perdida: 'Perdió la preñez',
  baja: 'Cerrado por la baja',
  abierto: 'En curso',
};

export const ORIGEN_CICLO: Record<OrigenCiclo, string> = {
  alta: 'desde el alta',
  parto: 'desde el parto',
  aborto: 'desde el aborto',
  perdida: 'desde la pérdida',
};

/** "1 cría: hembra, nacida viva". Vacío si el parto no las declaró. */
export function crias(lista: readonly Cria[]): string {
  if (lista.length === 0) return '';
  const cuenta = lista.length === 1 ? '1 cría' : `${lista.length} crías`;
  return `${cuenta}: ${lista.map((c) => `${SEXO_CRIA[c.sexo].toLowerCase()}, ${RESULTADO_CRIA[c.resultado].toLowerCase()}`).join(' · ')}`;
}

// ── El payload de un evento, en una línea ────────────────────────────────────
//
// El log guarda el payload como JSON libre y §9 lo sirve como `unknown`: es lo
// correcto —el núcleo tipa cada payload por separado y la API no reinterpreta
// nada— pero deja a la pantalla con un objeto sin forma. Estas funciones lo
// leen **defensivamente**: si un campo no está o no es del tipo esperado, no
// sale en la línea. Un historial que rompe la ficha porque un evento viejo
// tiene un payload que ya no se usa sería el peor cambio posible.

const campo = (payload: unknown, clave: string): unknown =>
  typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)[clave]
    : undefined;

const texto = (payload: unknown, clave: string): string | null => {
  const v = campo(payload, clave);
  return typeof v === 'string' && v !== '' ? v : null;
};

const cifra = (payload: unknown, clave: string): number | null => {
  const v = campo(payload, clave);
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
};

/**
 * Lo que el evento trae adentro, resumido para el historial. `null` cuando no
 * hay nada que agregar: el tipo y la fecha ya lo dicen todo (un celo es un
 * celo). Esto es presentación y no dominio — no decide nada, solo lee.
 */
export function detallePayload(tipo: TipoEvento, payload: unknown): string | null {
  const partes: string[] = [];

  switch (tipo) {
    case 'alta': {
      const nacimiento = texto(payload, 'fecha_nacimiento');
      if (nacimiento !== null) partes.push(`nacida el ${fechaCorta(nacimiento)}`);
      const lactancia = cifra(campo(payload, 'estado_inicial'), 'numero_lactancia');
      if (lactancia !== null) {
        partes.push(`entra con ${lactancia} ${lactancia === 1 ? 'lactancia' : 'lactancias'}`);
      }
      break;
    }
    case 'inseminacion': {
      if (campo(payload, 'iatf') === true) partes.push('IATF');
      const toro = texto(payload, 'toro');
      if (toro !== null) partes.push(`toro ${toro}`);
      const pajuela = texto(payload, 'pajuela');
      if (pajuela !== null) partes.push(`pajuela ${pajuela}`);
      break;
    }
    case 'tacto_positivo': {
      // Las dos mitades de las decisiones 111 y 112. La edad de gestación se
      // escribe tal como la declaró el veterinario, sin convertirla a fecha de
      // concepción: esa cuenta la hace el núcleo, y repetirla acá sería calcular
      // dominio en la pantalla que solo tiene que mostrar lo que se cargó.
      const gestacion = cifra(payload, 'dias_gestacion');
      if (gestacion !== null) partes.push(`preñez de ${dias(gestacion)}`);
      // El id del servicio no se escribe —es un uuid y no le dice nada a nadie—
      // pero **que se haya apuntado sí importa**: es la diferencia entre una
      // preñez atribuida al último servicio y una atribuida al que prendió.
      if (texto(payload, 'inseminacion_id') !== null) {
        partes.push('atribuida a un servicio en particular');
      }
      break;
    }
    case 'parto': {
      const lista = campo(payload, 'crias');
      if (Array.isArray(lista)) {
        const validas = lista.filter(
          (c): c is Cria =>
            typeof c === 'object' && c !== null && 'sexo' in c && 'resultado' in c,
        );
        const linea = crias(validas);
        if (linea !== '') partes.push(linea);
      }
      const grado = texto(payload, 'distocia');
      if (grado !== null) partes.push(DISTOCIA[grado as GradoDistocia] ?? grado);
      break;
    }
    case 'medicion': {
      const cc = cifra(payload, 'condicion_corporal');
      if (cc !== null) partes.push(`condición ${numero(cc, 2)}`);
      const peso = cifra(payload, 'peso');
      if (peso !== null) partes.push(`${numero(peso)} kg`);
      break;
    }
    case 'tratamiento': {
      const producto = texto(payload, 'producto');
      if (producto !== null) partes.push(producto);
      const motivo = texto(payload, 'motivo');
      if (motivo !== null) {
        partes.push((MOTIVO_TRATAMIENTO[motivo as MotivoTratamiento] ?? motivo).toLowerCase());
      }
      // El retiro se escribe **siempre que venga, incluso en cero**: un "sin
      // retiro" dicho es lo que distingue al producto que no lo tiene del dato
      // que nadie cargó, y esa distinción es la razón por la que el campo es
      // obligatorio en la API (decisión 99).
      const retiro = cifra(payload, 'retiro_leche_dias');
      if (retiro !== null) {
        partes.push(retiro === 0 ? 'sin retiro de leche' : `retiro de leche ${dias(retiro)}`);
      }
      const carne = cifra(payload, 'retiro_carne_dias');
      if (carne !== null) partes.push(`retiro de carne ${dias(carne)}`);
      const detalleTratamiento = texto(payload, 'detalle');
      if (detalleTratamiento !== null) partes.push(detalleTratamiento);
      break;
    }
    case 'traslado': {
      // `lote: null` es legítimo y significa sacarlo del lote (decisión 100), así
      // que acá no se puede usar el `texto()` de arriba: devuelve null para el
      // campo ausente y para el explícito, y son dos hechos distintos.
      const lote = campo(payload, 'lote');
      if (lote === null) partes.push('al rodeo general');
      else if (typeof lote === 'string' && lote !== '') partes.push(`al lote ${lote}`);
      break;
    }
    case 'control_lechero': {
      const l = cifra(payload, 'litros');
      if (l !== null) partes.push(litros(l));
      const grasa = cifra(payload, 'grasa');
      if (grasa !== null) partes.push(`grasa ${numero(grasa, 1)} %`);
      const proteina = cifra(payload, 'proteina');
      if (proteina !== null) partes.push(`proteína ${numero(proteina, 1)} %`);
      const rcs = cifra(payload, 'rcs');
      if (rcs !== null) partes.push(`RCS ${numero(rcs)}`);
      break;
    }
    case 'baja': {
      const motivo = texto(payload, 'motivo');
      if (motivo !== null) partes.push(MOTIVO_BAJA[motivo as MotivoBaja] ?? motivo);
      // Cómo salió y **por qué se fue** son dos datos y se escriben los dos
      // (decisión 106): "Descarte · reproducción" dice lo que "Descarte" solo no
      // dice, que es qué hay que arreglar en el tambo.
      const causa = texto(payload, 'causa');
      if (causa !== null) {
        partes.push((CAUSA_BAJA[causa as CausaBaja] ?? causa).toLowerCase());
      }
      const detalle = texto(payload, 'detalle');
      if (detalle !== null) partes.push(detalle);
      break;
    }
    default:
      break;
  }

  return partes.length === 0 ? null : partes.join(' · ');
}

/**
 * La caravana como se muestra. Puede venir `null` —la API la busca en un mapa y
 * un animal sin caravana activa no está ahí—, y en ese caso se dice: una fila de
 * la lista de trabajo sin nada en el lugar del número parecería un error de la
 * pantalla, cuando lo que falta es el dato.
 */
export const caravanaVisible = (caravana: string | null | undefined): string =>
  caravana === null || caravana === undefined || caravana === '' ? 'sin caravana' : caravana;

/** Etiqueta de una categoría que puede venir null (animal no ACTIVA). */
export function categoria(valor: string | null | undefined): string {
  if (valor === null || valor === undefined) return SIN_DATO;
  return CATEGORIA[valor as CategoriaAlimentacion] ?? valor;
}

/**
 * El día de hoy del dispositivo, en `YYYY-MM-DD`.
 *
 * Es solo un **respaldo**: cuando la respuesta de la API trae su propio `fecha`
 * —y casi todas lo traen— se usa ese, porque el que decide si un evento es
 * futuro es el reloj del servidor y no el del celular (decisión 52).
 */
export function hoyDelDispositivo(): string {
  const ahora = new Date();
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;
}
