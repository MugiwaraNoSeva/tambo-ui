# `tambo-ui` — la UI web del tambo

La pantalla del tambero: pensada para el **celular en el corral**, que es donde
se carga un celo. Es un cliente del contrato de §9 y **no tiene una sola regla de
dominio** — manda el evento y muestra lo que la API contesta.

## Cómo se entra

Con **email y contraseña**. El token que devuelve el login dura **8 horas** —un
turno de tambo— y no hay refresh: cumplidas las 8, se vuelve a escribir la
contraseña. Los usuarios los crea un administrador; acá no hay registro ni
"olvidé mi contraseña", porque del otro lado no hay correo que mandar y quien la
pierde se la resetea el admin.

Qué tambo se ve lo dice `GET /establecimientos`, que devuelve **los míos**: los
que tengo con permiso, y todos si soy administrador. Con uno solo se entra
derecho; con varios hay una lista, y el último elegido queda guardado.

## Y el administrador tiene su panel

**El admin no ve esto.** Su inicio es `#/admin`, y son tres pantallas encadenadas:

1. **los tambos** — la lista, crear uno, y ver los archivados si hace falta;
2. **un tambo** — un menú de qué hacer con él: entrar a usarlo, su gente, sus
   parámetros, o editarle el nombre y archivarlo;
3. **su gente** — quién entra y con qué permiso, y la persona entera: nombre,
   contraseña, si está activa, si es administradora;
4. **sus parámetros** — los diecisiete números del dominio, y el historial de
   bajo qué reglas se decidió cada cosa.

El menú del medio existe porque las tres cosas tienen frecuencias distintas:
entrar es de todos los días, repartir permisos es de vez en cuando, y archivar un
tambo pasa una vez en la vida. Apiladas en una pantalla sola, la de todos los
días quedaba abajo de las otras dos.

Hasta la tanda del panel esto se hacía con `curl` y este README decía por qué:
*"administrar es trabajo que se hace una vez cada tanto y no le corresponde a la
pantalla del corral"*. Era cierto y se revisó; el porqué del cambio, y las cuatro
decisiones que salieron de él, están más abajo en **El panel del admin**.

## Correrla contra la demo

Dos comandos, en dos terminales:

```bash
# en el repo del backend
DEMO_PORT=3000 npm run demo --prefix api   # API + Postgres embebido + un tambo poblado
# en este repo
npm run dev                                # http://localhost:5173
```

La demo puebla el tambo y termina imprimiendo **las credenciales de los tres
usuarios** junto a la URL y el id del establecimiento:

| rol | email | contraseña |
|---|---|---|
| admin | `admin@tambo.local` | `demo-admin` |
| escritura | `paulo@demo.local` | `demo-escritura` |
| lectura | `vet@demo.local` | `demo-lectura` |

Son credenciales **de demostración** y no protegen nada: la base y el secreto de
firma mueren con el proceso. El tambo trae ocho animales en distintos estados, un
parto forzado, una anulación, alertas con contenido y el tanque de diez días con
uno olvidado — así que todas las pantallas tienen algo que mostrar. **Probá con
los tres**: el de `lectura` es el que nadie prueba y el que más fácil se rompe.

**No apuntes `VITE_API_URL` a la demo.** La API no manda cabeceras CORS y el
browser bloquea el pedido antes de que salga. Para eso está el **proxy del
servidor de desarrollo**, que reenvía `/auth`, `/establecimientos`, `/usuarios` y
`/salud` al `DEMO_URL` (por default `http://127.0.0.1:3000`, ver `vite.config.ts`
y la decisión 55). `VITE_API_URL` es para producción, donde la API vive en otro
host y sí resuelve el origen.

Para entrar desde el celular, el servidor escucha en la red local: la URL
`Network:` que imprime Vite anda desde el teléfono conectado al mismo wifi.

## Cómo se prueba

```bash
npm test         # Vitest + Testing Library sobre jsdom, con `fetch` mockeado
npm run typecheck
npm run build
```

Y aparte, **con la demo levantada**, el humo contra la API de verdad:

```bash
npm run test:demo
```

Monta la app entera **sin mockear `fetch`**, contra `127.0.0.1:3000`, y entra con
los tres usuarios. Es lo que la suite mockeada no puede probar: que las
respuestas de verdad tengan la forma que los tipos declaran y que la pantalla que
sale de ellas sea la que corresponde a cada rol. **No está en el CI** —depende de
un backend levantado, y un CI que dependa de eso deja de ser una señal— y por eso
`npm test` lo excluye por nombre. Se puede correr las veces que haga falta contra
la misma demo: el test que escribe da de alta su propio animal.

**No hace falta ni base ni API levantada.** La verificación pesada vive en los 476
tests de `mu/`, `db/` y `api/`; repetirla contra un mock probaría que el mock
obedece, no que el sistema anda. Acá se prueba lo que la pantalla **muestra** de
lo que la respuesta trae y lo que **manda** de lo que el formulario junta.

Las respuestas de mentira están en `tests/fixtures.ts`, tipadas contra los tipos
del cliente —una fixture desalineada del contrato no compila— y con los datos de
`api/scripts/demo.ts`, para que lo que se ve en el test sea lo mismo que se ve en
la pantalla. Cuando algo no cierra, el camino más corto es levantar la demo y
comparar. La decisión 57 cuenta qué pasa cuando una fixture se despega del
contrato: el test sigue en verde y miente.

## Cómo está armado

