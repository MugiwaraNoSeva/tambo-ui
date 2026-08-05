// ─────────────────────────────────────────────────────────────────────────────
// Cargar un evento: el corazón operativo de la app, en dos pantallas.
//
// Hasta acá era una sola con un `<select>` de nueve tipos y campos que aparecían
// y desaparecían debajo. El README ya tenía anotado ese desplegable como el
// único toque pendiente de la remodelación, y concluía que la respuesta era la
// corrida. Lo sigue siendo **para el caso masivo**: veinticinco tactos se cargan
// ahí, eligiendo el tipo una vez. Esto es lo otro, la carga suelta de una vaca.
//
//   · `#/animales/:id/cargar` es un **menú** de los doce tipos, agrupados;
//   · `#/animales/:id/cargar/:tipo` es el formulario de ese tipo, con **solo sus
//     campos**.
//
// Son dos toques hasta el formulario contra los tres del desplegable —abrir,
// elegir, confirmar—, y el menú es lo que hizo barato el crecimiento: los tres
// tipos que entraron después (tratamiento, medición y traslado) son tres
// renglones más y un formulario cada uno. En el desplegable habrían sido tres
// opciones más de doce y otra tanda de campos que aparecen y desaparecen debajo.
//
// La pantalla no sabe **ninguna** regla: junta el payload que ese tipo lleva y
// lo manda.
//
// Si el animal no podía hacer eso, lo dice la API con el mensaje de §5.6 y se
// muestra tal cual. La única validación de acá es de forma, y el único gesto de
// dominio es el que la decisión 50 declara: que un rechazo forzable se puede
// confirmar.
//
// El evento viaja con **su propio id**. No es capricho: en el corral la señal se
// corta, y un POST cuya respuesta se pierde deja al tambero sin saber si el
// evento entró. Con el id del cliente, el reintento vuelve como
// `EVENTO_DUPLICADO` en vez de cargar el parto dos veces (decisión 41, y
// decisiones 63 y 67 por el lado de la UI).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ErrorApi, api } from '../api/cliente';
import type {
  CausaBaja,
  Cria,
  CuerpoError,
  CuerpoEvento,
  GradoDistocia,
  MotivoBaja,
  MotivoTratamiento,
  PayloadBaja,
  PayloadControlLechero,
  PayloadInseminacion,
  PayloadMedicion,
  PayloadParto,
  PayloadTactoPositivo,
  PayloadTratamiento,
  PayloadTraslado,
  ServicioDelCiclo,
  TipoEvento,
} from '../api/tipos';
import {
  CAUSAS_BAJA,
  GRADOS_DISTOCIA,
  MOTIVOS_BAJA,
  MOTIVOS_TRATAMIENTO,
} from '../api/tipos';
import { Armazon } from '../componentes/armazon';
import { Cargando, SoloLectura, Tarjeta, TarjetaCaida } from '../componentes/basicos';
import { Campo, CampoFecha, Casilla, Rechazo } from '../componentes/formulario';
import { usarEstablecimiento } from '../establecimiento';
import {
  CAUSA_BAJA,
  DISTOCIA,
  MOTIVO_BAJA,
  MOTIVO_TRATAMIENTO,
  RESULTADO_CRIA,
  SEXO_CRIA,
  TIPO_EVENTO,
  caravanaVisible,
  fechaCorta,
} from '../formato';
import { hoyDelServidor } from '../reloj';
import { aAnimal, aCargar, ir, usarCaravanaDelHash, usarVuelta } from '../ruteo';
import { nuevoUuid } from '../uuid';
import { mensajeDe, usarPedido } from '../usarPedido';

/**
 * Los tipos que se cargan desde acá. Faltan tres a propósito, y por tres motivos
 * distintos:
 *
 *   · `alta` tiene su pantalla — crea la fila del animal, no solo un evento;
 *   · `anulacion` se hace desde el historial, donde está el evento que deshace;
 *   · `correccion` también apunta a un evento existente (decisión 102), así que
 *     tampoco puede nacer de un menú que no sabe a cuál. Todavía no tiene gesto
 *     en la UI y la ficha muestra la marca `corregido_por` cuando llega por otro
 *     lado — que es lo mínimo para no mentir sobre lo que vale.
 */
type TipoCargable = Exclude<TipoEvento, 'alta' | 'anulacion' | 'correccion'>;

/**
 * Qué es cada uno en un renglón, y cómo se llama su botón.
 *
 * El renglón no es adorno: sin él, "Tacto positivo" y "Tacto negativo" son dos
 * puertas iguales y hay que abrirlas para saber cuál es cuál. Y el rótulo del
 * botón dice qué se está por hacer —"Cargar el parto"— porque un "Guardar"
 * genérico al final de un formulario largo no dice de qué formulario es.
 */
