// Las piezas que sí saben de vacas, separadas de `basicos.tsx` a propósito:
// allá está lo que sirve para cualquier app, acá lo que solo sirve para esta.

import type { ReactNode } from 'react';
import type { EstadoProductivo, EstadoReproductivo, EstadoVida } from '../api/tipos';
import { PRODUCTIVO, REPRODUCTIVO, VIDA, caravanaVisible } from '../formato';
import { aAnimal } from '../ruteo';

/**
 * Una fila de animal que lleva a su ficha.
 *
 * **La caravana es lo que se toca**, y por eso es lo más grande de la fila: en
 * el corral el tambero ya tiene el número en la cabeza —lo lee del animal— y lo
 * que busca en la pantalla es ese mismo número, no un renglón de texto. El
 * `<a>` ocupa la fila entera (60 px de alto) para que el dedo no tenga que
 * apuntar, y es un enlace de verdad para que el "atrás" del celular funcione
 * sin que la app lo programe.
 */
export function FilaAnimal({
  animalId,
  caravana,
  detalle,
}: {
  animalId: string;
  caravana: string | null;
  /** Lo que se muestra al lado del número: estados, categoría, lo que la pantalla sepa. */
  detalle?: ReactNode;
}) {
  return (
    <li>
      <a className="fila" href={aAnimal(animalId)}>
        <span className="caravana">{caravanaVisible(caravana)}</span>
        {detalle !== undefined && <span className="detalle">{detalle}</span>}
        <span className="flecha" aria-hidden="true">
          ›
        </span>
      </a>
    </li>
  );
}

// ── Los estados, dichos con palabra y con color ──────────────────────────────
//
// El color es **redundante y no informativo**: cada etiqueta lleva su texto
// siempre (convención 4 del prompt). En el corral hay sol de frente, la pantalla
// se mira de reojo con una mano ocupada, y buena parte de la población masculina
// —que es la que trabaja en el tambo— distingue mal el rojo del verde. Si algo
// solo se puede leer por el color, no se puede leer.

type Tono = 'verde' | 'ambar' | 'gris' | 'rojo';

/** INSEMINADA en ámbar: es el único de los tres que pide una acción (el tacto). */
const TONO_REPRODUCTIVO: Record<EstadoReproductivo, Tono> = {
  VACIA: 'gris',
  INSEMINADA: 'ambar',
  PRENADA: 'verde',
};

const TONO_PRODUCTIVO: Record<EstadoProductivo, Tono> = {
  SECA: 'gris',
  EN_LACTANCIA: 'verde',
};

const TONO_VIDA: Record<EstadoVida, Tono> = {
  SIN_ALTA: 'gris',
  ACTIVA: 'verde',
  BAJA: 'rojo',
};

export function Etiqueta({ tono, children }: { tono: Tono; children: ReactNode }) {
  return <span className={`etiqueta ${tono}`}>{children}</span>;
}

/**
 * Los dos ejes del animal, más la vida cuando tiene algo que decir.
 *
 * `vida` se muestra **solo si no es ACTIVA**: en el rodeo todas lo son, y una
 * etiqueta "Activa" repetida en cada fila es ruido que le saca lugar a lo que sí
 * cambia. La de baja, en cambio, tiene que gritar — es la que explica por qué
 * ese animal no aparece en ninguna cuenta.
 */
export function EtiquetasDeEstado({
  vida,
  reproductivo,
  productivo,
}: {
  vida: EstadoVida;
  reproductivo: EstadoReproductivo | null;
  productivo: EstadoProductivo | null;
}) {
  return (
    <>
      {vida !== 'ACTIVA' && <Etiqueta tono={TONO_VIDA[vida]}>{VIDA[vida]}</Etiqueta>}
      {reproductivo !== null && (
        <Etiqueta tono={TONO_REPRODUCTIVO[reproductivo]}>{REPRODUCTIVO[reproductivo]}</Etiqueta>
      )}
      {productivo !== null && (
        <Etiqueta tono={TONO_PRODUCTIVO[productivo]}>{PRODUCTIVO[productivo]}</Etiqueta>
      )}
    </>
  );
}
