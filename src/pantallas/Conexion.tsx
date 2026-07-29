// ─────────────────────────────────────────────────────────────────────────────
// Elegir el tambo: la única pantalla que se ve una sola vez.
//
// Se pide el id del establecimiento y **se verifica contra la API antes de
// guardarlo**. Guardar primero y descubrir después que no existe dejaría la app
// arrancando siempre en un error, con el id malo pegado en `localStorage` y sin
// forma obvia de sacarlo.
//
// Que se escriba un uuid a mano es feo y es a propósito: mientras no haya login
// (Fase 6) no hay de dónde sacar la lista de tambos de nadie, e inventar un
// `GET /establecimientos` que devuelva todos los del sistema sería abrir por la
// UI justo lo que la Fase 6 viene a cerrar. `npm run demo` imprime el id.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from 'react';
import { api } from '../api/cliente';
import { mensajeDe } from '../usarPedido';
import { Aviso, Tarjeta } from '../componentes/basicos';
import { urlBase } from '../api/cliente';

export function Conexion({ alConectar }: { alConectar: (id: string) => void }) {
  const [id, setId] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const limpio = id.trim();
    if (limpio === '') return;
    setVerificando(true);
    setError(null);
    try {
      await api.establecimiento(limpio);
      alConectar(limpio);
    } catch (causa) {
      setError(mensajeDe(causa));
    } finally {
      setVerificando(false);
    }
  }

  return (
    <div className="app">
      <header className="encabezado">
        <h1>Tambo</h1>
      </header>
      <main className="contenido">
        <Tarjeta titulo="¿En qué tambo estás?" subtitulo="Se elige una vez y queda guardado.">
          <form onSubmit={enviar}>
            <label className="campo">
              <span>Id del establecimiento</span>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="00000000-0000-0000-0000-000000000000"
                required
              />
              <span className="ayuda">
                Lo imprime <code>npm run demo</code> al terminar de poblar el tambo.
              </span>
            </label>
            <button className="boton ancho" type="submit" disabled={verificando}>
              {verificando ? 'Verificando…' : 'Conectar'}
            </button>
          </form>
        </Tarjeta>

        {error !== null && (
          <Aviso titulo="No se pudo conectar">{error}</Aviso>
        )}

        <p className="vacio">
          Servidor: <code>{urlBase() === '' ? 'el mismo de esta página' : urlBase()}</code>
        </p>
      </main>
    </div>
  );
}