const CARGABLES: Record<TipoCargable, { que: string; boton: string }> = {
  celo: { que: 'La vio alzada', boton: 'Cargar el celo' },
  inseminacion: { que: 'Toro, pajuela, IATF', boton: 'Cargar la inseminación' },
  tacto_positivo: { que: 'Preñada, y de cuánto', boton: 'Cargar el tacto' },
  tacto_negativo: { que: 'Vacía', boton: 'Cargar el tacto' },
  parto: { que: 'Las crías y cuánta ayuda necesitó', boton: 'Cargar el parto' },
  aborto: { que: 'Perdió la preñez', boton: 'Cargar el aborto' },
  control_lechero: { que: 'Litros, grasa, proteína, RCS', boton: 'Cargar el control' },
  secado: { que: 'Sale de ordeñe', boton: 'Cargar el secado' },
  tratamiento: { que: 'Qué se le dio y cuántos días de retiro', boton: 'Cargar el tratamiento' },
  medicion: { que: 'Cuánto pesa y cómo está de condición', boton: 'Cargar la medición' },
  traslado: { que: 'Pasa a otro corral', boton: 'Cargar el cambio' },
  baja: { que: 'Venta, muerte o descarte', boton: 'Dar de baja' },
};

/**
 * En qué orden y bajo qué título se listan.
 *
 * Los grupos son los del trabajo del tambo y no los del modelo: reproducción es
 * lo que se carga todos los días y va primero; la salida va sola y última porque
 * es la única que no se deshace sola —se anula— y no tiene por qué compartir
 * grupo con nada.
 *
 * Adentro de reproducción el orden es el del ciclo —celo, servicio, diagnóstico,
 * parto— y no el alfabético: así el menú se lee como el recorrido de una vaca.
 */
const GRUPOS: readonly { rotulo: string; tipos: readonly TipoCargable[] }[] = [
  {
    rotulo: 'Reproducción',
    tipos: ['celo', 'inseminacion', 'tacto_positivo', 'tacto_negativo', 'parto', 'aborto'],
  },
  { rotulo: 'Producción', tipos: ['control_lechero', 'secado'] },
  // El grupo que trajeron las decisiones 99, 100 y 108. Van los tres juntos
  // porque comparten lo que tienen de distinto con los de arriba: **ninguno
  // cambia el estado del animal.** Un tratamiento no la deja preñada ni seca, una
  // pesada tampoco, y el lote es otra dimensión. Son la parte del trabajo del
  // tambo que el modelo de tres ejes no cubría.
  { rotulo: 'Sanidad y manejo', tipos: ['tratamiento', 'medicion', 'traslado'] },
  { rotulo: 'Salida', tipos: ['baja'] },
];

/**
 * Los cuatro que **no llevan payload**: fecha y observaciones, y nada más.
 *
 * Comparten un solo componente que recibe el tipo. Cuatro pantallas idénticas con
 * el título cambiado serían cuatro lugares donde arreglar lo mismo el día que la
 * carga cambie.
 *
 * Eran cinco: el **tacto positivo se fue** cuando las decisiones 111 y 112 le
 * dieron dos campos. Es el movimiento que más valor mueve de toda esta tanda —
 * los dos campos existían en la API desde entonces y no había dónde escribirlos—.
 */
const SIN_PAYLOAD: readonly TipoCargable[] = ['celo', 'tacto_negativo', 'aborto', 'secado'];

const CRIA_NUEVA: Cria = { sexo: 'hembra', resultado: 'viva' };

/**
 * Lo que se elige en un desplegable **que puede quedar sin elegir**.
 *
 * Aparece tres veces —la distocia del parto, la causa de la baja, y en su momento
 * cualquier otro dato opcional de lista cerrada— y las tres por la misma razón de
 * dominio: lo no declarado se cuenta **aparte** y no como el valor más benigno
 * (decisiones 106 y 107). Un desplegable que arranque en "Parió sola" convierte
 * el silencio en una afirmación, que es inventar el dato justo hacia el lado que
 * hace quedar mejor al tambo.
 */
const SIN_DECLARAR = '';

/** Lo que el camino trae, validado. Lo que no se reconoce cae en el menú. */
function tipoValido(crudo: string | null): TipoCargable | null {
  if (crudo === null) return null;
  return Object.hasOwn(CARGABLES, crudo) ? (crudo as TipoCargable) : null;
}

/**
 * La puerta. Al de `lectura` la ficha no le ofrece "Cargar un evento"; esto es
 * para el que igual llegó por la barra de direcciones, y le dice por qué no
 * puede en vez de dejarlo llenar un formulario que la API va a rechazar.
 */
