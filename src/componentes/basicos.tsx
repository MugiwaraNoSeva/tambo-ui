// Las piezas que se repiten en todas las pantallas. Nada acá sabe de vacas: son
// la caja, el aviso, el "esperá", la cifra con su rótulo y la caja que se cayó.

import { useState, type ReactNode } from 'react';
import { SIN_DATO } from '../formato';

export function Tarjeta({
  titulo,
  subtitulo,
  destacada = false,
  children,
}: {
  /** `ReactNode` y no `string` para que el número de una lista de trabajo se pueda resaltar. */
  titulo?: ReactNode;
  subtitulo?: string;
  /**
   * Esta tarjeta es **trabajo pendiente** y no información.
   *
   * En el tablero, "Para revisar (3)" pesaba exactamente lo mismo que el reparto
   * de dietas, y no son la misma clase de cosa: una son cuatro animales
   * esperando en el corral y la otra es una referencia que se mira cuando se
   * planta la ración. El tablero tiene que leerse como una lista de tareas.
   *
   * Se apaga sola cuando no hay nada que hacer: una lista vacía es una buena
   * noticia y destacarla sería un susto por nada.
   */
  destacada?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={destacada ? 'tarjeta tarea' : 'tarjeta'}>
      {titulo !== undefined && <h2>{titulo}</h2>}
      {subtitulo !== undefined && <p className="subtitulo">{subtitulo}</p>}
      {children}
    </section>
  );
}

/**
 * Una tarjeta que **no pide sus datos hasta que alguien la abre**.
 *
 * Existe por una cuenta concreta: abrir una ficha costaba cinco lecturas —la
 * proyección, los KPIs, las lactancias, el historial y el historial de reglas—
 * y en el corral se entra a una ficha para cargar lo que se acaba de ver, no
 * para mirar la curva de lactancia. Lo que no se mira al entrar se pide al
 * abrirlo, y lo que se ahorra es la mitad de los pedidos de la pantalla.
 *
 * El contenido **se monta recién al abrir**, y eso es lo que dispara su
 * `usarPedido`: no hay una bandera que alguien tenga que acordarse de mirar.
 * Cerrarla lo desmonta, así que volver a abrirla vuelve a pedir — es una
 * lectura, la proyección la calcula el servidor y acá no hay caché optimista
 * (misma razón que en `usarPedido`).
 *
 * El título sigue siendo un `<h2>` con un botón adentro, que es la forma que ya
 * conocen los lectores de pantalla: el encabezado da la estructura y
 * `aria-expanded` dice si está abierta. Reemplazarlo por un `<div>` con clic
 * habría sacado la tarjeta del índice de la página.
 */
export function TarjetaPlegable({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);

  return (
    <section className="tarjeta">
      <h2 className="plegable">
        <button type="button" aria-expanded={abierta} onClick={() => setAbierta(!abierta)}>
          <span>{titulo}</span>
          <span className="flecha" aria-hidden="true">
            {abierta ? '⌄' : '›'}
          </span>
        </button>
      </h2>
      {abierta && (
        <>
          {subtitulo !== undefined && <p className="subtitulo">{subtitulo}</p>}
          {children}
        </>
      )}
    </section>
  );
}

export type TonoAviso = 'error' | 'atencion' | 'bien';

/**
 * Un mensaje. El `codigo` se muestra chiquito abajo: al tambero no le dice
 * nada, pero es lo primero que se pregunta cuando llama por teléfono porque
 * algo no lo deja cargar.
 */
export function Aviso({
  tono = 'error',
  titulo,
  children,
  codigo,
}: {
  tono?: TonoAviso;
  titulo?: string;
  children: ReactNode;
  codigo?: string | undefined;
}) {
  return (
    <div className={`aviso ${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      {titulo !== undefined && <h3>{titulo}</h3>}
      <p>{children}</p>
      {codigo !== undefined && <span className="codigo">{codigo}</span>}
    </div>
  );
}

/**
 * Una tarjeta cuyo pedido no volvió.
 *
 * Conserva el título —así se sabe **qué** falta y no solo que falta algo— y
 * ofrece reintentar en el lugar: en una pantalla donde cada tarjeta pide por su
 * cuenta (decisión 56), recargar la página entera para recuperar una sería
 * volver a pedir las que ya están.
 */
export function TarjetaCaida({
  titulo,
  error,
  reintentar,
}: {
  titulo: string;
  error: string | null;
  reintentar: () => void;
}) {
  return (
    <Tarjeta titulo={titulo}>
      <Aviso titulo="No se pudo traer">{error ?? 'El servidor no contestó.'}</Aviso>
      <button className="boton ancho secundario" type="button" onClick={reintentar}>
        Reintentar
      </button>
    </Tarjeta>
  );
}

/**
 * Lo que ve el de `lectura` donde el de `escritura` ve un formulario.
 *
 * Aparece solo si igual llegó —la ruta escrita a mano en la barra de
 * direcciones—, porque el camino normal es que el botón directamente no esté.
 * Es la red de cortesía delante de la red de verdad, que es el 403 del servidor:
 * mejor un renglón que explica que un formulario entero cuyo único final posible
 * es un rechazo.
 */
export function SoloLectura({ children }: { children: ReactNode }) {
  return (
    <Aviso tono="atencion" titulo="Tu permiso acá es de lectura">
      {children} Si necesitás cargar, pedile a un administrador que te dé permiso de escritura en
      este tambo.
    </Aviso>
  );
}

export function Cargando({ que = 'Cargando…' }: { que?: string }) {
  return (
    <p className="cargando" role="status">
      {que}
    </p>
  );
}

/**
 * Una cifra con su rótulo. Un `null` se escribe "sin datos" y **nunca 0**: son
 * cosas distintas y confundirlas es lo que la decisión 37 vino a evitar.
 */
export function Cifra({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="cifra">
      <span className={`valor${valor === SIN_DATO ? ' sin-datos' : ''}`}>{valor}</span>
      <span className="rotulo">{rotulo}</span>
    </div>
  );
}
