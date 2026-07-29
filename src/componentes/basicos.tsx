// Las piezas que se repiten en todas las pantallas. Nada acá sabe de vacas: son
// la caja, el aviso, el "esperá", la cifra con su rótulo y la caja que se cayó.

import type { ReactNode } from 'react';
import { SIN_DATO } from '../formato';

export function Tarjeta({
  titulo,
  subtitulo,
  children,
}: {
  titulo?: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <section className="tarjeta">
      {titulo !== undefined && <h2>{titulo}</h2>}
      {subtitulo !== undefined && <p className="subtitulo">{subtitulo}</p>}
      {children}
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
