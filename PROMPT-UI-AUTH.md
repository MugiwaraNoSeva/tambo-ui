# Prompt: la cerradura en la UI

Sos un agente de código trabajando sobre este repo (`tambo-ui`). Este archivo es dos cosas: **el
prompt** y **tu documento de progreso**. Trabajás por partes, en orden; al terminar cada parte
marcás su casilla en la sección *Progreso* (con el hash del commit) y commiteás. Si tu sesión se
corta, el próximo agente lee este archivo y retoma desde la primera casilla sin marcar — por eso
las marcas se hacen al TERMINAR cada parte, nunca antes y nunca de a varias.

## Contexto

Esta es la UI web de una app de gestión de tambo (establecimiento lechero uruguayo) con event
sourcing. Está completa y andando: tablero, rodeo, ficha con curva de lactancia, carga de eventos
con el flujo de "Confirmar igual", anulación, alta y tanque. 100 tests, celular primero, **sin una
sola regla de dominio** — es un cliente de la API.

**Lo que pasó del otro lado**: el backend acaba de cerrar su Fase 6 y le puso la cerradura a toda
la API. Hoy esta UI **está rota contra ese backend**: no manda ningún header, así que todo
contesta 401. Tu tarea es ponerla al día.

El backend vive en otro repositorio (`tambo`, en `C:\Users\niky\Desktop\fabletambo`) y **no se
toca desde acá**: son dos repos, cada uno con su historia, su CI y su `git push`, y ningún commit
toca los dos. Si descubrís que falta algo del backend —y puede pasar—, se arregla allá, con su
test, su fila en §9 y su decisión numerada en §7 de `proyecto_app_tambo-1.md`, y se pushea por
separado. Acá no hay copia de esa spec: **todo lo que necesitás saber del contrato está escrito en
este archivo**, con las rutas y los cuerpos exactos.

## El contrato, completo

Todo pedido va con el token en el header, salvo el login:

```
Authorization: Bearer <token>
```

**El token dura 8 horas** y no hay refresh: a las 8 horas hay que volver a escribir la contraseña.

### Entrar y saber quién soy

| Pedido | Cuerpo | Respuesta |
|---|---|---|
| `POST /auth/login` | `{ "email": "…", "password": "…" }` | **200** `{ "token": "…", "usuario": {…} }` |
| `GET /auth/yo` | — | **200** `{ "usuario": {…} }` |
| `POST /auth/password` | `{ "actual": "…", "nueva": "…" }` | **204** sin cuerpo |

El `usuario` de las dos primeras tiene **exactamente** esta forma:

```json
{
  "id": "0192f0a0-0000-7000-8000-000000000000",
  "nombre": "Paulo",
  "email": "paulo@demo.local",
  "es_admin": false,
  "permisos": [{ "establecimiento_id": "0192…", "rol": "escritura" }]
}
```

- `rol` es `"escritura"` o `"lectura"`, y nada más. No hay rol de dueño.
- `es_admin: true` significa que puede todo en **todos** los tambos, y su `permisos` viene
  **vacío**: el admin no necesita permisos porque pasa siempre. Ojo con esto al armar el selector.
- **Los permisos se leen de la base en cada pedido**, no viajan adentro del token: si un
  administrador revoca un permiso, el pedido siguiente ya lo siente. `GET /auth/yo` devuelve el
  estado de ahora y no el de cuando se logueó.
- El login fallido contesta **401** con un mensaje único (`"Email o contraseña incorrectos."`): que
  el email no exista y que la contraseña esté mal se ven igual, a propósito. **Mostralo tal cual**,
  no lo reinterpretes.
- Un usuario desactivado que acierta la contraseña recibe un 401 con su propio mensaje
  (`"Tu usuario está desactivado…"`). También se muestra tal cual.
- `POST /auth/password` exige la actual; errarle es **401** (no 422). La nueva tiene un mínimo de
  **8 caracteres** y menos es **400**.

### Elegir tambo

