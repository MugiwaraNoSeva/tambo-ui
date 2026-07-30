// ─────────────────────────────────────────────────────────────────────────────
// La ficha del animal: todo lo que el sistema sabe de una vaca.
//
// Son cuatro lecturas —la proyección, los KPIs, las lactancias y el log— y
// siguen la regla del tablero (decisión 56): cada tarjeta pide la suya y se cae
// sola. La única que es distinta es la **proyección**, porque de ella sale la
// caravana que va en el encabezado: sin ella no hay ficha que dibujar, así que
// esa sí bloquea la pantalla.
//
// Nada de acá calcula nada del animal. La fecha probable de parto, la categoría
// de alimentación y los días en leche los sabe el núcleo; los que la API sirve
// se muestran y los que no, no se inventan (que es lo mismo que dice la
// decisión 37 sobre los `null`).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo, useState } from 'react';
import { ErrorApi, api } from '../api/cliente';
import type { Ciclo, CuerpoError, EventoHistorial, RespuestaAnimal } from '../api/tipos';
import { EtiquetasDeEstado } from '../componentes/animales';
import { Armazon } from '../componentes/armazon';
import { Aviso, Cargando, Cifra, Tarjeta, TarjetaCaida } from '../componentes/basicos';
import { Campo, Rechazo } from '../componentes/formulario';
import { CurvaLactancia } from '../componentes/CurvaLactancia';
import { usarEstablecimiento } from '../establecimiento';
import {
  MOTIVO_BAJA,
  ORIGEN_CICLO,
  RESULTADO_CICLO,
  SIN_DATO,
  TIPO_EVENTO,
  anios,
  caravanaVisible,
  crias,
  detallePayload,
  dias,
  fechaCorta,
  fechaOSinDato,
  litros,
  numero,
  porcentaje,
} from '../formato';
import { aCargar, aRodeo } from '../ruteo';
import { nuevoUuid } from '../uuid';
import { mensajeDe, usarPedido } from '../usarPedido';

