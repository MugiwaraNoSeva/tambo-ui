# Prompt: el panel del admin — los tambos, su gente, y entrar a usarlos

Sos un agente de código trabajando sobre este repo (`tambo-ui`). Este archivo es dos cosas: **el
prompt** y **tu documento de progreso**. Trabajás por partes, en orden; al terminar cada parte
marcás su casilla en *Progreso* (con el hash del commit) y commiteás. Si tu sesión se corta, el
próximo agente lee este archivo y retoma desde la primera casilla sin marcar — por eso las marcas
se hacen al TERMINAR cada parte, nunca antes y nunca de a varias.

## Contexto

`tambo-ui` es la UI web de una app de gestión de tambo (establecimiento lechero uruguayo) con
event sourcing. La app entera está completa y desplegada: la base en Supabase, la API y esta UI en
Render. El backend vive en `https://github.com/MugiwaraNoSeva/tambo.git` (clonado en
`C:\Users\niky\Desktop\fabletambo`), con la spec `proyecto_app_tambo-1.md`: **§9 es el contrato de
la API y la única fuente de verdad** sobre rutas, cuerpos y permisos; §5.6 son los códigos de
error; §7 son las decisiones numeradas del backend.

Hoy esta UI es **la pantalla del tambero y nada más**. Su `README.md` lo dice con todas las
letras: *"Lo único de administración que vive en esta UI es cambiar la contraseña propia. Crear
usuarios y repartir permisos se hace con `curl` contra la API"*. Y `pantallas/Conexion.tsx`, cuando
un admin entra a una base recién instalada, le imprime en pantalla los tres `curl` que tiene que
correr.

**Eso es lo que esta tanda viene a cambiar.** Paulo quiere que el administrador tenga su panel:
que vea los tambos, que adentro de cada tambo vea a la gente que tiene acceso, y que desde ahí
pueda entrar al tambo y usarlo como un usuario más.

## Lo que Paulo decidió (no se re-discute)

Salió de una conversación con él. Son tres y en este orden, que es el orden de la navegación:

1. **El admin ve los tambos.** Esa es su pantalla de inicio, no el selector del tambero.
2. **Adentro de un tambo, ve a los usuarios registrados en ese tambo**, con qué permiso entra cada
   uno, y puede repartirlos.
3. **Desde ahí puede entrar al tambo y manipularlo como un usuario más** — la app de siempre,
   entera, con la vuelta al panel a un toque.

Y una cuarta que se sigue de la primera: si el panel existe, **crear el tambo, crear la persona y
darle el permiso se hacen desde acá**. El lote completo o no vale la pena: un panel que muestra y
no toca deja el `curl` igual de necesario que hoy, y entonces no cambió nada.

### Lo que NO es, y conviene que lo leas antes de empezar

- **No es "ver la app con los ojos de otro".** Entrar al tambo es entrar **como vos, que sos
  admin**: podés cargar todo, porque un admin puede cargar todo. No se simula el rol de `lectura`,
  no hay "ver como", no hay suplantación de nadie. `puedeCargarEn()` ya devuelve `true` para el
  admin y **eso no se toca**. Una UI que le miente al admin sobre lo que puede hacer es peor que no
  tener panel.
- **No se borra a nadie.** No hay `DELETE /usuarios` y no es un olvido: `eventos.usuario_id` es una
  FK y el log no admite DELETE ni UPDATE (decisión 76 del backend). Lo que hay es `activo: false`.
  Si te encontrás dibujando un tacho de basura, pensaste mal.
- **No se edita la `Config` del tambo, ni su nombre.** No existe `PATCH /establecimientos/{est}`:
  la `Config` se fija al crear y después no la cambia nadie, ni por acá ni por `curl`. Un
  formulario que ofrezca editarla sería una pantalla que promete algo que la API no puede cumplir.
- **No hay paginación, ni búsqueda, ni auditoría.** `GET /usuarios` devuelve todos, sin paginar y
  por nombre, y el sistema tiene un puñado de personas. Cuando sean cientos, se revisa.

## Lo que ya está del lado de la API: nada que agregar

**Esta tanda no toca el backend.** Las seis rutas que el panel necesita existen desde la Fase 6 y
están en §9. Verificalas ahí antes de escribir el cliente — esta tabla es un resumen, §9 es el
contrato:

| método | ruta | quién | qué |
|---|---|---|---|
| `GET` | `/establecimientos` | autenticada | Los míos, **y todos si soy admin** (decisión 81). De acá sale la lista del panel. |
| `POST` | `/establecimientos` | admin | `{nombre, config?}` → `{id, nombre}`, 201. |
| `GET` | `/usuarios` | admin | **Todos**, con sus permisos, **incluidos los desactivados**, por nombre. |
| `POST` | `/usuarios` | admin | `{nombre, email, password, es_admin?}` → el usuario con `permisos: []`, 201. |
| `PATCH` | `/usuarios/{id}` | admin | `{nombre?, activo?, es_admin?, password?}` — al menos uno, y un campo desconocido es **400**. |
| `PUT` | `/usuarios/{id}/permisos/{est}` | admin | `{rol}` con `escritura` o `lectura`. Otorga **o cambia**: es idempotente. |
| `DELETE` | `/usuarios/{id}/permisos/{est}` | admin | Revoca. Idempotente, **204 aunque no hubiera nada que revocar**. |

El usuario visto por un admin trae **un campo más** que el de `/auth/yo`: `activo`. Está en
`api/src/auth/vista.ts` del backend, y el porqué de que sean dos vistas y no una está escrito ahí:
para el admin, quién está afuera es la mitad de la información.

El proxy de desarrollo (`vite.config.ts`) ya reenvía `/usuarios` además de `/auth`,
`/establecimientos` y `/salud`. No hay que agregarle nada — verificalo, no lo rehagas.

## Convenciones (no negociables)

1. **La UI no tiene reglas de dominio**, y esto no las agrega: los permisos no son dominio del
   tambo, pero el panel igual no valida nada que la API valide. Manda el pedido y muestra lo que
   contesta, **con el mensaje de la API tal cual**. La única validación local es de forma (que el
   email tenga forma de email, que la contraseña tenga 8 caracteres) y existe para no hacer viajar
   un pedido que ya se sabe roto.
2. **Cero dependencias nuevas.** Ni un router, ni una librería de tablas, ni un date picker. Si
   creés que una es inevitable, paralo y dejalo anotado en la casilla en vez de agregarla.
3. **Celular primero**, también acá. Targets de 48 px, tipografía de 17 px, funciona con una mano.
   El admin va a repartir un permiso parado en la tranquera igual que el tambero carga un celo.
   **Reusá el sistema de diseño que ya está** (`estilos.css`): `.tarjeta`, `.lista`, `.fila`,
   `.campo`, `.boton ancho secundario`, `.etiqueta`, `.renglon`, `.vacio`, `.acciones`. Si te falta
   una clase, agregala en el mismo estilo y en el mismo archivo — no hay CSS por componente.
4. **Ningún estado se comunica solo con color.** `escritura`, `lectura`, `administrador` y
   `desactivado` llevan siempre su palabra.
5. **Español rioplatense** en toda la interfaz, como todo lo que ya está.
6. **Las decisiones de diseño de la UI se registran en el `README.md` de este repo**, en la sección
   de prosa que ya existe, con el problema, el porqué y lo que se descartó. El registro numerado
   (§7) es del otro repo y esta tanda no lo toca.
7. Cada parte cierra con: `npm test` en verde, `npm run typecheck` limpio, `npm run build`, casilla
   marcada con hash, commit al estilo del historial y `git push`.
8. **Lo que no puedas verificar, no lo declares hecho.**

## Las partes

### Parte 1 — Las seis operaciones que le faltan al cliente

`src/api/cliente.ts` es **el único lugar de la UI que sabe que la API existe**, y hoy no tiene una
sola operación de administración. Sin esto no hay panel que armar.

- En `src/api/tipos.ts`, el vocabulario que falta. Va en la sección *"Quién soy y qué puedo"*, al
  lado de `Usuario` y `Permiso`, porque es lo mismo visto por el admin:
  - `UsuarioAdmin` — `Usuario` más `activo: boolean`. Escribilo como extensión y no copiando los
    campos: el día que a `Usuario` le agreguen uno, este tiene que enterarse.
  - `RespuestaUsuarios`, `CuerpoAltaUsuario`, `CuerpoPatchUsuario`, `CuerpoPermiso`,
    `RespuestaEstablecimientoCreado`.
  - Los campos del `PATCH` son **todos opcionales y hay que mandar al menos uno**. Un `{}` es 400.
- En `cliente.ts`, las seis, con el nombre de la operación y no de la ruta, en el orden de §9. La
  URL se arma adentro, como todas: nadie concatena rutas afuera de este archivo.