| Pedido | Respuesta |
|---|---|
| `GET /establecimientos` | **200** `{ "establecimientos": [{ "id": "0192…", "nombre": "La Esperanza" }] }` |
| `GET /establecimientos/{est}` | **200** `{ "id": "…", "nombre": "…", "config": {…} }` |

`GET /establecimientos` devuelve **los míos**: los tambos donde tengo permiso, y todos si soy
admin. Es de acá que sale el selector — y existe justamente porque hoy hay con qué filtrarla.

### Lo que ya usabas, con dos cambios

Todas las rutas bajo `/establecimientos/{est}` siguen igual **salvo**:

1. **Exigen el header.** `GET` pide permiso de `lectura` o `escritura` sobre *ese* tambo; `POST`
   pide `escritura`. El admin pasa siempre.
2. **`usuario` sale del cuerpo de los POST.** El evento se firma con el token: `POST …/animales` y
   `POST …/animales/{id}/eventos` **no** llevan `usuario`, y si lo llevan es **400** — no se ignora
   en silencio. En las **respuestas** el campo `usuario` sigue viniendo (es quién firmó); eso no
   cambia.

### Los dos rechazos nuevos, y qué hacer con cada uno

El cuerpo de todo error es el que ya parseás, con `codigo`, `mensaje` y `forzable` — también para
estos dos, así que `ErrorApi` no necesita un segundo camino:

```json
{ "codigo": "NO_AUTENTICADO", "mensaje": "…", "forzable": false }
```

| Status | Código | Qué significa | Qué hace la UI |
|---|---|---|---|
| **401** | `NO_AUTENTICADO` | No hay token, venció, la firma no cierra, o el usuario se desactivó. | **Borra el token y vuelve al login.** Se arregla volviendo a entrar. |
| **403** | `SIN_PERMISO` | Hay sesión válida y no alcanza: no tengo permiso sobre ese tambo, o mi permiso es de lectura y estoy cargando. | **NO vuelve al login** — la sesión está bien. Vuelve al selector de tambo o muestra el mensaje. |

Confundirlos es el error clásico y se paga caro en las dos direcciones: mandar al login por un 403
manda al tambero a escribir la contraseña para siempre, y quedarse en la pantalla con un 401 lo
deja mirando un error que no se va.

**Un tambo sobre el que no tenés permiso contesta 403 exista o no** (es a propósito: 404 y 403
juntos dirían qué tambos existen). Así que un id guardado que ya no me corresponde se ve igual que
uno inventado, y las dos cosas se resuelven igual: de vuelta al selector.

### La demo, que es el backend de desarrollo

```bash
# en el repo del backend (C:\Users\niky\Desktop\fabletambo)
DEMO_PORT=3000 npm run demo --prefix api
# acá
npm run dev
```

La demo siembra el tambo poblado de siempre y **tres usuarios**, e imprime sus credenciales al
terminar junto a la URL y el id del establecimiento:

| rol | email | contraseña |
|---|---|---|
| admin | `admin@tambo.local` | `demo-admin` |
| escritura | `paulo@demo.local` | `demo-escritura` |
| lectura | `vet@demo.local` | `demo-lectura` |

Son credenciales de demostración: la base y el secreto de firma mueren con el proceso.

**Probá con los tres.** El de `lectura` es el que nadie prueba y el que más fácil se rompe.

## Convenciones (no negociables)

1. **Sin reglas de dominio.** Sigue valiendo palabra por palabra. El token y los permisos **no son
   dominio del tambo**: son de la aplicación, así que viven en el vocabulario de la UI y no en la
   copia del núcleo de `src/api/nucleo.ts`, que no se toca.
2. **Los mensajes de la API se muestran tal cual.** Están redactados para el tambero. No se
   reescriben, no se "mejoran" y no se traducen a otro tono — y menos los de auth, que están
   pensados para no decir de más.
3. **Celular primero** y **español rioplatense**, como todo lo que ya está.
4. **El token no se loguea ni se muestra.** Ni en un `console.log` de depuración, ni en un mensaje
   de error, ni en la pantalla. Tampoco la contraseña.