```
src/
  api/               El contrato de §9 escrito una vez: tipos y cliente HTTP
  componentes/       Lo que se repite: tarjetas, avisos, cifras, formularios, la curva
  pantallas/         Una por ruta (Panel y Personas son las del admin)
  sesion.ts          El token: dónde vive y el aviso de que se cayó
  usuario.tsx        Quién está usando la app, y cómo se sale
  establecimiento.tsx El tambo activo y si puedo cargar en él
  almacen.ts         Lo poco que se recuerda entre visitas: el tambo elegido
  formato.ts         Presentación: fechas DD/MM/AAAA, números con coma, el vocabulario
  reloj.ts           Qué día es hoy, según el servidor
  ruteo.ts           Treinta líneas sobre el hash, sin dependencias
  estilos.css        El sistema de diseño entero
```

Quince pantallas, en **dos árboles**. Las del tambo son diez: login, conexión
(el selector), tablero, rodeo, ficha, carga de evento, **corrida**, alta, tanque
y mi cuenta.
Las del panel son cinco —los tambos, el menú de uno, su gente, sus parámetros, y
todas las personas— y se dibujan **afuera** del establecimiento activo, porque no
son de ningún tambo. "Mi cuenta" es la única que vive en los dos: la contraseña
es de la persona.

Las cuatro librerías que **no** están —componentes, Tailwind, router y charts— y
por qué, en la decisión 51. Esa decisión se revisó **dos** veces: en la 61,
cuando el CSS pasó de 400 líneas, y de nuevo al remodelar. Las dos siguen abajo,
en *El sistema de diseño*.

## Las reglas que no se negocian

1. **La UI no tiene reglas de dominio.** No pre-valida transiciones, plazos ni
   payloads: manda el evento y muestra lo que la API contesta. Los mensajes de
   error del núcleo se muestran **tal cual** — están redactados para el tambero
   (§5.6) y reescribirlos acá sería duplicar dominio en el peor lugar posible: el
   que nadie mira cuando la regla cambia. La única validación local es de forma.

   Hay **una** excepción declarada, y está en la decisión 50 para que se note si
   aparece una segunda: que un rechazo forzable se puede confirmar (§3.5). No
   *cuáles* son forzables — eso lo dice el servidor (decisión 54).

   El token y los permisos **no son dominio del tambo**: en un tambo hay vacas,
   celos y partos, no usuarios con rol de lectura. Son de la aplicación, así que
   viven en el vocabulario de esta UI (`src/api/tipos.ts`) y no en la copia del
   núcleo, que no se toca.

2. **Celular primero.** Targets de 48 px, tipografía de 17 px, las acciones
   frecuentes a un toque, funciona con una mano. El escritorio es el caso
   secundario.

3. **Español rioplatense** en toda la interfaz. Las fechas se muestran DD/MM/AAAA
   aunque la API hable ISO, y la conversión vive en un solo helper — que además
   nunca usa `new Date`, porque `new Date('2026-03-01')` es medianoche UTC y en
   Montevideo se lee 28 de febrero (decisiones 47 y 52).

4. **Ningún estado se comunica solo con color.** VACÍA, INSEMINADA y PREÑADA
   llevan siempre su palabra: en el corral hay sol de frente, apuro, y buena parte
   de la población masculina distingue mal el rojo del verde.

5. **`null` es "sin datos", nunca 0 y nunca en blanco** (decisión 37). Un cero
   dice "medimos y dio cero"; un blanco dice "acá no va nada"; lo que pasa es que
   no hay con qué calcularlo.

## El vocabulario del núcleo es una copia

`src/api/nucleo.ts` tiene los tipos del dominio (`Proyeccion`, `ResumenKPIs`,
`CategoriaAlimentacion`…) **copiados** de `mu/src` del repo del backend. Hasta
que la UI vivía en el monorepo eso era un `import type` contra el paquete
`tambo-reglas`; fuera de ahí la ruta no existe y npm no instala desde un
subdirectorio de un repo git.

Se pudo copiar porque son solo declaraciones: la UI importa tipos y **nunca**
valores, así que al browser no viaja una línea del motor de dominio. El costo es
que la copia se puede despegar del original, y lo que la ata es parcial —
detecta lo que cambia de forma, no lo que se agrega. La red de verdad es usar la
app contra la demo. Está todo en el encabezado de ese archivo y en la decisión 66.

## Las decisiones de la cerradura

Acá viven las decisiones de diseño **de la UI**, en prosa y con lo que se
descartó. El registro numerado (§7) es de la spec del otro repo: lo que se
decide de este lado se escribe acá.

### El token vive en `localStorage`

Tres candidatos y ninguno gratis. `sessionStorage` se borra al cerrar la
pestaña, y en un celular la pestaña se cierra sola todo el tiempo. Solo en
memoria es lo más seguro y pide la contraseña en cada recarga. `localStorage`
sobrevive al bloqueo de pantalla y al browser cerrado, que es exactamente lo que
pasa treinta veces por mañana: el tambero apoya el teléfono, mueve una vaca, lo
levanta y sigue cargando.

El costo real es que **cualquier XSS lo lee**, y hay que decir de qué tamaño es
acá: esta app no tiene ni una dependencia de terceros en runtime (decisión 51),
no muestra contenido escrito por usuarios de otros tambos, y el token tiene un
techo de 8 horas sin refresh. Con esa superficie, el riesgo de un XSS es el
riesgo de un bug propio — y un XSS propio con el token en memoria igual podría
hacer los pedidos desde la página. Lo que se gana es que la pantalla de login se
vea una vez por turno y no una vez por bloqueo de pantalla.

