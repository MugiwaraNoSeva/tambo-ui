// ─────────────────────────────────────────────────────────────────────────────
// El rodeo entero: la lista de la que se sale hacia cualquier ficha.
//
// **Se pide una vez y se filtra en el cliente** (decisión 58). El endpoint no
// pagina ni filtra a propósito —decisión 53—, así que un rodeo son unos cientos
// de filas chicas que entran de sobra en memoria; buscar una caravana contra el
// servidor sería un viaje por cada tecla, y en el corral el viaje es lo caro.
// Escribir "10" y ver la lista achicarse mientras se tipea es la diferencia
// entre encontrar la vaca y no encontrarla.
//
// Los filtros no saben nada de dominio: comparan el estado que la fila trae con
// el que el chip dice. Quién está INSEMINADA lo decidió el núcleo cuatro capas
// más abajo. La cuenta vive en `filtros.ts` porque **la corrida la hereda**.
//
// Desde la remodelación son **chips y no desplegables**. Un `select` en el
// celular son tres toques —abrir, elegir, confirmar—, tapa la pantalla mientras
// está abierto, y los tres apilados empujaban la primera fila abajo del borde:
// había que scrollear para ver una vaca. Con chips, filtrar es un toque y lo que
// está puesto se ve sin abrir nada.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo, useState } from 'react';
import { api } from '../api/cliente';
import type {
  CategoriaAlimentacion,
  EstadoProductivo,
  EstadoReproductivo,
  FilaAnimal as Fila,
} from '../api/tipos';
import { EtiquetasDeEstado, FilaAnimal } from '../componentes/animales';
import { Cargando, Tarjeta, TarjetaCaida } from '../componentes/basicos';
import { Campo, Casilla, Chips, type Opcion } from '../componentes/formulario';
import { usarEstablecimiento } from '../establecimiento';
import {
  SIN_FILTROS,
  aParametros,
  enPalabras,
  filtrar,
  hayFiltro,
  type Filtros,
} from '../filtros';
import {
  CATEGORIA,
  ORDEN_CATEGORIAS,
  PRODUCTIVO,
  REPRODUCTIVO,
  categoria as etiquetaCategoria,
  fechaCorta,
} from '../formato';
import { aCorrida, aRodeo } from '../ruteo';
import { usarPedido } from '../usarPedido';

// Las tres listas de chips, armadas del vocabulario y no a mano: agregar un
// estado del otro lado tiene que aparecer acá sin que nadie se acuerde.
const REPRODUCTIVOS: readonly Opcion<EstadoReproductivo>[] = (
  Object.keys(REPRODUCTIVO) as EstadoReproductivo[]
).map((valor) => ({ valor, rotulo: REPRODUCTIVO[valor] }));

const PRODUCTIVOS: readonly Opcion<EstadoProductivo>[] = (
  Object.keys(PRODUCTIVO) as EstadoProductivo[]
).map((valor) => ({ valor, rotulo: PRODUCTIVO[valor] }));

const CATEGORIAS: readonly Opcion<CategoriaAlimentacion>[] = ORDEN_CATEGORIAS.map((valor) => ({
  valor,
  rotulo: CATEGORIA[valor],
}));

