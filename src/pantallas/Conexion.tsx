// ─────────────────────────────────────────────────────────────────────────────
// Elegir el tambo. Hasta la cerradura, esta pantalla pedía que se escribiera un
// uuid a mano, y su propio comentario explicaba por qué: sin login no había de
// dónde sacar la lista de los tambos de nadie, e inventar un `GET
// /establecimientos` que devolviera todos los del sistema hubiera sido abrir por
// la UI justo lo que la Fase 6 vino a cerrar.
//
// Ahora hay de dónde: `GET /establecimientos` devuelve **los míos** —donde tengo
// permiso, y todos si soy admin—, así que esto es una lista para tocar con el
// dedo. Un uuid tipeado en el corral, con una mano y la pantalla al sol, era la
// peor pantalla de la app.
//
// Los tres casos que importan y ninguno es el "feliz" solo:
//
//   - **uno solo** no llega acá: `App` entra derecho. Es el 90% de la gente y
//     una lista de un elemento es una pantalla de peaje;
//   - **varios** es esta lista, y el elegido queda guardado —ahí `localStorage`
//     está bien, porque el tambo elegido no es un secreto—;
//   - **ninguno** no es una lista vacía ni un error: es alguien a quien todavía
//     no le dieron acceso, y lo que necesita es saber a quién pedírselo.
// ─────────────────────────────────────────────────────────────────────────────

import { urlBase } from '../api/cliente';
import type { EstablecimientoDeLaLista } from '../api/tipos';
import { Aviso, Tarjeta } from '../componentes/basicos';
import { usarSalir, usarUsuario } from '../usuario';

export function Conexion({
  tambos,
  alConectar,
  aviso,
}: {
  tambos: EstablecimientoDeLaLista[];
  alConectar: (id: string) => void;
  /** Por qué se está viendo esta pantalla, si no es por elección propia. */
  aviso?: string | null;
}) {
  const usuario = usarUsuario();
  const salir = usarSalir();

  return (
    <div className="app">
      <header className="encabezado">
        <h1>Tambo</h1>
      </header>
      <main className="contenido">
        {aviso !== undefined && aviso !== null && (
          <Aviso tono="atencion" titulo="Elegí de nuevo">
            {aviso}
          </Aviso>
        )}

        {tambos.length === 0 ? (
          <Tarjeta titulo={`Hola, ${usuario.nombre}`}>
            <p className="vacio">
              Todavía no te dieron acceso a ningún tambo. Pedíselo a un administrador: él es quien
              reparte los permisos.
            </p>
          </Tarjeta>
        ) : (
          <Tarjeta titulo="¿En qué tambo estás?" subtitulo="Queda guardado para la próxima.">
            <ul className="lista">
              {tambos.map((tambo) => (
                <li key={tambo.id}>
                  {/* Un botón y no un enlace: no navega a ninguna dirección,
                      elige. La fila entera —60 px— es el área de toque, la
                      misma que las del rodeo: el dedo no tiene que apuntar. */}
                  <button className="fila" type="button" onClick={() => alConectar(tambo.id)}>
                    <span className="nombre-tambo">{tambo.nombre}</span>
                    <span className="flecha" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}

        <button className="boton ancho secundario" type="button" onClick={salir}>
          Salir
        </button>

        <p className="vacio">
          Servidor: <code>{urlBase() === '' ? 'el mismo de esta página' : urlBase()}</code>
        </p>
      </main>
    </div>
  );
}
