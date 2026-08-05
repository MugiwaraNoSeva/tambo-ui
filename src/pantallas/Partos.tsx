// ─────────────────────────────────────────────────────────────────────────────
// Los partos y las lactancias de un animal.
//
// Existe porque `api.lactancias` traía por lactancia las crías, el pico, el
// promedio de controles, el RCS máximo, la acumulada y la estandarizada a 305
// días, y la ficha usaba **la curva y el pico de una sola** —de las anteriores,
// un renglón con la acumulada—. El resto llegaba y se tiraba, y
// `LactanciaConNumeros` era un tipo exportado que nadie consumía entero.
//
// Es una pantalla y no una tarjeta más larga por dos motivos que apuntan al
// mismo lado: son seis cifras y una curva **por lactancia**, así que una vaca de
// cinco partos no entra en ninguna tarjeta; y esto no se mira en el corral, se
// mira sentado. Por eso lleva `ancha`, como el rodeo y la ficha.
//
// El pedido sigue siendo **diferido** igual que antes: lo hace esta pantalla al
// montarse, en vez del plegable de la ficha al abrirse. La ficha sigue pagando
// tres lecturas y no cuatro, que era la cuenta de la remodelación.
//
// Nada de acá calcula nada: los seis números los sirve el núcleo, y los que
// vienen `null` se dicen "sin datos" y no cero (decisión 37).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { api } from '../api/cliente';
import type { LactanciaConNumeros } from '../api/tipos';
import { Armazon } from '../componentes/armazon';
import { Aviso, Cargando, Cifra, Tarjeta, TarjetaCaida } from '../componentes/basicos';
import { CurvaLactancia } from '../componentes/CurvaLactancia';
import { usarEstablecimiento } from '../establecimiento';
import { DISTOCIA, condicion, crias, fechaCorta, litros, numero } from '../formato';
import { aAnimal, usarCaravanaDelHash, usarVuelta } from '../ruteo';
import { usarPedido } from '../usarPedido';

