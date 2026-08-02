// El marco que todas las pantallas comparten: la barra de arriba y el cuerpo.
//
// Existe porque hasta la Parte 2 había una sola pantalla y el `div.app` estaba
// copiado tres veces en `App.tsx` — con tres pantallas más eso se convierte en
// tres encabezados que se despegan. Acá adentro no hay nada que sepa de vacas:
// un título, una vuelta opcional y lo que le pongan adentro.

import { useEffect, useRef, type ReactNode } from 'react';
import { usarCamino } from '../ruteo';

export function Armazon({
  titulo,
  volverA,
  ancha = false,
  children,
}: {
  titulo: string;
  /** Si viene, la flecha de volver apunta ahí. El tablero no lleva ninguna. */
  volverA?: string;
  /**
   * Esta pantalla **se mira sentado** y no en el corral: el rodeo entero, la
   * ficha, el tanque con su período, el panel del admin. Ahí la columna de 720 px
   * deja un monitor vacío a los costados, y las listas se pueden acomodar en
   * varias columnas en vez de una sola larguísima.
   *
   * Las de **carga** no la llevan, y no es un olvido: un formulario más ancho
   * solo aleja los campos entre sí y del ojo. Vale también para la corrida, que
   * es una pantalla de carga aunque tenga una lista adentro.
   *
   * **En el celular no cambia nada**: el ancho extra vive detrás de un
   * `min-width` y abajo de eso las dos topan contra el borde de la ventana.
   */
  ancha?: boolean;
  children: ReactNode;
}) {
  // ── Cambiar de pantalla vuelve arriba, y se anuncia ────────────────────────
  //
  // `ir()` escribe el hash y nada más. Como el fragmento no matchea ningún `id`,
  // el browser deja el scroll donde estaba y lo recorta contra el alto de la
  // pantalla nueva: bajás cuarenta filas del rodeo, tocás una vaca, y la ficha
  // aparece scrolleada por la mitad. Tampoco se movía el foco, así que un lector
  // de pantalla no tenía cómo enterarse de que la pantalla cambió — el `<h1>`
  // nuevo se dibujaba y el cursor virtual seguía donde estaba.
  //
  // Esto es **ir arriba**, no reponer el scroll anterior: reponerlo sería la pila
  // de navegación que este repo descarta, y que además nadie tendría que
  // mantener sincronizada con el "atrás" del browser.
  //
  // Cuelga del **camino** y no del hash entero: un `?cat=SECA` que cambia es la
  // misma pantalla con otro dato, y saltar al techo ahí sería castigar cada
  // toque de un filtro.
  const camino = usarCamino();
  const encabezado = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    encabezado.current?.focus();
  }, [camino]);

  return (
    <div className={ancha ? 'app ancha' : 'app'}>
      <header className="encabezado">
        {volverA !== undefined && (
          // Un `<a>` y no un `<button>`: es navegación, y así se puede abrir en
          // otra pestaña y el browser le da el gesto de "atrás" que ya conoce.
          <a className="volver" href={volverA} aria-label="Volver">
            ←
          </a>
        )}
        {/* `tabIndex={-1}` lo hace enfocable **por código y no con Tab**: el
            título no es un control y no tiene que entrar en el recorrido del
            teclado. Es solo para que el foco tenga dónde aterrizar al cambiar de
            pantalla, que es lo que hace que se anuncie. */}
        <h1 ref={encabezado} tabIndex={-1}>
          {titulo}
        </h1>
      </header>
      <main className="contenido">{children}</main>
    </div>
  );
}
