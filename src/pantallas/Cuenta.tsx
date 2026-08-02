// ─────────────────────────────────────────────────────────────────────────────
// Mi cuenta: quién soy y cambiar mi contraseña.
//
// Es la única pantalla que vive en los **dos** árboles —el del tambo y el del
// panel—, y por eso `volverA` es un parámetro: la contraseña es de la persona y
// no de ningún establecimiento. Administrar a los demás es otra cosa y está en
// `Panel.tsx`; lo de acá lo hace cada uno con lo suyo.
//
// El cambio **exige la contraseña actual** aunque ya haya sesión abierta: el
// token puede estar en un celular que quedó sobre la mesa del tambo. Errarle es
// un 401 que la API contesta con el mismo `NO_AUTENTICADO` de un token vencido,
// y por eso `cliente.ts` lo marca como "lleva una contraseña adentro": ese 401
// habla de lo que se escribió acá y no cierra la sesión.
//
// Cambiar la contraseña **no cierra la sesión**, y está bien: quien la cambió es
// quien está usando la app. Lo que sí conviene saber, y lo dice la pantalla, es
// que las sesiones abiertas en otros teléfonos siguen abiertas hasta las 8 horas.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from 'react';
import { api } from '../api/cliente';
import { Aviso, Tarjeta } from '../componentes/basicos';
import { Armazon } from '../componentes/armazon';
import type { SalidaDelTambo } from '../establecimiento';
import { aTablero } from '../ruteo';
import { usarSalir, usarUsuario } from '../usuario';
import { mensajeDe } from '../usarPedido';

/** El mínimo que exige la API. Es de forma, no de dominio: el largo lo dice §9. */
const LARGO_MINIMO = 8;

/**
 * `volverA` existe porque esta pantalla vive en los dos árboles: el tambero
 * vuelve a su tablero y el admin al panel, que es de donde entró. Es la única de
 * las nueve que no es de un tambo — mi contraseña es mía y no de ningún
 * establecimiento—, y en una base recién instalada es la única forma que tiene
 * el admin de cambiar la suya: todavía no hay tambo al que entrar.
 *
 * `salida` es lo que llegó con la barra inferior: las dos acciones que antes
 * vivían al pie del tablero —irse del tambo y cerrar la sesión— se mudaron acá.
 * Viene solo desde adentro de un tambo; en el árbol del panel no hay tambo del
 * que irse y salir se hace desde el panel, así que la tarjeta no se dibuja.
 */
export function Cuenta({
  volverA = aTablero(),
  salida,
}: {
  volverA?: string;
  salida?: SalidaDelTambo;
}) {
  const usuario = usarUsuario();

  return (
    <Armazon titulo="Mi cuenta" volverA={volverA}>
      <Tarjeta titulo={usuario.nombre} subtitulo={usuario.email}>
        <p className="vacio">
          {usuario.es_admin
            ? 'Sos administrador: entrás a todos los tambos.'
            : 'Los tambos a los que entrás y con qué permiso los reparte un administrador.'}
        </p>
      </Tarjeta>

      <CambiarPassword />

      {salida !== undefined && <Salidas salida={salida} />}
    </Armazon>
  );
}

/**
 * Las dos formas de irse, juntas y al final de la pantalla más lejana del pulgar.
 *
 * Es el criterio **inverso** al de la barra de abajo, y a propósito: lo que se
 * hace todo el día va en la zona del pulgar, y lo que se hace una vez por turno
 * va arriba y lejos, donde el dedo no llega solo. Que salir sea incómodo es la
 * idea; al pie del tablero pesaba exactamente lo mismo que "Dar de alta".
 *
 * Las dos se dicen juntas porque lo que hay que entender es la diferencia:
 * cambiar de tambo **no** cierra la sesión y salir sí.
 */
function Salidas({ salida }: { salida: SalidaDelTambo }) {
  const salir = usarSalir();

  return (
    <Tarjeta titulo="Salir">
      <p className="subtitulo">
        {salida.rotulo === null
          ? 'Salir cierra la sesión: hay que volver a escribir la contraseña.'
          : `"${salida.rotulo}" no cierra la sesión. Salir sí, y hay que volver a escribir la contraseña.`}
      </p>
      <div className="acciones">
        {/* `rotulo: null` es "no hay a dónde ir" —el tambero de un solo tambo—,
            y entonces el botón no está: una lista de un elemento es una pantalla
            de peaje y un botón que lleva a ella, un peaje sin pantalla. */}
        {salida.rotulo !== null && (
          <button className="boton secundario" type="button" onClick={() => salida.irse(null)}>
            {salida.rotulo}
          </button>
        )}
        <button className="boton secundario" type="button" onClick={salir}>
          Salir
        </button>
      </div>
    </Tarjeta>
  );
}

function CambiarPassword() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    setLista(false);
    try {
      await api.cambiarPassword({ actual, nueva });
      // Los dos campos se vacían: no se deja una contraseña escrita en pantalla.
      setActual('');
      setNueva('');
      setLista(true);
    } catch (causa) {
      setError(mensajeDe(causa));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta titulo="Cambiar mi contraseña">
      <form onSubmit={enviar}>
        <label className="campo">
          <span>Contraseña actual</span>
          <input
            type="password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            autoComplete="current-password"
            autoCapitalize="off"
            spellCheck={false}
            required
          />
        </label>

        <label className="campo">
          <span>Contraseña nueva</span>
          <input
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
            autoCapitalize="off"
            spellCheck={false}
            minLength={LARGO_MINIMO}
            required
          />
          <span className="ayuda">De {LARGO_MINIMO} caracteres para arriba.</span>
        </label>

        <button className="boton ancho" type="submit" disabled={guardando}>
          {guardando ? 'Cambiando…' : 'Cambiar la contraseña'}
        </button>
      </form>

      {lista && (
        <Aviso tono="bien" titulo="Contraseña cambiada">
          La próxima vez que entres, usá la nueva. Esta sesión sigue abierta, y las que estén
          abiertas en otros teléfonos duran hasta que se cumplan sus 8 horas.
        </Aviso>
      )}

      {error !== null && <Aviso titulo="No se pudo cambiar">{error}</Aviso>}
    </Tarjeta>
  );
}
