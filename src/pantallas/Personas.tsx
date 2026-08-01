// ─────────────────────────────────────────────────────────────────────────────
// Las personas: crearlas, editarlas, desactivarlas y resetearles la contraseña.
//
// Este archivo es **la lista completa del sistema** y las dos piezas que la
// pantalla de cada tambo reusa: `AltaDePersona` y `FichaDePersona`. La ficha es
// la misma en los dos lados —una persona se edita igual se la mire desde donde
// se la mire— y lo que cambia es lo que se le cuelga al lado: en un tambo, los
// controles del permiso sobre ese tambo, que entran por `children`.
//
// Esta lista global es la **segunda puerta**, no la principal: el camino de todos
// los días es entrar por el tambo. Existe igual porque hay dos clases de persona
// que ninguna lista por tambo puede mostrar — los administradores, que no
// figuran en el reparto de ninguno, y quien todavía no tiene acceso a ninguno—.
//
// Tres cosas que esta pantalla tiene que decir en voz alta, porque las tres se
// asumen al revés:
//
//   · **nadie se borra.** No hay `DELETE /usuarios` y no es un olvido: el log
//     firma con `usuario_id` y una fila borrada rompería la historia. Lo que hay
//     es desactivar, que sí es inmediato;
//   · **resetear la contraseña no cierra las sesiones abiertas.** El token del
//     otro vale hasta sus 8 horas. Para sacar a alguien *ahora*, se lo desactiva;
//   · **la contraseña inicial se dice de boca.** Del otro lado no hay correo que
//     mandar, así que si esta pantalla no la muestra una vez, el admin la
//     escribió en un formulario y ya nadie la sabe.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../api/cliente';
import type { EstablecimientoDeLaLista, UsuarioAdmin } from '../api/tipos';
import { Armazon } from '../componentes/armazon';
import { Aviso, Cargando, Tarjeta, TarjetaCaida } from '../componentes/basicos';
import { Campo, Casilla } from '../componentes/formulario';
import { aPanel } from '../ruteo';
import { usarUsuario } from '../usuario';
import { mensajeDe, usarPedido } from '../usarPedido';

/** El mínimo que exige la API. Es de forma, no de dominio: el largo lo dice §9. */
const LARGO_MINIMO = 8;

export function Personas() {
  const traerPersonas = useCallback(() => api.usuarios(), []);
  const personas = usarPedido(traerPersonas);
  const traerTambos = useCallback(() => api.establecimientos(), []);
  const tambos = usarPedido(traerTambos);

  return (
    <Armazon titulo="Todas las personas" volverA={aPanel()} ancha>
      <p className="vacio">
        Todas las del sistema, entren al tambo que entren. Para repartir el acceso a un tambo, el
        camino corto es entrar por él.
      </p>

      <AltaDePersona alCrear={personas.recargar} />

      {personas.cargando && <Cargando que="Buscando a la gente…" />}

      {personas.error !== null && (
        <TarjetaCaida titulo="Las personas" error={personas.error} reintentar={personas.recargar} />
      )}

      {personas.datos !== null && (
        <Tarjeta
          titulo="Todas"
          subtitulo="Los desactivados también: son los que hay que poder volver a entrar."
        >
          <ul className="lista-simple">
            {personas.datos.usuarios.map((persona) => (
              <FichaDePersona
                key={persona.id}
                persona={persona}
                tambos={tambos.datos?.establecimientos ?? null}
                alCambiar={personas.recargar}
              />
            ))}
          </ul>
        </Tarjeta>
      )}
    </Armazon>
  );
}

// ── Crear ────────────────────────────────────────────────────────────────────

/**
 * El alta, que es la misma acá y adentro de un tambo.
 *
 * `alCrear` recibe **el id de la persona nueva** porque de este lado no sirve
 * para nada y del otro sí: la pantalla del tambo la deja elegida en el "dar
 * acceso" de al lado, que es lo que uno iba a hacer a continuación. Crear y dar
 * el permiso siguen siendo dos gestos —dos pedidos, y el rol se elige— porque
 * elegirlo en silencio sería decidir por el admin lo único que hay que decidir.
 */