- **`revocarPermiso` contesta 204**, o sea sin cuerpo. `pedir()` ya lo maneja (devuelve
  `undefined`), pero hoy el único 204 de la app es `POST /auth/password` y el helper `get`/`post`
  no cubre `PUT` ni `DELETE`: vas a tener que llamar a `pedir()` directo. Que se note en el código
  que es a propósito.
- **No agregues `validaUnaPassword` a ninguna de estas.** Esa marca es para el pedido cuyo 401
  habla de una contraseña escrita en el formulario; acá la contraseña que viaja es la que el admin
  le pone a **otro**, y un 401 en `POST /usuarios` sí es la sesión del admin que se cayó. Son dos y
  siguen siendo dos.
- Tests en `tests/cliente.test.ts`: que cada operación pegue en la ruta correcta con el método
  correcto, que el token viaje, que el 204 no reviente al parsear, y que un 409 llegue como
  `ErrorApi` con su cuerpo entero.

### Parte 2 — El ruteo, y dónde se parte el árbol

Acá está el trabajo de arquitectura de toda la tanda, y conviene entenderlo antes de escribir una
línea.

Hoy `App.tsx` es una escalera: *hay token* → *sé quién soy* → **elijo tambo** → `Conectado`
verifica contra la API y monta `ProveedorEstablecimiento` → `Pantallas` lee la ruta y dibuja. O sea
que **`usarRuta()` se consulta recién adentro del establecimiento activo**, y todas las rutas que
existen son rutas *de un tambo*.

El panel del admin **no es de un tambo**: la lista de tambos no tiene tambo, y la lista de gente de
un tambo se mira sin estar conectado a él. Entonces el árbol se parte más arriba.

- Rutas nuevas en `src/ruteo.ts`, con sus constructoras (`aPanel()`, `aPanelTambo(id)`,
  `aPanelUsuarios()`) porque las direcciones se arman con funciones y no a mano:
  - `#/admin` — la lista de tambos;
  - `#/admin/tambos/{id}` — un tambo y su gente;
  - `#/admin/usuarios` — todas las personas del sistema (la Parte 5).
- `leerRuta()` hoy manda al tablero **todo lo que no entiende**, y está bien: una pantalla de "no
  encontrado" para un hash tipeado a mano no le sirve a nadie. Con el panel eso deja de ser
  inofensivo — `#/admin` de un no-admin caería en el tablero de su tambo, que es una respuesta
  rara pero aceptable, y `#/admin/tambos/{id}` de un tambo ajeno lo mismo. **Decidilo y dejalo
  escrito**, no lo dejes pasar por omisión.
- En `App.tsx`: la ruta se lee **antes** de elegir tambo cuando el usuario es admin y la ruta es de
  admin. El panel se dibuja sin `ProveedorEstablecimiento` y sin `Conectado`, porque no hay
  establecimiento activo que proveer. Lo que sí necesita es `ProveedorUsuario`, que ya está montado
  más arriba.
- **La puerta.** El panel es del admin: si `usuario.es_admin` es `false`, esas rutas no existen para
  él. Y como siempre, **esto no es seguridad** —la API contesta 403 y esa es la red de verdad—: es
  cortesía, y se escribe con el mismo criterio que la decisión de la UI sobre el rol de lectura, que
  ya está en el README.
- Tests en `tests/ruteo.test.ts` para las tres rutas nuevas y para el hash desconocido.

### Parte 3 — La lista de tambos, que es la pantalla de inicio del admin

`GET /establecimientos` ya le devuelve **todos** al admin (decisión 81 del backend). La pantalla es
esa lista, más el alta.

- Pantalla nueva, `src/pantallas/Panel.tsx`. Cada fila: el nombre del tambo y cuánta gente entra
  —que sale de cruzar con `GET /usuarios`, ver Parte 4— y lleva a `#/admin/tambos/{id}`. Si el
  cruce te obliga a pedir los usuarios en esta pantalla también, pedilos: son dos GET y el panel no
  es la pantalla del corral.
- **Crear el tambo**: un formulario de un campo, el nombre. **Sin `config`**, que se manda ausente y
  la API pone `CONFIG_DEFAULT` — releé arriba por qué no se ofrece editarla.
