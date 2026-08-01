// ─────────────────────────────────────────────────────────────────────────────
// Cargar un evento: el corazón operativo de la app.
//
// La pantalla no sabe **ninguna** regla: elige un tipo, junta el payload que ese
// tipo lleva y lo manda. Si el animal no podía hacer eso, lo dice la API con el
// mensaje de §5.6 y se muestra tal cual. La única validación de acá es de forma
// —campos requeridos y tipos de input— y el único gesto de dominio es el que la
// decisión 50 declara: que un rechazo forzable se puede confirmar.
//
// El evento viaja con **su propio id**. No es capricho: en el corral la señal se
// corta, y un POST cuya respuesta se pierde deja al tambero sin saber si el
// evento entró. Con el id del cliente, el reintento vuelve como
// `EVENTO_DUPLICADO` en vez de cargar el parto dos veces (decisión 41, y
// decisiones 63 y 67 por el lado de la UI).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo, useState, type FormEvent } from 'react';
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
import { aAnimal, ir, usarCaravanaDelHash, usarVuelta } from '../ruteo';
import { nuevoUuid } from '../uuid';
import { mensajeDe, usarPedido } from '../usarPedido';

/**
 * Los tipos que se cargan desde acá. Faltan dos a propósito: `alta` tiene su
 * pantalla —crea la fila del animal, no solo un evento— y `anulacion` se hace
 * desde el historial, donde está el evento que se va a deshacer.
 */
const CARGABLES: readonly TipoEvento[] = [
  'celo',
  'inseminacion',
  'tacto_positivo',
  'tacto_negativo',
  'parto',
  'aborto',
  'secado',
  'control_lechero',
  'baja',
];

const CRIA_NUEVA: Cria = { sexo: 'hembra', resultado: 'viva' };

/**
 * La puerta. Al de `lectura` la ficha no le ofrece "Cargar un evento"; esto es
 * para el que igual llegó por la barra de direcciones, y le dice por qué no
 * puede en vez de dejarlo llenar un formulario que la API va a rechazar.
 */
export function CargarEvento({ id }: { id: string }) {
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
    return (
      <Armazon titulo={`Cargar — ${caravana}`} volverA={vuelta}>
        <Formulario animalId={id} vuelta={vuelta} />
      </Armazon>
    );
  }

  // Y el camino de un enlace pelado —una dirección tipeada, un favorito viejo—,
  // que sigue andando: si nadie dijo la caravana, se va a buscar.
  return <CargaSinCaravana id={id} vuelta={vuelta} />;
}

