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
// el que el desplegable dice. Quién está INSEMINADA lo decidió el núcleo cuatro
// capas más abajo.
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
import { usarEstablecimiento } from '../establecimiento';
import {
  CATEGORIA,
  ORDEN_CATEGORIAS,
  PRODUCTIVO,
  REPRODUCTIVO,
  categoria as etiquetaCategoria,
  fechaCorta,
} from '../formato';
import { aCorrida } from '../ruteo';
import { usarPedido } from '../usarPedido';

/** El valor de un desplegable sin elegir. No es un estado: es "no filtres". */
const TODOS = '';

export function Rodeo() {
  const { id, puedeCargar } = usarEstablecimiento();
  const [conBajas, setConBajas] = useState(false);
  const traer = useCallback(() => api.animales(id, conBajas), [id, conBajas]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  const [busqueda, setBusqueda] = useState('');
  const [reproductivo, setReproductivo] = useState<EstadoReproductivo | ''>(TODOS);
  const [productivo, setProductivo] = useState<EstadoProductivo | ''>(TODOS);
  const [categoria, setCategoria] = useState<CategoriaAlimentacion | ''>(TODOS);

  const todas = datos?.animales;
  const filtradas = useMemo(() => {
    if (todas === undefined) return [];
    // La búsqueda es por **coincidencia parcial** y no por igualdad: el tambero
    // escribe "10" para ver la 101, la 102 y la 150, que es como se busca cuando
    // uno no se acuerda del número entero.
    const texto = busqueda.trim().toLowerCase();
    return todas.filter(
      (a) =>
        (texto === '' || (a.caravana ?? '').toLowerCase().includes(texto)) &&
        (reproductivo === TODOS || a.reproductivo === reproductivo) &&
        (productivo === TODOS || a.productivo === productivo) &&
        (categoria === TODOS || a.categoria === categoria),
    );
  }, [todas, busqueda, reproductivo, productivo, categoria]);

  if (cargando) return <Cargando que="Trayendo el rodeo…" />;
  if (error !== null || datos === null) {
    return <TarjetaCaida titulo="El rodeo" error={error} reintentar={recargar} />;
  }

  const hayFiltro =
    busqueda.trim() !== '' || reproductivo !== TODOS || productivo !== TODOS || categoria !== TODOS;

  return (
    <>
      <Tarjeta titulo="Buscar en el rodeo">
        <label className="campo">
          <span>Caravana</span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            // `inputMode` numérico levanta el teclado de números en el celular
            // sin impedir una caravana con letras, que las hay.
            inputMode="numeric"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Escribí un número"
          />
        </label>

        <div className="dos-columnas">
          <label className="campo">
            <span>Reproductivo</span>
            <select
              value={reproductivo}
              onChange={(e) => setReproductivo(e.target.value as EstadoReproductivo | '')}
            >
              <option value={TODOS}>Todas</option>
              {(Object.keys(REPRODUCTIVO) as EstadoReproductivo[]).map((estado) => (
                <option key={estado} value={estado}>
                  {REPRODUCTIVO[estado]}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            <span>Productivo</span>
            <select
              value={productivo}
              onChange={(e) => setProductivo(e.target.value as EstadoProductivo | '')}
            >
              <option value={TODOS}>Todas</option>
              {(Object.keys(PRODUCTIVO) as EstadoProductivo[]).map((estado) => (
                <option key={estado} value={estado}>
                  {PRODUCTIVO[estado]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="campo">
          <span>Categoría de alimentación</span>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaAlimentacion | '')}
          >
            <option value={TODOS}>Todas</option>
            {ORDEN_CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="casilla">
          <input
            type="checkbox"
            checked={conBajas}
            onChange={(e) => setConBajas(e.target.checked)}
          />
          <span>Mostrar también las de baja</span>
        </label>
      </Tarjeta>

      {/* La corrida sobre el rodeo entero. **Todavía no se lleva los filtros de
          arriba**: la lista que recorre son todas las activas, y adentro se
          busca por caravana, que es como se encuentra a la que está en la manga.
          Pasarle el filtro puesto es de la Parte 4, cuando estos tres
          desplegables sean chips y haya un filtro que valga la pena viajar. */}
      {puedeCargar && (
        <a className="boton ancho" href={aCorrida('rodeo')}>
          Cargarle lo mismo a varias
        </a>
      )}

      <Tarjeta
        titulo={`${filtradas.length} de ${datos.animales.length}`}
        subtitulo={`El rodeo al ${fechaCorta(datos.fecha)}.`}
      >
        {filtradas.length === 0 ? (
          <p className="vacio">
            {hayFiltro
              ? 'Ningún animal con esos filtros. Probá borrando alguno.'
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
