// ─────────────────────────────────────────────────────────────────────────────
// Mi cuenta: quién soy y cambiar mi contraseña.
//
// Es lo único de administración que vive en la UI, y está acá porque es del
// tambero y no del admin: crear usuarios y repartir permisos se hace una vez
// cada tanto, del otro lado, y no le corresponde a la pantalla del corral.
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
import { aTablero } from '../ruteo';
import { usarUsuario } from '../usuario';
import { mensajeDe } from '../usarPedido';

/** El mínimo que exige la API. Es de forma, no de dominio: el largo lo dice §9. */
const LARGO_MINIMO = 8;

export function Cuenta() {
  const usuario = usarUsuario();

  return (
    <Armazon titulo="Mi cuenta" volverA={aTablero()}>
      <Tarjeta titulo={usuario.nombre} subtitulo={usuario.email}>
        <p className="vacio">
          {usuario.es_admin
            ? 'Sos administrador: entrás a todos los tambos.'
            : 'Los tambos a los que entrás y con qué permiso los reparte un administrador.'}
        </p>
      </Tarjeta>

      <CambiarPassword />
    </Armazon>
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
