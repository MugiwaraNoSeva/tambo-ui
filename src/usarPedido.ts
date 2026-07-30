// ─────────────────────────────────────────────────────────────────────────────
// Un pedido a la API con sus tres estados, que son siempre los mismos.
//
// Toda pantalla de lectura hace lo mismo: pide, muestra "cargando", y termina o
// en datos o en un mensaje de error. Escrito una vez acá, ninguna pantalla tiene
// `useEffect` con dependencias que se olvidan ni un `setState` sobre un
// componente que ya no está.
//
// El `recargar` existe porque después de cargar un evento hay que volver a
// preguntar: la proyección la calcula el servidor y la UI no la puede adivinar
// (es la misma razón por la que no hay caché optimista en ningún lado).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { ErrorApi, ErrorDeRed } from './api/cliente';

export interface Pedido<T> {
  datos: T | null;
  cargando: boolean;
  error: string | null;
  /**
   * El rechazo entero, para el que necesite algo más que el texto. Casi nadie:
   * una pantalla que muestra un error solo quiere `error`. Lo mira quien tiene
   * que **decidir** con el status —el 403 del selector, que vuelve a elegir
   * tambo en vez de mostrar un aviso—, y por eso viaja al lado y no en lugar
   * del mensaje.
   */
  causa: unknown;
  recargar: () => void;
}

/** El texto que se le muestra a quien está en el corral, venga de donde venga. */
export function mensajeDe(error: unknown): string {
  if (error instanceof ErrorApi || error instanceof ErrorDeRed) return error.message;
  if (error instanceof Error) return error.message;
  return 'Algo salió mal y no sabemos qué. Volvé a intentar.';
}

/**
 * `traer` tiene que ser estable (envolverlo en `useCallback` en el llamador) o
 * la pantalla se queda pidiendo para siempre. Es el precio de no traer una
 * librería de datos entera para cinco pantallas.
 */
export function usarPedido<T>(traer: () => Promise<T>): Pedido<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [causa, setCausa] = useState<unknown>(null);
  const [intento, setIntento] = useState(0);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    setCausa(null);
    traer().then(
      (resultado) => {
        if (!vigente) return;
        setDatos(resultado);
        setCargando(false);
      },
      (rechazo: unknown) => {
        if (!vigente) return;
        setError(mensajeDe(rechazo));
        setCausa(rechazo);
        setCargando(false);
      },
    );
    // La bandera evita pisar el estado con la respuesta de un pedido viejo
    // cuando la pantalla ya cambió — en el celular, con red lenta, pasa.
    return () => {
      vigente = false;
    };
  }, [traer, intento]);

  return { datos, cargando, error, causa, recargar };
}

/** ¿Este rechazo es un 403? Lo pregunta quien vuelve al selector en vez de avisar. */
export const esSinPermiso = (causa: unknown): boolean =>
  causa instanceof ErrorApi && causa.status === 403;
