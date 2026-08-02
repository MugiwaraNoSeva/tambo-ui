// ─────────────────────────────────────────────────────────────────────────────
// La ficha del animal: todo lo que el sistema sabe de una vaca.
//
// Cada tarjeta pide la suya y se cae sola (decisión 56). La **proyección** es la
// distinta: de ella sale la caravana del encabezado, así que sin ella no hay
// ficha que dibujar y esa sí bloquea la pantalla.
//
// Al entrar se piden **tres** cosas y no cinco: la proyección, el log y las
// reglas con que se juzgó cada evento. Los números y la lactancia viven en
// `TarjetaPlegable` y traen lo suyo recién cuando alguien las abre — en el
// corral se entra a una ficha para cargar lo que se acaba de ver, no para leer
// la curva. Una consecuencia que se ve en los tests: anular refresca dos
// tarjetas y no cuatro, porque a las que nadie abrió no hay qué refrescarles.
//
// Nada de acá calcula nada del animal. La fecha probable de parto, la categoría
// de alimentación y los días en leche los sabe el núcleo; los que la API sirve
// se muestran y los que no, no se inventan (que es lo mismo que dice la
// decisión 37 sobre los `null`).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo, useState } from 'react';
import { ErrorApi, api } from '../api/cliente';
import type {
  Ciclo,
  CuerpoError,
  EventoHistorial,
  RespuestaAnimal,
  TipoEvento,
  VersionDeConfig,
} from '../api/tipos';
import { diferenciasDeConfig } from './ConfigDelTambo';
import { EtiquetasDeEstado } from '../componentes/animales';
import { Armazon } from '../componentes/armazon';
import {
  Aviso,
  Cargando,
  Cifra,
  Tarjeta,
  TarjetaCaida,
  TarjetaPlegable,
} from '../componentes/basicos';
import { Campo, Chips, Rechazo, type Opcion } from '../componentes/formulario';
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
import { aAnimal, aCargar, aRodeo, usarVuelta } from '../ruteo';
import { nuevoUuid } from '../uuid';
import { mensajeDe, usarPedido } from '../usarPedido';

export function Ficha({ id }: { id: string }) {
  const { id: est, puedeCargar } = usarEstablecimiento();
  // A dónde vuelve la flecha: lo que dijo quien abrió esta ficha. El rodeo es el
  // default —la lista a la que este animal pertenece— y era lo único que había
  // antes, lo que mandaba al rodeo también al que venía del tablero.
  const vuelta = usarVuelta(aRodeo());
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
    <Armazon titulo={titulo} volverA={vuelta} ancha>
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
            // La caravana viaja: la carga ya no tiene que pedir el animal entero
            // para escribirla en su encabezado. Y `desde` es esta misma ficha,
            // así que después de cargar se vuelve acá — que es donde se ve el
            // evento nuevo en el historial.
            <a
              className="boton ancho"
              href={aCargar(id, { desde: aAnimal(id, vuelta), caravana: datos.caravana })}
            >
              Cargar un evento
            </a>
          )}

          {/* Las dos que **no se miran al entrar**. Se entra a una ficha en el
              corral para cargar lo que se acaba de ver, no para leer la curva
              de lactancia: sus pedidos salen recién cuando alguien las abre, y
              eso baja la pantalla de cinco lecturas a tres.

              El historial se queda abierto: es lo segundo que se mira siempre
              —qué pasó recién— y es el único lugar desde donde se anula. */}
          <TarjetaPlegable titulo="Los números">
            <KPIs animalId={id} version={version} />
          </TarjetaPlegable>
          <TarjetaPlegable titulo="La lactancia">
            <Lactancias animalId={id} version={version} />
          </TarjetaPlegable>
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
/**
 * Un pedido que no volvió, **adentro** de una tarjeta que ya existe.
 *
 * `TarjetaCaida` no sirve acá porque dibuja su propia tarjeta, y estas viven
 * adentro de una plegable. Lo que se conserva es lo que importa: se dice qué
 * falta y se puede reintentar en el lugar, sin recargar la pantalla entera.
 */
function Caida({ error, reintentar }: { error: string | null; reintentar: () => void }) {
  return (
    <>
      <Aviso titulo="No se pudo traer">{error ?? 'El servidor no contestó.'}</Aviso>
      <button className="boton ancho secundario" type="button" onClick={reintentar}>
        Reintentar
      </button>
    </>
  );
}

