// Las piezas que sí saben de vacas, separadas de `basicos.tsx` a propósito:
// allá está lo que sirve para cualquier app, acá lo que solo sirve para esta.

import { caravanaVisible } from '../formato';
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
  /** Lo que se muestra al lado del número: estado, motivo, lo que la pantalla sepa. */
  detalle?: string;
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
