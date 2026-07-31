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
//
// Y "ninguno" son **dos** casos, no uno. En una base recién instalada no existe
// ningún establecimiento y el único usuario es el admin, así que la primera
// pantalla que alguien ve en producción es esta, vacía — y decirle *"pedíselo a
// un administrador"* al administrador es darle una instrucción imposible. No
// apareció nunca porque la demo siembra el tambo antes de que nadie entre y los
// tests parten de una sesión con establecimientos. Con `usuario.es_admin` en la
// mano, el vacío del admin dice lo que **sí** puede hacer.
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
            {usuario.es_admin ? (
              <>
                <p className="vacio">
                  Todavía no hay ningún tambo cargado, y el que los crea sos vos: sos
                  administrador.
                </p>
                <p className="vacio">
                  Esta pantalla no lo hace, y es a propósito — administrar es trabajo que se hace
                  una vez cada tanto y no le corresponde a la pantalla del corral. Va contra la
                  API, en este orden:
                </p>
                <ul className="lista-simple">
                  <li>
                    <code>POST /establecimientos</code> — el tambo
                  </li>
                  <li>
                    <code>POST /usuarios</code> — las personas que lo van a usar
                  </li>
                  <li>
                    <code>PUT /usuarios/&#123;id&#125;/permisos/&#123;est&#125;</code> — con{' '}
                    <code>escritura</code> o <code>lectura</code>
                  </li>
                </ul>
                <p className="vacio">
                  Los comandos completos están en el README. Cuando el tambo exista, esta pantalla
                  te lo va a ofrecer como a todos.
                </p>
              </>
            ) : (
              <p className="vacio">
                Todavía no te dieron acceso a ningún tambo. Pedíselo a un administrador: él es
                quien reparte los permisos.
              </p>
            )}
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
