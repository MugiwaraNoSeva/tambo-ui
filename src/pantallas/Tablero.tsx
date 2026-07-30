// ─────────────────────────────────────────────────────────────────────────────
// El tablero: la mañana del tambero.
//
// El orden de las tarjetas es el orden de la mañana y no el de los endpoints:
// **primero lo que hay que hacer** (las dos listas de trabajo, que son animales
// concretos esperando en el corral), después cómo viene el rodeo, y último el
// tanque, que se carga cuando termina el ordeñe. Un tablero que arranque con la
// composición se lee como un informe; este tiene que leerse como una lista de
// tareas.
//
// Cada tarjeta hace **su propio pedido y falla sola** (decisión 56): son tres
// lecturas independientes y en el corral la señal se cae de a ratos, así que
// una que no vuelva no puede llevarse puesta la pantalla entera. Lo que se
// pierde es una tarjeta con su "reintentar", no la mañana.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { api } from '../api/cliente';
import type { AnimalDeLista } from '../api/tipos';
import { FilaAnimal } from '../componentes/animales';
import { Aviso, Cargando, Cifra, Tarjeta, TarjetaCaida } from '../componentes/basicos';
import { usarEstablecimiento } from '../establecimiento';
import { CATEGORIA, ORDEN_CATEGORIAS, dias, fechaCorta, litros, numero, porcentaje } from '../formato';
import { aAlta, aRodeo, aTanque } from '../ruteo';
import { usarPedido } from '../usarPedido';

export function Tablero() {
  // El de `lectura` ve el mismo tablero —las listas de trabajo, el rodeo y el
  // tanque son para mirar— menos las puertas de carga, que no están: mejor que
  // no estén a que estén y fallen (§ el rol de lectura, en el README).
  const { puedeCargar } = usarEstablecimiento();

  return (
    <>
      <ListasDeTrabajo />
      <ElRodeoHoy />
      <ElTanqueDeHoy />
      <div className="acciones">
        <a className="boton secundario" href={aRodeo()}>
          Ver el rodeo entero
        </a>
        {puedeCargar && (
          <a className="boton secundario" href={aAlta()}>
            Dar de alta
          </a>
        )}
      </div>
    </>
  );
}

// ── Las dos listas de trabajo ────────────────────────────────────────────────

/**
 * Las dos listas salen de **un solo** `GET /alertas` y se dibujan en dos
 * tarjetas: es una lectura y dos tareas distintas, y separarlas en dos pedidos
 * sería pagar dos viajes por el mismo dato.
 */