5. **Un solo lugar sabe de HTTP**: `src/api/cliente.ts`. El header se pone ahí y en ningún otro
   lado; ninguna pantalla arma una URL ni un header.
6. **Las decisiones de diseño de la UI se registran en `README.md`**, en una sección propia y en
   prosa, con el problema, el porqué y qué se descartó — el estilo de las que ya cita el README.
   No inventes una numeración paralela: el registro numerado (§7) vive en la spec del otro repo, y
   lo que sí va numerado allá es cualquier cambio que le pidas al backend.
7. Cada parte cierra con: **la suite en verde**, `npm run typecheck` limpio, `npm run build`
   andando, casilla marcada con hash, commit al estilo del historial y `git push`.

## Lo que NO entra en esta tanda

El backend tiene rutas de administración (`POST /usuarios`, `GET /usuarios`,
`PATCH /usuarios/{id}`, `PUT|DELETE /usuarios/{id}/permisos/{est}`), y **no se hace pantalla para
eso**. Es trabajo de admin, se hace una vez cada tanto y hoy se hace con `curl`; ponerlo en la UI
del corral es alcance que nadie pidió. Si te tienta, anotalo y seguí.

Lo único de administración que sí entra es el **cambio de contraseña propia**
(`POST /auth/password`), que es del tambero y no del admin.

## Las partes

### Parte 1 — El token: dónde vive y cómo viaja

- **`src/sesion.ts`** (nuevo, o `almacen.ts` crecido —elegí y explicá—): guardar, leer y olvidar el
  token. **Dónde lo guardás es una decisión y va al README con su porqué.** Los candidatos y sus
  costos reales, para que la elijas y no la heredes:
  - `localStorage` sobrevive al recargar y al cerrar el browser. Es lo que hace que el celular que
    se bloquea cada dos minutos en el corral no pida la contraseña de nuevo cada vez que la
    pantalla se apaga y el tambero vuelve a la app. El costo es que cualquier XSS lo lee — y lo que
    hay que decir es qué tan grande es ese costo acá: sin dependencias de terceros en runtime, sin
    contenido de usuarios de otros tambos en pantalla y con 8 horas de techo.
  - `sessionStorage` se va al cerrar la pestaña, que en un celular pasa todo el tiempo.
  - En memoria (solo un `useState`) es lo más seguro y obliga a loguearse en cada recarga.
- **El header, en `pedir()` de `src/api/cliente.ts`** y en ningún otro lugar: si hay token, va.
  Ojo con `fetch`, que hoy solo manda `content-type` cuando hay cuerpo — el header de auth va
  **siempre**, con cuerpo o sin cuerpo.
- **Las tres operaciones nuevas del cliente**: `api.login({email, password})`, `api.yo()` y
  `api.cambiarPassword({actual, nueva})`, con sus tipos en `src/api/tipos.ts`. `login` es la única
  que no manda header.
- **El 401 vuelve al login, desde una sola parte.** El `pedir()` que recibe un 401 tiene que
  borrar el token y avisarle a la app, y eso incluye **el 401 que llega a las 8 horas con la
  sesión abierta y a mitad de una carga**: no puede quedar en un `Aviso` de una pantalla suelta.
  Resolvelo con un aviso registrable desde `App` (un callback en el módulo del cliente, o un evento
  propio) y **decilo en el README**: es la parte que un lector nuevo no adivina.
  - Cuando eso pase, el tambero tiene que **entender qué pasó y no perder lo que escribió en
    silencio**: el mensaje que manda la API ya dice "Tu sesión venció: dura 8 horas". Mostralo.
    Si lo que estaba haciendo era una carga, que quede claro que ese evento **no se guardó**.
- Tests con el `montarApi` que ya existe (`tests/servidor.ts`): que el header viaje en un GET y en
  un POST, que el login no lo mande, y que un 401 borre el token guardado.

### Parte 2 — La pantalla de login y el arranque de la app