export function Ficha({ id }: { id: string }) {
  const { id: est, puedeCargar } = usarEstablecimiento();
  // Una anulación cambia el estado, los KPIs, las lactancias y el log a la vez,
  // así que las cinco tarjetas se vuelven a pedir juntas. Subir el número es lo
  // que las dispara: cada `traer` lo lleva en sus dependencias.
  const [version, setVersion] = useState(0);
  const refrescar = useCallback(() => setVersion((n) => n + 1), []);

  const traer = useCallback(() => api.animal(est, id), [est, id, version]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  // La flecha vuelve al rodeo —la lista a la que este animal pertenece— y no al
  // tablero. Igual son enlaces de verdad, así que el "atrás" del celular
  // deshace el camino que se hizo, venga de donde venga.
  const titulo = datos === null ? 'Ficha del animal' : caravanaVisible(datos.caravana);

  return (
    <Armazon titulo={titulo} volverA={aRodeo()}>
      {cargando && <Cargando que="Abriendo la ficha…" />}
      {!cargando && (error !== null || datos === null) && (
        <TarjetaCaida titulo="La ficha" error={error} reintentar={recargar} />
      )}
      {!cargando && datos !== null && error === null && (
        <>
          <EstadoActual animal={datos} />

          {/* La acción más frecuente de la ficha, arriba y a un toque: se entra
              a una ficha en el corral para cargar lo que se acaba de ver.
              **Salvo en un animal de baja**, donde no se ofrece: la baja es
              terminal (decisión 7) y todo evento posterior se rechaza sin
              posibilidad de forzarlo, así que el botón sería un formulario
              entero cuyo único final posible es un "no" (decisión 65). La
              salida existe y está a la vista: anular la baja desde el
              historial, que es el último evento vigente. */}
          {puedeCargar && datos.proyeccion.estado.vida !== 'BAJA' && (
            <a className="boton ancho" href={aCargar(id)}>
              Cargar un evento
            </a>
          )}

          <KPIs animalId={id} version={version} />
          <Lactancias animalId={id} version={version} />
          <Ciclos ciclos={datos.proyeccion.ciclos} />
          <Historial animalId={id} version={version} alAnular={refrescar} />
        </>
      )}
    </Armazon>
  );
}

// ── El estado, que es lo primero que se mira ─────────────────────────────────

function EstadoActual({ animal }: { animal: RespuestaAnimal }) {
  const e = animal.proyeccion.estado;

  return (
    <Tarjeta>
      <div className="cabecera-animal">
        <span className="caravana grande">{caravanaVisible(animal.caravana)}</span>
        <span className="etiquetas">
          <EtiquetasDeEstado
            vida={e.vida}
            reproductivo={e.reproductivo}
            productivo={e.productivo}
          />
        </span>
      </div>

      {e.motivo_baja !== null && (
        <Aviso tono="atencion" titulo="Fuera del rodeo">
          Salió por {MOTIVO_BAJA[e.motivo_baja].toLowerCase()}. No cuenta en ninguna de las cifras
          del rodeo y no se le pueden cargar eventos. Si volvió, anulá la baja desde el historial.
        </Aviso>
      )}

      <dl className="datos">
        <Dato rotulo="Nacimiento" valor={fechaOSinDato(e.fecha_nacimiento)} />
        <Dato rotulo="Último parto" valor={fechaOSinDato(e.fecha_ultimo_parto)} />
        <Dato rotulo="Lactancias" valor={numero(e.ultimo_numero_lactancia)} />
        <Dato rotulo="Último celo" valor={fechaOSinDato(e.fecha_ultimo_celo)} />
        <Dato rotulo="Última inseminación" valor={fechaOSinDato(e.fecha_ultima_inseminacion)} />
        <Dato
          rotulo="Servicio que la preñó"
          valor={fechaOSinDato(e.fecha_inseminacion_efectiva)}
        />
        {e.fecha_parto_probable_inicial !== null && (
          <Dato
            rotulo="Parto probable declarado"
            valor={fechaCorta(e.fecha_parto_probable_inicial)}
          />
        )}
        {e.madre_id !== null && <Dato rotulo="Nacida en el rodeo" valor="sí" />}
      </dl>
    </Tarjeta>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="dato">
      <dt>{rotulo}</dt>
      <dd className={valor === SIN_DATO ? 'sin-datos' : undefined}>{valor}</dd>
    </div>
  );
}

// ── Los KPIs ─────────────────────────────────────────────────────────────────

/**
 * Los indicadores del animal. **Ningún `null` se esconde ni se dibuja como 0**
 * (decisión 37): "sin datos" y "cero" son cosas distintas —no hay con qué
 * calcularlo contra sí se calculó y dio cero— y confundirlas es lo que esa
 * decisión vino a evitar. Por eso están los diez, incluso los que no aplican
 * todavía: un hueco enseña que el dato falta.
 */
function KPIs({ animalId, version }: { animalId: string; version: number }) {
  const { id: est } = usarEstablecimiento();
  const traer = useCallback(() => api.kpis(est, animalId), [est, animalId, version]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  if (cargando) {
    return (
      <Tarjeta titulo="Los números">
        <Cargando que="Calculando…" />
      </Tarjeta>
    );
  }
  if (error !== null || datos === null) {
    return <TarjetaCaida titulo="Los números" error={error} reintentar={recargar} />;
  }

  const k = datos.kpis;

  return (
    <Tarjeta titulo="Los números" subtitulo={`Al ${fechaCorta(datos.fecha)}.`}>
      <div className="cifras">
        <Cifra rotulo="Días abiertos" valor={dias(k.dias_abiertos)} />
        <Cifra rotulo="Parto a 1er servicio" valor={dias(k.intervalo_parto_primer_servicio)} />
        <Cifra rotulo="Entre partos" valor={dias(k.intervalo_entre_partos)} />
        <Cifra rotulo="Servicios por preñez" valor={numero(k.servicios_por_concepcion, 1)} />
        <Cifra rotulo="Pérdida de preñez" valor={porcentaje(k.tasa_perdida_prenez)} />
        <Cifra rotulo="Mortalidad al parto" valor={porcentaje(k.tasa_mortalidad_perinatal)} />
        <Cifra rotulo="Hembras nacidas vivas" valor={numero(k.hembras_nacidas_vivas)} />
        <Cifra rotulo="Edad" valor={anios(k.edad_dias)} />
        <Cifra rotulo="Edad al primer parto" valor={anios(k.edad_al_primer_parto)} />
      </div>

      {k.ciclos_excluidos > 0 && (
        <Aviso tono="atencion" titulo="Hay ciclos que no cuentan">
          {numero(k.ciclos_excluidos)}{' '}
          {k.ciclos_excluidos === 1 ? 'ciclo tiene' : 'ciclos tienen'} algún evento cargado con
          "confirmar igual", así que sus fechas no son confiables y quedan afuera de estos números.
        </Aviso>
      )}
    </Tarjeta>
  );
}

// ── Las lactancias ───────────────────────────────────────────────────────────

function Lactancias({ animalId, version }: { animalId: string; version: number }) {
  const { id: est } = usarEstablecimiento();
  const traer = useCallback(() => api.lactancias(est, animalId), [est, animalId, version]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  if (cargando) {
    return (
      <Tarjeta titulo="La lactancia">
        <Cargando que="Trayendo la curva…" />
      </Tarjeta>
    );
  }
  if (error !== null || datos === null) {
    return <TarjetaCaida titulo="La lactancia" error={error} reintentar={recargar} />;
  }

  if (datos.lactancias.length === 0) {
    return (
      <Tarjeta titulo="La lactancia">
        <p className="vacio">Este animal todavía no tuvo ninguna lactancia.</p>
      </Tarjeta>
    );
  }

  // La que interesa es la abierta; si están todas cerradas, la última. El resto
  // va abajo en una línea cada una: lo que se compara entre lactancias viejas es
  // cuánto dieron, y para eso alcanza la acumulada.
  const abierta = datos.lactancias.find((l) => l.fecha_fin === null);
  const enFoco = abierta ?? datos.lactancias[datos.lactancias.length - 1];
  if (enFoco === undefined) return null;
  const anteriores = datos.lactancias.filter((l) => l.numero !== enFoco.numero).reverse();

  return (
    <>
      <Tarjeta
        titulo={`Lactancia ${numero(enFoco.numero)}${abierta === undefined ? '' : ' (en curso)'}`}
        subtitulo={`Empezó el ${fechaCorta(enFoco.fecha_inicio)}${
          enFoco.fecha_fin === null ? '' : ` y cerró el ${fechaCorta(enFoco.fecha_fin)}`
        }.`}
      >
        {enFoco.datos_incompletos && (
          <Aviso tono="atencion" titulo="Datos incompletos">
            La abrió un parto cargado con "confirmar igual": la fecha de inicio no es confiable, y
            con ella tampoco los días en leche de la curva.
          </Aviso>
        )}

        <CurvaLactancia curva={enFoco.curva} pico={enFoco.pico} />

        <div className="cifras">
          <Cifra rotulo="Pico" valor={litros(enFoco.pico?.litros ?? null)} />
          <Cifra rotulo="Al día en leche" valor={numero(enFoco.pico?.del ?? null)} />
          <Cifra rotulo="Acumulada" valor={litros(enFoco.acumulada, 0)} />
          <Cifra rotulo="Promedio por control" valor={litros(enFoco.promedio_controles)} />
          <Cifra rotulo="A 305 días" valor={litros(enFoco.estandarizada_305, 0)} />
          <Cifra rotulo="RCS máximo" valor={numero(enFoco.rcs_maximo)} />
        </div>

        {enFoco.crias.length > 0 && <p className="renglon">Parto: {crias(enFoco.crias)}</p>}
      </Tarjeta>

      {anteriores.length > 0 && (
        <Tarjeta titulo="Las lactancias anteriores">
          <ul className="reparto">
            {anteriores.map((l) => (
              <li key={l.numero}>
                <span>
                  Lactancia {numero(l.numero)} — {fechaCorta(l.fecha_inicio)}
                </span>
                <span className="cuenta">{litros(l.acumulada, 0)}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </>
  );
}

// ── Los ciclos ───────────────────────────────────────────────────────────────

function Ciclos({ ciclos }: { ciclos: Ciclo[] }) {
  if (ciclos.length === 0) return null;

  return (
    <Tarjeta titulo="Los ciclos" subtitulo="Del último al primero.">
      <ul className="lista-simple">
        {[...ciclos].reverse().map((c) => (
          <li key={c.numero}>
            <strong>
              Ciclo {numero(c.numero)} — {RESULTADO_CICLO[c.resultado]}
            </strong>
            <span className="renglon">
              {fechaCorta(c.fecha_inicio)} {ORIGEN_CICLO[c.origen]}
              {c.fecha_fin !== null && ` · cerró el ${fechaCorta(c.fecha_fin)}`}
              {` · ${numero(c.servicios)} ${c.servicios === 1 ? 'servicio' : 'servicios'}`}
              {c.fecha_primer_servicio !== null &&
                ` · el primero el ${fechaCorta(c.fecha_primer_servicio)}`}
            </span>
            {c.datos_incompletos && (
              <span className="renglon aviso-suave">Con datos forzados: fuera de los KPIs.</span>
            )}
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

// ── El historial ─────────────────────────────────────────────────────────────

/**
 * El log del animal, **del último al primero**.
 *
 * La API lo sirve en el orden en que ocurrió, que es el orden del fold; acá se
 * da vuelta porque lo que se busca al abrir una ficha es qué pasó recién. Es
 * también el orden en que se anula (§3.5: en orden inverso), así que el evento
 * que se puede deshacer queda arriba de todo.
 *
 * Tres marcas y no una: un evento **anulado** (tachado), la **anulación** que lo
 * deshizo, y los **forzados**. La anulación tiene `vigente: false` como el
 * evento que anuló —no forma parte del estado— pero no está anulada, así que
 * pintarlas igual sería mentir sobre cuál deshizo a cuál.
 */
function Historial({
  animalId,
  version,
  alAnular,
}: {
  animalId: string;
  version: number;
  alAnular: () => void;
}) {
  const { id: est, puedeCargar } = usarEstablecimiento();
  const traer = useCallback(() => api.eventos(est, animalId), [est, animalId, version]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  if (cargando) {
    return (
      <Tarjeta titulo="El historial">
        <Cargando que="Trayendo el log…" />
      </Tarjeta>
    );
  }
  if (error !== null || datos === null) {
    return <TarjetaCaida titulo="El historial" error={error} reintentar={recargar} />;
  }

  // El único que se puede anular es **el último vigente**, y la UI ofrece el
  // botón solo ahí (§3.5: se anula en orden inverso). No es una regla que la UI
  // decida: si se manda otro, la API contesta `ANULACION_INVALIDA` con el
  // mensaje que explica el orden. Ofrecerlo en todos sería invitar a un rechazo
  // que ya se sabe que va a venir. Y anular es cargar un evento más, así que el
  // de lectura no lo ve: el historial se mira igual, entero y con sus marcas.
  const ultimoVigente = puedeCargar
    ? [...datos.eventos].reverse().find((e) => e.vigente)
    : undefined;

  return (
    <Tarjeta titulo={`El historial (${numero(datos.eventos.length)})`}>
      {datos.eventos.length === 0 ? (
        <p className="vacio">Sin eventos cargados.</p>
      ) : (
        <ul className="lista-simple historial">
          {[...datos.eventos].reverse().map((evento) => (
            <EventoDelLog
              key={evento.id}
              evento={evento}
              animalId={animalId}
              anulable={evento.id === ultimoVigente?.id}
              alAnular={alAnular}
            />
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

function EventoDelLog({
  evento,
  animalId,
  anulable,
  alAnular,
}: {
  evento: EventoHistorial;
  animalId: string;
  anulable: boolean;
  alAnular: () => void;
}) {
  const anulado = evento.anulado_por !== null;
  const esAnulacion = evento.tipo === 'anulacion';
  const detalle = detallePayload(evento.tipo, evento.payload);

  return (
    <li className={anulado ? 'anulado' : undefined}>
      <strong>
        {fechaCorta(evento.fecha_evento)} — {TIPO_EVENTO[evento.tipo]}
      </strong>
      {/* Las marcas son palabra, no color ni ícono solo: "anulado" tachado y sin
          la palabra se lee como un problema de la pantalla. */}
      {anulado && <span className="marca anulado">anulado</span>}
      {esAnulacion && <span className="marca">deshace un evento anterior</span>}
      {evento.forzado && <span className="marca forzado">cargado con "confirmar igual"</span>}
      {detalle !== null && <span className="renglon">{detalle}</span>}
      {evento.observaciones !== null && evento.observaciones !== '' && (
        <span className="renglon observaciones">“{evento.observaciones}”</span>
      )}
      {anulable && <Anulacion evento={evento} animalId={animalId} alAnular={alAnular} />}
    </li>
  );
}

/**
 * Deshacer el último evento.
 *
 * No se edita ni se borra: se carga una **anulación**, que es un evento más del
 * log. El original queda —con su marca— porque el log es append-only y saber que
 * alguien se equivocó y cuándo lo corrigió es parte de la historia del animal.
 *
 * Las observaciones son obligatorias y el botón espera a que haya texto: la API
 * las va a exigir igual (`OBSERVACIONES_REQUERIDAS`), así que pedirlas antes
 * ahorra un viaje y un rechazo que ya se sabe que viene.
 */
function Anulacion({
  evento,
  animalId,
  alAnular,
}: {
  evento: EventoHistorial;
  animalId: string;
  alAnular: () => void;
}) {
  const { id: est } = usarEstablecimiento();
  const [abierto, setAbierto] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [rechazo, setRechazo] = useState<CuerpoError | null>(null);
  // Con su id, como cualquier carga: una anulación reintentada después de un
  // corte de red vuelve como `EVENTO_DUPLICADO` (decisión 67).
  const idDeLaAnulacion = useMemo(nuevoUuid, []);

  async function anular() {
    setEnviando(true);
    setRechazo(null);
    try {
      await api.cargarEvento(est, animalId, {
        ...(idDeLaAnulacion === undefined ? {} : { id: idDeLaAnulacion }),
        tipo: 'anulacion',
        payload: { evento_anulado_id: evento.id },
        observaciones: observaciones.trim(),
      });
      setAbierto(false);
      setObservaciones('');
      alAnular();
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

  if (!abierto) {
    return (
      <button className="boton secundario chico" type="button" onClick={() => setAbierto(true)}>
        Anular este evento
      </button>
    );
  }

  return (
    <div className="anulacion">
      <Campo etiqueta="Por qué se anula">
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Fecha equivocada al pasar de la libreta."
          required
        />
      </Campo>
      {/* Una anulación rechazada no es forzable —no está en §5.6— así que va sin
          "Confirmar igual": el mensaje de la API ya explica el orden inverso. */}
      {rechazo !== null && <Rechazo error={rechazo} />}
      <div className="acciones">
        <button
          className="boton peligro"
          type="button"
          disabled={observaciones.trim() === '' || enviando}
          onClick={() => void anular()}
        >
          {enviando ? 'Anulando…' : 'Anular'}
        </button>
        <button
          className="boton secundario"
          type="button"
          onClick={() => {
            setAbierto(false);
            setRechazo(null);
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