export function AltaDePersona({ alCrear }: { alCrear: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [esAdmin, setEsAdmin] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** La recién creada, para decirla una vez. Se olvida al cerrar el formulario. */
  const [recienCreada, setRecienCreada] = useState<{ nombre: string; password: string } | null>(
    null,
  );

  if (!abierto) {
    return (
      <>
        {recienCreada !== null && (
          <Aviso tono="bien" titulo={`${recienCreada.nombre} ya puede entrar`}>
            Su contraseña es <code>{recienCreada.password}</code>. Decísela vos: del otro lado no
            hay correo que mandar. Que la cambie en "Mi cuenta" apenas entre — esta pantalla no la
            va a volver a mostrar.
          </Aviso>
        )}
        <button className="boton ancho" type="button" onClick={() => setAbierto(true)}>
          Crear una persona
        </button>
      </>
    );
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const creada = await api.crearUsuario({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        es_admin: esAdmin,
      });
      setRecienCreada({ nombre: nombre.trim(), password });
      setNombre('');
      setEmail('');
      setPassword('');
      setEsAdmin(false);
      setAbierto(false);
      alCrear(creada.id);
    } catch (causa) {
      // El formulario **no se vacía**: el rechazo cotidiano acá es el 409 del
      // email repetido, y hacerle escribir todo de nuevo por eso sería castigar
      // el error más común de la pantalla.
      setError(mensajeDe(causa));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta titulo="Una persona nueva">
      <form onSubmit={enviar}>
        <Campo etiqueta="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </Campo>

        <Campo etiqueta="Email" ayuda="Es con lo que entra, así que tiene que ser el suyo.">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoCapitalize="off"
            spellCheck={false}
            required
          />
        </Campo>

        <Campo
          etiqueta="Contraseña inicial"
          ayuda={`De ${LARGO_MINIMO} caracteres para arriba. Se la decís vos y la cambia al entrar.`}
        >
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoCapitalize="off"
            spellCheck={false}
            minLength={LARGO_MINIMO}
            required
          />
        </Campo>

        <Casilla etiqueta="Que sea administrador" marcada={esAdmin} alCambiar={setEsAdmin} />
        <p className="renglon">
          Un administrador entra a todos los tambos y reparte los permisos. Conviene que haya más
          de uno: si el único se va, no queda nadie que pueda arreglarlo desde adentro.
        </p>

        <div className="acciones">
          <button className="boton" type="submit" disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear la persona'}
          </button>
          <button
            className="boton secundario"
            type="button"
            disabled={guardando}
            onClick={() => setAbierto(false)}
          >
            Cancelar
          </button>
        </div>

        {error !== null && <Aviso titulo="No se pudo crear">{error}</Aviso>}
      </form>
    </Tarjeta>
  );
}

// ── Una persona, y lo que se le puede hacer ──────────────────────────────────

export function FichaDePersona({
  persona,
  tambos,
  alCambiar,
  children,
}: {
  persona: UsuarioAdmin;
  /** Para escribir en qué tambo entra con nombre y no con uuid. Null si no vino. */
  tambos: EstablecimientoDeLaLista[] | null;
  alCambiar: () => void;
  /**
   * Lo que le agrega el contexto: adentro de un tambo, los controles del permiso
   * sobre **ese** tambo. Van afuera del "Editar" y no adentro porque cambiar un
   * permiso es lo que se viene a hacer todos los días, y editar a la persona es
   * lo que se hace de vez en cuando.
   */
  children?: ReactNode;
}) {
  const yo = usarUsuario();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);

  const soyYo = persona.id === yo.id;

  async function editar(cambio: Parameters<typeof api.editarUsuario>[1]) {
    setGuardando(true);
    setRechazo(null);
    try {
      await api.editarUsuario(persona.id, cambio);
      alCambiar();
    } catch (causa) {
      // Acá llega el `ULTIMO_ADMIN`: sacarle el rol al único que queda. La UI no
      // lleva la cuenta de cuántos admins hay y no debería — quien la tiene es
      // el servidor, y su mensaje explica cómo salir.
      setRechazo(mensajeDe(causa));
    } finally {
      setGuardando(false);
    }
  }

  const nombreDeTambo = (id: string): string =>
    tambos?.find((t) => t.id === id)?.nombre ?? 'un tambo';

  return (
    <li>
      <div className="etiquetas">
        <strong>{persona.nombre}</strong>
        {persona.es_admin && <span className="etiqueta ambar">administrador</span>}
        {!persona.activo && <span className="etiqueta rojo">desactivado</span>}
        {soyYo && <span className="etiqueta gris">sos vos</span>}
      </div>
      <span className="renglon">{persona.email}</span>

      {/* La mitad de la información que trae `activo`, dicha donde se ve: el
          desactivado conserva sus permisos y **no entra**. Sin este renglón, una
          fila con permiso de escritura parece alguien que está cargando. */}
      {!persona.activo && (
        <span className="renglon aviso-suave">
          No entra: está desactivado. Sus permisos quedan para cuando vuelva.
        </span>
      )}

      {persona.es_admin ? (
        <span className="renglon">Entra a todos los tambos.</span>
      ) : persona.permisos.length === 0 ? (
        <span className="renglon">No entra a ningún tambo todavía.</span>
      ) : (
        <span className="renglon">
          {persona.permisos
            .map((p) => `${nombreDeTambo(p.establecimiento_id)} (${p.rol})`)
            .join(', ')}
        </span>
      )}

      {children}

      {!abierto ? (
        <button
          className="boton chico secundario"
          type="button"
          onClick={() => setAbierto(true)}
        >
          Editar
        </button>
      ) : (
        <div className="anulacion">
          <CambiarNombre persona={persona} guardando={guardando} alGuardar={editar} />

          <ResetearPassword persona={persona} guardando={guardando} alGuardar={editar} />

          {/* Las dos que la API le prohíbe a uno sobre sí mismo. No se ofrecen:
              un botón cuyo único final posible es un 422 es una promesa que la
              pantalla no puede cumplir. La salida —nombrar a otro y que ese otro
              te desactive— se dice con palabras, que es lo que sirve. */}
          {soyYo ? (
            <p className="renglon">
              Sos vos: no podés desactivarte ni sacarte el rol de administrador. Si te vas, nombrá
              administrador a otra persona y que ella te desactive.
            </p>
          ) : (
            <div className="acciones">
              <button
                className="boton chico secundario"
                type="button"
                disabled={guardando}
                onClick={() => void editar({ activo: !persona.activo })}
              >
                {persona.activo ? 'Desactivar' : 'Reactivar'}
              </button>
              <button
                className="boton chico secundario"
                type="button"
                disabled={guardando}
                onClick={() => void editar({ es_admin: !persona.es_admin })}
              >
                {persona.es_admin ? 'Quitar administrador' : 'Hacer administrador'}
              </button>
            </div>
          )}

          <p className="renglon">
            Nadie se borra: al que se fue se lo desactiva, y así el historial que firmó sigue
            diciendo quién cargó cada cosa.
          </p>

          {rechazo !== null && <Aviso titulo="No se pudo guardar">{rechazo}</Aviso>}

          <button className="boton chico secundario" type="button" onClick={() => setAbierto(false)}>
            Listo
          </button>
        </div>
      )}
    </li>
  );
}

