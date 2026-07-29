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
  children,
}: {
  titulo: string;
  /** Si viene, la flecha de volver apunta ahí. El tablero no lleva ninguna. */
  volverA?: string;
  children: ReactNode;
}) {
  return (
    <div className="app">
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
