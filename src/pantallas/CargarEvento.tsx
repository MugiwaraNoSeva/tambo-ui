// ─────────────────────────────────────────────────────────────────────────────
// Cargar un evento: el corazón operativo de la app, en dos pantallas.
//
// Hasta acá era una sola con un `<select>` de nueve tipos y campos que aparecían
// y desaparecían debajo. El README ya tenía anotado ese desplegable como el
// único toque pendiente de la remodelación, y concluía que la respuesta era la
// corrida. Lo sigue siendo **para el caso masivo**: veinticinco tactos se cargan
// ahí, eligiendo el tipo una vez. Esto es lo otro, la carga suelta de una vaca.
//
//   · `#/animales/:id/cargar` es un **menú** de los nueve tipos, agrupados;
//   · `#/animales/:id/cargar/:tipo` es el formulario de ese tipo, con **solo sus
//     campos**.
//
// Son dos toques hasta el formulario contra los tres del desplegable —abrir,
// elegir, confirmar—, y conviene anotar lo que se descubrió armando el
// prototipo: **cinco de los nueve tipos no llevan payload**, así que casi la
// mitad de las veces el menú lleva a una pantalla con un solo campo. La ganancia
// no es el formulario propio: es no tener que abrir un desplegable.
//
// La pantalla no sabe **ninguna** regla: junta el payload que ese tipo lleva y
// lo manda. Si el animal no podía hacer eso, lo dice la API con el mensaje de
// §5.6 y se muestra tal cual. La única validación de acá es de forma, y el único
// gesto de dominio es el que la decisión 50 declara: que un rechazo forzable se
// puede confirmar.
//
// El evento viaja con **su propio id**. No es capricho: en el corral la señal se
// corta, y un POST cuya respuesta se pierde deja al tambero sin saber si el
// evento entró. Con el id del cliente, el reintento vuelve como
// `EVENTO_DUPLICADO` en vez de cargar el parto dos veces (decisión 41, y
// decisiones 63 y 67 por el lado de la UI).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ErrorApi, api } from '../api/cliente';
import type { Cria, CuerpoError, CuerpoEvento, MotivoBaja, TipoEvento } from '../api/tipos';
import { MOTIVOS_BAJA } from '../api/tipos';
import { Armazon } from '../componentes/armazon';
import { Cargando, SoloLectura, Tarjeta, TarjetaCaida } from '../componentes/basicos';
import { Campo, CampoFecha, Casilla, Rechazo } from '../componentes/formulario';
import { usarEstablecimiento } from '../establecimiento';
import {
  MOTIVO_BAJA,
  RESULTADO_CRIA,
  SEXO_CRIA,
  TIPO_EVENTO,
  caravanaVisible,
} from '../formato';
import { hoyDelServidor } from '../reloj';
import { aAnimal, aCargar, ir, usarCaravanaDelHash, usarVuelta } from '../ruteo';
import { nuevoUuid } from '../uuid';
import { mensajeDe, usarPedido } from '../usarPedido';

/**
 * Los tipos que se cargan desde acá. Faltan dos a propósito: `alta` tiene su
 * pantalla —crea la fila del animal, no solo un evento— y `anulacion` se hace
 * desde el historial, donde está el evento que se va a deshacer.
 */
type TipoCargable = Exclude<TipoEvento, 'alta' | 'anulacion'>;

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
  tacto_positivo: { que: 'Preñada', boton: 'Cargar el tacto' },
  tacto_negativo: { que: 'Vacía', boton: 'Cargar el tacto' },
  parto: { que: 'Las crías, con su sexo y su resultado', boton: 'Cargar el parto' },
  aborto: { que: 'Perdió la preñez', boton: 'Cargar el aborto' },
  control_lechero: { que: 'Litros, grasa, proteína, RCS', boton: 'Cargar el control' },
  secado: { que: 'Sale de ordeñe', boton: 'Cargar el secado' },
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
  { rotulo: 'Salida', tipos: ['baja'] },
];

/**
 * Los cinco que **no llevan payload**: fecha y observaciones, y nada más.
 *
 * Comparten un solo componente que recibe el tipo. Cinco pantallas idénticas con
 * el título cambiado serían cinco lugares donde arreglar lo mismo el día que la
 * carga cambie.
 */
const SIN_PAYLOAD: readonly TipoCargable[] = [
  'celo',
  'tacto_positivo',
  'tacto_negativo',
  'aborto',
  'secado',
];

const CRIA_NUEVA: Cria = { sexo: 'hembra', resultado: 'viva' };

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
  if (elegido === 'parto') return <CargaDeParto {...comun} />;
  if (elegido === 'control_lechero') return <CargaDeControl {...comun} />;
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
  children,
}: Comunes & {
  payload: () => unknown;
  /** La baja: su botón es rojo porque lo que hace no se parece a lo demás. */
  peligro?: boolean;
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
          disabled={enviando}
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
      payload={() => ({
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

function CargaDeParto(comun: Comunes) {
  const [crias, setCrias] = useState<Cria[]>([CRIA_NUEVA]);

  return (
    <MarcoDeCarga {...comun} payload={() => ({ crias })}>
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
      payload={() => ({
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

function CargaDeBaja(comun: Comunes) {
  const [motivo, setMotivo] = useState<MotivoBaja>('venta');
  const [detalle, setDetalle] = useState('');

  return (
    <MarcoDeCarga
      {...comun}
      peligro
      payload={() => ({
        motivo,
        ...(detalle.trim() === '' ? {} : { detalle: detalle.trim() }),
      })}
    >
      <Campo etiqueta="Motivo" ayuda="Sin esto no hay tasa de descarte ni de mortalidad.">
        <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoBaja)}>
          {MOTIVOS_BAJA.map((m) => (
            <option key={m} value={m}>
              {MOTIVO_BAJA[m]}
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
