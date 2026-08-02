// El marco que todas las pantallas comparten: la barra de arriba, el cuerpo, y
// —en las tres que son un lugar— la barra de abajo.
//
// Existe porque hasta la Parte 2 había una sola pantalla y el `div.app` estaba
// copiado tres veces en `App.tsx` — con tres pantallas más eso se convierte en
// tres encabezados que se despegan. Acá adentro no hay nada que sepa de vacas:
// un título, una vuelta opcional y lo que le pongan adentro.
//
// ── La barra vive en los lugares, no en las tareas ───────────────────────────
//
// Es la regla que ordena toda la navegación y se decide **una vez, acá**:
//
//   · llevan barra y **no** llevan flecha: el tablero, el rodeo y el tanque;
//   · llevan flecha y **no** llevan barra: la ficha, los partos, la carga, el
//     alta, la corrida, mi cuenta, y el panel del admin entero.
//
// Con eso nunca hay que decidir si el "atrás" saca de la pestaña o del
// formulario, y un pulgar sucio no puede abandonar una corrida de veinticinco
// tactos de un toque mal dado. El panel no la lleva a propósito: ahí la
// jerarquía es el punto, y está argumentada por frecuencia en el README.

import { useEffect, useRef, type ReactNode } from 'react';
import { aCuenta, aRodeo, aTablero, aTanque, caminoDe, usarCamino } from '../ruteo';

export function Armazon({
  titulo,
  volverA,
  ancha = false,
  lugar = false,
  children,
}: {
  titulo: string;
  /**
   * Si viene, la flecha de volver apunta ahí.
   *
   * **Es lo contrario de `lugar`**: una pantalla lleva flecha o lleva barra, y
   * nunca las dos. No está impedido por el tipo porque hacerlo obligaría a que
   * cada llamador elija entre dos formas de la misma prop; está escrito acá, que
   * es donde se mira cuando se agrega una pantalla.
   */
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
  /**
   * Esta pantalla es un **lugar** y no una tarea: el tablero, el rodeo y el
   * tanque. Dibuja las dos cosas que marcan un lugar y que son la misma decisión
   * vista de los dos lados —abajo, la barra con las tres secciones; arriba y a la
   * derecha, "Mi cuenta"—.
   *
   * El criterio de arriba es **el inverso** del de abajo, y a propósito: lo que
   * se hace todo el día va en la zona del pulgar, y lo que se hace una vez por
   * turno —cambiar de tambo, salir— va arriba y lejos, donde el dedo no llega
   * solo. Que salir sea incómodo es la idea; hasta acá pesaba exactamente lo
   * mismo que "Dar de alta".
   */
  lugar?: boolean;
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
        {lugar && (
          <a className="cuenta" href={aCuenta()}>
            Mi cuenta
          </a>
        )}
      </header>
      <main className="contenido">{children}</main>
      {lugar && <BarraInferior />}
    </div>
  );
}

/**
 * Las tres secciones, abajo y al alcance del pulgar.
 *
 * **Sin íconos, y no es un olvido.** No hay pictograma que diga "tanque" sin que
 * haya que aprenderlo, no hay una dependencia de la que sacar un set (decisión
 * 51), y a un brazo de distancia con la pantalla sucia una palabra se lee mejor
 * que un dibujo de 20 px con su rótulo de 11 abajo. Cada pestaña lleva su
 * palabra y nada más.
 *
 * Lo que **no** hace: acordarse de en qué pestaña estabas. Eso sería la pila de
 * navegación que el README descarta; acá cada pestaña es una dirección y se
 * entra a ella como a cualquier otra.
 */
const LUGARES: readonly { rotulo: string; href: string }[] = [
  { rotulo: 'Inicio', href: aTablero() },
  { rotulo: 'Rodeo', href: aRodeo() },
  { rotulo: 'Tanque', href: aTanque() },
];

function BarraInferior() {
  // Se compara el **camino** y no el hash entero: `#/rodeo?cat=SECA` sigue
  // siendo el rodeo, y la pestaña tiene que quedar marcada igual.
  const camino = usarCamino();

  return (
    <nav className="barra" aria-label="Secciones">
      {LUGARES.map(({ rotulo, href }) => {
        // Tres señales y ninguna es solo el color —la barra de arriba, el peso y
        // la tinta, en el CSS— más `aria-current`, que es la que sirve para quien
        // no ve la pantalla.
        const puesta = caminoDe(href) === camino;
        return (
          <a key={rotulo} href={href} aria-current={puesta ? 'page' : undefined}>
            {rotulo}
          </a>
        );
      })}
    </nav>
  );
}