Vive en `src/sesion.ts` y no en `almacen.ts` aunque los dos escriban en
`localStorage`: el establecimiento elegido es una preferencia —no es secreto, no
vence, se olvida cuando el tambero quiere— y el token es una credencial que
vence sola y que **borra la API desde afuera** al contestar 401. Juntarlos haría
que "olvidar" signifique dos cosas en el mismo archivo.

### El 401 se atiende en un solo lugar, y avisa al revés

El caso que manda es el peor: se cumplen las 8 horas **con la sesión abierta y a
mitad de una carga**. Ahí el 401 llega a una pantalla que está por desaparecer,
así que mostrarlo en el `Aviso` de esa pantalla no sirve para nada.

Por eso el aviso va al revés de lo habitual: `pedir()` en `src/api/cliente.ts`
—el único lugar que sabe de HTTP— borra el token y **avisa** a través de
`alCaerLaSesion()`, y `App`, que es el único que puede cambiar de pantalla, se
registra para escucharlo. Es un callback y no un evento del DOM para que el
typecheck sostenga la forma del mensaje y para que la suite no dependa de
`window`. El mensaje que se muestra es el de la API tal cual ("Tu sesión venció:
dura 8 horas"), y si lo que se estaba haciendo era una carga, se dice además que
ese evento **no se guardó**.

### Un 401 con una contraseña adentro no es la sesión

`POST /auth/password` rechaza la contraseña actual mal escrita con **401 y el
mismo `NO_AUTENTICADO`** que un token vencido. Aplicar ahí la regla de arriba
echaría al tambero de una sesión perfectamente viva por un dedo torpe.

La regla, entonces, tiene una excepción de una línea: **un pedido que lleva una
contraseña en el cuerpo no dispara la vuelta al login**, porque su 401 habla de
esa contraseña. Son dos —el login y el cambio de contraseña propia— y están
marcados en `cliente.ts` con `validaUnaPassword`. Se descartó pedirle al backend
un código distinto: no falta nada del otro lado, la distinción la tiene el
llamador y sale más barata acá que en el contrato.

### El 403 no vuelve al login

Es el error clásico y se paga en las dos direcciones. Un 403 significa que la
sesión está bien y que **falta permiso sobre ese tambo**: mandar al login sería
condenar al tambero a escribir la contraseña una y otra vez sin que eso arregle
nada.

Dónde termina depende de **dónde llega**, y la diferencia importa:

- **En la puerta del tambo** (`GET /establecimientos/{est}`, que es lo primero
  que se pide al entrar) vuelve al **selector**, con el porqué escrito. Es el
  caso del permiso revocado y el del id que quedó de otra demo: como un tambo sin
  permiso contesta 403 exista o no, los dos se ven igual y los dos se arreglan
  eligiendo otro. Con **un solo** tambo eso podría convertirse en un ida y vuelta
  infinito —entrar derecho, rebotar, entrar derecho—, así que el que rebotó queda
  anotado y volver a entrar pasa a ser un toque.
- **Adentro**, en cualquier otro pedido, se **muestra el mensaje** de la API tal
  cual, en la tarjeta que lo pidió. Un 403 adentro no siempre es "este tambo no
  es tuyo": también es "tu permiso acá es de lectura y esto es una carga", y a
  eso mandarlo al selector no lo arregla. Un 403 nunca vuelve al login, que es lo
  que la tabla exige; a dónde sí va lo decide qué se estaba haciendo.

### Qué ve el rol de lectura, y por qué eso no es seguridad

La cuenta es una sola —`es_admin || rol === 'escritura'` sobre **este** tambo— y
vive en un solo lugar: `puedeCargarEn()` en `src/establecimiento.tsx`, cuyo
resultado viaja en el contexto del establecimiento activo al lado del `nombre` y
la `Config`. **Ninguna pantalla la recalcula.** Repetida en cinco lugares, el
sexto se olvida de la mitad del admin —que puede todo y viene con `permisos: []`—
y le muestra una interfaz de solo lectura a quien puede todo.

El de `lectura` ve el tambo entero: las listas de trabajo, el rodeo, la ficha, el
historial con sus marcas y el tanque. Lo que no ve son las **puertas de carga**:
"Dar de alta", "Cargar un evento", "Cargar el tanque de hoy" y "Anular". Que no
estén, no que estén y fallen. Tampoco se le reclama que cargue el tanque del día:
sería un reto por algo que no está en sus manos.

Y si igual llega —`#/alta` escrito en la barra de direcciones, un enlace viejo—,
lo que encuentra es un renglón que explica que su permiso acá es de lectura, no
un formulario entero cuyo único final posible es un 403 al enviar.

**Nada de esto protege nada.** La cerradura está en la API: el servidor contesta
403 y esa es la red de verdad. Esto es cortesía con el que mira, y por eso no se
esconde nada creyendo que eso lo defiende ni se duplica la regla en ninguna parte
más que en ese único lugar.

## El panel del admin

### Administrar sí le corresponde a esta UI, y antes se dijo que no

La decisión anterior está unos párrafos más arriba en el historial de este mismo
archivo: crear usuarios y repartir permisos se hacía con `curl` porque *"es
trabajo que se hace una vez cada tanto y no le corresponde a la pantalla del
corral"*. El argumento era bueno para lo que miraba —el tambero con el celular
embarrado— y equivocado para lo que no: **el admin también es una persona con un
teléfono**, y lo que le quedaba era escribir uuids en una terminal.

Lo que la volteó fue el despliegue. `DESPLIEGUE.md` describe el primer arranque
real —una base vacía, un solo usuario— y sus pasos 2, 3 y 4 eran tres `curl` con
uuids copiados a mano de la salida del anterior. O sea que la única forma de
dejar el sistema usable era la que la UI había decidido no tener. Un producto que
no se puede poner en marcha desde su propia interfaz no tiene una decisión de
alcance: tiene un agujero.

Lo que **no** cambió: la pantalla del corral sigue sin saber nada de esto. El
panel es otro árbol, el tambero no lo ve, y ninguna pantalla de tambo tiene un
botón de administración.

### El panel se dibuja afuera del establecimiento activo

Las rutas del tambo (`#/rodeo`, `#/animales/…`) viven adentro de
`ProveedorEstablecimiento`, que les da el nombre, la `Config` y el permiso. Las
del panel **no tienen tambo**: la lista no pertenece a ninguno, y la gente de uno
se mira sin estar conectado a él. Por eso `App` parte el árbol una sola vez, en
`usuario.es_admin`, y no cuelga el panel de una pantalla del tambo.

El costo es que hay dos lugares donde se lee la ruta, y la trampa apareció en el
primer test que la buscó: `#/admin` tocado por alguien que **no** es admin
llegaba al `switch` del árbol del tambo, no matcheaba ninguna rama y dejaba la
pantalla en blanco. Cae en el inicio, como cualquier hash que no se entienda.

### El panel es el inicio del admin, y eso arregla un defecto

El selector entra derecho cuando hay **un solo** tambo: es el 90% de los tamberos
y una lista de un elemento es una pantalla de peaje. Para el admin eso habría
sido fatal —una base recién instalada tiene exactamente un tambo, así que habría
entrado derecho a él y no habría visto el panel nunca—, y no se arregla con un
`if` adentro del selector: se arregla no pasando por ahí. El atajo es del que
tiene un tambo; el admin, por definición, es el que los ve todos.

De la misma regla salen dos consecuencias que conviene saber:

- **el hash no abre un tambo por su cuenta.** Un enlace profundo a la ficha de un
  animal deja al admin en el panel hasta que elija en cuál de los tambos mirarla.
  Es lo mismo que ya le pasa al tambero que todavía no eligió: el selector le
  tapa cualquier hash;
- **el tambo abierto no se guarda** en `localStorage`, a diferencia del que elige
  el tambero. Ahí es una preferencia que la próxima visita lee; acá nadie la
  leería, y una preferencia que se escribe y no se lee es un valor que envejece
  hasta que alguien le cree. El precio es que recargar la página con un tambo
  abierto devuelve al panel, que es exactamente lo que la regla promete.

### Los administradores entran a todos los tambos sin figurar en ninguno

Es la trampa de la pantalla "quién entra a este tambo". La lista sale de
`GET /usuarios` filtrada por `permisos`, y un admin viene con `permisos: []` **a
propósito** (no necesita que le den permiso sobre ninguno), así que ese filtro no
lo devuelve nunca. Una pantalla que conteste quién entra y omita a las personas
que entran a todas partes está mintiendo, y es la clase de mentira que se
descubre el día que alguien pregunta quién tocó qué.

Van en su propia tarjeta y no mezclados con el reparto, porque acá no hay nada
que repartir: su acceso no sale de este tambo y no se les puede sacar desde esta
pantalla. Lo mismo vale para el otro lado: los admins no aparecen entre los
candidatos a "dar acceso", porque darles permiso no cambiaría nada.

La otra mitad es el **desactivado**, que es el caso simétrico: figura en el
reparto con su permiso intacto y **no entra**. Se muestra con esa palabra —no se
esconde, que dejaría al admin sin poder volver a entrarlo, y no se muestra como a
los demás, que diría que entra alguien que no entra—.

### Entrar al tambo es entrar como uno mismo

El admin entra y usa la app entera: carga eventos, da de alta, anula y carga el
tanque, porque un admin puede todo. **No hay un modo "ver como" ni suplantación
de nadie**: `puedeCargarEn()` ya devuelve `true` para él y no se toca. Una UI que
le mienta al admin sobre lo que puede hacer es peor que no tener panel.

Entrar reusa la misma puerta que el tambero (`Conectado`), que es la que verifica
contra la API, arma la `Config`, calcula el permiso y maneja el rechazo. Lo único
que los distingue es cómo se sale, y el rótulo viaja al lado de la función: un
botón que diga "Cambiar de tambo" y lleve al panel es peor que ninguno.

Un detalle que se ve solo desde este lado: para el admin, un tambo que no existe
contesta **404 y no 403**. El 403 parejo está para no decirle a un extraño qué
tambos hay, y él no es un extraño.

### Un tambo tampoco se borra: se archiva

Es la misma respuesta que para las personas, y por eso tiene la misma forma —un
campo del `PATCH`— en vez de un `DELETE` que archive por debajo. De un
establecimiento cuelgan sus animales, su log, sus permisos y su tanque, y el log
no admite borrados: borrarlo es romper esas referencias o romper la historia
(decisión 91 de la spec).

Lo que **sí** hace archivar, y conviene saberlo porque no es "esconder":

- sale de la lista, y vuelve con "Ver también los archivados";
- **deja de aceptar cargas**, con un 409 que también se come el admin;
- y se sigue mirando entero — el rodeo, las fichas, el historial, el tanque. Ese
  es el punto de archivar en vez de borrar: el log queda, y el log es para leerlo.

La pantalla lo dice con esas palabras y el botón no pide una confirmación con
cara de irreversible, porque no lo es: se deshace con el mismo botón.

### Los parámetros son su propia pantalla, y la mitad es explicación

Los diecisiete números del dominio no van al lado del campo "nombre": cambiarle
el nombre a un tambo y cambiar con qué números decide el sistema no son la misma
clase de cosa. Tienen su pantalla, colgada del menú del tambo.

Lo que la hace distinta de un formulario:

- **Avisa qué cambia, arriba de todo.** El historial de eventos no se toca, y el
  parto probable de las preñadas de hoy tampoco —quedó fijado en la proyección
  cuando se cargó el diagnóstico—. Pero las listas de la mañana, las categorías
  de alimentación y los indicadores se calculan **al leer**, así que cambian al
  instante para todo el rodeo: alguien puede entrar mañana y encontrar vacas
  nuevas en "para secar" sin que se haya cargado nada.
- **Se manda la `Config` entera y se guarda de una sola vez**, porque hay cinco
  reglas que atan unos parámetros con otros. Guardar de a uno haría imposible un
  cambio coherente que toca dos campos a la vez —subir el mínimo y el máximo de
  gestación juntos—. Cada grupo lleva escrita la relación que tiene que valer, y
  la validación local sigue siendo solo de forma: que la combinación cierre lo
  dice `validarConfig`, y su mensaje se muestra tal cual.
- **Los valores de fábrica vienen de la API** (`GET /config-default`). La
  decisión 51 le prohíbe a esta UI importar valores del núcleo, así que copiarse
  los diecisiete números sería duplicar el dominio en el peor lugar posible. El
  botón **rellena el formulario y no guarda**: quien vuelve a fábrica igual tiene
  que mirar lo que queda y confirmarlo.
- **Abajo está el historial**, que es para lo que existe todo esto: cada versión
  con su fecha, quién la puso y por qué. La primera de cada tambo no se le
  atribuye a nadie —"vino con el sistema"—, porque inventar un usuario sería
  mentir justo en la pantalla que existe para saber quién hizo qué.

### Y en la ficha, con qué reglas se juzgó cada evento

Es el pago de todo lo anterior, y donde lo ve el que importa: el tambero que mira
el rodeo y no encuentra una vaca donde la esperaba. Cada evento del historial
trae su `configuracion_id`, y la ficha lo cruza con el historial de reglas.

**Lo que se muestra es la diferencia, no la versión.** Un id no le dice nada a
nadie; *"cuando se cargó, el período voluntario de espera era 45 en vez de 60"*
sí. Y **solo en los eventos que se juzgaron con reglas que ya no rigen**: escribir
"reglas vigentes" en los cuarenta renglones sería ruido que tapa los dos que
importan. Los demás no dicen nada, que es lo correcto — se cargaron con lo que
está puesto.

Si el historial de reglas no vuelve, los eventos se muestran igual sin esa línea:
es un dato al lado, no lo que se vino a mirar.

El campo "por qué se cambia" es opcional y no viaja vacío, pero es lo que hace
que el número signifique algo dentro de un año: *"subimos el PVE a 60 después de
la charla con el veterinario"* explica el 60. El 60 solo no explica nada.

### Lo que el panel no hace, y por qué

- **No borra a nadie.** No existe `DELETE /usuarios`: el log firma con
  `usuario_id` y una fila borrada rompería la historia. Lo que hay es desactivar,
  que además es lo que saca a alguien **ahora**.
- **Resetear la contraseña no cierra las sesiones abiertas**, y eso está escrito
  al lado del botón. Es lo que todo el mundo asume al revés, y asumirlo al revés
  significa creer que echaste a alguien que sigue adentro con su token vivo.
- **La contraseña inicial se muestra una vez**, después de crear a la persona.
  Del otro lado no hay correo que mandar: si la pantalla no la dice, el admin la
  escribió en un formulario y ya no la sabe nadie.
- **No ofrece desactivarse ni sacarse el rol a uno mismo.** La API lo rechaza con
  422 (`AUTOBLOQUEO`), y un botón cuyo único final posible es un rechazo es una
  promesa que la pantalla no puede cumplir. La salida —nombrar a otro y que ese
  otro te desactive— se dice con palabras. `ULTIMO_ADMIN` sí se muestra cuando
  llega: esa cuenta la lleva el servidor y la UI no debería llevarla.
- **No pagina ni busca.** `GET /usuarios` devuelve a todos, por nombre y sin
  paginar, y el sistema tiene un puñado de personas. Cuando sean cientos, se
  revisa.

### La lista global de personas es la segunda puerta

El camino de todos los días es entrar por el tambo: ahí está la gente que
importa, con el permiso que se viene a cambiar. La lista completa (`Todas las
personas`) se queda igual porque hay **dos clases de persona que ninguna lista
por tambo puede mostrar**: los administradores, que no figuran en el reparto de
ninguno, y quien todavía no tiene acceso a ninguno. Sin ella, esas dos serían
invisibles salvo en el momento exacto de crearlas.

Las dos pantallas comparten la ficha de la persona —se edita igual se la mire
desde donde se la mire— y lo que cambia es lo que se le cuelga al lado: adentro
de un tambo, los controles del permiso sobre ese tambo.

## La corrida

Es la pantalla que **da vuelta el eje de la app**, y por eso vale la pena decir
cuál era el eje. Todo lo demás está armado como *un animal → muchos eventos
posibles*: se entra a una ficha y se elige qué cargarle. Pero el trabajo de la
mañana es al revés —viene el veterinario y tacta veinticinco seguidas, el
inseminador recorre las que están en celo, el control lechero pasa por el rodeo
entero el mismo día—: **lo constante es el tipo y lo que cambia es la caravana.**

Medido antes de escribirla, cargar un tacto por el camino de siempre costaba
**16 pedidos y unos 6 toques**, y terminaba en una pantalla que no era la de
origen. Una mañana de veinticinco tactos, 400 pedidos contra una API que duerme
a los 15 minutos.

Se entra desde las dos listas del tablero y desde el rodeo. Las tres usan datos
que ya existían (`GET /alertas` y `GET /animales`): **no se agregó un solo
endpoint**, y la idempotencia que hace todo esto seguro ya estaba resuelta en las
decisiones 63 y 67.

### La lista se congela al abrir

Después de cargarle el tacto a la tercera vaca, esa vaca **ya no está** "para
revisar". La lista igual no se vuelve a pedir ni se reordena: se le pone una
marca y se queda donde estaba.

Es la decisión que más se nota y la más fácil de errarle. Una lista que se
reacomoda abajo del dedo hace perder el lugar, y perder el lugar en una lista de
veinticinco es exactamente el defecto que esta pantalla vino a arreglar. La
libreta de papel no se reordena sola.

El precio es que la lista envejece mientras dura la corrida, y está bien: es una
foto del trabajo que había cuando se empezó, no un estado en vivo.

### Un rechazo aparta a ese animal y la corrida sigue

El que la API rechaza queda **apartado con su mensaje de §5.6 tal cual**, y el
recorrido continúa con el siguiente. Los apartados se juntan en una tarjeta al
final, que es donde vive el **"Confirmar igual"**.

Que esté al final y no en la fila es la parte pensada: confirmar exige
observaciones, o sea teclado, y el teclado abriéndose en el medio de un recorrido
de veinticinco corta lo único que esta pantalla tiene para dar. Los rechazos se
atienden sentado, cuando el rodeo ya pasó.

Confirmar reusa **el mismo id de cliente**: es el mismo hecho, insistido. Uno
nuevo lo convertiría en un evento distinto y perdería la protección contra el
duplicado.

### Los pedidos van de a uno

Con la lista a la vista, el dedo va más rápido que la red: tres toques seguidos
serían tres POST en vuelo. Contra una API que duerme y un celular con una barra
de señal, eso es la forma más rápida de que fallen todos.

Se resuelve con una cadena de promesas y no con un estado de "cola" que haya que
dibujar. De paso, el orden en que aparecen los resultados es el orden en que se
tocó.

### El tipo por default sale del origen, y eso arregla la mitad del problema

Quien entra por "Para revisar" viene a tactar; quien entra por "Para secar", a
secar. Hasta acá el formulario de carga **volvía a `celo` en cada evento**, así
que cargar un tacto costaba abrir un desplegable y elegir, veinticinco veces.

El tipo se elige con un segmentado y no con un desplegable, y eso importa por un
caso concreto: la mayoría de una corrida de tactos son positivos y de vez en
cuando cae una vacía. Pasar a "Tacto negativo" y volver son **dos toques**, no
seis. Por eso el tipo se puede cambiar a mitad de corrida sin que eso sea una
excepción: es el uso normal.

### Una sola fecha, y ninguna observación por animal

El veterinario que pasa el miércoles carga el miércoles entero: preguntar la
fecha por animal es veinticinco veces la misma respuesta. Sale del servidor y
nunca del reloj del celular (decisión 52).

Las observaciones se quedan en la carga suelta. En una corrida serían el teclado
abierto veinticinco veces, y la excepción —el apartado que se confirma— ya las
pide porque la API las exige.

### Qué entra en una corrida y qué no

Entran los tipos cuyo payload **es el mismo para todas o cabe en un campo**: celo,
tacto positivo, tacto negativo y secado, que no llevan payload, y el control
lechero, que lleva un solo número por animal — un input y el siguiente.

Grasa, proteína y RCS no se piden en serie. **El parto y la baja no entran**:
cada uno lleva un payload propio y distinto por animal —las crías con su sexo y
su resultado, el motivo de la salida— y un formulario largo repetido veinticinco
veces no es una corrida, es la pantalla de siempre con más pasos. Esa pantalla
**se queda**: la corrida no la reemplaza, la complementa.

### La corrida vive en memoria, y el origen viaja en la dirección

La ruta es `#/corrida/<origen>` y lo único que lleva es de qué lista sale. Con
eso la pantalla pide su lista y la congela. **El progreso no viaja**: recargar
empieza una corrida nueva, con la lista de ese momento y sin las marcas.

Es lo mismo que ya pasa con cualquier cosa que no se guardó, y que sobreviva a un
F5 es el problema de la cola offline, que es otra tanda. Una corrida sin origen,
o con uno que no se entiende, **no existe**: cae en el inicio como cualquier hash
inventado, porque adivinarle un origen sería empezar a cargar eventos sobre una
lista que nadie pidió.

### La sesión caída corta la cola

Las 8 horas se cumplen a media mañana y el 401 llega con veinte pedidos
encadenados atrás, que ahora son veinte 401 seguros. La corrida los corta.

Lo que **no** hace es contar cuántas entraron, y es a propósito: no hace falta.
Lo que ya entró está guardado —nada se pierde— y el único evento que no se
guardó es el que se comió el 401, del que ya avisa el mensaje del login ("ese
evento no se guardó"). Después de volver a entrar, las que faltan son las que
siguen en la lista.

### Lo que la corrida todavía no hace

Desde el rodeo se recorre el rodeo **entero**: no se lleva los filtros de arriba.
Adentro se busca por caravana, que es como se encuentra a la que está en la
manga, así que funciona — pero el contador dice "quedan 197" en vez de "quedan
30". Se arregla en la tanda del rodeo, cuando esos tres desplegables sean chips y
haya un filtro que valga la pena hacer viajar.

## El sistema de diseño

Todo vive en `src/estilos.css`, y desde la remodelación son **tres escalas de
variables**: color, tipografía y espacio. Fuera de ese archivo no se escribe un
color ni un tamaño de letra.

### Quince tamaños de letra eran cuatro repetidos

El encabezado de `estilos.css` decía que si algún día había que agregarle una
escala tipográfica, era que la app había crecido y la decisión había que
revisarla. Creció: había **quince tamaños escritos a mano** y la mitad eran
duplicados accidentales con dos centésimas de diferencia — `0.78` para el rótulo
de un dato, `0.80` para el rótulo de un bloque y `0.82` para el de una cifra,
haciendo los tres el mismo trabajo y ninguno a propósito.

Quedaron **siete pasos**, y juntar los duplicados movió once selectores. Ninguno
más de 1,7 px, y se listan acá porque "casi nada" no es "nada":

| Qué | Antes | Ahora | Δ |
|---|---|---|---|
| Las cifras grandes (`.cifra .valor`) | 1.6rem | 1.5rem | −1,7 px |
| La flecha de volver | 1.4rem | 1.5rem | +1,7 px |
| El título del encabezado | 1.05rem | 1rem | −0,85 px |
| Una cifra sin datos | 1.05rem | 1rem | −0,85 px |
| El título de un aviso | 0.95rem | 0.9rem | −0,85 px |
| Las marcas del historial y el código de error | 0.75rem | 0.78rem | +0,51 px |
| El título de "lo que quedaría inválido" | 0.85rem | 0.82rem | −0,51 px |
| El detalle de una fila y los renglones | 0.88rem | 0.9rem | +0,34 px |
| El rótulo de bloque (`h3` de tarjeta) | 0.8rem | 0.78rem | −0,34 px |

El más grande es el de las cifras, y es el que vale la pena explicar: la
caravana de una fila (1.5) y el número de un KPI (1.6) son **el mismo papel** —un
número que se lee de reojo— y que fueran distintos no lo había decidido nadie.
Unificarlos es la decisión; cuál de los dos valores ganaba es arbitrario.

Tres tamaños quedaron **afuera de la escala a propósito**, y cada uno tiene su
comentario al lado: los 17 px del `body`, que son la raíz de la que cuelgan los
`rem`; los 17 px de los campos, porque abajo de 16 px iOS hace zoom al enfocar; y
los 10 y 12 px de los rótulos de la curva, que están adentro de un `<svg>` con
`viewBox` — ahí un `px` es una unidad de usuario y no un píxel de CSS, así que un
`rem` escalaría contra otra cosa.

### El espacio va por la grilla de 4, y todavía no la cubre entera

Seis pasos (4 a 24). Se migraron los valores que **ya** estaban en la grilla; los
que no —6, 10, 14, 18— quedaron literales, porque moverlos ahora correría el
layout de pantallas que la remodelación todavía no tocó. Se pagan pantalla por
pantalla. **Lo que se escriba nuevo usa la escala**: si hace falta un valor que
no está, el que falta es el paso.

### Los colores se desdoblaron por papel, y por eso hay modo oscuro

Un mismo `--verde` era el fondo del encabezado **y** la tinta de un botón
secundario. En claro eso funciona; de noche deja de funcionar, porque el fondo
tiene que seguir siendo oscuro y la tinta tiene que aclararse. Ahora cada familia
tiene hasta cinco papeles (`--verde`, `--sobre-verde`, `--verde-texto`,
`--verde-tenue`, `--verde-borde`), y de paso desaparecieron los siete colores que
estaban escritos a mano sueltos por el archivo.

Con eso, el modo oscuro es **solo un juego de valores**: ninguna regla del
archivo sabe que existe. Va por `prefers-color-scheme` y **no** hay un botón para
cambiarlo, y ese es el punto: el teléfono ya sabe qué hora es y da vuelta el tema
justo en las horas en que el tambo trabaja. Una preferencia que hay que acordarse
de cambiar dos veces por día no la cambia nadie.

Por qué existe: **el primer ordeñe empieza antes del amanecer.** El porqué escrito
del tema claro era el sol de frente al mediodía, y es cierto — pero una pantalla
blanca al máximo de brillo en un corral oscuro a las cinco de la mañana encandila
igual. Las dos reglas que no se negocian valen igual de noche: ningún estado se
comunica solo con color, y cada par fondo/texto mantiene su contraste.

Lo segundo está **medido y no prometido**: los once pares del tema oscuro —tinta
sobre papel y sobre fondo, el texto de cada botón sobre su color, y cada etiqueta
y cada aviso sobre su fondo tenue— van de **5,9:1 a 14,8:1**, todos por encima
del 4,5:1 que pide AA para texto normal. El más ajustado es el blanco sobre el
verde del botón, que es el mismo par que ya existía en claro.

### Y Tailwind sigue afuera, por segunda vez

La decisión 51 lo descartó y la 61 lo revisó a las 619 líneas. Esta es la tercera
mirada, con el archivo en 933 y catorce pantallas, y la respuesta no cambió:
**cero dependencias de runtime es la bandera del proyecto** —es lo mismo que
sostiene el uuid propio, el ruteo en treinta líneas y `scrypt` a mano del otro
lado— y lo que Tailwind resuelve, que es la consistencia entre decenas de
pantallas mantenidas por un equipo, acá lo resuelven tres escalas de variables
que entran en una pantalla.

Lo que sí cambió es el disparador, que antes decía "cuando crezca" y ahora tiene
un número: **se vuelve a mirar si `estilos.css` pasa de 1.200 líneas, o si
aparece la tercera pantalla que necesita un componente que no está en
`componentes/`.** Un disparador que se cumple y nadie mira vuelve inútiles a
todos los demás, que es exactamente lo que dijo la 61.

### Dos controles nuevos: el chip y el segmentado

Los dos existen para lo mismo —que elegir cueste **un** toque y no tres— y la
diferencia entre ellos es si se puede soltar:

- **`Chips`** filtra, y tocar el que ya está puesto lo saca. Por eso `null` es
  "sin filtrar" y no hace falta una opción "Todas" al principio de la lista.
- **`Segmentado`** elige, y siempre hay uno elegido. Por dentro son
  `<input type="radio">` de verdad adentro de un `<fieldset>`: elegir uno entre
  varios excluyentes ya tiene una forma que el browser sabe —las flechas mueven
  el foco, el lector anuncia "2 de 4"— y reimplementarla con botones sería
  escribir peor lo que ya está. El input se esconde de la **vista** con posición
  y opacidad, nunca con `display: none`, que lo sacaría también del foco.

Los dos llevan su palabra siempre y anuncian lo elegido sin depender del color
(`aria-pressed` en el chip, el `checked` del radio en el otro).

## Cómo se despliega

Como **Static Site de Render**, con `render.yaml` versionado acá al lado. Es
gratis y —lo que importa— **no duerme**: la pantalla de login carga al toque
aunque la API esté dormida, que a los 15 minutos sin tráfico lo va a estar.

```
buildCommand: npm ci && npm run build
staticPublishPath: ./dist
```

### `VITE_API_URL` se incrusta al compilar

Es lo más contraintuitivo de todo el despliegue de la UI y se descubre tarde:
esa variable **no se lee en runtime**, Vite la escribe adentro del bundle cuando
compila. O sea que **cambiar la URL de la API obliga a rebuildear el front**; no
alcanza con editarla en el panel y reiniciar, porque un sitio estático no
"reinicia" nada.

Va la URL exacta del servicio de la API, **sin barra final**.

Si falta, `urlBase()` cae a "mismo origen" —que es correcto cuando la API sirve
la UI, y acá no la sirve—, así que la app cargaría perfecto y fallaría todos los
pedidos contra el CDN con un `Failed to fetch` que no dice una palabra de la
causa. Por eso **el build se cae a propósito** cuando corre en Render sin esa
variable (ver `vite.config.ts`): ruidoso y de un minuto, en vez de silencioso y
de una tarde.

### El huevo y la gallina de las dos URLs

La API necesita la URL de este sitio en `ORIGENES_PERMITIDOS` y este sitio
necesita la de la API en `VITE_API_URL`, y **ninguna existe hasta crear los
servicios**. El orden que sale de eso —crear los dos primero, completar las dos
variables después, y recién ahí el primer deploy que sirve— está escrito en el
`DESPLIEGUE.md` del repo de la API, que es donde vive el despliegue completo.

### Nada de `_redirects` ni de reescrituras

El ruteo es **por hash** (`#/animales/…`, decisión 51), así que el servidor nunca
ve más que `/`: cualquier ruta profunda funciona sin que él sepa una palabra. La
reescritura `/* → /index.html` que todo el mundo agrega "por las dudas" acá no
arregla nada y esconde los 404 de verdad. No se agrega.

### El vacío que le mandaba al admin a pedirse permiso a sí mismo

En una base recién instalada **no existe ningún establecimiento** y el único
usuario es el admin. Cuando entra, `GET /establecimientos` le devuelve la lista
vacía — y en su momento el selector le decía *"Todavía no te dieron acceso a
ningún tambo. Pedíselo a un administrador"*. **Él es el administrador.** Es
literalmente la primera pantalla que alguien ve en producción y le daba una
instrucción imposible.

Nunca apareció porque la demo siembra el tambo antes de que nadie entre y los
tests parten de una sesión con establecimientos. La primera respuesta fue
imprimirle los tres `curl` que sí podía correr; **la de ahora es que el admin no
llega a esa pantalla**: tiene su panel, y ahí el vacío es el formulario que crea
el primer tambo. `Conexion.tsx` volvió a ser lo que era, la pantalla del tambero,
con un solo caso de vacío en vez de dos.

De paso se cerró el otro agujero del mismo arranque: la única pantalla que
cambiaba la contraseña propia colgaba de un tambo, así que en una base vacía el
admin no tenía dónde cambiar la que el despliegue le manda a cambiar antes que
nada. "Mi cuenta" ahora vive en los dos árboles.

## Dónde está el resto

El backend vive en **`https://github.com/MugiwaraNoSeva/tambo.git`**: el núcleo
(`mu/`), la persistencia (`db/`), la API (`api/`) y la demo. Ahí está también la
spec, **`proyecto_app_tambo-1.md`**: §5.6 (los códigos de error y su columna
"¿Forzable?"), §7 (las decisiones — de la 50 a la 67 son de la UI, y la 81 nació
de este repo: `GET /establecimientos`, sin la cual no hay selector que armar) y **§9 (el
contrato de la API, la única fuente de verdad sobre requests y respuestas)**.