- **El vacío es la primera pantalla que alguien ve en producción.** Hoy `Conexion.tsx` le imprime al
  admin los tres `curl`, con un párrafo que explica que administrar "no le corresponde a la pantalla
  del corral". **Eso se va**: ahora sí le corresponde, y el vacío es un botón que crea el primer
  tambo. Borrá el mensaje viejo entero, no lo dejes de refugiado.
- El `Conexion.tsx` del no-admin **no se toca**: "todavía no te dieron acceso a ningún tambo,
  pedíselo a un administrador" sigue siendo la verdad para él.

### Parte 4 — El tambo por dentro: quién entra y con qué permiso

El corazón de lo que pidió Paulo, y donde están las tres trampas que la respuesta obvia no ve.

La lista sale de `GET /usuarios` filtrando por `permisos`, con
`u.permisos.some((p) => p.establecimiento_id === est)`. No hay endpoint de "usuarios de este tambo"
y no hace falta: la respuesta trae todo lo que se necesita, en un pedido. Ahora, las trampas:

1. **Los administradores no tienen permisos, y entran igual.** Un admin viene con `permisos: []`
   *a propósito* (decisión 68 del backend), así que el filtro de arriba **no lo devuelve nunca** — y
   una pantalla que diga "quién entra a este tambo" y omita a las tres personas que entran a todos
   está mintiendo. Mostralos, aparte y dicho con esas palabras: son gente que entra a este tambo sin
   figurar en su reparto. **Es el defecto más probable de esta parte** y ningún test lo agarra si
   la fixture no tiene un admin adentro. Que la tenga.
2. **Los desactivados vienen en la lista.** `GET /usuarios` los incluye a propósito. Un usuario
   `activo: false` con permiso de escritura sobre este tambo **no entra**, aunque el permiso siga
   ahí. Mostralo con su palabra, no lo escondas y no lo mezcles con los que sí entran.
3. **La misma respuesta trae a todo el sistema**, así que "darle acceso a alguien que ya existe" no
   necesita otro pedido: es elegir de la gente que no está en este tambo y mandar el `PUT`.

Y las acciones de la pantalla, que son tres:

- **Dar acceso** — `PUT /usuarios/{id}/permisos/{est}` con `escritura` o `lectura`.
- **Cambiar el permiso** — el mismo `PUT`. Es idempotente y cambia en su lugar: no hay que revocar
  antes, y hacerlo dejaría un hueco en el medio.
- **Sacar el acceso** — `DELETE`, que contesta 204 aunque no hubiera nada. **El efecto es
  inmediato**: los permisos se leen de la base en cada pedido, así que quien esté con la pantalla
  abierta lo pierde en el request siguiente. Decilo en la pantalla, que es lo que hace que el admin
  entienda qué acaba de hacer.
- Después de cada una, la lista se recarga: la respuesta del `PUT` trae el usuario actualizado, pero
  el que decide es el servidor.

### Parte 5 — Las personas: crearlas, editarlas, desactivarlas, resetearles la contraseña

`#/admin/usuarios`, y también alcanzable desde el tambo (dar acceso a alguien que todavía no
existe es un `POST /usuarios` seguido de un `PUT`).

- **Crear**: nombre, email, contraseña inicial (8 mínimo) y una casilla de administrador. La
  contraseña es **obligatoria** aunque la base admita cuentas sin ninguna: crear a alguien sin
  contraseña es crear a alguien que no puede entrar y que va a llamar por teléfono.
- **Mostrá la contraseña inicial una vez, después de crear**, con la instrucción de pasársela a la
  persona y que la cambie en "Mi cuenta". Del otro lado no hay correo que mandar: si esa pantalla no
  la muestra, el admin la escribió en un formulario y ya no la tiene.
- **Editar**: nombre, activo, administrador, y resetear contraseña. Todos por `PATCH`, y **mandá
  solo lo que cambió** — un campo desconocido es 400 y un `{}` también.
- **Resetear la contraseña NO cierra las sesiones abiertas.** El token del otro sigue valiendo hasta
  que se cumplan sus 8 horas, porque no hay lista de revocados. Para sacar a alguien **ahora** —el
  celular perdido, el que se fue enojado— lo que corresponde es desactivarlo, que sí es inmediato.
  **Esto va escrito en la pantalla**, al lado del botón: es exactamente la clase de cosa que todo el
  mundo asume al revés, y asumirla al revés acá significa creer que echaste a alguien que sigue
  adentro.