- **`src/pantallas/Login.tsx`**: email y contraseña, y nada más. Para el corral: `type="email"`,
  `autoComplete="username"` / `"current-password"`, `autoCapitalize="off"`, `spellCheck={false}`,
  botón ancho y estado "Entrando…". El error se muestra tal cual lo manda la API.
- **`App.tsx` pasa a tener tres estados** y el orden importa:
  1. **sin token** → `Login`;
  2. **con token pero sin saber quién soy** → `GET /auth/yo` (es lo primero que se llama al
     arrancar). Si contesta 401, se borra el token y se va a `Login` sin mostrar ningún error: un
     token vencido de ayer no es una falla que haya que explicar;
  3. **con usuario** → lo de siempre, con el `usuario` disponible para las pantallas de abajo (un
     contexto, como `ProveedorEstablecimiento`).
- **Salir**: un botón que borra el token y vuelve al login, junto a "Cambiar de tambo".
- **`POST /auth/password`** en algún lugar alcanzable —una pantalla mínima o una tarjeta en el
  tablero—: exige la actual, la nueva con 8 caracteres, y al terminar avisa que quedó cambiada. No
  cierra la sesión, y eso está bien.
- **Ojo con la suite entera acá**: `montarApi` **tira** si la pantalla pide una ruta que el test no
  previó, así que todos los tests que renderizan `<App>` se van a caer cuando `App` empiece a pedir
  `GET /auth/yo` y `GET /establecimientos`. No los parchees uno por uno a mano: hacé un helper
  —`sesionDePrueba()` en `tests/fixtures.ts` o en `preparacion.ts`— que devuelva las dos rutas
  listas y un token guardado, y usalo en todos. Va a ser el cambio más grande en líneas de toda la
  tanda y es puro andamio: que quede en un solo lugar.

### Parte 3 — El selector de tambo, armado con los permisos

- **`Conexion.tsx` se muere como está.** Hoy pide que se escriba un uuid a mano y su propio
  comentario explica por qué: no había de dónde sacar la lista. Ahora hay `GET /establecimientos`.
  Pasa a ser una **lista para tocar con el dedo**, con el nombre de cada tambo.