type Editar = (cambio: Parameters<typeof api.editarUsuario>[1]) => Promise<void>;

function CambiarNombre({
  persona,
  guardando,
  alGuardar,
}: {
  persona: UsuarioAdmin;
  guardando: boolean;
  alGuardar: Editar;
}) {
  const [nombre, setNombre] = useState(persona.nombre);
  const cambio = nombre.trim() !== '' && nombre.trim() !== persona.nombre;

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        // Solo lo que cambió: un PATCH con campos de más es 400, y uno vacío
        // también.
        void alGuardar({ nombre: nombre.trim() });
      }}
    >
      <Campo etiqueta="Nombre">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      </Campo>
      <button className="boton chico secundario" type="submit" disabled={guardando || !cambio}>
        Cambiar el nombre
      </button>
    </form>
  );
}

/**
 * Resetear la contraseña de otro.
 *
 * La advertencia va **al lado del botón** y no en la documentación: es la cosa
 * que todo el mundo asume al revés, y asumirla al revés significa creer que
 * echaste a alguien que sigue adentro con su token vivo.
 */
function ResetearPassword({
  persona,
  guardando,
  alGuardar,
}: {
  persona: UsuarioAdmin;
  guardando: boolean;
  alGuardar: Editar;
}) {
  const [password, setPassword] = useState('');
  const [lista, setLista] = useState(false);

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        void alGuardar({ password }).then(() => {
          setLista(true);
          setPassword('');
        });
      }}
    >
      <Campo
        etiqueta="Contraseña nueva"
        ayuda={`De ${LARGO_MINIMO} para arriba. Decísela vos y que la cambie al entrar.`}
      >
        <input
          type="text"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setLista(false);
          }}
          autoCapitalize="off"
          spellCheck={false}
          minLength={LARGO_MINIMO}
          placeholder="La que le vas a decir"
        />
      </Campo>
      <button
        className="boton chico secundario"
        type="submit"
        disabled={guardando || password.length < LARGO_MINIMO}
      >
        Resetear la contraseña
      </button>
      <p className="renglon aviso-suave">
        Resetearla <strong>no cierra</strong> las sesiones que {persona.nombre} tenga abiertas: su
        token vale hasta que se cumplan sus 8 horas. Para sacarlo ahora, desactivalo.
      </p>
      {lista && (
        <Aviso tono="bien" titulo="Contraseña cambiada">
          Decísela y que la cambie apenas entre.
        </Aviso>
      )}
    </form>
  );
}
