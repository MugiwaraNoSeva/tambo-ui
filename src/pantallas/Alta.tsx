// ─────────────────────────────────────────────────────────────────────────────
// Dar de alta un animal: la fila y su primer evento, que la API guarda juntos.
//
// El alta tiene su propia pantalla y no es un tipo más del formulario de carga
// porque **crea el animal**: sin fila no hay URL contra la cual cargar eventos.
//
// El estado inicial existe para dos casos reales y ninguno es el común: una vaca
// comprada que ya viene preñada, y la migración de un rodeo que hasta ayer vivía
// en una libreta. Por eso arranca plegado — el alta de una ternera nacida en el
// tambo es caravana y fecha, y nada más.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState, type FormEvent } from 'react';
import { ErrorApi, api } from '../api/cliente';
import type {
  CuerpoAlta,
  CuerpoError,
  EstadoInicial,
  EstadoProductivo,
  EstadoReproductivo,
  PayloadAltaApi,
} from '../api/tipos';
import { Armazon } from '../componentes/armazon';
import { Cargando, SoloLectura, Tarjeta } from '../componentes/basicos';
import { Campo, Casilla, Rechazo } from '../componentes/formulario';
import { usarEstablecimiento } from '../establecimiento';
import { PRODUCTIVO, REPRODUCTIVO, caravanaVisible, fechaCorta } from '../formato';
import { hoyDelServidor } from '../reloj';
import { aAnimal, aTablero, ir, usarVuelta } from '../ruteo';
import { mensajeDe, usarPedido } from '../usarPedido';

const SIN_ELEGIR = '';

/**
 * La puerta. Al de `lectura` el botón "Dar de alta" ni le aparece en el tablero;
 * esto es para el que igual llegó —`#/alta` escrito a mano, un enlace viejo—,
 * que merece un renglón que se entienda y no un formulario entero cuyo único
 * final posible es un 403 al enviar.
 */
export function Alta() {
  const { puedeCargar } = usarEstablecimiento();
  // De dónde se vino. El tablero es el default —es de donde se entra hoy— y lo
  // que se hace con esto está abajo, en `mandar`.
  const vuelta = usarVuelta(aTablero());

  if (!puedeCargar) {
    return (
      <Armazon titulo="Dar de alta" volverA={vuelta}>
        <SoloLectura>No podés dar de alta animales en este tambo.</SoloLectura>
      </Armazon>
    );
  }

  return <FormularioDeAlta vuelta={vuelta} />;
}