export function Partos({ id }: { id: string }) {
  const { id: est } = usarEstablecimiento();
  const vuelta = usarVuelta(aAnimal(id));
  // La caravana viaja en la dirección, como en la carga. Si no viene —un enlace
  // pelado, un favorito viejo— el título es genérico y **no se pide el animal**:
  // acá el encabezado es el título de una lectura y no dice a quién se le está
  // por cargar algo, así que un viaje por él no se paga.
  const caravana = usarCaravanaDelHash();

  const traer = useCallback(() => api.lactancias(est, id), [est, id]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  const titulo = caravana === undefined ? 'Partos y lactancias' : `${caravana} — partos`;

  return (
    <Armazon titulo={titulo} volverA={vuelta} ancha>
      {cargando && <Cargando que="Trayendo las lactancias…" />}

      {!cargando && (error !== null || datos === null) && (
        <TarjetaCaida titulo="Partos y lactancias" error={error} reintentar={recargar} />
      )}

      {!cargando && datos !== null && error === null && datos.lactancias.length === 0 && (
        <Tarjeta titulo="Partos y lactancias">
          <p className="vacio">Este animal todavía no tuvo ninguna lactancia.</p>
        </Tarjeta>
      )}

      {/* De la última a la primera, que es el mismo orden que el historial y por
          el mismo motivo: lo que se viene a mirar es la que está en curso. */}
      {!cargando &&
        datos !== null &&
        error === null &&
        [...datos.lactancias]
          .reverse()
          .map((l) => <UnaLactancia key={l.numero} lactancia={l} />)}
    </Armazon>
  );
}

function UnaLactancia({ lactancia: l }: { lactancia: LactanciaConNumeros }) {
  const enCurso = l.fecha_fin === null;

  return (
    <Tarjeta
      titulo={
        <>
          Lactancia {numero(l.numero)}
          {enCurso && <span className="cuanto"> (en curso)</span>}
        </>
      }
      subtitulo={
        enCurso
          ? `Empezó el ${fechaCorta(l.fecha_inicio)} con el parto.`
          : `Del ${fechaCorta(l.fecha_inicio)} al ${fechaCorta(l.fecha_fin)}.`
      }
    >
      {/* Va arriba de todo y no al pie: si la fecha de inicio no es confiable,
          tampoco lo son los días en leche, que es el eje de la curva que sigue.
          Leer el aviso después del dibujo sería enterarse tarde.

          **Son dos avisos y no uno desde la decisión 110**, y la diferencia es
          justamente la que esa decisión separó: `datos_incompletos` dice que el
          payload del parto puede estar a medias, y `fecha_incierta` que lo que no
          cierra es la fecha. Solo el segundo se lleva puesta la curva. Un parto
          de monta forzado tiene una fecha perfectamente confiable —la vieron
          parir— y mostrar ahí "los días en leche no son confiables" sería repetir
          el error que la 110 vino a arreglar, ahora del lado de la pantalla. */}
      {l.fecha_incierta ? (
        <Aviso tono="atencion" titulo="La fecha del parto no es confiable">
          Lo que se forzó al cargarlo pone en duda la fecha, y con ella los días en leche que son
          el eje de la curva.
        </Aviso>
      ) : (
        l.datos_incompletos && (
          <Aviso tono="atencion" titulo="Datos incompletos">
            La abrió un parto cargado con "confirmar igual", así que su ciclo queda afuera de los
            indicadores. La fecha sí es confiable: la curva se lee normal.
          </Aviso>
        )
      )}

      <CurvaLactancia curva={l.curva} pico={l.pico} />

      <div className="cifras">
        <Cifra rotulo="Pico" valor={litros(l.pico?.litros ?? null)} />
        <Cifra rotulo="Al día en leche" valor={numero(l.pico?.del ?? null)} />
        <Cifra rotulo="Promedio por control" valor={litros(l.promedio_controles)} />
        <Cifra rotulo="Acumulada" valor={litros(l.acumulada, 0)} />
        <Cifra rotulo="A 305 días" valor={litros(l.estandarizada_305, 0)} />
        <Cifra rotulo="RCS máximo" valor={numero(l.rcs_maximo)} />
      </div>

      {/* El equivalente maduro va **aparte y con su factor al lado** (decisión
          105). Aparte, porque contesta otra pregunta: "a 305 días" compara vacas
          de la misma lactancia y esta compara **entre** lactancias — es la que
          permite mirar a una vaquillona y a una vaca hecha en la misma columna,
          que es lo que decide descartes.

          Y con el factor a la vista porque un número que se multiplicó por 1,32
          tiene que poder decir por qué: sin él, la primera lactancia de una
          vaquillona aparece treinta por ciento más alta que la real y nadie sabe
          de dónde salió. */}
      {l.equivalente_maduro_305 !== null && (
        <>
          <h3>Comparada con una vaca madura</h3>
          <div className="cifras">
            <Cifra rotulo="Equivalente maduro" valor={litros(l.equivalente_maduro_305, 0)} />
            <Cifra rotulo="Factor aplicado" valor={numero(l.factor_madurez, 2)} />
          </div>
        </>
      )}

      {/* El parto que la abrió. La fecha es la de inicio de la lactancia —son el
          mismo hecho— y las crías vienen con la lactancia, así que esto no cuesta
          un pedido más. Cuando el parto no las declaró, no se inventa un renglón:
          se dice que no se sabe cuántas fueron. */}
      <h3>El parto que la abrió</h3>
      <ul className="lista-simple">
        <li>
          <strong>{fechaCorta(l.fecha_inicio)} — Parto</strong>
          <span className="renglon">
            {l.crias.length === 0 ? 'Sin crías declaradas.' : crias(l.crias)}
          </span>
          {/* Cuánta ayuda necesitó (107) y con qué cuerpo llegó (108). Van juntas
              porque contestan lo mismo —cómo entró a esta lactancia— y juntas
              explican los días abiertos que vienen después. Ninguna se inventa:
              la distocia sin declarar y la condición sin medir no dicen nada. */}
          {l.distocia !== null && (
            <span className="renglon">Ayuda al parir: {DISTOCIA[l.distocia].toLowerCase()}</span>
          )}
          {l.condicion_al_parto !== null && (
            <span className="renglon">
              Condición corporal al parto: {condicion(l.condicion_al_parto)}
            </span>
          )}
        </li>
      </ul>
    </Tarjeta>
  );
}