export function CargarEvento({ id, tipo }: { id: string; tipo: string | null }) {
  const { puedeCargar } = usarEstablecimiento();
  // Los dos datos que quien abrió esta pantalla **ya sabía**, y que por eso
  // viajan en la dirección en vez de pedirse otra vez.
  const caravana = usarCaravanaDelHash();
  const vuelta = usarVuelta(aAnimal(id));

  if (!puedeCargar) {
    return (
      <Armazon titulo="Cargar un evento" volverA={vuelta}>
        <SoloLectura>No podés cargar eventos en este tambo.</SoloLectura>
      </Armazon>
    );
  }

  // El camino normal: la caravana vino en el hash y **no hay ningún pedido**.
  // Antes esta pantalla traía el animal entero —la proyección, sus ciclos, su
  // estado— para escribir un número en el encabezado.
  if (caravana !== undefined) {
    return <MenuOFormulario id={id} tipo={tipo} caravana={caravana} vuelta={vuelta} />;
  }

  // Y el camino de un enlace pelado —una dirección tipeada, un favorito viejo—,
  // que sigue andando: si nadie dijo la caravana, se va a buscar.
  return <CargaSinCaravana id={id} tipo={tipo} vuelta={vuelta} />;
}

function CargaSinCaravana({
  id,
  tipo,
  vuelta,
}: {
  id: string;
  tipo: string | null;
  vuelta: string;
}) {
  const { id: est } = usarEstablecimiento();
  const traer = useCallback(() => api.animal(est, id), [est, id]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  if (cargando) {
    return (
      <Armazon titulo="Cargar un evento" volverA={vuelta}>
        <Cargando que="Abriendo la carga…" />
      </Armazon>
    );
  }

  if (error !== null || datos === null) {
    return (
      <Armazon titulo="Cargar un evento" volverA={vuelta}>
        <TarjetaCaida titulo="El animal" error={error} reintentar={recargar} />
      </Armazon>
    );
  }

  return (
    <MenuOFormulario
      id={id}
      tipo={tipo}
      caravana={caravanaVisible(datos.caravana)}
      vuelta={vuelta}
    />
  );
}

/**
 * El desvío del camino: sin tipo —o con uno que no se entiende— es el menú; con
 * tipo, su formulario.
 *
 * Un `:tipo` desconocido **no rompe y no muestra un error**: cae en el menú, que
 * es de donde se sale eligiendo. Es el mismo criterio con que `deParametros`
 * descarta un filtro que no reconoce, y por el mismo motivo — un cartel de "eso
 * no existe" para una dirección tipeada mal no le sirve a nadie.
 */
function MenuOFormulario({
  id,
  tipo,
  caravana,
  vuelta,
}: {
  id: string;
  tipo: string | null;
  caravana: string;
  vuelta: string;
}) {
  const elegido = tipoValido(tipo);

  if (elegido === null) return <Menu id={id} caravana={caravana} vuelta={vuelta} />;

  // La flecha del formulario vuelve **al menú** y no al origen: el paso que se
  // deshace es "elegí mal el tipo". El origen sigue viajando adentro de ese
  // enlace, así que al terminar de cargar se vuelve a donde se vino de verdad.
  const alMenu = aCargar(id, { desde: vuelta, caravana });
  const comun = { animalId: id, tipo: elegido, caravana, vuelta, volverA: alMenu };

  if (SIN_PAYLOAD.includes(elegido)) return <CargaSinPayload {...comun} />;
  if (elegido === 'inseminacion') return <CargaDeInseminacion {...comun} />;
  if (elegido === 'tacto_positivo') return <CargaDeTactoPositivo {...comun} />;
  if (elegido === 'parto') return <CargaDeParto {...comun} />;
  if (elegido === 'control_lechero') return <CargaDeControl {...comun} />;
  if (elegido === 'tratamiento') return <CargaDeTratamiento {...comun} />;
  if (elegido === 'medicion') return <CargaDeMedicion {...comun} />;
  if (elegido === 'traslado') return <CargaDeTraslado {...comun} />;
  return <CargaDeBaja {...comun} />;
}

// ── El menú ──────────────────────────────────────────────────────────────────

function Menu({ id, caravana, vuelta }: { id: string; caravana: string; vuelta: string }) {
  return (
    <Armazon titulo={`Cargarle a ${caravana}`} volverA={vuelta}>
      <Tarjeta titulo="Qué pasó">
        {GRUPOS.map(({ rotulo, tipos }) => (
          <div key={rotulo}>
            <h3>{rotulo}</h3>
            <ul className="lista indice">
              {tipos.map((t) => (
                <li key={t}>
                  {/* El origen viaja adentro del enlace: el formulario tiene que
                      saber a dónde volver al terminar, y no es este menú. */}
                  <a className="fila" href={aCargar(id, { tipo: t, desde: vuelta, caravana })}>
                    <span className="detalle">
                      <strong>{TIPO_EVENTO[t]}</strong>
                      <span className="renglon">{CARGABLES[t].que}</span>
                    </span>
                    <span className="flecha" aria-hidden="true">
                      ›
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Tarjeta>
    </Armazon>
  );
}

// ── El marco que comparten los nueve formularios ─────────────────────────────

interface Comunes {
  animalId: string;
  tipo: TipoCargable;
  caravana: string;
  /** A dónde se vuelve **al terminar de cargar**: el origen, no el menú. */
  vuelta: string;
  /** A dónde apunta la flecha: el menú. */
  volverA: string;
}

/**
 * Todo lo que los nueve tienen en común: la fecha, las observaciones, el envío,
 * el rechazo con su "confirmar igual" y el id que sobrevive a los reintentos.
 *
 * Los campos propios del tipo entran como `children`, y quien los pone es quien
 * tiene su estado: por eso `payload` es una función y no un valor. Así cada tipo
 * es un componente con **solo sus campos** y sin un `if` que pregunte cuál es.
 */
function MarcoDeCarga({
  animalId,
  tipo,
  caravana,
  vuelta,
  volverA,
  payload,
  peligro = false,
  listo = true,
  children,
}: Comunes & {
  payload: () => unknown;
  /** La baja: su botón es rojo porque lo que hace no se parece a lo demás. */
  peligro?: boolean;
  /**
   * Si el formulario está en condiciones de mandarse.
   *
   * Existe por **un solo caso**, y por eso tiene default: la medición, donde los
   * dos campos son opcionales pero uno tiene que venir (decisión 108). Eso no lo
   * puede expresar el `required` de un input, que mira un campo a la vez, y
   * dejarlo pasar sería mandar un pedido cuyo `MEDICION_INVALIDA` ya se conoce —
   * el mismo criterio con el que el botón de "confirmar igual" espera a que haya
   * observaciones. Sigue siendo validación de forma: no pregunta si el animal
   * podía, pregunta si el formulario dice algo.
   */
  listo?: boolean;
  children?: ReactNode;
}) {
  const { id: est } = usarEstablecimiento();

  // El hoy del servidor se fija **una vez** al abrir el formulario, y de ahí
  // salen tanto el default como el atajo de "ayer": si se releyera en cada
  // dibujo, una carga abierta antes de medianoche cambiaría de día sola.
  const [hoy] = useState(hoyDelServidor);
  const [fecha, setFecha] = useState(hoy);
  const [observaciones, setObservaciones] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [rechazo, setRechazo] = useState<CuerpoError | null>(null);

  // El id se genera **una vez por formulario** y sobrevive a los reintentos: es
  // lo que hace que insistir después de un corte de red no duplique el evento.
  const idDelEvento = useMemo(nuevoUuid, []);

  async function mandar(forzado: boolean, observacionesDelForzado?: string) {
    setEnviando(true);
    setRechazo(null);
    const notas = forzado ? (observacionesDelForzado ?? '') : observaciones.trim();
    const cuerpo: CuerpoEvento = {
      ...(idDelEvento === undefined ? {} : { id: idDelEvento }),
      tipo,
      fecha_evento: fecha,
      payload: payload(),
      observaciones: notas === '' ? null : notas,
      ...(forzado ? { forzado: true } : {}),
    };
    try {
      await api.cargarEvento(est, animalId, cuerpo);
      // Se vuelve **a donde se vino**, que no es el menú ni siempre la ficha:
      // quien entró por el atajo de una lista de trabajo vuelve a esa lista, ya
      // sin el animal que acaba de cargar.
      ir(vuelta);
    } catch (causa) {
      setRechazo(
        causa instanceof ErrorApi
          ? causa.cuerpo
          : { codigo: 'SIN_RESPUESTA', mensaje: mensajeDe(causa) },
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Armazon titulo={`${TIPO_EVENTO[tipo]} — ${caravana}`} volverA={volverA}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void mandar(false);
        }}
      >
        <Tarjeta>
          <CampoFecha
            etiqueta="Cuándo"
            ayuda="Por default, hoy. Si el hecho fue otro día, cambialo."
            valor={fecha}
            alCambiar={setFecha}
            hoy={hoy}
          />

          {children}

          <Campo etiqueta="Observaciones" ayuda="Opcional. Queda guardado con el evento.">
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </Campo>
        </Tarjeta>

        {rechazo !== null && (
          <Rechazo
            error={rechazo}
            enviando={enviando}
            alConfirmar={(notas) => void mandar(true, notas)}
          />
        )}

        <button
          className={peligro ? 'boton ancho peligro' : 'boton ancho'}
          type="submit"
          disabled={enviando || !listo}
        >
          {enviando ? 'Cargando…' : CARGABLES[tipo].boton}
        </button>
      </form>
    </Armazon>
  );
}

// ── Los cinco que no llevan nada más ─────────────────────────────────────────

/**
 * Celo, tacto positivo, tacto negativo, aborto y secado: fecha y observaciones.
 *
 * Son **cinco de los nueve**, y es el dato que conviene tener a la vista al
 * juzgar si el menú valió la pena: casi la mitad de las veces lleva a una
 * pantalla con un campo. Lo que se ganó no es el formulario propio sino no
 * abrir un desplegable de nueve para elegir uno.
 */
function CargaSinPayload(comun: Comunes) {
  return <MarcoDeCarga {...comun} payload={() => ({})} />;
}

// ── Y los cuatro que sí ──────────────────────────────────────────────────────

function CargaDeInseminacion(comun: Comunes) {
  const [toro, setToro] = useState('');
  const [pajuela, setPajuela] = useState('');
  const [iatf, setIatf] = useState(false);

  return (
    <MarcoDeCarga
      {...comun}
      payload={(): PayloadInseminacion => ({
        ...(iatf ? { iatf: true } : {}),
        ...(toro.trim() === '' ? {} : { toro: toro.trim() }),
        ...(pajuela.trim() === '' ? {} : { pajuela: pajuela.trim() }),
      })}
    >
      <Campo etiqueta="Toro">
        <input value={toro} onChange={(e) => setToro(e.target.value)} autoComplete="off" />
      </Campo>
      <Campo etiqueta="Pajuela">
        <input
          value={pajuela}
          onChange={(e) => setPajuela(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
        />
      </Campo>
      <Casilla etiqueta="Fue a tiempo fijo (IATF)" marcada={iatf} alCambiar={setIatf} />
    </MarcoDeCarga>
  );
}

/**
 * El tacto positivo: **la pantalla que les faltaba a las decisiones 111 y 112.**
 *
 * Los dos campos existían en la API desde esas decisiones y no había dónde
 * escribirlos, así que no le servían a nadie. Cada uno arregla un caso distinto:
 *
 *   · `dias_gestacion` es lo que hace visible a **una preñez sin servicio
 *     anotado** —la que montó un toro—. Sin ella no hay fecha de concepción, y
 *     sin fecha de concepción no hay parto probable, ni secado, ni dieta de
 *     preparto: esa vaca nunca aparecía en la lista "para secar".
 *   · `inseminacion_id` arregla el **celo falso**: una preñada que muestra celo y
 *     se re-sirve. Sin el puntero, la preñez se le atribuye al último servicio y
 *     quedan mal el parto probable —tres semanas tarde— y el padre de la cría.
 *
 * Los dos son **opcionales y así se ofrecen**: un chequeo rápido del propio
 * tambero puede no traer una edad, y exigirla convertiría un dato de más en una
 * traba.
 */
function CargaDeTactoPositivo(comun: Comunes) {
  const { id: est } = usarEstablecimiento();
  const [diasGestacion, setDiasGestacion] = useState('');
  const [servicio, setServicio] = useState<string>(SIN_DECLARAR);

  // El **único** formulario del menú que pide el animal, y solo por la lista de
  // servicios: sin ella el puntero de la decisión 112 no se puede ofrecer, porque
  // lo que se elige son eventos concretos con su fecha.
  //
  // Y el pedido **no bloquea nada**: si no vuelve, el formulario se dibuja igual
  // sin el selector y el tacto se carga con su edad de gestación. Eso no es
  // degradarse a medias — es exactamente lo que hacía la pantalla hasta ayer, y
  // sin `inseminacion_id` la API atribuye la preñez al último servicio, que es lo
  // correcto en el 93% de los casos. Un tacto que no se puede cargar porque una
  // lectura secundaria falló sería mucho peor que un tacto sin puntero.
  const traer = useCallback(() => api.animal(est, comun.animalId), [est, comun.animalId]);
  const { datos } = usarPedido(traer);
  const servicios: ServicioDelCiclo[] = datos?.proyeccion.estado.servicios_del_ciclo ?? [];

  // Con **un solo** servicio no hay nada que elegir: apuntarle y no apuntarle
  // pliegan igual, porque a falta de puntero la API usa el último y el último es
  // ese. El selector aparece recién cuando la pregunta existe, que es cuando el
  // ciclo tiene dos servicios o más — el caso del celo falso.
  const hayQueElegir = servicios.length > 1;

  return (
    <MarcoDeCarga
      {...comun}
      payload={(): PayloadTactoPositivo => ({
        ...(diasGestacion === '' ? {} : { dias_gestacion: Number(diasGestacion) }),
        ...(servicio === SIN_DECLARAR ? {} : { inseminacion_id: servicio }),
      })}
    >
      <Campo
        etiqueta="De cuántos días viene la preñez"
        ayuda="Lo que dijo el que tactó. Con esto el sistema saca el parto probable y la fecha de secado, aunque el servicio no esté anotado."
      >
        <input
          type="number"
          inputMode="numeric"
          step="1"
          min="1"
          value={diasGestacion}
          onChange={(e) => setDiasGestacion(e.target.value)}
        />
      </Campo>

      {hayQueElegir && (
        <Campo
          etiqueta="De qué servicio quedó preñada"
          ayuda="Sin elegir ninguno se le atribuye al último. Si la edad de la preñez no da con ese, elegí el que corresponde: puede haber mostrado un celo estando preñada."
        >
          <select value={servicio} onChange={(e) => setServicio(e.target.value)}>
            <option value={SIN_DECLARAR}>El último</option>
            {[...servicios].reverse().map((s) => (
              <option key={s.evento_id} value={s.evento_id}>
                {fechaCorta(s.fecha)}
              </option>
            ))}
          </select>
        </Campo>
      )}
    </MarcoDeCarga>
  );
}

function CargaDeParto(comun: Comunes) {
  const [crias, setCrias] = useState<Cria[]>([CRIA_NUEVA]);
  const [distocia, setDistocia] = useState<GradoDistocia | ''>(SIN_DECLARAR);

  return (
    <MarcoDeCarga
      {...comun}
      payload={(): PayloadParto => ({
        crias,
        ...(distocia === SIN_DECLARAR ? {} : { distocia }),
      })}
    >
      {/* La distocia va **arriba de las crías** aunque el payload la ponga
          después: es lo primero que se recuerda de un parto que costó, y las
          crías son un formulario que crece. */}
      <Campo
        etiqueta="Cuánta ayuda necesitó"
        ayuda="Un parto que costó deja metritis, y eso se ve después como una vaca que tarda en volver a servirse."
      >
        <select
          value={distocia}
          onChange={(e) => setDistocia(e.target.value as GradoDistocia | '')}
        >
          {/* "No lo anoté" es la opción de arranque y no "Parió sola": lo no
              declarado se cuenta **aparte** (decisión 107), y arrancar en el
              grado más benigno convertiría el silencio en una afirmación —
              inventar el dato justo hacia el lado que hace quedar mejor al
              tambo—. */}
          <option value={SIN_DECLARAR}>No lo anoté</option>
          {GRADOS_DISTOCIA.map((g) => (
            <option key={g} value={g}>
              {DISTOCIA[g]}
            </option>
          ))}
        </select>
      </Campo>

      <h3>Las crías</h3>
      <p className="renglon">Sin esto no hay reposición ni mortalidad al parto.</p>
      {crias.map((cria, i) => (
        <div className="cria" key={i}>
          <div className="dos-columnas">
            <Campo etiqueta={`Cría ${i + 1} — sexo`}>
              <select
                value={cria.sexo}
                onChange={(e) =>
                  setCrias(
                    crias.map((c, j) =>
                      j === i ? { ...c, sexo: e.target.value as Cria['sexo'] } : c,
                    ),
                  )
                }
              >
                {(Object.keys(SEXO_CRIA) as Cria['sexo'][]).map((s) => (
                  <option key={s} value={s}>
                    {SEXO_CRIA[s]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Resultado">
              <select
                value={cria.resultado}
                onChange={(e) =>
                  setCrias(
                    crias.map((c, j) =>
                      j === i ? { ...c, resultado: e.target.value as Cria['resultado'] } : c,
                    ),
                  )
                }
              >
                {(Object.keys(RESULTADO_CRIA) as Cria['resultado'][]).map((r) => (
                  <option key={r} value={r}>
                    {RESULTADO_CRIA[r]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          {crias.length > 1 && (
            <button
              className="boton secundario"
              type="button"
              onClick={() => setCrias(crias.filter((_, j) => j !== i))}
            >
              Quitar la cría {i + 1}
            </button>
          )}
        </div>
      ))}
      <button
        className="boton ancho secundario"
        type="button"
        onClick={() => setCrias([...crias, CRIA_NUEVA])}
      >
        Agregar melliza
      </button>
    </MarcoDeCarga>
  );
}

function CargaDeControl(comun: Comunes) {
  const [litros, setLitros] = useState('');
  const [grasa, setGrasa] = useState('');
  const [proteina, setProteina] = useState('');
  const [rcs, setRcs] = useState('');

  return (
    <MarcoDeCarga
      {...comun}
      payload={(): PayloadControlLechero => ({
        litros: Number(litros),
        ...(grasa === '' ? {} : { grasa: Number(grasa) }),
        ...(proteina === '' ? {} : { proteina: Number(proteina) }),
        ...(rcs === '' ? {} : { rcs: Number(rcs) }),
      })}
    >
      <Campo etiqueta="Litros del día">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={litros}
          onChange={(e) => setLitros(e.target.value)}
          required
        />
      </Campo>
      <div className="dos-columnas">
        <Campo etiqueta="Grasa (%)">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={grasa}
            onChange={(e) => setGrasa(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Proteína (%)">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={proteina}
            onChange={(e) => setProteina(e.target.value)}
          />
        </Campo>
      </div>
      <Campo etiqueta="RCS (miles/ml)" ayuda="Grasa, proteína y RCS solo si vino el laboratorio.">
        <input
          type="number"
          inputMode="numeric"
          step="1"
          value={rcs}
          onChange={(e) => setRcs(e.target.value)}
        />
      </Campo>
    </MarcoDeCarga>
  );
}

/**
 * El tratamiento sanitario (decisión 99).
 *
 * Los tres campos de arriba son obligatorios y ninguno es decorativo. El que
 * importa es el último: **sin los días de retiro no se sabe qué leche no puede ir
 * al tanque**, que es la razón por la que este evento existe. Un campo de
 * seguridad que se puede omitir y por defecto significa "no hay retiro" es la
 * forma clásica en que una alerta falla en silencio — nadie carga el dato y el
 * sistema contesta que la leche está bien.
 */
function CargaDeTratamiento(comun: Comunes) {
  const [producto, setProducto] = useState('');
  const [motivo, setMotivo] = useState<MotivoTratamiento | ''>(SIN_DECLARAR);
  const [retiroLeche, setRetiroLeche] = useState('');
  const [retiroCarne, setRetiroCarne] = useState('');
  const [detalle, setDetalle] = useState('');

  return (
    <MarcoDeCarga
      {...comun}
      payload={(): PayloadTratamiento => ({
        producto: producto.trim(),
        // Los dos obligatorios ya vienen garantizados por el `required` de sus
        // controles: el formulario no se manda sin ellos.
        motivo: motivo as MotivoTratamiento,
        retiro_leche_dias: Number(retiroLeche),
        ...(retiroCarne === '' ? {} : { retiro_carne_dias: Number(retiroCarne) }),
        ...(detalle.trim() === '' ? {} : { detalle: detalle.trim() }),
      })}
    >
      <Campo etiqueta="Qué se le dio" ayuda="El nombre comercial alcanza: es para poder trazarlo.">
        <input
          value={producto}
          onChange={(e) => setProducto(e.target.value)}
          autoComplete="off"
          required
        />
      </Campo>

      <Campo etiqueta="Por qué" ayuda="Es lo que después contesta de qué se enferma este rodeo.">
        {/* Sin opción de arranque, y con `required`: el motivo es obligatorio en
            la API, así que acá no hay un "sin declarar" que ofrecer — lo que hay
            es un desplegable que no deja seguir hasta que se elige. Arrancarlo en
            "Mastitis" llenaría el informe de mastitis que nadie escribió. */}
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as MotivoTratamiento | '')}
          required
        >
          <option value={SIN_DECLARAR}>Elegí una</option>
          {MOTIVOS_TRATAMIENTO.map((m) => (
            <option key={m} value={m}>
              {MOTIVO_TRATAMIENTO[m]}
            </option>
          ))}
        </select>
      </Campo>

      <Campo
        etiqueta="Días de retiro de la leche"
        ayuda="Los que dice la etiqueta del producto. Con esto la vaca entra a la lista de las que hoy no van al tanque. Si el producto no tiene retiro, poné 0."
      >
        <input
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          value={retiroLeche}
          onChange={(e) => setRetiroLeche(e.target.value)}
          required
        />
      </Campo>

      <Campo
        etiqueta="Días de retiro de la carne"
        ayuda="Opcional. Se guarda para poder contestarlo: todavía no frena ninguna baja."
      >
        <input
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          value={retiroCarne}
          onChange={(e) => setRetiroCarne(e.target.value)}
        />
      </Campo>

      <Campo etiqueta="Detalle" ayuda="Dosis, vía, quién lo aplicó.">
        <input value={detalle} onChange={(e) => setDetalle(e.target.value)} />
      </Campo>
    </MarcoDeCarga>
  );
}

/**
 * El peso y la condición corporal (decisión 108).
 *
 * Los dos campos son opcionales **pero uno tiene que venir**: una medición vacía
 * no mide nada. Es la única regla de forma de todo el menú que un `required` no
 * puede expresar, porque mira los dos campos a la vez.
 *
 * El caso que más importa no es el de la vaca al parto sino el de la **recría**,
 * donde se pesa todos los meses y no hay ni parto ni servicio de dónde colgar el
 * dato: es la etapa que gobierna la edad al primer parto.
 */
function CargaDeMedicion(comun: Comunes) {
  const [condicion, setCondicion] = useState('');
  const [peso, setPeso] = useState('');

  return (
    <MarcoDeCarga
      {...comun}
      listo={condicion !== '' || peso !== ''}
      payload={(): PayloadMedicion => ({
        ...(condicion === '' ? {} : { condicion_corporal: Number(condicion) }),
        ...(peso === '' ? {} : { peso: Number(peso) }),
      })}
    >
      <Campo
        etiqueta="Condición corporal (1 a 5)"
        ayuda="Se califica de a cuartos. Al parto va entre 3 y 3,5; por debajo de 2,5 en servicio, no queda preñada."
      >
        <input
          type="number"
          inputMode="decimal"
          step="0.25"
          min="1"
          max="5"
          value={condicion}
          onChange={(e) => setCondicion(e.target.value)}
        />
      </Campo>

      <Campo etiqueta="Peso (kg)" ayuda="Cargá al menos uno de los dos.">
        <input
          type="number"
          inputMode="decimal"
          step="1"
          min="0"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
        />
      </Campo>
    </MarcoDeCarga>
  );
}

/**
 * El cambio de lote (decisión 100).
 *
 * `lote: null` es legítimo y significa **sacarla del lote**: vuelve al rodeo
 * general, que es donde nacen todas. Por eso no alcanza con un campo de texto
 * vacío: "no escribí nada todavía" y "quiero que vuelva al general" se verían
 * igual, y el segundo es un cambio de verdad que se puede hacer sin querer. La
 * casilla lo vuelve un gesto explícito.
 */
function CargaDeTraslado(comun: Comunes) {
  const [lote, setLote] = useState('');
  const [alGeneral, setAlGeneral] = useState(false);

  return (
    <MarcoDeCarga
      {...comun}
      listo={alGeneral || lote.trim() !== ''}
      payload={(): PayloadTraslado => ({ lote: alGeneral ? null : lote.trim() })}
    >
      {!alGeneral && (
        <Campo
          etiqueta="A qué lote pasa"
          ayuda="El nombre se guarda como lo escribas: es el que se lee en el corral."
        >
          <input value={lote} onChange={(e) => setLote(e.target.value)} autoComplete="off" />
        </Campo>
      )}
      <Casilla
        etiqueta="Sacarla del lote: vuelve al rodeo general"
        marcada={alGeneral}
        alCambiar={setAlGeneral}
      />
    </MarcoDeCarga>
  );
}

function CargaDeBaja(comun: Comunes) {
  const [motivo, setMotivo] = useState<MotivoBaja>('venta');
  const [causa, setCausa] = useState<CausaBaja | ''>(SIN_DECLARAR);
  const [detalle, setDetalle] = useState('');

  return (
    <MarcoDeCarga
      {...comun}
      peligro
      payload={(): PayloadBaja => ({
        motivo,
        ...(causa === SIN_DECLARAR ? {} : { causa }),
        ...(detalle.trim() === '' ? {} : { detalle: detalle.trim() }),
      })}
    >
      <Campo etiqueta="Cómo salió" ayuda="Sin esto no hay tasa de descarte ni de mortalidad.">
        <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoBaja)}>
          {MOTIVOS_BAJA.map((m) => (
            <option key={m} value={m}>
              {MOTIVO_BAJA[m]}
            </option>
          ))}
        </select>
      </Campo>

      {/* **Por qué se fue** es otra pregunta que cómo salió (decisión 106), y es
          la que decide qué arreglar: un rodeo que pierde el 12% por patas tiene
          un problema de instalaciones, y uno que lo pierde por reproducción tiene
          otro completamente distinto.

          Opcional, a diferencia del motivo, y por eso arranca sin elegir: un
          rodeo se migra desde una libreta que casi nunca la anotó, y exigirla
          bloquearía esa carga. Lo que no se declara se cuenta aparte. */}
      <Campo etiqueta="Por qué se fue" ayuda="Opcional. Es lo que dice qué hay que arreglar.">
        <select value={causa} onChange={(e) => setCausa(e.target.value as CausaBaja | '')}>
          <option value={SIN_DECLARAR}>No lo sé</option>
          {CAUSAS_BAJA.map((c) => (
            <option key={c} value={c}>
              {CAUSA_BAJA[c]}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Detalle">
        <input value={detalle} onChange={(e) => setDetalle(e.target.value)} />
      </Campo>
    </MarcoDeCarga>
  );
}
