// ─────────────────────────────────────────────────────────────────────────────
// Los formularios: los campos, y el rechazo.
//
// De dominio acá no hay **nada**, salvo una sola cosa que se declara en voz alta
// porque es la excepción y conviene que se note si aparece una segunda: **que un
// rechazo forzable se puede confirmar** (§3.5, decisión 50). No cuáles son
// forzables —eso lo dice el servidor en el cuerpo del error (decisión 54)— sino
// que existe el gesto de insistir con observaciones.
//
// Todo lo demás que valida esta pantalla es de forma: campos requeridos y tipos
// de input. Si un número es implausible o una transición es imposible lo dice la
// API, con el mensaje que §5.6 redactó para el tambero, y se muestra tal cual.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type ReactNode } from 'react';
import type { CuerpoError } from '../api/tipos';
import { Aviso } from './basicos';

/**
 * Un campo con su rótulo. El `<label>` envuelve al control: así el toque en el
 * texto también enfoca, que en el celular es la mitad del área útil.
 *
 * La **ayuda queda afuera del `<label>`** a propósito. Adentro se sumaba al
 * nombre accesible del campo, y "Cuándo" pasaba a llamarse "Cuándo Por default,
 * hoy. Si el hecho fue otro día, cambialo." — un rótulo que ni un lector de
 * pantalla ni un test pueden usar para encontrar el control.
 */
export function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div className="campo">
      <label>
        <span>{etiqueta}</span>
        {children}
      </label>
      {ayuda !== undefined && <span className="ayuda">{ayuda}</span>}
    </div>
  );
}

/** Una casilla. Va aparte de `Campo` porque el rótulo va **después** del control. */
export function Casilla({
  etiqueta,
  marcada,
  alCambiar,
}: {
  etiqueta: string;
  marcada: boolean;
  alCambiar: (valor: boolean) => void;
}) {
  return (
    <label className="casilla">
      <input type="checkbox" checked={marcada} onChange={(e) => alCambiar(e.target.checked)} />
      <span>{etiqueta}</span>
    </label>
  );
}

/**
 * Lo que la API contestó que no.
 *
 * El `mensaje` se muestra **tal cual**: está redactado en §5.6 para que el
 * tambero sepa cómo salir del paso, y reescribirlo acá sería duplicar el dominio
 * en el peor lugar. El `codigo` va chiquito abajo — al tambero no le dice nada,
 * pero es lo primero que se pregunta cuando llama por teléfono.
 *
 * Si el rechazo es forzable **y quien lo muestra sabe reenviar**, aparece
 * "Confirmar igual" con sus observaciones obligatorias. Las dos condiciones son
 * necesarias: `forzable` lo dice el servidor, pero el `POST /tanque` no acepta
 * un campo `forzado` en su cuerpo, así que ofrecer el botón ahí sería ofrecer un
 * gesto que la API no puede cumplir. Quien no pasa `alConfirmar` no lo muestra.
 */
export function Rechazo({
  error,
  alConfirmar,
  enviando = false,
}: {
  error: CuerpoError;
  alConfirmar?: (observaciones: string) => void;
  enviando?: boolean;
}) {
  const [observaciones, setObservaciones] = useState('');
  const puedeConfirmar = error.forzable === true && alConfirmar !== undefined;

  return (
    <div className="rechazo">
      <Aviso titulo="La carga no entró" codigo={error.codigo}>
        {error.mensaje}
      </Aviso>

      {/* CONFLICTO_RETROACTIVO trae la lista completa de lo que quedaría
          inválido (decisión 14): mostrar solo el primero obligaría a descubrir
          los demás de a uno, que es justo lo que esa decisión evitó. */}
      {error.conflictos !== undefined && error.conflictos.length > 0 && (
        <div className="conflictos">
          <h3>Lo que quedaría inválido</h3>
          <ul className="lista-simple">
            {error.conflictos.map((c) => (
              <li key={c.evento_id}>
                <strong>{c.codigo}</strong>
                <span className="renglon">{c.mensaje}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {puedeConfirmar && (
        <div className="confirmar">
          <p className="renglon">
            Si el hecho pasó igual, cargalo con una explicación. Queda guardado como forzado y su
            ciclo no cuenta en los indicadores.
          </p>
          <Campo etiqueta="Por qué se carga igual">
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Parió en el campo: la preñez nunca se había registrado."
              required
            />
          </Campo>
          <button
            className="boton ancho peligro"
            type="button"
            // La API va a exigir las observaciones igual (`OBSERVACIONES_REQUERIDAS`).
            // Deshabilitarlo hasta que haya texto ahorra un viaje y un rechazo
            // que ya se sabe que va a venir.
            disabled={observaciones.trim() === '' || enviando}
            onClick={() => alConfirmar(observaciones.trim())}
          >
            {enviando ? 'Confirmando…' : 'Confirmar igual'}
          </button>
        </div>
      )}
    </div>
  );
}