export function Rodeo() {
  const { id, puedeCargar } = usarEstablecimiento();
  const [conBajas, setConBajas] = useState(false);
  const traer = useCallback(() => api.animales(id, conBajas), [id, conBajas]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const cambiar = <C extends keyof Filtros>(cual: C, valor: Filtros[C]) =>
    setFiltros((antes) => ({ ...antes, [cual]: valor }));

  const todas = datos?.animales;
  const filtradas = useMemo(
    () => (todas === undefined ? [] : filtrar(todas, filtros)),
    [todas, filtros],
  );

  if (cargando) return <Cargando que="Trayendo el rodeo…" />;
  if (error !== null || datos === null) {
    return <TarjetaCaida titulo="El rodeo" error={error} reintentar={recargar} />;
  }

  const puestos = enPalabras(filtros);

  return (
    <>
      <Tarjeta titulo="Buscar en el rodeo">
        <Campo etiqueta="Caravana">
          <input
            value={filtros.busqueda}
            onChange={(e) => cambiar('busqueda', e.target.value)}
            // `inputMode` numérico levanta el teclado de números en el celular
            // sin impedir una caravana con letras, que las hay.
            inputMode="numeric"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Escribí un número"
          />
        </Campo>

        <h3>Reproductivo</h3>
        <Chips
          etiqueta="Reproductivo"
          opciones={REPRODUCTIVOS}
          elegida={filtros.reproductivo}
          alElegir={(v) => cambiar('reproductivo', v)}
        />

        <h3>Productivo</h3>
        <Chips
          etiqueta="Productivo"
          opciones={PRODUCTIVOS}
          elegida={filtros.productivo}
          alElegir={(v) => cambiar('productivo', v)}
        />

        <h3>Categoría de alimentación</h3>
        <Chips
          etiqueta="Categoría de alimentación"
          opciones={CATEGORIAS}
          elegida={filtros.categoria}
          alElegir={(v) => cambiar('categoria', v)}
        />

        <Casilla
          etiqueta="Mostrar también las de baja"
          marcada={conBajas}
          alCambiar={setConBajas}
        />

        {/* Qué está filtrado, dicho en palabras y con una salida de un toque. Los
            chips ya lo muestran, pero con tres grupos y once opciones hay que
            barrer la pantalla para encontrar los dos que están puestos — y el
            caso que importa es el de la lista vacía, donde lo primero que hay que
            saber es qué se está filtrando. */}
        {puestos.length > 0 && (
          <div className="filtros-puestos">
            <p className="renglon">Filtrando por {puestos.join(' · ')}.</p>
            <button
              className="boton secundario chico"
              type="button"
              onClick={() => setFiltros(SIN_FILTROS)}
            >
              Quitar los filtros
            </button>
          </div>
        )}
      </Tarjeta>

      {/* La corrida se lleva los filtros puestos: quien filtró "en ordeñe" y toca
          acá recorre esas y no el rodeo entero, así que el contador dice la
          verdad. Las de baja **no** viajan: a un animal de baja no se le carga
          nada, y una corrida con ellas adentro terminaría en un rechazo por fila. */}
      {puedeCargar && filtradas.length > 0 && (
        <a className="boton ancho" href={aCorrida('rodeo', aParametros(filtros))}>
          Cargarle lo mismo a {filtradas.length === 1 ? 'esta' : `estas ${filtradas.length}`}
        </a>
      )}

      <Tarjeta
        titulo={`${filtradas.length} de ${datos.animales.length}`}
        subtitulo={`El rodeo al ${fechaCorta(datos.fecha)}.`}
      >
        {filtradas.length === 0 ? (
          <p className="vacio">
            {hayFiltro(filtros)
              ? 'Ningún animal con esos filtros. Probá quitando alguno.'
              : 'El rodeo está vacío. Dale de alta el primer animal.'}
          </p>
        ) : (
          <ul className="lista">
            {filtradas.map((a) => (
              <FilaAnimal
                key={a.animal_id}
                animalId={a.animal_id}
                caravana={a.caravana}
                detalle={<DetalleDeFila animal={a} />}
                desde={aRodeo()}
              />
            ))}
          </ul>
        )}
      </Tarjeta>
    </>
  );
}

function DetalleDeFila({ animal }: { animal: Fila }) {
  return (
    <>
      <span className="etiquetas">
        <EtiquetasDeEstado
          vida={animal.vida}
          reproductivo={animal.reproductivo}
          productivo={animal.productivo}
        />
      </span>
      <span className="renglon">
        {animal.categoria === null ? '' : etiquetaCategoria(animal.categoria)}
        {animal.fecha_ultimo_parto !== null &&
          ` · parió el ${fechaCorta(animal.fecha_ultimo_parto)}`}
      </span>
    </>
  );
}