- **Los dos 422 que el admin se puede comer con su propia cuenta**: desactivarse a sí mismo y
  quitarse el admin a sí mismo están prohibidos por la API (decisión 77 del backend), y hay un
  tercero, `ULTIMO_ADMIN`, que salta si el que se va es el último que queda. Los tres llegan como
  `ErrorApi` con un mensaje redactado para leer. Lo mínimo es mostrarlos tal cual; **lo correcto es
  no ofrecerle al admin las dos casillas sobre sí mismo**, porque un botón cuyo único final posible
  es un rechazo es una promesa que la pantalla no puede cumplir. `ULTIMO_ADMIN` sí se muestra: la UI
  no lleva la cuenta de cuántos admins quedan y no debería.
- **El 409 `EMAIL_EN_USO`** es el rechazo cotidiano de esta pantalla: el email es la identidad y se
  repite todo el tiempo. Que el mensaje de la API se vea entero y que el formulario **no se borre**.

### Parte 6 — Entrar al tambo, y volver

Lo tercero que pidió Paulo, y lo más corto de escribir si la Parte 2 quedó bien: desde
`#/admin/tambos/{id}`, un botón que entra. De ahí en más es la app de siempre, entera, sin ninguna
diferencia — el admin carga eventos, da de alta, anula y carga el tanque, porque puede.

- Entrar es `guardarEstablecimiento(id)` y montar el mismo camino que ya existe (`Conectado` →
  `ProveedorEstablecimiento` → `Pantallas`). **No escribas un segundo camino de entrada al tambo**:
  el que está verifica contra la API, arma la `Config`, calcula `puedeCargar` y maneja el 403 de la
  puerta. Duplicarlo es duplicar los cuatro.
- **La vuelta.** Hoy el tablero muestra "Cambiar de tambo" **solo si hay más de uno**, y va al
  selector. Para el admin que entró desde el panel, la salida tiene que ser **"Volver al panel"**,
  siempre, exista un tambo o cincuenta. Sin eso, entra y queda encerrado: la única salida sería
  "Salir" y volver a escribir la contraseña.
- **La trampa que se lleva puesto todo el panel.** `ConTambo` entra derecho cuando la lista tiene
  **un solo** tambo, y lo hace *antes* de mirar el guardado — es el 90% de los tamberos y está bien
  para ellos. Pero un admin en un sistema con un tambo (que es exactamente la base recién
  instalada, o sea la de Paulo hoy) **entraría derecho al tambo y no vería el panel nunca**. El
  atajo es para el tambero de un tambo; el admin, por definición, es el que los ve todos. **Para el
  admin, el panel es el inicio.**
- Lo que se descartó y va escrito: que el tambo guardado gane sobre el panel al arrancar. Ahorra un
  toque al admin que además trabaja un tambo todos los días, y a cambio hace que la pantalla de
  inicio del admin dependa de lo que tenga escrito el `localStorage` — o sea, que la primera
  pantalla sea distinta en dos teléfonos de la misma persona.
- **Un id inventado en `#/admin/tambos/{id}` no se ve como un 403 acá.** Para el admin, la puerta
  del tambo (`GET /establecimientos/{est}`) contesta **404**, no 403: el 403 parejo existe para no
  decirle a un extraño qué tambos hay, y el admin no es un extraño. `Conectado` hoy atiende el 403
  y manda al selector; el 404 le cae en la rama de error genérica. Que la salida sea al panel.

### Parte 7 — Contra la demo de verdad, y lo que queda escrito

La suite mockeada prueba lo que la pantalla muestra de lo que la respuesta trae. **Lo que no puede
probar es que las respuestas de verdad tengan la forma que los tipos declaran** — y esta tanda
estrena seis operaciones que nunca pasaron por acá.

- Levantá la demo del backend (`DEMO_PORT=3000 npm run demo --prefix api`, en
  `C:\Users\niky\Desktop\fabletambo`) y corré `npm run test:demo`. Agregale el recorrido del panel
  **con el usuario admin** (`admin@tambo.local` / `demo-admin`): ver los tambos, entrar a uno, ver
  su gente, crear una persona, darle permiso, cambiárselo, sacárselo, entrar al tambo y volver.
  Está fuera del CI y `npm test` lo excluye por nombre, así que corrélo a mano y decí en la casilla
  qué viste.
- **La demo tiene los tres roles y el de `lectura` es el que nadie prueba.** Entrá también con
  `vet@demo.local` y confirmá que para él el panel no existe.