function ListasDeTrabajo() {
  const { id } = usarEstablecimiento();
  const traer = useCallback(() => api.alertas(id), [id]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  if (cargando) {
    return (
      <Tarjeta titulo="El trabajo de hoy">
        <Cargando que="Buscando las listas de hoy…" />
      </Tarjeta>
    );
  }

  if (error !== null || datos === null) {
    return <TarjetaCaida titulo="El trabajo de hoy" error={error} reintentar={recargar} />;
  }

  return (
    <>
      <ListaDeTrabajo
        titulo="Para revisar"
        subtitulo="Inseminadas que ya pasaron el plazo y siguen sin diagnóstico."
        animales={datos.para_revisar}
        vacia="Ninguna para revisar: las inseminadas tienen su tacto al día."
      />
      <ListaDeTrabajo
        titulo="Para secar"
        subtitulo="Preñadas que ya tendrían que estar secas y siguen en ordeñe."
        animales={datos.para_secar}
        vacia="Ninguna para secar."
      />
    </>
  );
}

/**
 * Una lista de trabajo. Cuando está vacía **lo dice con una frase completa** y
 * no con un hueco: en el tablero de la mañana, "ninguna" es la respuesta a una
 * pregunta que el tambero se hizo, y un espacio en blanco se lee como que la
 * pantalla no cargó.
 */
function ListaDeTrabajo({
  titulo,
  subtitulo,
  animales,
  vacia,
}: {
  titulo: string;
  subtitulo: string;
  animales: AnimalDeLista[];
  vacia: string;
}) {
  return (
    <Tarjeta titulo={`${titulo} (${animales.length})`} subtitulo={subtitulo}>
      {animales.length === 0 ? (
        <p className="vacio">{vacia}</p>
      ) : (
        <ul className="lista">
          {animales.map((a) => (
            <FilaAnimal key={a.animal_id} animalId={a.animal_id} caravana={a.caravana} />
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

// ── La composición del rodeo ─────────────────────────────────────────────────

function ElRodeoHoy() {
  const { id } = usarEstablecimiento();
  const traer = useCallback(() => api.rodeo(id), [id]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  if (cargando) {
    return (
      <Tarjeta titulo="El rodeo hoy">
        <Cargando que="Contando el rodeo…" />
      </Tarjeta>
    );
  }

  if (error !== null || datos === null) {
    return <TarjetaCaida titulo="El rodeo hoy" error={error} reintentar={recargar} />;
  }

  const r = datos.resumen;
  const c = r.composicion;

  return (
    <Tarjeta titulo="El rodeo hoy" subtitulo={`Al ${fechaCorta(datos.fecha)}`}>
      <div className="cifras">
        <Cifra rotulo="Activas" valor={numero(c.activas)} />
        <Cifra rotulo="En ordeñe" valor={numero(c.en_ordene)} />
        <Cifra rotulo="Secas" valor={numero(c.secas)} />
        <Cifra rotulo="Vacías" valor={numero(c.vacias)} />
        <Cifra rotulo="Inseminadas" valor={numero(c.inseminadas)} />
        <Cifra rotulo="Preñadas" valor={numero(c.prenadas)} />
      </div>

      <h3>Cómo viene</h3>
      <div className="cifras">
        {/* Preñadas sobre activas: la foto del stock, que se mueve despacio. No
            es la tasa de preñez de 21 días de la literatura, y por eso el
            rótulo dice "del rodeo" — el núcleo las llama distinto a propósito. */}
        <Cifra rotulo="Preñez del rodeo" valor={porcentaje(r.porcentaje_prenez)} />
        <Cifra rotulo="Días abiertos" valor={dias(r.dias_abiertos_promedio)} />
        <Cifra rotulo="Entre partos" valor={dias(r.intervalo_entre_partos_promedio)} />
        <Cifra rotulo="Descarte" valor={porcentaje(r.tasa_descarte)} />
        <Cifra rotulo="Mortalidad" valor={porcentaje(r.tasa_mortalidad)} />
      </div>

      <h3>El reparto de dietas</h3>
      <ul className="reparto">
        {ORDEN_CATEGORIAS.map((categoria) => (
          <li key={categoria}>
            <span>{CATEGORIA[categoria]}</span>
            <span className="cuenta">{numero(r.categorias[categoria])}</span>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

// ── El tanque ────────────────────────────────────────────────────────────────

/**
 * El tanque de hoy.
 *
 * Pide `GET /tanque` **sin período**, y no es un descuido: para acotarlo haría
 * falta saber qué día es hoy, que es justamente lo que se está preguntando. Con
 * la fecha del celular el borde podría caer un día corrido —el reloj del corral
 * miente, y decisión 52— y la pantalla diría "falta cargar el tanque" con el
 * tanque cargado, que es la peor forma de equivocarse: manda a cargar de nuevo
 * algo que la API va a rechazar por duplicado. Sin período la respuesta trae su
 * propio `fecha`, que es el día del servidor, y con ese se busca el registro.
 *
 * El costo es que viajan todos los registros del tambo. Se revisa cuando eso
 * moleste —un par de años de carga diaria— o el día que la API pagine.
 */
function ElTanqueDeHoy() {
  const { id, puedeCargar } = usarEstablecimiento();
  const traer = useCallback(() => api.tanque(id), [id]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  if (cargando) {
    return (
      <Tarjeta titulo="El tanque de hoy">
        <Cargando que="Mirando el tanque…" />
      </Tarjeta>
    );
  }

  if (error !== null || datos === null) {
    return <TarjetaCaida titulo="El tanque de hoy" error={error} reintentar={recargar} />;
  }

  // Solo el registro sin lote es el total del tambo (decisión 33): el desglose
  // por lote convive con él y sumarlos contaría dos veces.
  const deHoy = datos.registros.find((r) => r.fecha === datos.fecha && (r.lote ?? null) === null);

  return (
    <Tarjeta titulo="El tanque de hoy" subtitulo={fechaCorta(datos.fecha)}>
      <div className="cifras">
        <Cifra rotulo="Litros del día" valor={litros(deHoy?.litros ?? null, 0)} />
        <Cifra rotulo="Por vaca en ordeñe" valor={litros(datos.litros_por_vaca_en_ordene)} />
      </div>

      {/* Al de lectura no se le reclama que cargue el tanque: no puede, y el
          aviso sería un reto por algo que no está en sus manos. Ve el número y
          el enlace para mirar el período, como el resto de la pantalla. */}
      {deHoy === undefined && puedeCargar ? (
        <>
          <Aviso tono="atencion" titulo="Todavía no cargaste el tanque">
            Un día sin cargar no baja el promedio: desaparece de la cuenta del mes.
          </Aviso>
          <a className="boton ancho" href={aTanque()}>
            Cargar el tanque de hoy
          </a>
        </>
      ) : (
        <a className="boton ancho secundario" href={aTanque()}>
          Ver el tanque
        </a>
      )}
    </Tarjeta>
  );
}
