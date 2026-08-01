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

import { useId, useState, type ReactNode } from 'react';
import type { CuerpoError } from '../api/tipos';
import { diaAnterior } from '../reloj';
import { Aviso } from './basicos';

/** Una opción de un chip o de un segmentado: el valor que viaja y lo que se lee. */
export interface Opcion<T extends string> {
  valor: T;
  rotulo: string;
}

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

/**
 * Un filtro a un toque, en vez de un desplegable.
 *
 * Un `select` en el celular son **tres** toques —abrir, elegir, confirmar— y
 * mientras está abierto tapa la pantalla; un chip es uno y no tapa nada. Por eso
 * reemplaza al desplegable cuando las opciones son pocas y se cambian seguido,
 * que es el caso de los filtros del rodeo.
 *
 * **Es un filtro y por lo tanto se apaga**: tocar el que ya está elegido lo
 * saca, y `null` es "ninguno, mostrá todo". Eso es lo que hace innecesaria una
 * opción "Todas" al principio de la lista — la opción de no filtrar es soltar el
 * que está puesto.
 *
 * Lo elegido se dice de tres formas y ninguna es solo el color: el fondo, el
 * borde y `aria-pressed`, que es lo que lo hace legible para quien no ve la
 * pantalla. Cada chip lleva su palabra siempre.
 */
export function Chips<T extends string>({
  etiqueta,
  opciones,
  elegida,
  alElegir,
}: {
  /** Qué se está filtrando. No se dibuja: nombra al grupo para quien no ve. */
  etiqueta: string;
  opciones: readonly Opcion<T>[];
  /** `null` es "sin filtrar". */
  elegida: T | null;
  alElegir: (valor: T | null) => void;
}) {
  return (
    <div className="chips" role="group" aria-label={etiqueta}>
      {opciones.map(({ valor, rotulo }) => {
        const puesta = valor === elegida;
        return (
          <button
            key={valor}
            type="button"
            className="chip"
            aria-pressed={puesta}
            onClick={() => alElegir(puesta ? null : valor)}
          >
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Elegir una entre pocas, sin abrir nada y viéndolas todas juntas.
 *
 * Es el hermano excluyente de `Chips`: donde el chip filtra y se puede soltar,
 * acá **siempre hay una elegida**. Es lo que reemplaza al desplegable cuando lo
 * que se elige manda sobre el resto de la pantalla — el tipo de evento de una
 * corrida, por ejemplo, que decide qué campos se ven abajo.
 *
 * Por dentro son `<input type="radio">` de verdad y no botones, y eso no es
 * decoración: elegir uno entre varios excluyentes ya tiene una forma que el
 * browser sabe —el foco se mueve con las flechas, el lector de pantalla anuncia
 * "2 de 4"— y reimplementarla con botones sería escribir peor lo que ya está.
 * El `<fieldset>` con su `<legend>` es lo que agrupa; el input se esconde de la
 * **vista** con posición y opacidad, nunca con `display: none`, que lo sacaría
 * también del foco y de la accesibilidad.
 */
export function Segmentado<T extends string>({
  etiqueta,
  opciones,
  elegida,
  alElegir,
}: {
  etiqueta: string;
  opciones: readonly Opcion<T>[];
  elegida: T;
  alElegir: (valor: T) => void;
}) {
  // Dos segmentados en la misma pantalla no pueden compartir el `name` o se
  // comportan como un solo grupo de radios. `useId` lo resuelve sin que quien
  // lo usa tenga que acordarse de pasar un nombre único.
  const nombre = useId();

  return (
    <fieldset className="segmentado-campo">
      <legend>{etiqueta}</legend>
      <div className="segmentado">
        {opciones.map(({ valor, rotulo }) => (
          <label className="opcion" key={valor}>
            <input
              type="radio"
              name={nombre}
              value={valor}
              checked={valor === elegida}
              onChange={() => alElegir(valor)}
            />
            {rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * La fecha de una carga, con "hoy" y "ayer" a un toque.
 *
 * El `<input type="date">` solo cuesta **tres** toques en el celular —abrir el
 * calendario nativo, elegir, confirmar— y el 95% de lo que se carga pasó hoy o
 * ayer: el ordeñe de anoche, el celo que se vio al caer la tarde y se anota a la
 * mañana. Los dos atajos cubren ese 95% con un toque y el calendario queda para
 * el resto, que sigue estando.
 *
 * No son `Chips` ni `Segmentado` aunque se les parezcan, y la diferencia importa:
 * un chip se puede soltar y acá siempre hay una fecha; un segmentado obliga a que
 * una de las opciones esté elegida, y acá **puede no estarlo ninguna** —cuando la
 * fecha es de hace tres días, ni "Hoy" ni "Ayer" están puestos y eso es correcto—.
 *
 * El día de hoy sale del servidor y nunca del celular (decisión 52), y "ayer" se
 * cuenta hacia atrás sobre ese string, sin `new Date`.
 */
export function CampoFecha({
  etiqueta,
  ayuda,
  valor,
  alCambiar,
  hoy,
}: {
  etiqueta: string;
  ayuda?: string;
  valor: string;
  alCambiar: (fecha: string) => void;
  /** El hoy del servidor. Se recibe y no se lee acá para que la pantalla lo fije una vez. */
  hoy: string;
}) {
  const ayer = diaAnterior(hoy);
  const atajos: readonly { rotulo: string; fecha: string }[] = [
    { rotulo: 'Hoy', fecha: hoy },
    { rotulo: 'Ayer', fecha: ayer },
  ];

  return (
    <div className="campo">
      <label>
        <span>{etiqueta}</span>
        <input
          type="date"
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          required
        />
      </label>
      <div className="chips atajos-de-fecha" role="group" aria-label={`${etiqueta}: atajos`}>
        {atajos.map(({ rotulo, fecha }) => (
          <button
            key={rotulo}
            type="button"
            className="chip"
            aria-pressed={valor === fecha}
            onClick={() => alCambiar(fecha)}
          >
            {rotulo}
          </button>
        ))}
      </div>
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