function CargaSinCaravana({ id, vuelta }: { id: string; vuelta: string }) {
  const { id: est } = usarEstablecimiento();
  const traer = useCallback(() => api.animal(est, id), [est, id]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  const titulo = datos === null ? 'Cargar un evento' : `Cargar — ${caravanaVisible(datos.caravana)}`;

  return (
    <Armazon titulo={titulo} volverA={vuelta}>
      {cargando && <Cargando que="Abriendo la carga…" />}
      {!cargando && (error !== null || datos === null) && (
        <TarjetaCaida titulo="El animal" error={error} reintentar={recargar} />
      )}
      {!cargando && datos !== null && error === null && (
        <Formulario animalId={id} vuelta={vuelta} />
      )}
    </Armazon>
  );
}

function Formulario({ animalId, vuelta }: { animalId: string; vuelta: string }) {
  const { id: est } = usarEstablecimiento();

  const [tipo, setTipo] = useState<TipoEvento>('celo');
  // El hoy del servidor se fija **una vez** al abrir el formulario, y de ahí
  // salen tanto el default como el atajo de "ayer": si se releyera en cada
  // dibujo, una carga abierta antes de medianoche cambiaría de día sola.
  const [hoy] = useState(hoyDelServidor);
  const [fecha, setFecha] = useState(hoy);
  const [observaciones, setObservaciones] = useState('');

  // Inseminación
  const [toro, setToro] = useState('');
  const [pajuela, setPajuela] = useState('');
  const [iatf, setIatf] = useState(false);
  // Parto
  const [crias, setCrias] = useState<Cria[]>([CRIA_NUEVA]);
  // Control lechero
  const [litros, setLitros] = useState('');
  const [grasa, setGrasa] = useState('');
  const [proteina, setProteina] = useState('');
  const [rcs, setRcs] = useState('');
  // Baja
  const [motivo, setMotivo] = useState<MotivoBaja>('venta');
  const [detalle, setDetalle] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [rechazo, setRechazo] = useState<CuerpoError | null>(null);

  // El id se genera **una vez por formulario** y sobrevive a los reintentos: es
  // lo que hace que insistir después de un corte de red no duplique el evento.
  const idDelEvento = useMemo(nuevoUuid, []);

  const payload = (): unknown => {
    switch (tipo) {
      case 'inseminacion':
        return {
          ...(iatf ? { iatf: true } : {}),
          ...(toro.trim() === '' ? {} : { toro: toro.trim() }),
          ...(pajuela.trim() === '' ? {} : { pajuela: pajuela.trim() }),
        };
      case 'parto':
        return { crias };
      case 'control_lechero':
        return {
          litros: Number(litros),
          ...(grasa === '' ? {} : { grasa: Number(grasa) }),
          ...(proteina === '' ? {} : { proteina: Number(proteina) }),
          ...(rcs === '' ? {} : { rcs: Number(rcs) }),
        };
      case 'baja':
        return { motivo, ...(detalle.trim() === '' ? {} : { detalle: detalle.trim() }) };
      default:
        return {};
    }
  };

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
      // Se vuelve **a donde se vino**, que ahora no es siempre la ficha: quien
      // entró por el atajo de una lista de trabajo vuelve a esa lista, ya sin el
      // animal que acaba de cargar. Desde la ficha, `desde` es la ficha misma,
      // así que ahí no cambia nada y el evento nuevo se ve en el historial.
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
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void mandar(false);
      }}
    >
      <Tarjeta titulo="Qué pasó">
        <Campo etiqueta="Tipo de evento">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento)}>
            {CARGABLES.map((t) => (
              <option key={t} value={t}>
                {TIPO_EVENTO[t]}
              </option>
            ))}
          </select>
        </Campo>

        <CampoFecha
          etiqueta="Cuándo"
          ayuda="Por default, hoy. Si el hecho fue otro día, cambialo."
          valor={fecha}
          alCambiar={setFecha}
          hoy={hoy}
        />
      </Tarjeta>

      {tipo === 'inseminacion' && (
        <Tarjeta titulo="El servicio">
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
          <Casilla
            etiqueta="Fue a tiempo fijo (IATF)"
            marcada={iatf}
            alCambiar={setIatf}
          />
        </Tarjeta>
      )}

      {tipo === 'parto' && (
        <Tarjeta titulo="Las crías" subtitulo="Sin esto no hay reposición ni mortalidad al parto.">
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
        </Tarjeta>
      )}

      {tipo === 'control_lechero' && (
        <Tarjeta titulo="El control" subtitulo="Grasa, proteína y RCS solo si vino el laboratorio.">
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
          <Campo etiqueta="RCS (miles/ml)">
            <input
              type="number"
              inputMode="numeric"
              step="1"
              value={rcs}
              onChange={(e) => setRcs(e.target.value)}
            />
          </Campo>
        </Tarjeta>
      )}

      {tipo === 'baja' && (
        <Tarjeta titulo="La salida">
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
        </Tarjeta>
      )}

      <Tarjeta titulo="Observaciones" subtitulo="Opcional. Queda guardado con el evento.">
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
        {enviando ? 'Cargando…' : 'Cargar el evento'}
      </button>
    </form>
  );
}
