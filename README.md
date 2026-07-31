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

Lo único de administración que vive en esta UI es **cambiar la contraseña
propia**, en "Mi cuenta". Crear usuarios y repartir permisos se hace con `curl`
contra la API: es trabajo de admin, se hace una vez cada tanto, y ponerlo en la
pantalla del corral sería alcance que nadie pidió.

Qué tambo se ve lo dice `GET /establecimientos`, que devuelve **los míos**: los
que tengo con permiso, y todos si soy administrador. Con uno solo se entra
derecho; con varios hay una lista, y el último elegido queda guardado.

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
  pantallas/         Una por ruta
  sesion.ts          El token: dónde vive y el aviso de que se cayó
  usuario.tsx        Quién está usando la app, y cómo se sale
  establecimiento.tsx El tambo activo y si puedo cargar en él
  almacen.ts         Lo poco que se recuerda entre visitas: el tambo elegido
  formato.ts         Presentación: fechas DD/MM/AAAA, números con coma, el vocabulario
  reloj.ts           Qué día es hoy, según el servidor
  ruteo.ts           Treinta líneas sobre el hash, sin dependencias
  estilos.css        El sistema de diseño entero
```

Nueve pantallas: login, conexión (el selector de tambo), tablero, rodeo, ficha,
carga de evento, alta, tanque y mi cuenta.

Las cuatro librerías que **no** están —componentes, Tailwind, router y charts— y
por qué, en la decisión 51. La revisión de esa decisión cuando el CSS creció está
en la 61.

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
vacía — y hasta acá el selector le decía *"Todavía no te dieron acceso a ningún
tambo. Pedíselo a un administrador"*. **Él es el administrador.** Es literalmente
la primera pantalla que alguien ve en producción y le daba una instrucción
imposible.

Nunca apareció porque la demo siembra el tambo antes de que nadie entre y los
tests parten de una sesión con establecimientos. Ahora el vacío son **dos**
casos: con `usuario.es_admin` en la mano, al admin se le dice lo que **sí** puede
hacer —crear el tambo, las personas y sus permisos, en ese orden— y que eso va
contra la API porque esta UI no tiene pantallas de administración.

Que no las tenga **es una decisión, no un olvido**: administrar es trabajo que se
hace una vez cada tanto y no le corresponde a la pantalla del corral. El mensaje
lo dice con esas palabras, para que no se lea como una funcionalidad que falta.

## Dónde está el resto

El backend vive en **`https://github.com/MugiwaraNoSeva/tambo.git`**: el núcleo
(`mu/`), la persistencia (`db/`), la API (`api/`) y la demo. Ahí está también la
spec, **`proyecto_app_tambo-1.md`**: §5.6 (los códigos de error y su columna
"¿Forzable?"), §7 (las decisiones — de la 50 a la 67 son de la UI, y la 81 nació
de este repo: `GET /establecimientos`, sin la cual no hay selector que armar) y **§9 (el
contrato de la API, la única fuente de verdad sobre requests y respuestas)**.
