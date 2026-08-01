// El marco que todas las pantallas comparten: la barra de arriba y el cuerpo.
//
// Existe porque hasta la Parte 2 había una sola pantalla y el `div.app` estaba
// copiado tres veces en `App.tsx` — con tres pantallas más eso se convierte en
// tres encabezados que se despegan. Acá adentro no hay nada que sepa de vacas:
// un título, una vuelta opcional y lo que le pongan adentro.

import type { ReactNode } from 'react';

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
        <h1>{titulo}</h1>
      </header>
      <main className="contenido">{children}</main>
    </div>
  );
}
