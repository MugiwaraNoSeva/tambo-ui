// ─────────────────────────────────────────────────────────────────────────────
// Entrar. La primera pantalla del día y la única que se ve sin sesión.
//
// Dos campos y nada más: no hay registro —los usuarios los crea un admin— ni
// "olvidé mi contraseña", porque del otro lado no hay correo que mandar y quien
// la pierde se la resetea el admin. Poner un enlace que no lleva a ningún lado
// sería peor que no ponerlo.
//
// Está escrita para el corral: teclado de email, sin autocorrector y sin la
// primera mayúscula que el celular mete sola en cada campo, que en un email es
// un rechazo garantizado y en una contraseña es peor, porque no se ve. El botón
// ocupa el ancho y dice en qué está.
//
// **El error se muestra tal cual lo manda la API.** El "Email o contraseña
// incorrectos" es un mensaje único a propósito —decir cuál de los dos falló
// regala la lista de usuarios— y reescribirlo acá para que sea "más claro"
// desharía justamente eso.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from 'react';
import { api, urlBase } from '../api/cliente';
import type { RespuestaLogin } from '../api/tipos';
import { Aviso, Tarjeta } from '../componentes/basicos';
import type { CaidaDeSesion } from '../sesion';
import { mensajeDe } from '../usarPedido';

export function Login({
  alEntrar,
  caida,
}: {
  alEntrar: (respuesta: RespuestaLogin) => void;
  /** Si venimos de una sesión que se cayó, lo que pasó. Al arrancar, `null`. */
  caida: CaidaDeSesion | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setEntrando(true);
    setError(null);
    try {
      alEntrar(await api.login({ email: email.trim(), password }));
      // Sin `setEntrando(false)` en el camino feliz: la pantalla se va.
    } catch (causa) {
      setError(mensajeDe(causa));
      setEntrando(false);
    }
  }

  return (
    <div className="app">
      <header className="encabezado">
        <h1>Tambo</h1>
      </header>
      <main className="contenido">
        {caida !== null && (
          <Aviso tono="atencion" titulo="Se cerró la sesión">
            {caida.mensaje}
            {caida.seEstabaCargando &&
              ' Lo que estabas cargando no llegó a guardarse: cargalo de nuevo cuando entres.'}
          </Aviso>
        )}

        <Tarjeta titulo="Entrar" subtitulo="Con tu email y tu contraseña.">
          <form onSubmit={enviar}>
            <label className="campo">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                // El email es el nombre de usuario acá: así el llavero del
                // celular ofrece la contraseña que corresponde.
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </label>

            <label className="campo">
              <span>Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoCapitalize="off"
                spellCheck={false}
                required
              />
            </label>

            <button className="boton ancho" type="submit" disabled={entrando}>
              {entrando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </Tarjeta>

        {error !== null && <Aviso titulo="No se pudo entrar">{error}</Aviso>}

        <p className="vacio">
          Servidor: <code>{urlBase() === '' ? 'el mismo de esta página' : urlBase()}</code>
        </p>
      </main>
    </div>
  );
}
