// ─────────────────────────────────────────────────────────────────────────────
// La sesión: el token, dónde vive, y el aviso de que se cayó.
//
// Va en su propio módulo y no adentro de `almacen.ts` —que también escribe en
// `localStorage`— porque son dos cosas con vidas distintas. El establecimiento
// elegido es una preferencia: no es secreto, no vence y se olvida cuando el
// tambero quiere. El token es una credencial: es secreto, vence a las 8 horas y
// **se lo borra la API**, desde afuera, cuando contesta 401. Mezclarlos haría
// que "olvidar" signifique dos cosas en el mismo archivo, y que el día que haya
// que limpiar lo uno se limpie también lo otro sin querer.
//
// **Dónde vive el token: `localStorage`.** El porqué, con su costo, está en el
// README —es una decisión y no un default heredado—. En corto: el celular en el
// corral se bloquea cada dos minutos y el tambero vuelve a la app con una mano
// sucia; `sessionStorage` le pediría la contraseña cada vez que la pestaña se
// cierra, y solo en memoria, en cada recarga. Ocho horas de techo y ninguna
// dependencia de terceros en runtime es lo que hace que ese costo se banque.
//
// `localStorage` puede estar apagado (modo privado de algunos browsers) y tirar
// al leer o al escribir. Todo va envuelto en try/catch, igual que en `almacen`:
// sin almacenamiento la app anda lo mismo, solo que la sesión dura lo que dure
// la pestaña.
// ─────────────────────────────────────────────────────────────────────────────

const CLAVE = 'tambo.token';

export function tokenGuardado(): string | null {
  try {
    const valor = window.localStorage.getItem(CLAVE);
    return valor === null || valor === '' ? null : valor;
  } catch {
    return null;
  }
}

export function guardarToken(token: string): void {
  try {
    window.localStorage.setItem(CLAVE, token);
  } catch {
    // Sin almacenamiento se sigue: la sesión vale mientras la pestaña esté abierta.
  }
}

export function olvidarToken(): void {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // Ídem.
  }
}

// ── El aviso de que la sesión se cayó ────────────────────────────────────────
//
// El 401 puede llegar en cualquier momento y en cualquier pantalla: el caso que
// importa es el de las 8 horas, con la sesión abierta y a mitad de una carga.
// Ese aviso no puede terminar en el `Aviso` de la pantalla de turno, porque la
// pantalla de turno está por desaparecer.
//
// Por eso el camino es al revés de lo habitual: `cliente.ts` **avisa** acá
// cuando la API contesta 401, y `App` —que es el único que puede cambiar de
// pantalla— se registra para escucharlo. Es un callback y no un evento del DOM
// para que el typecheck sostenga la forma del mensaje, y para que la suite no
// dependa de `window`.

type Escucha = (mensaje: string) => void;

let escuchas: Escucha[] = [];

/**
 * Registra quién se entera de que la sesión se cayó. Devuelve la baja, para
 * llamarla desde el `useEffect` que la dio de alta.
 */
export function alCaerLaSesion(escucha: Escucha): () => void {
  escuchas = [...escuchas, escucha];
  return () => {
    escuchas = escuchas.filter((e) => e !== escucha);
  };
}

/**
 * La sesión no vale más: se borra el token y se avisa. Lo llama el cliente HTTP
 * al recibir un 401, y el `mensaje` es el de la API tal cual —"Tu sesión venció:
 * dura 8 horas"—, que es lo que hay que mostrarle al tambero para que entienda
 * por qué está de vuelta en el login.
 *
 * El token se borra **antes** de avisar: si un escucha dispara un pedido nuevo,
 * que no lo mande con la credencial que la API ya rechazó.
 */
export function caerLaSesion(mensaje: string): void {
  olvidarToken();
  for (const escucha of escuchas) escucha(mensaje);
}