function FormularioDeAlta({ vuelta }: { vuelta: string }) {
  const { id: est } = usarEstablecimiento();

  const [caravana, setCaravana] = useState('');
  const [fechaAlta, setFechaAlta] = useState(hoyDelServidor);
  const [nacimiento, setNacimiento] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [conEstadoInicial, setConEstadoInicial] = useState(false);
  const [reproductivo, setReproductivo] = useState<EstadoReproductivo | ''>(SIN_ELEGIR);
  const [productivo, setProductivo] = useState<EstadoProductivo | ''>(SIN_ELEGIR);
  const [numeroLactancia, setNumeroLactancia] = useState('');
  const [fechaServicio, setFechaServicio] = useState('');
  const [partoProbable, setPartoProbable] = useState('');

  const [esCriaDelRodeo, setEsCriaDelRodeo] = useState(false);
  const [madreId, setMadreId] = useState(SIN_ELEGIR);
  const [partoEventoId, setPartoEventoId] = useState(SIN_ELEGIR);

  const [enviando, setEnviando] = useState(false);
  const [rechazo, setRechazo] = useState<CuerpoError | null>(null);

  function armarPayload(): PayloadAltaApi | undefined {
    const payload: PayloadAltaApi = {};
    if (nacimiento !== '') payload.fecha_nacimiento = nacimiento;

    if (conEstadoInicial) {
      const inicial: EstadoInicial = {};
      if (reproductivo !== SIN_ELEGIR) inicial.reproductivo = reproductivo;
      if (productivo !== SIN_ELEGIR) inicial.productivo = productivo;
      if (numeroLactancia !== '') inicial.numero_lactancia = Number(numeroLactancia);
      if (fechaServicio !== '') inicial.fecha_servicio_estimada = fechaServicio;
      if (partoProbable !== '') inicial.fecha_parto_probable = partoProbable;
      if (Object.keys(inicial).length > 0) payload.estado_inicial = inicial;
    }

    if (esCriaDelRodeo && madreId !== SIN_ELEGIR) {
      payload.madre_id = madreId;
      // `parto_evento_id` exige madre: un id de parto suelto no identifica nada
      // (decisión 31). Por eso solo viaja si además hay madre elegida.
      if (partoEventoId !== SIN_ELEGIR) payload.parto_evento_id = partoEventoId;
    }

    return Object.keys(payload).length === 0 ? undefined : payload;
  }

  async function mandar(forzado: boolean, observacionesDelForzado?: string) {
    setEnviando(true);
    setRechazo(null);
    const notas = forzado ? (observacionesDelForzado ?? '') : observaciones.trim();
    const payload = armarPayload();
    const cuerpo: CuerpoAlta = {
      caravana: caravana.trim(),
      fecha_evento: fechaAlta,
      observaciones: notas === '' ? null : notas,
      ...(payload === undefined ? {} : { payload }),
      ...(forzado ? { forzado: true } : {}),
    };
    try {
      const alta = await api.alta(est, cuerpo);
      // El origen del alta se le pasa a la ficha nueva. Sin esto la flecha de esa
      // ficha caía en su default, que es el rodeo: dabas de alta desde el tablero
      // y para volver al tablero tenías que pasar por una lista de doscientas.
      // Es el mismo `desde` que ya usan la fila del rodeo y el atajo de carga.
      ir(aAnimal(alta.animal_id, vuelta));
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
    <Armazon titulo="Dar de alta" volverA={vuelta}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void mandar(false);
        }}
      >
        <Tarjeta titulo="El animal">
          <Campo etiqueta="Caravana" ayuda="Tiene que estar libre entre las activas del tambo.">
            <input
              value={caravana}
              onChange={(e) => setCaravana(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              autoCapitalize="characters"
              required
            />
          </Campo>
          <Campo etiqueta="Fecha del alta">
            <input
              type="date"
              value={fechaAlta}
              onChange={(e) => setFechaAlta(e.target.value)}
              required
            />
          </Campo>
          <Campo
            etiqueta="Fecha de nacimiento"
            ayuda="Opcional: de una vaca comprada no siempre se sabe."
          >
            <input
              type="date"
              value={nacimiento}
              onChange={(e) => setNacimiento(e.target.value)}
            />
          </Campo>
        </Tarjeta>

        <Tarjeta
          titulo="¿Ya venía con historia?"
          subtitulo="Para una vaca comprada o un rodeo que se está pasando de la libreta."
        >
          <Casilla
            etiqueta="Cargar su estado inicial"
            marcada={conEstadoInicial}
            alCambiar={setConEstadoInicial}
          />

          {conEstadoInicial && (
            <>
              <div className="dos-columnas">
                <Campo etiqueta="Reproductivo">
                  <select
                    value={reproductivo}
                    onChange={(e) => setReproductivo(e.target.value as EstadoReproductivo | '')}
                  >
                    <option value={SIN_ELEGIR}>Vacía (default)</option>
                    {(Object.keys(REPRODUCTIVO) as EstadoReproductivo[]).map((r) => (
                      <option key={r} value={r}>
                        {REPRODUCTIVO[r]}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Productivo">
                  <select
                    value={productivo}
                    onChange={(e) => setProductivo(e.target.value as EstadoProductivo | '')}
                  >
                    <option value={SIN_ELEGIR}>Seca (default)</option>
                    {(Object.keys(PRODUCTIVO) as EstadoProductivo[]).map((p) => (
                      <option key={p} value={p}>
                        {PRODUCTIVO[p]}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              <Campo etiqueta="Lactancias que ya cursó">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={numeroLactancia}
                  onChange={(e) => setNumeroLactancia(e.target.value)}
                />
              </Campo>
              <Campo
                etiqueta="Fecha estimada del servicio"
                ayuda="Si entra inseminada o preñada y se sabe cuándo la sirvieron."
              >
                <input
                  type="date"
                  value={fechaServicio}
                  onChange={(e) => setFechaServicio(e.target.value)}
                />
              </Campo>
              <Campo
                etiqueta="Parto probable"
                ayuda="Alternativa si entra preñada y no se conoce el servicio."
              >
                <input
                  type="date"
                  value={partoProbable}
                  onChange={(e) => setPartoProbable(e.target.value)}
                />
              </Campo>
            </>
          )}
        </Tarjeta>

        <Tarjeta titulo="¿Nació en el tambo?">
          <Casilla
            etiqueta="Es cría de una vaca del rodeo"
            marcada={esCriaDelRodeo}
            alCambiar={setEsCriaDelRodeo}
          />
          {esCriaDelRodeo && (
            <OrigenDeLaCria
              madreId={madreId}
              alElegirMadre={(elegida) => {
                setMadreId(elegida);
                // La madre cambió: el parto elegido era de la anterior.
                setPartoEventoId(SIN_ELEGIR);
              }}
              partoEventoId={partoEventoId}
              alElegirParto={setPartoEventoId}
            />
          )}
        </Tarjeta>

        <Tarjeta titulo="Observaciones" subtitulo="Opcional.">
          <Campo etiqueta="Nota">
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

        <button className="boton ancho" type="submit" disabled={enviando}>
          {enviando ? 'Dando de alta…' : 'Dar de alta'}
        </button>
      </form>
    </Armazon>
  );
}

/**
 * Madre y parto de origen, elegidos de listas y no escritos.
 *
 * El contrato pide dos uuids (`madre_id` y `parto_evento_id`), y pedirle a
 * alguien que los tipee en el corral sería inventar una forma nueva de
 * equivocarse. Se eligen: la madre de la lista del rodeo, y el parto de **su**
 * log, ya filtrado a los partos vigentes — que es exactamente lo que la API va a
 * verificar contra el log de la madre (decisión 31).
 *
 * Las dos lecturas viven acá adentro y no en el formulario: solo se piden si
 * alguien marca la casilla, que es el caso raro.
 */
function OrigenDeLaCria({
  madreId,
  alElegirMadre,
  partoEventoId,
  alElegirParto,
}: {
  madreId: string;
  alElegirMadre: (id: string) => void;
  partoEventoId: string;
  alElegirParto: (id: string) => void;
}) {
  const { id: est } = usarEstablecimiento();
  const traerRodeo = useCallback(() => api.animales(est), [est]);
  const rodeo = usarPedido(traerRodeo);

  return (
    <>
      <Campo etiqueta="Madre">
        {rodeo.cargando ? (
          <Cargando que="Trayendo el rodeo…" />
        ) : (
          <select value={madreId} onChange={(e) => alElegirMadre(e.target.value)}>
            <option value={SIN_ELEGIR}>Elegí la madre</option>
            {(rodeo.datos?.animales ?? []).map((a) => (
              <option key={a.animal_id} value={a.animal_id}>
                {caravanaVisible(a.caravana)}
              </option>
            ))}
          </select>
        )}
      </Campo>

      {madreId !== SIN_ELEGIR && (
        <PartosDeLaMadre
          madreId={madreId}
          partoEventoId={partoEventoId}
          alElegirParto={alElegirParto}
        />
      )}
    </>
  );
}

function PartosDeLaMadre({
  madreId,
  partoEventoId,
  alElegirParto,
}: {
  madreId: string;
  partoEventoId: string;
  alElegirParto: (id: string) => void;
}) {
  const { id: est } = usarEstablecimiento();
  const traer = useCallback(() => api.eventos(est, madreId), [est, madreId]);
  const { datos, cargando } = usarPedido(traer);

  const partos = (datos?.eventos ?? []).filter((e) => e.tipo === 'parto' && e.vigente);

  if (cargando) return <Cargando que="Buscando sus partos…" />;

  if (partos.length === 0) {
    return (
      <p className="vacio">
        Esa madre no tiene ningún parto vigente cargado. Cargá el parto primero y volvé.
      </p>
    );
  }

  return (
    <Campo etiqueta="Parto del que salió">
      <select value={partoEventoId} onChange={(e) => alElegirParto(e.target.value)}>
        <option value={SIN_ELEGIR}>Elegí el parto</option>
        {[...partos].reverse().map((p) => (
          <option key={p.id} value={p.id}>
            {fechaCorta(p.fecha_evento)}
          </option>
        ))}
      </select>
    </Campo>
  );
}