- **Los casos, todos:**
  - **un solo tambo** → entrar directo, sin pantalla intermedia. Es el caso del 90% de la gente y
    una lista de un elemento es una pantalla de peaje;
  - **varios** → la lista, y queda guardado el último elegido (ahí `localStorage` está bien: no es
    un secreto);
  - **ninguno** → un aviso que diga qué hacer ("todavía no te dieron acceso a ningún tambo, pedíselo
    a un administrador"), **no** una lista vacía ni un error;
  - **el guardado ya no está en la lista** —le revocaron el permiso, o es de otra demo— → al
    selector, sin dejarlo pegado. El `localStorage` propone; la lista de la API decide.
- **`almacen.ts` se achica**, como su propio comentario predijo: sigue guardando el establecimiento
  elegido y ya no es lo único que la UI recuerda.
- Un 403 en cualquier pedido de un tambo tiene que llevar al selector y no al login (ver la tabla
  de arriba).
- Tests: los cuatro casos, y el del permiso revocado con el tambo guardado.

### Parte 4 — Qué ve y qué no ve el rol de lectura

- **De dónde sale el rol**: de `usuario.permisos`, buscando el `establecimiento_id` activo. La
  cuenta completa es `puedeCargar = usuario.es_admin || rol === 'escritura'` — **el admin tiene
  `permisos: []` y puede todo**, y si te olvidás de esa mitad el admin ve una UI de solo lectura.
  Ponelo en un solo lugar (el contexto del establecimiento activo, junto al `nombre` y la `Config`)
  y que ninguna pantalla lo recalcule.
- **Lo que el de lectura no ve**: los botones y accesos de carga —"Cargar evento", el alta de
  animal, el registro de tanque, la anulación—. Que no estén, no que estén y fallen.
- **Y si igual llega**: la ruta escrita a mano en la barra de direcciones tiene que dar un aviso
  legible ("tu permiso en este tambo es de lectura"), no un formulario que va a comerse un 403 al
  enviar. El 403 del servidor sigue siendo la red de atrás; esto es para que no haga falta.
- **Nada de esto es seguridad.** La cerradura está en la API y esto es una cortesía con el que
  mira: no escondas nada creyendo que eso lo protege, y no dupliques la regla de permisos en
  ninguna parte más que en ese único lugar.
- Tests con los tres roles: `lectura` no ve los botones, `escritura` sí, y el admin sin permisos
  también.

### Parte 5 — `usuario` fuera del cuerpo, el proxy y el README

- **`src/api/tipos.ts`**: sacar `usuario?: string` de los dos cuerpos de pedido (`CuerpoAlta` y
  `CuerpoEvento`). Hoy ninguna pantalla lo manda —el campo está en el tipo y nadie lo llena—, así
  que es un cambio chico: confirmalo con un `grep -rn usuario src` y fijate que lo único que queda
  sea el `usuario: string | null` de la **respuesta** del log, que se queda.
- **`vite.config.ts`**: el proxy del servidor de desarrollo reenvía hoy `/establecimientos` y
  `/salud`, y nada más. **Agregá `/auth`** (y `/usuarios` si alguna vez lo usás). Sin esto el login
  contra la demo falla por CORS y el síntoma no dice nada de la causa: es la primera media hora que
  pierde el que venga después.
- **`README.md` al día**: cómo se entra, las credenciales de la demo, el token de 8 horas, dónde
  vive el token y por qué, qué pasa a las 8 horas, 401 vs 403, y qué ve el rol de lectura. Más la
  sección de decisiones de la convención 6.

### Parte 6 — Probar con los tres, y cerrar

- **Contra la demo de verdad, en un browser**, con los tres usuarios: entrar, elegir tambo, cargar
  un evento con el de escritura, mirar todo con el de lectura y ver que no aparezcan los botones de
  carga, y entrar con el admin (que no tiene permisos y tiene que ver todos los tambos).
- Probá también: recargar la página con sesión abierta (no tiene que pedir la contraseña de nuevo),
  y salir y volver a entrar.
- Cierre: suite en verde, `npm run typecheck`, `npm run build`, CI del repo en verde, README al día,
  y **`PROMPT-UI-AUTH.md` borrado en el último commit** — la misma convención que el prompt del
  backend.
- Cuando esto esté, avisá: en el otro repo queda un último commit que borra su propio
  `PROMPT-AUTH.md`, y se hace con los dos repos en verde y pusheados.

## Si algo te bloquea

Paulo no está mirando mientras corrés. Cuando te topes con algo que este prompt no resuelve:
**decidí con el criterio del proyecto, dejalo registrado en el README con lo que descartaste, y
seguí.** Lo que no se hace es inventar en silencio ni frenar la parte entera. Si lo que falta es
del backend, arreglalo allá con su test y su decisión numerada, en un commit aparte, y seguí acá.
Si es algo que solo Paulo puede decidir, dejalo anotado en la casilla de la parte y hacé todo lo
demás.

## Progreso

Marcá al terminar cada parte: `- [x] Parte N — <hash> — <una línea de qué quedó>`.

- [x] Parte 1 — 54c21a4 — `sesion.ts` con el token en `localStorage` y el aviso de sesión caída; el header y el 401 en `pedir()`, único lugar que sabe de HTTP; `login`, `yo`, `cambiarPassword` y `establecimientos` en el cliente. Un 401 con una contraseña en el cuerpo (el login y `/auth/password`) **no** vuelve al login: su 401 habla de esa contraseña
- [ ] Parte 2 — La pantalla de login, el arranque con `/auth/yo` y el andamio de los tests
- [ ] Parte 3 — El selector de tambo armado con `GET /establecimientos`
- [ ] Parte 4 — Qué ve y qué no ve el rol de lectura
- [ ] Parte 5 — `usuario` fuera del cuerpo, el proxy de `/auth` y el README
- [ ] Parte 6 — Probado con los tres roles, CI en verde y este archivo borrado
