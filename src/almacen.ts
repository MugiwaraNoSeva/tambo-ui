// ─────────────────────────────────────────────────────────────────────────────
// Lo poco que la UI recuerda entre visitas.
//
// Sigue siendo una sola cosa: **qué establecimiento está activo**. Se elige una
// vez y queda guardado, porque un tambero trabaja en un tambo y volver a
// elegirlo cada mañana sería una pantalla de peaje.
//
// Con la cerradura puesta, este módulo se achicó como su comentario anticipaba:
// **ya no es lo único que la UI recuerda** —el token vive en `sesion.ts`, que es
// una credencial y no una preferencia— y **ya no decide nada**. Lo guardado acá
// propone; quien decide es `GET /establecimientos`, que dice cuáles son míos. Un
// id que quedó de otra demo, o un permiso revocado, no vuelven a dejar la app
// arrancando contra un tambo al que no puede entrar.
//
// `localStorage` puede estar apagado (modo privado de algunos browsers) y tirar
// al leer. Envuelto en try/catch: sin almacenamiento la app funciona igual,
// solo que vuelve a preguntar el establecimiento cada vez.
// ─────────────────────────────────────────────────────────────────────────────

const CLAVE = 'tambo.establecimiento';

export function establecimientoGuardado(): string | null {
  try {
    const valor = window.localStorage.getItem(CLAVE);
    return valor === null || valor === '' ? null : valor;
  } catch {
    return null;
  }
}

export function guardarEstablecimiento(id: string): void {
  try {
    window.localStorage.setItem(CLAVE, id);
  } catch {
    // Sin almacenamiento se sigue: la elección vale para esta sesión.
  }
}

export function olvidarEstablecimiento(): void {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // Ídem.
  }
}