function KPIs({ animalId, version }: { animalId: string; version: number }) {
  const { id: est } = usarEstablecimiento();
  const traer = useCallback(() => api.kpis(est, animalId), [est, animalId, version]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  if (cargando) return <Cargando que="Calculando…" />;
  if (error !== null || datos === null) return <Caida error={error} reintentar={recargar} />;

  const k = datos.kpis;

  return (
    <>
      <p className="subtitulo">Al {fechaCorta(datos.fecha)}.</p>
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
    </>
  );
}

// ── Las lactancias ───────────────────────────────────────────────────────────

function Lactancias({ animalId, version }: { animalId: string; version: number }) {
  const { id: est } = usarEstablecimiento();
  const traer = useCallback(() => api.lactancias(est, animalId), [est, animalId, version]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  if (cargando) return <Cargando que="Trayendo la curva…" />;
  if (error !== null || datos === null) return <Caida error={error} reintentar={recargar} />;

  if (datos.lactancias.length === 0) {
    return <p className="vacio">Este animal todavía no tuvo ninguna lactancia.</p>;
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
      <h3>
        Lactancia {numero(enFoco.numero)}
        {abierta === undefined ? '' : ' (en curso)'}
      </h3>
      <p className="subtitulo">
        Empezó el {fechaCorta(enFoco.fecha_inicio)}
        {enFoco.fecha_fin === null ? '' : ` y cerró el ${fechaCorta(enFoco.fecha_fin)}`}.
      </p>
      <>
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
      </>

      {anteriores.length > 0 && (
        <>
          <h3>Las anteriores</h3>
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
        </>
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
 * Con qué se juzgó este evento, **solo si no es con lo de hoy**.
 *
 * La decisión es no escribir "reglas vigentes" en los cuarenta renglones: sería
 * ruido que tapa los dos que importan. Lo que se muestra es la diferencia —qué
 * número era otro— y solo en los eventos que se juzgaron con una versión que ya
 * no rige. Los demás no dicen nada, que es lo correcto: se cargaron con lo que
 * está puesto.
 *
 * Devuelve null cuando no hay nada que decir: cuando el historial de reglas no
 * volvió, cuando el evento se juzgó con la vigente, o cuando el tambo nunca
 * cambió sus parámetros —que es el caso de casi todos—.
 */
function reglasDistintas(
  evento: EventoHistorial,
  versiones: VersionDeConfig[] | null,
): string | null {
  if (versiones === null || versiones.length === 0) return null;
  const vigente = versiones[0];
  if (vigente === undefined) return null;
  if (evento.configuracion_id === null || evento.configuracion_id === vigente.id) return null;

  const suya = versiones.find((v) => v.id === evento.configuracion_id);
  if (suya === undefined) return null;

  const diferencias = diferenciasDeConfig(suya.config, vigente.config);
  return diferencias.length === 0 ? null : diferencias.join('; ');
}

// ── El historial, filtrable por tipo ─────────────────────────────────────────
//
// Cuatro grupos y no once tipos: lo que se busca en un historial es "cuándo
// parió" o "cuántas veces la inseminaron", y para eso los tres tipos de tacto y
// el celo son una sola pregunta —cómo viene el ciclo—. Once chips serían tres
// renglones de pantalla arriba de la línea de tiempo que se vino a leer.
//
// Los que no están en ningún grupo —el alta, el aborto, el secado, la baja y la
// anulación— **no desaparecen**: son los que se ven cuando no hay ningún chip
// puesto, que es como abre la ficha. Un chip filtra y soltarlo devuelve la línea
// de tiempo entera; por eso acá sí se usa el componente `Chips` y no el marcado
// de los atajos de fecha.
type GrupoDeEventos = 'parto' | 'inseminacion' | 'celo' | 'control';

const GRUPOS: Record<GrupoDeEventos, { rotulo: string; tipos: readonly TipoEvento[] }> = {
  parto: { rotulo: 'Partos', tipos: ['parto'] },
  inseminacion: { rotulo: 'Inseminaciones', tipos: ['inseminacion'] },
  celo: { rotulo: 'Celos y tactos', tipos: ['celo', 'tacto_positivo', 'tacto_negativo'] },
  control: { rotulo: 'Controles', tipos: ['control_lechero'] },
};

const OPCIONES_DE_TIPO: readonly Opcion<GrupoDeEventos>[] = (
  Object.keys(GRUPOS) as GrupoDeEventos[]
).map((valor) => ({ valor, rotulo: GRUPOS[valor].rotulo }));

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

  // Las reglas con las que se juzgó cada evento. Es **un pedido para todo el
  // historial** y no uno por renglón: la respuesta trae las versiones enteras y
  // el evento trae el id de la suya. Si no vuelve, el historial se dibuja igual
  // sin esa línea — es un dato al lado, no lo que se vino a mirar.
  const traerReglas = useCallback(() => api.configuraciones(est), [est]);
  const reglas = usarPedido(traerReglas);

  // El filtrado es **en el cliente** sobre los eventos que ya están cargados:
  // `GET /animales/:id/eventos` devuelve el log entero con su `tipo`, así que un
  // pedido por chip sería un viaje para pedir lo que ya está en memoria.
  const [grupo, setGrupo] = useState<GrupoDeEventos | null>(null);

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
  //
  // Se calcula sobre **todos** los eventos y no sobre los que se están viendo:
  // qué se puede anular no puede depender de qué chip está puesto.
  const ultimoVigente = puedeCargar
    ? [...datos.eventos].reverse().find((e) => e.vigente)
    : undefined;

  const mostrados =
    grupo === null
      ? datos.eventos
      : datos.eventos.filter((e) => GRUPOS[grupo].tipos.includes(e.tipo));

  return (
    // La cuenta del título es la de lo que se está mostrando y no la del log
    // entero: un "(12)" arriba de tres renglones se lee como que faltan nueve.
    <Tarjeta titulo={`El historial (${numero(mostrados.length)})`}>
      {/* El chip filtra y nada más: **no reordena, no agrupa y no pagina**. El
          historial es una línea de tiempo, se lee de arriba abajo y es lo
          segundo que se mira siempre. */}
      {datos.eventos.length > 0 && (
        <Chips
          etiqueta="Filtrar el historial por tipo"
          opciones={OPCIONES_DE_TIPO}
          elegida={grupo}
          alElegir={setGrupo}
        />
      )}

      {datos.eventos.length === 0 && <p className="vacio">Sin eventos cargados.</p>}

      {/* Cero resultados se dice con una frase y no con una lista en blanco, que
          se leería como que la tarjeta no cargó. Y se distingue del vacío de
          arriba: "no hay ninguno" y "no hay ninguno de ese tipo" son cosas
          distintas, y de la segunda se sale soltando el chip. */}
      {datos.eventos.length > 0 && mostrados.length === 0 && (
        <p className="vacio">
          Ningún evento de ese tipo. Soltá el chip para ver el historial entero.
        </p>
      )}

      {mostrados.length > 0 && (
        <ul className="lista-simple historial">
          {[...mostrados].reverse().map((evento) => (
            <EventoDelLog
              key={evento.id}
              evento={evento}
              animalId={animalId}
              anulable={evento.id === ultimoVigente?.id}
              alAnular={alAnular}
              versiones={reglas.datos?.configuraciones ?? null}
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
  versiones,
}: {
  evento: EventoHistorial;
  animalId: string;
  anulable: boolean;
  alAnular: () => void;
  /** El historial de reglas del tambo, o null si ese pedido no volvió. */
  versiones: VersionDeConfig[] | null;
}) {
  const anulado = evento.anulado_por !== null;
  const esAnulacion = evento.tipo === 'anulacion';
  const detalle = detallePayload(evento.tipo, evento.payload);
  const otrasReglas = reglasDistintas(evento, versiones);

  // ── Cuándo se cargó, y solo cuando no es cuándo pasó ───────────────────────
  //
  // El renglón decía cuándo **pasó** el evento y nunca cuándo se **cargó**, con
  // `fecha_registro` llegando en cada evento y ninguna pantalla mirándola. El
  // atajo "Ayer" existe precisamente porque se cargan tarde: el celo que se vio
  // al caer la tarde se anota a la mañana siguiente. Cuando alguien revisa el
  // historial y no entiende por qué una vaca no estaba en la lista de esa
  // mañana, esta es la respuesta.
  //
  // Aparece **solo cuando las dos fechas difieren**, que es la misma forma que
  // ya tiene la marca de "otras reglas": habla cuando hay algo que decir y se
  // calla en los demás casos, que son casi todos. Escribir "cargado el mismo
  // día" en cuarenta renglones taparía los dos que importan.
  //
  // `fecha_registro` es un instante ISO y se corta en el día, como el
  // `vigente_desde` del historial de reglas: es el día en UTC y no el de
  // Montevideo, pero abrirlo con `new Date` para corregir tres horas traería el
  // parser que las decisiones 47 y 52 sacaron de todo el archivo.
  const diaDeCarga = evento.fecha_registro.slice(0, 10);
  const cargadoOtroDia = diaDeCarga !== '' && diaDeCarga !== evento.fecha_evento;

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
      {otrasReglas !== null && <span className="marca forzado">otras reglas</span>}
      {cargadoOtroDia && <span className="marca">cargado el {fechaCorta(diaDeCarga)}</span>}
      {detalle !== null && <span className="renglon">{detalle}</span>}
      {otrasReglas !== null && (
        <span className="renglon aviso-suave">
          Cuando se cargó, el tambo tenía otros parámetros — {otrasReglas}.
        </span>
      )}
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
