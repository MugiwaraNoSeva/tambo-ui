// ─────────────────────────────────────────────────────────────────────────────
// La curva de lactancia, en un `<svg>` escrito a mano.
//
// Es la decisión 51 cumplida: **una** serie de puntos con su pico marcado no
// justifica una librería de charts. Lo que sigue es toda la matemática que hacía
// falta —dos escalas lineales— y se estila con el mismo CSS que el resto, sin
// un segundo modelo de colores en la app.
//
// La curva se lee de izquierda a derecha en **días en leche (DEL)**, no en
// fechas: así dos lactancias de la misma vaca se comparan aunque hayan empezado
// en meses distintos, que es para lo que existe la curva. El `del` lo calcula el
// núcleo y viaja en cada control.
//
// **Un gráfico no es accesible por sí solo**, y este se mira al sol con el
// celular en una mano: por eso el `aria-label` cuenta la curva en palabras, y
// los números que importan —pico y acumulada— van afuera como cifras de texto,
// no dentro del dibujo. Quien no pueda ver el SVG no se pierde ningún dato.
// ─────────────────────────────────────────────────────────────────────────────

import type { ControlLechero } from '../api/tipos';
import { litros, numero } from '../formato';

const ANCHO = 320;
const ALTO = 160;
// Izquierda: entran los litros. Abajo: entra el DEL.
const MARGEN = { arriba: 12, derecha: 10, abajo: 24, izquierda: 34 };

export interface Escala {
  puntos: { x: number; y: number; control: ControlLechero }[];
  /** El DEL más alto de la curva, que es el borde derecho. */
  delMaximo: number;
  /** Litros del borde de arriba, redondeados a un múltiplo de 5 para que la
   *  grilla dé números que se leen. */
  litrosMaximo: number;
}

/**
 * De controles a coordenadas. Se exporta para poder probarlo sin mirar el DOM:
 * lo que puede salir mal acá es la aritmética, no el JSX.
 */
export function escalar(curva: readonly ControlLechero[]): Escala {
  const delMaximo = Math.max(...curva.map((c) => c.del), 1);
  const pico = Math.max(...curva.map((c) => c.litros), 1);
  const litrosMaximo = Math.max(Math.ceil(pico / 5) * 5, 5);

  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;

  return {
    delMaximo,
    litrosMaximo,
    puntos: curva.map((control) => ({
      control,
      x: MARGEN.izquierda + (control.del / delMaximo) * anchoUtil,
      // El eje Y crece hacia arriba y el SVG hacia abajo: de ahí la resta.
      y: ALTO - MARGEN.abajo - (control.litros / litrosMaximo) * altoUtil,
    })),
  };
}

const coord = (n: number): string => n.toFixed(1);

export function CurvaLactancia({
  curva,
  pico,
}: {
  curva: readonly ControlLechero[];
  pico: ControlLechero | null;
}) {
  if (curva.length === 0) {
    return (
      <p className="vacio">
        Todavía no hay controles lecheros en esta lactancia. La curva aparece con el primero.
      </p>
    );
  }

  const { puntos, delMaximo, litrosMaximo } = escalar(curva);
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  if (primero === undefined || ultimo === undefined) return null;

  const mitad = litrosMaximo / 2;
  const yDe = (l: number) =>
    ALTO - MARGEN.abajo - (l / litrosMaximo) * (ALTO - MARGEN.arriba - MARGEN.abajo);

  const resumen =
    `Curva de lactancia con ${numero(curva.length)} ${curva.length === 1 ? 'control' : 'controles'}, ` +
    `del día ${numero(primero.control.del)} al ${numero(ultimo.control.del)} en leche` +
    (pico === null ? '.' : `, con el pico de ${litros(pico.litros)} al día ${numero(pico.del)}.`);

  return (
    <svg
      className="curva"
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      role="img"
      aria-label={resumen}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* La grilla: tres líneas y sus litros. Más que eso, en un celular al sol,
          es ruido encima del dato. */}
      {[0, mitad, litrosMaximo].map((valor) => (
        <g key={valor}>
          <line
            className="grilla"
            x1={MARGEN.izquierda}
            x2={ANCHO - MARGEN.derecha}
            y1={coord(yDe(valor))}
            y2={coord(yDe(valor))}
          />
          <text className="rotulo-eje" x={MARGEN.izquierda - 5} y={yDe(valor) + 3} textAnchor="end">
            {numero(valor)}
          </text>
        </g>
      ))}

      {/* El eje de abajo, en días en leche. */}
      <text className="rotulo-eje" x={primero.x} y={ALTO - 8} textAnchor="middle">
        DEL {numero(primero.control.del)}
      </text>
      {puntos.length > 1 && (
        <text className="rotulo-eje" x={ultimo.x} y={ALTO - 8} textAnchor="end">
          DEL {numero(ultimo.control.del)}
        </text>
      )}

      {puntos.length > 1 && (
        <polyline className="linea" points={puntos.map((p) => `${coord(p.x)},${coord(p.y)}`).join(' ')} />
      )}

      {puntos.map((p) => {
        const esPico = pico !== null && p.control.evento_id === pico.evento_id;
        return (
          <circle
            key={p.control.evento_id}
            className={esPico ? 'punto pico' : 'punto'}
            cx={coord(p.x)}
            cy={coord(p.y)}
            r={esPico ? 5 : 3}
          />
        );
      })}

      {/* El pico dice su número al lado: es el dato que se busca en la curva, y
          buscarlo contando cuadraditos no es buscarlo. */}
      {pico !== null &&
        puntos
          .filter((p) => p.control.evento_id === pico.evento_id)
          .map((p) => (
            <text
              key={`rotulo-${p.control.evento_id}`}
              className="rotulo-pico"
              x={coord(p.x)}
              y={coord(Math.max(p.y - 10, 10))}
              textAnchor="middle"
            >
              {litros(pico.litros)}
            </text>
          ))}
    </svg>
  );
}