- **El `README.md` de este repo miente en tres lugares** después de esta tanda, y hay que
  reescribirlos, no parcharlos:
  - *"Lo único de administración que vive en esta UI es cambiar la contraseña propia… se hace con
    `curl` contra la API"*;
  - la sección *"El vacío que le mandaba al admin a pedirse permiso a sí mismo"*, que termina
    diciendo que no haya pantallas de administración **es una decisión y no un olvido**. Era cierto
    y ahora se revisó: contá qué cambió y por qué, que es como se escribe una decisión revisada acá
    (mirá cómo la 61 revisó a la 51).
  - la lista de pantallas: eran nueve.
- Y las decisiones nuevas, en la sección de prosa del README: el panel afuera del establecimiento
  activo, los admins que no figuran en el reparto, el panel como inicio del admin, y que entrar al
  tambo es entrar como uno mismo y no como otro.
- **En el otro repo**, `DESPLIEGUE.md` tiene la sección *"El primer arranque real: de una base
  vacía a un tambo usable"*, con los pasos 2, 3 y 4 en `curl`. Esos tres pasos ahora se hacen desde
  la UI. Actualizala ahí (es un commit del repo del backend, aparte) y dejá los `curl` como lo que
  pasaron a ser: la salida cuando la UI no está a mano.
- El último commit de esta tanda **borra este archivo**, que es la convención del proyecto.

## Progreso

- [x] **Parte 1** — Las seis operaciones del cliente y sus tipos · commit `a974e5b`
      Las seis de §9 en `cliente.ts` y su vocabulario en `tipos.ts`, más las
      fixtures del panel con los cinco casos (el admin sin permisos, el
      desactivado que figura en el reparto, la que no entra a ningún lado).
      El prompt no preveía nada que no estuviera: `pedir()` ya manejaba el 204 y
      el proxy de `vite.config.ts` ya reenviaba `/usuarios`, las dos verificadas
      en vez de rehechas. 158 tests (10 nuevos), typecheck y build limpios.
- [x] **Parte 2** — El ruteo del panel y la partición del árbol · commit `717ec5a`
      Las tres rutas, sus constructoras y `esRutaDeAdmin`, con el "cae en el
      panel" propio del árbol de admin. **La partición de `App` se movió a la
      Parte 3**: partir el árbol dejando del otro lado un componente vacío es
      poner un placeholder, y la partición se lee de una sola vez junto a la
      pantalla que dibuja. 161 tests (3 nuevos), typecheck limpio.
- [x] **Partes 3 a 6** — El panel entero · commit `4c74759`
      **Las cuatro se hicieron juntas, y la decisión es de sequenciación**: la
      lista, el tambo por dentro, las personas y entrar/volver son una sola
      pantalla encadenada, y separarlas dejaba en cada commit un enlace que no
      llevaba a ningún lado o una fila que no se podía tocar. Entregadas de una,
      todo funciona de punta a punta.

      Tres cosas que el prompt no preveía:

      · **`Pantallas` no tenía rama para las rutas de admin.** Un `#/admin` de
        quien no es admin caía en un `switch` sin ninguna rama que matcheara y
        dejaba la pantalla en blanco. Lo encontró el test de la puerta. Cae en el
        inicio, como cualquier hash que no se entienda.
      · **El tambo abierto por el admin no se guarda en `localStorage`**, al
        revés de lo que decía la Parte 6. Nadie lo leería —su inicio es el panel,
        decidido arriba— y una preferencia que se escribe y no se lee es un valor
        que envejece hasta que alguien le cree.
      · **"Mi cuenta" pasó a vivir en los dos árboles** (`volverA` opcional): en
        una base recién instalada no hay tambo al que entrar, y esa es la única
        pantalla donde el admin puede cambiar la contraseña que el despliegue le
        manda a cambiar antes que nada.

      187 tests (26 nuevos, 29 en `Panel.test.tsx`), typecheck y build limpios.
      Se movieron a `Panel.test.tsx` los tres del admin que vivían en
      `Conexion.test.tsx`, y los dos de `Permisos.test.tsx` ahora entran por el
      panel, que es la única puerta que le queda.
- [ ] **Parte 7** — La demo de verdad y la documentación (y se borra este archivo) · commit `________`

Debajo de cada casilla, al marcarla: qué quedó hecho, qué encontraste que el prompt no preveía, y
qué decisión tomaste si tuviste que tomar una.
