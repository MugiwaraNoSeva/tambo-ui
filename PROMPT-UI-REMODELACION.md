# Prompt: remodelar la UI — que la mañana del tambero cueste lo que tiene que costar

Sos un agente de código trabajando sobre este repo (`tambo-ui.git`). Este archivo es dos cosas:
**el prompt** y **tu documento de progreso**. Trabajás por partes, en orden; al terminar cada
parte marcás su casilla en la sección *Progreso* (con el hash del commit) y commiteás. Si tu
sesión se corta, el próximo agente lee este archivo y retoma desde la primera casilla sin marcar
— por eso las marcas se hacen al TERMINAR cada parte, nunca antes y nunca de a varias.

## Contexto

App de gestión de tambo (establecimiento lechero uruguayo) con event sourcing. Las fases 2 a 6
están cerradas y **el producto anda en producción**. Esta tanda no agrega dominio: agrega
velocidad a lo que ya existe.

- Este repo es la **UI web**: React 19, cero dependencias de runtime, ~6.900 líneas, **207 tests**
  más 12 de humo contra la demo de verdad. Su `README.md` es su registro de decisiones.
- El backend vive en **`tambo.git`** (`C:\Users\niky\Desktop\fabletambo`): el núcleo (`mu/`), la
  persistencia (`db/`), la API (`api/`) y la demo. **En esta tanda no se edita una sola línea de
  ese repo** — pero se lo lee y se le levanta la demo, que son las dos cosas que vas a necesitar
  de él. De la spec `proyecto_app_tambo-1.md` te importan §5.6 (códigos de error y su columna
  "¿Forzable?") y §9 (el contrato); ninguna de las dos se edita.
- Producción: UI en `https://tambo-ui.onrender.com`, API en `https://tambo-1aug.onrender.com`,
  base en Supabase. La API **duerme a los 15 minutos** sin tráfico y el primer pedido después
  tarda cerca de un minuto: cada pedido que esta UI ahorra, se nota.

## El estudio que originó esta tanda

Se midió la operación más frecuente del sistema —**cargar un tacto a una vaca**— siguiendo el
camino real desde el tablero:

| Paso | Pedidos |
|---|---|
| Tablero abierto | 3 GET (alertas, rodeo, tanque) |
| Toco la vaca en "Para revisar" → Ficha | 5 GET (animal, kpis, lactancias, eventos, configuraciones) |
| Toco "Cargar un evento" → CargarEvento | 1 GET (`api.animal` **otra vez**, solo por la caravana del título, `CargarEvento.tsx:77-80`) |
| Abro el select —que arranca en `celo` siempre (`CargarEvento.tsx:96`)— y elijo "Tacto positivo" | — |
| Toco "Cargar el evento" | 1 POST |
| Vuelve a la ficha (`CargarEvento.tsx:160`) | 5 GET |
| Toco ← , que va **al rodeo** y no a la lista de donde salí (`Ficha.tsx:70`) | 1 GET |

**16 pedidos y unos 6 toques por vaca**, terminando en una pantalla que no es la de origen. Una
mañana de 25 tactos son 400 pedidos contra una API que duerme. Nada se cachea: `usarPedido`
(`usarPedido.ts:53-76`) pide en cada montaje — está bien decidido (la proyección la calcula el
servidor y no se adivina), pero significa que ir y volver re-descarga todo.

De ahí salieron cinco hallazgos, ordenados por impacto:

1. **El eje está invertido.** La app está armada como *un animal → muchos eventos posibles*. El
   trabajo real es *un evento → muchos animales*: viene el veterinario y tacta veinticinco
   seguidas, el inseminador recorre las que están en celo, el control lechero pasa por el rodeo
   entero el mismo día. Lo constante es el tipo de evento y lo que cambia es la caravana — y la
   app pone el tipo en un `select` que vuelve a `celo` en cada carga. **Este hallazgo manda:
   los otros cuatro son minutos, este son horas.**
2. **La lista de trabajo se pierde en cada carga.** Se sale de "Para revisar" y se vuelve al
   rodeo. Para seguir hay que volver al tablero, y la lista ya cambió —la recién tactada salió
   de ella—. No hay marca de "esta ya la hice" ni forma de saber por dónde iba. La libreta de
   papel no se reordena sola; esta pantalla sí.
3. **Se descarga la ficha entera para pasar de largo.** Cinco lecturas para llegar al
   formulario, y ninguna se mira cuando lo que se viene a hacer ya estaba decidido antes de
   sacar el teléfono.
4. **No hay cola offline** y el corral es donde se cae la señal. Está toda la infraestructura
   —el id del cliente por evento, el mensaje de `ErrorDeRed`— **y no está la cola**. → *Queda
   fuera de esta tanda por decisión de Paulo (ver abajo).*
5. **Una pantalla por dato.** 720 px de ancho máximo, una tarjeta por sección, una columna. En
   el celular es correcto. Pero el tanque, los KPIs del rodeo y el panel del admin **no se miran
   en el corral**: se miran sentado, en un monitor, y ahí hay una columna angosta en el medio de
   la nada.

Y las de segundo orden: los tres `select` del rodeo ocupan una pantalla entera antes de la
primera fila; no hay atajo de carga desde una fila; el tablero no prioriza (una lista de trabajo
pesa lo mismo que el reparto de dietas); y `type="date"` cobra tres toques por una fecha que en
el 95% de los casos es "hoy".

## Lo que Paulo ya decidió (no se re-discute)

1. **Solo la UI.** El modo de carga en serie se hace con **N POSTs secuenciales desde el
   browser**, cada uno con su id de cliente. La idempotencia ya está resuelta (decisiones 63 y
   67, que usan la puerta que abrió la 41): un corte de red y su reintento vuelven como
   `EVENTO_DUPLICADO`, no como un parto cargado dos veces. **No inventes un endpoint batch y no
   pidas listas filtradas nuevas.** Del repo del backend se **lee** la spec y se **levanta** la
   demo —las dos cosas las vas a necesitar— pero **no se edita ni un archivo**. Se descartó el
   batch en la API porque obliga a decidir qué pasa cuando el evento 12 de 25 se rechaza, y esa
   pregunta se contesta mejor en la pantalla —donde está la persona— que en una transacción.
2. **Flujo y aspecto juntos.** Se rehace cómo se navega **y** cómo se ve. El CSS va a crecer, así
   que la decisión 51 (nada de librerías de componentes ni Tailwind) **se revisa explícitamente y
   por escrito**, como ya se hizo una vez en la 61 — no se deja vencer por omisión.
3. **El offline queda afuera.** El hallazgo ④ se anota como próxima tanda, con lo que se aprenda
   acá. No metas un service worker, ni una cola en `localStorage`, ni una app instalable.

## Convenciones (no negociables)

1. **La UI no tiene reglas de dominio.** No pre-valida transiciones, plazos ni payloads: manda el
   evento y muestra lo que la API contesta, con los mensajes de §5.6 **tal cual**. La única
   excepción declarada sigue siendo la de la decisión 50 (un rechazo forzable se puede
   confirmar). Si te encontrás escribiendo "si está inseminada entonces…", pensaste mal el lugar.
2. **Cero dependencias de runtime.** Sigue siendo la bandera del proyecto. Si creés que una es
   inevitable, paralo y anotalo en la casilla en vez de agregarla.
3. **Ningún estado se comunica solo con color.** Cada etiqueta lleva su palabra: en el corral hay
   sol de frente y buena parte de la gente que trabaja ahí distingue mal el rojo del verde.
4. **`null` es "sin datos", nunca 0 y nunca en blanco** (decisión 37).
5. **Celular primero**: targets de 48 px, tipografía de 17 px o más en los campos (abajo de 16 px
   iOS hace zoom al enfocar), funciona con una mano. El escritorio suma, no reemplaza.
6. **Español rioplatense** en toda la interfaz, con voseo. Fechas DD/MM/AAAA y **nunca `new
   Date`** en este código (decisiones 47 y 52).
7. **Toda decisión de diseño se registra en el `README.md` de este repo**, en prosa, con el
   problema, el porqué y lo que se descartó — al estilo de las que ya están. El registro numerado
   §7 es del otro repo y esta tanda no lo toca.
8. Cada parte cierra con: `npm test` en verde, `npm run typecheck` limpio, `npm run build` sin
   errores, casilla marcada con hash, commit al estilo del historial y `git push`.

### Lo que no se toca, aunque estés remodelando

Estas piezas tienen su porqué escrito y una remodelación las rompe sin querer. Si alguna te
estorba, **anotalo en la casilla y seguí; no la borres**:

- el 401 atendido en un solo lugar (`cliente.ts`) y su aviso al revés, por el caso del 401 a
  mitad de una carga;
- la excepción de `validaUnaPassword`: un 401 de un pedido con contraseña adentro no cierra la
  sesión;
- el 403 que nunca vuelve al login, y su bifurcación entre "en la puerta" y "adentro";
- `puedeCargarEn()` como **única** cuenta de permisos, viajando en el contexto del
  establecimiento. Ninguna pantalla la recalcula — el admin viene con `permisos: []` y puede
  todo;
- el id de cliente por evento y por anulación;
- el ruteo por hash sin dependencias, y que las direcciones se armen con las funciones de
  `ruteo.ts` y nunca a mano;
- que el panel del admin sea otro árbol, dibujado afuera del establecimiento activo;
- `src/api/nucleo.ts` es una **copia** de los tipos del núcleo: se lee, no se edita.

### Sobre los 207 tests

Muchos consultan por rótulo y por rol, así que **esta tanda los va a romper**. La regla para
distinguir:

- un test que rompe **porque el texto cambió** se actualiza sin culpa;
- un test que rompe **porque el comportamiento cambió** es un hallazgo: o el comportamiento nuevo
  está mal, o el test estaba documentando algo que ya no vale. Decidí cuál de las dos y **escribí
  en la casilla cuál era**;
- un test que **desaparece** porque su pantalla desapareció se reemplaza por el de la pantalla
  nueva, no se borra a secas. Si al terminar una parte hay menos tests que al empezar, decí por
  qué.

Y el que de verdad protege un cambio de flujo es el humo: **`npm run test:demo`**, con la demo
levantada del otro repo (`DEMO_PORT=3000 npm run demo --prefix api`), que monta la app sin
mockear `fetch` y entra con los tres usuarios. Corrélo al cerrar cada parte que toque navegación.
**No lo apuntes nunca a producción**: ese humo da de alta un animal.

## Las partes

### Parte 1 — El vocabulario visual, antes de mover una sola pantalla

Va primero para no rehacer el CSS dos veces, y es **deliberadamente chica**: acá no se rediseña
ninguna pantalla todavía.

- **Una escala explícita.** Hoy el sistema de diseño son cuatro variables (`--toque`, `--radio`,
  `--espacio` y los colores) y los tamaños de letra están escritos a mano en una docena de
  lugares (`1.05rem`, `0.88rem`, `0.82rem`, `0.78rem`, `0.75rem`…). Definí una escala tipográfica
  y una de espaciado como variables, y pasá el CSS existente a usarlas. El encabezado del archivo
  dice que si hay que agregar una escala es que la app creció y la decisión hay que revisarla:
  **creció, y esta es la revisión.**
- **La segunda revisión de la decisión 51, por escrito.** La primera fue la **61**, que miró el
  disparador de las 400 líneas cuando `estilos.css` tenía 619 y confirmó que Tailwind seguía
  afuera. Hoy tiene **695** y esta tanda le va a sumar. Con eso y catorce pantallas, ¿sigue
  valiendo? La respuesta esperada es que sí —cero dependencias de runtime es la bandera del
  proyecto, y el botón de esta app se toca con guante mojado— pero **escribila en el README con
  lo que pesaría la alternativa**, y dejá el disparador nuevo con un número, no con un "cuando
  crezca".
- **Dos componentes nuevos y nada más**: un grupo de **chips** (para filtros que hoy son
  `select`) y un **selector segmentado** (para elegir entre pocas opciones a un toque). Los dos
  con target de 48 px, los dos con palabra y no solo color, los dos usables con una mano.
- **La densidad deja de ser una sola.** El `max-width: 720px` de `.app` es correcto para las
  pantallas de carga y equivocado para las de análisis. Introducí la distinción —una clase, un
  breakpoint— **sin aplicarla todavía a ninguna pantalla**: eso es la Parte 5.
- **Una pregunta de dominio para que decidas y registres**: hoy hay `color-scheme: light` fijo, y
  el porqué escrito es el sol de frente. Pero **el primer ordeñe empieza antes del amanecer**, y
  una pantalla blanca a las cinco de la mañana en un corral oscuro encandila igual que el sol.
  Decidí si eso justifica un modo oscuro, dejá el porqué en el README, y si la respuesta es que
  sí, hacelo acá —donde están las variables— y no repartido por las pantallas.

**Cómo verificás esta parte**: **en claro, la app tiene que verse exactamente igual que antes.**
Es una refactorización del CSS, y si algo se movió es un error. (El modo oscuro, si decidís que
va, es una capa que se suma: no cambia un píxel de cómo se ve en claro, y por eso no rompe esta
verificación.) Los dos componentes nuevos quedan escritos y probados **sin que ninguna pantalla
los use todavía**. Los 207 tests siguen en verde sin tocar uno solo.

### Parte 2 — La carga en serie: el modo lista

El corazón de la tanda. Una pantalla nueva donde **se elige el tipo de evento una vez y se
recorren N animales cargándoselo**, sin salir de ella.

Cómo se entra: desde una lista de trabajo del tablero ("tactar estas cuatro"), y desde el rodeo
con los filtros puestos ("control lechero a las treinta en ordeñe"). Los dos orígenes ya tienen
sus datos —`GET /alertas` y `GET /animales`— así que **no hace falta ningún pedido nuevo**.

Las decisiones que este prompt te deja tomadas, porque son las que se descubren tarde:

- **La lista se congela al arrancar la corrida.** Después de cargarle el tacto a la tercera vaca,
  esa vaca ya no está "para revisar" — pero la lista **no se vuelve a pedir ni se reordena**: se
  le pone una marca de hecha y se queda donde está. Una lista que se reordena abajo del dedo hace
  perder el lugar, que es exactamente el hallazgo ② que vinimos a arreglar.
- **Un rechazo no frena la corrida.** El animal que la API rechaza queda **apartado con su
  mensaje de §5.6 tal cual**, y la corrida sigue con el siguiente. Al final, los apartados se
  atienden juntos: es donde vive el "Confirmar igual" (que exige observaciones y por lo tanto un
  teclado, y por lo tanto no puede estar en el medio de un recorrido de veinticinco).
- **El progreso está siempre a la vista**: cuántas van, cuántas faltan, cuántas quedaron
  apartadas. En el corral la pantalla se mira de reojo.
- **Cada carga lleva su propio id de cliente**, generado al agregar el animal a la corrida y
  estable a través de los reintentos. Es lo que hace que insistir después de un pozo de señal no
  duplique el evento.
- **Los pedidos van de a uno, en serie y no en paralelo.** Contra una API que duerme y un celular
  con una barra de señal, veinticinco POSTs simultáneos es la forma más rápida de que fallen
  todos. En serie, además, el orden de lo que se ve en pantalla es el orden de lo que pasó.
- **Si se cae la sesión a mitad de la corrida** —las 8 horas se cumplen a media mañana— el
  callback de `alCaerLaSesion()` desmonta todo y vuelve al login. Eso **no puede tragarse en
  silencio las que faltaban**: la corrida tiene que frenar y el mensaje tiene que decir cuántas
  entraron y cuántas no. Es el mismo criterio que ya rige para la carga suelta ("ese evento no se
  guardó"), aplicado a N.
- **Una sola fecha para toda la corrida**, elegida al arrancar y con hoy por default. El
  veterinario que pasa el miércoles carga el miércoles entero: preguntar la fecha por animal es
  veinticinco veces la misma respuesta. Sale de `hoyDelServidor` y **nunca** del reloj del
  celular (decisión 52).
- **Sin observaciones por animal.** El campo se queda en la carga suelta, donde tiene sentido; en
  una corrida es el teclado abierto veinticinco veces. La excepción es el apartado que se
  confirma al final, donde la API las exige igual.
- **El que tiene permiso de lectura no ve esta puerta**, con el mismo criterio de siempre: mejor
  que no esté a que esté y falle. Y si igual llega por la barra de direcciones, un renglón que lo
  explique y no una corrida entera cuyo único final posible es un 403.
- **La corrida vive en memoria.** Merece su entrada en `ruteo.ts` —para que la flecha de volver y
  el "atrás" del celular sepan a dónde van— pero recargar la página la termina, como cualquier
  cosa que no se guardó. Que la lista congelada y el progreso sobrevivan a un F5 es el problema
  de la cola offline, que **quedó afuera de esta tanda**: no lo empieces por la mitad.
- **La pantalla de carga suelta se queda.** `CargarEvento.tsx` sigue siendo el camino de una vaca
  sola, y la corrida no la reemplaza: la complementa. Lo que sí cambia ahí es lo de la Parte 3.

Qué tipos de evento admite el modo serie: aquellos cuyo payload **es el mismo para todas o cabe
en un campo**. Entran celo, tacto positivo, tacto negativo y secado —que no llevan payload— y el
`control_lechero`, que lleva un solo número por animal: un input numérico y el siguiente, que
sigue siendo una corrida. Grasa, proteína y RCS **no** se piden en serie; para eso está la carga
suelta. **El parto y la baja no entran**: cada uno lleva un payload propio y distinto por animal,
y un formulario largo repetido veinticinco veces no es una corrida, es la pantalla que ya existe
con más pasos.

**Cómo verificás esta parte**: tests de la pantalla nueva —la corrida completa, la que falla en el
medio, la sesión que se cae, el rol de lectura— y el humo contra la demo, cargándole un celo a
tres animales de verdad en una corrida.

### Parte 3 — El camino corto, y volver a donde estabas

- **La ficha deja de traer todo de una.** Los KPIs, las lactancias y el historial de reglas no se
  miran al entrar: se piden cuando se abren. Cuidado con lo que **sí** bloquea —la proyección, de
  la que sale la caravana del encabezado— y con la regla de que cada tarjeta se cae sola
  (decisión 56), que no se toca.
- **`CargarEvento` deja de pedir el animal entero** para poner la caravana en el título. La
  caravana ya la tiene quien lo abrió; pasala.
- **El ← vuelve a donde viniste.** Hoy la ficha vuelve siempre al rodeo (`Ficha.tsx:70`) aunque
  hayas entrado desde una lista del tablero o desde una corrida. Dos condiciones para la
  solución, y salen de cómo está armada esta app: **el origen tiene que viajar en la dirección**
  —para que sobreviva a una recarga y a un enlace compartido, que es lo que ya pasa con todo lo
  demás del ruteo por hash— y **no puede haber una pila de navegación** que alguien tenga que
  mantener sincronizada con el "atrás" del browser. Los enlaces de esta app son enlaces de verdad
  y el "atrás" del celular ya deshace el camino; lo que falta es que la flecha de la pantalla
  haga lo mismo. Cómo se codifica el origen lo elegís vos, pero armalo con las funciones de
  `ruteo.ts` y no concatenando hashes en las pantallas.
- **Atajo de carga desde la fila.** Que cargarle algo a una vaca no obligue a pasar por su ficha.
  Sin romper que la caravana entera siga siendo el target grande que lleva a la ficha: son dos
  acciones en una fila de 60 px y la principal sigue siendo la de siempre.
- **La fecha, a cero toques.** "Hoy" ya es el default y está bien; lo que falta es "ayer" sin
  abrir el date picker nativo. El día lo pone el servidor (`hoyDelServidor`) y restarle uno **no
  se hace con `new Date`**: mirá cómo `Tanque.tsx:32` resuelve el primero del mes cortando el
  string, y si para "ayer" eso no alcanza, la cuenta va en `formato.ts`/`reloj.ts` con su test y
  no repartida por las pantallas.

### Parte 4 — El tablero que prioriza y el rodeo que se filtra a un toque

- **El tablero es una lista de tareas, no un informe.** El orden ya es el correcto (primero lo que
  hay que hacer); lo que falta es que la **jerarquía visual lo diga**: hoy "Para revisar (3)" pesa
  lo mismo que el reparto de dietas. Una lista de trabajo con animales adentro tiene que
  dominar la pantalla, y una vacía tiene que seguir diciendo su frase completa —"ninguna para
  revisar"—, que es una respuesta y no un hueco.
- **Y tiene que ofrecer la corrida ahí mismo**: desde "Para revisar (4)", empezar a tactar las
  cuatro es un toque.
- **Los filtros del rodeo pasan a chips.** Los tres `select` apilados ocupan una pantalla entera
  antes de la primera fila. Con los chips de la Parte 1, filtrar "inseminadas" es un toque y la
  primera fila se ve sin scrollear. El filtrado sigue siendo en el cliente y sin saber nada de
  dominio (decisión 58): compara el estado que la fila trae con el que el chip dice.
- **Que se vea qué filtro está puesto sin leer tres desplegables**, y que se pueda sacar todo de
  un toque.

### Parte 5 — El escritorio, y la verificación contra la demo de verdad

- **Las pantallas de análisis usan el ancho** que la Parte 1 dejó preparado: el tanque con su
  período, el rodeo entero, los números del rodeo, la ficha, y el panel del admin —que es el que
  más lo pide, porque repartir permisos no se hace en el corral—. **Las de carga no**: el
  formulario angosto es correcto y ensancharlo solo aleja los campos.
- **Nada de esto puede empeorar el celular.** Es un `min-width`, no un rediseño paralelo: si
  aparece una segunda versión de una pantalla, pensaste mal el lugar.
- **La verificación de punta a punta**, que es la que cierra la tanda: con la demo levantada,
  entrar con los **tres** usuarios —admin, escritura y lectura— y recorrer la app entera. El de
  `lectura` es el que nadie prueba y el que más fácil se rompe: tiene que ver el tambo entero y
  **ninguna** puerta de carga, incluida la nueva.
- **Volvé a medir lo que el estudio midió**, con la misma tabla y contando igual: cuántos pedidos
  y cuántos toques cuesta ahora cargarle un tacto a **una** vaca, y cuántos cuesta cargárselo a
  **veinticinco** en corrida. Escribí los cuatro números en la casilla, al lado de los de arriba.
  El punto de comparación es **16 pedidos y 6 toques por vaca**: si el caso de una vaca sola no
  quedó claramente por debajo de eso, algo de las Partes 3 y 4 quedó a medias, y decilo en vez de
  cerrar la casilla.
- **Actualizá el `README.md`**: la cantidad de pantallas (hoy dice catorce), el mapa de `src/`, y
  las decisiones nuevas de las cinco partes.

## Si algo te bloquea

Paulo no está mirando mientras corrés. Cuando te topes con algo que el prompt no resuelve:
**decidí con el criterio del proyecto, dejalo registrado en el README con lo que descartaste, y
seguí.** Lo que no se hace es inventar en silencio ni frenar la parte entera.

Dos límites que no son tuyos para cruzar, y si llegás a uno **hacé todo lo demás y anotá qué
necesitás**:

- **editar el repo del backend** — la decisión 1 de arriba lo prohíbe (leerlo y levantar la demo,
  en cambio, es parte del trabajo). Si encontrás algo que de verdad no se puede hacer sin la API,
  escribí exactamente qué endpoint haría falta y por qué, y seguí con el resto;
- **producción** — desplegar y probar contra `tambo-ui.onrender.com` es de Paulo. Vos verificás
  contra la demo local, que para eso está.

## Progreso

Marcá al terminar cada parte: `- [x] Parte N — <hash> — <una línea de qué quedó>`.

- [x] Parte 1 — `073d517` — Las tres escalas puestas y los dos controles hechos sin
      que ninguna pantalla los use. **El prompt pedía un imposible y conviene saberlo
      antes de la Parte 5**: la verificación decía "en claro tiene que verse
      exactamente igual", y había **quince** tamaños de letra escritos a mano donde la
      mitad eran duplicados accidentales de dos centésimas (`0.78`/`0.80`/`0.82`
      haciendo el mismo trabajo). Una escala que preserve los quince *es* el estado
      anterior. Se colapsaron a **siete pasos**, lo que movió **once selectores**,
      ninguno más de 1,7 px, y están todos con su delta en el README. El más grande
      es `.cifra .valor` (1.6 → 1.5rem): la caravana de una fila y el número de un KPI
      son el mismo papel y que fueran distintos no lo había decidido nadie.
      Tres tamaños quedan fuera de la escala **a propósito** y con su comentario: los
      17 px del `body` (la raíz de los `rem`), los 17 px de los campos (abajo de 16 px
      iOS hace zoom) y los 10/12 px de la curva, que están adentro de un `viewBox`
      donde un `px` no es un píxel de CSS — un `rem` ahí escalaría contra otra cosa.
      **El modo oscuro va.** La pregunta que el prompt dejaba abierta se cerró que sí,
      por `prefers-color-scheme` y sin botón: el teléfono ya da vuelta el tema justo
      en las horas en que el tambo trabaja, y una preferencia que hay que cambiar dos
      veces por día no la cambia nadie. Lo que lo destrabó fue desdoblar los colores
      por papel (un mismo `--verde` era fondo del encabezado **y** tinta de un botón
      secundario), y de paso desaparecieron los siete colores literales sueltos por el
      archivo. Los once pares del tema oscuro **medidos**: de 5,9:1 a 14,8:1, todos
      por encima del 4,5:1 de AA.
      La escala de espacio (grilla de 4) **no cubre el archivo entero**: los valores
      fuera de la grilla —6, 10, 14, 18— quedaron literales porque moverlos correría
      el layout de pantallas que esta parte no toca. Se pagan en las Partes 3 a 5.
      Verificado: ninguna `var()` usada sin definir, cero colores literales fuera de
      los bloques de tokens, 217 tests (los 207 de antes **sin tocar uno solo**, más
      10 de los controles), typecheck limpio y build en verde.
      **Pendiente de mirar: la comparación visual.** La extensión de Chrome no está
      conectada en esta máquina, así que el "se ve igual que antes" está sostenido por
      el análisis de los deltas y no por dos capturas al lado. El dev server levanta
      sin problema (`npm run dev`, `localhost:5173`); si alguien puede mirarlo, lo que
      hay que confirmar son las cifras del tablero y la flecha de volver, que son los
      dos deltas de 1,7 px.
- [x] Parte 2 — `a7420fd` — `Corrida.tsx`, con las siete decisiones del prompt
      implementadas tal cual: lista congelada, rechazo que aparta sin frenar,
      apartados atendidos al final, pedidos de a uno por cadena de promesas, una
      sola fecha, sin observaciones por animal, y el id de cliente estable a través
      del "Confirmar igual". **Cero cambios en el backend**, como pedía la decisión
      1: las tres entradas usan `GET /alertas` y `GET /animales`, que ya estaban.
      **Dos cosas que el prompt no preveía y valen para las partes que siguen:**
      (1) *una corrida de tactos tiene dos resultados.* El prompt decía "se elige el
      tipo de evento una vez", y es cierto para el celo o el secado, pero en una
      corrida de tactos la mayoría son positivos y de vez en cuando cae una vacía.
      No hizo falta un concepto nuevo: como el tipo se elige con el `Segmentado` de
      la Parte 1, cambiarlo a mitad de corrida cuesta **un** toque, así que el caso
      minoritario son dos toques y vuelta. Queda escrito como uso normal y no como
      excepción. (2) *`nuevoUuid()` devuelve `string | undefined`* —y no es un
      descuido suyo: sin `getRandomValues` prefiere no dar id antes que inventar uno
      con poca entropía que choque y haga rechazar una carga buena. La corrida
      respeta el hueco igual que la carga suelta.
      **Lo que se apartó del prompt, y por qué:** decía que la sesión caída tenía que
      decir "cuántas entraron y cuántas no". Se implementó el corte de la cola —que
      es lo que evita veinte 401 en fila— pero **no el conteo**, porque no hay nada
      que contar: lo que entró está guardado y el único evento perdido es el que se
      comió el 401, del que ya avisa el mensaje del login. Sostener el número
      obligaba a pasarlo por `CaidaDeSesion` hasta una pantalla que se está
      desmontando, para decir algo que no cambia ninguna decisión de quien lo lee.
      **Lo que queda a medias a propósito:** la corrida desde el rodeo recorre el
      rodeo **entero** y no se lleva los filtros de arriba. Funciona —adentro se
      busca por caravana, que es como se encuentra a la que está en la manga— pero
      el contador dice "quedan 197" en vez de "quedan 30". Se cierra en la Parte 4,
      cuando esos tres desplegables sean chips y haya un filtro que valga la pena
      hacer viajar por la ruta.
      233 tests (los 217 de antes **sin tocar uno solo**, 14 de la corrida y 2 del
      ruteo), typecheck limpio y build en verde. El de la cola es el que más cuesta
      y el que más paga: envuelve el `fetch` para demorar los POST y medir el pico
      en vuelo, porque con un mock instantáneo serie y paralelo se ven igual.
      **Sigue pendiente lo visual**, como en la Parte 1: la extensión de Chrome no
      está conectada en esta máquina.
- [x] Parte 3 — `0c0b0ef` — Los cinco puntos hechos. **Medido: de 16 pedidos y ~6
      toques a 7 y 4** para cargarle un evento a una vaca desde el tablero (3 del
      tablero + 0 de la carga + 1 POST + 3 al volver). La ficha bajó de cinco
      lecturas a tres, la carga de una a cero, y la vuelta ya no pasa por el rodeo.
      **Lo que el prompt pedía y no se hizo entero, con su porqué:** decía que el
      historial de reglas (`GET /configuraciones`) tampoco se pidiera al entrar. Se
      dejó, porque es lo que hace que el historial diga la verdad sobre bajo qué
      parámetros se juzgó cada evento —el pago entero de la decisión 92— y
      esconderlo detrás de un clic lo volvería invisible. El ahorro real ahí es
      **cachearlo por establecimiento** (es el mismo para todo el tambo y hoy viaja
      una vez por ficha), no diferirlo; queda anotado en el README y no cuesta un
      pedido más que antes.
      **Lo que apareció al hacerlo:** (1) la vuelta necesita un filtro de seguridad
      que el prompt no mencionaba — `?de=` termina en un `href` y llega de la barra
      de direcciones, así que solo se acepta lo que empieza con `#/`; sin eso, un
      `?de=https://…` convierte la flecha de volver en un enlace a cualquier lado.
      Tiene sus tres tests. (2) El atajo de la fila **cambia el nombre accesible de
      la fila vecina**: "Cargar un evento a 104" matchea `/104/` igual que la fila,
      y eso rompió dos tests que buscaban por nombre sin anclar. El nombre del atajo
      tiene que llevar la caravana —quien no ve la pantalla necesita saber a qué
      animal le va a cargar— así que se ancló la búsqueda, no se acortó el rótulo.
      (3) El `hoy` del servidor ahora se fija **al abrir el formulario**: releerlo
      en cada dibujo hace que una carga abierta antes de medianoche cambie de día
      sola, y con "Ayer" en pantalla eso se vuelve visible.
      **253 tests. 18 de los viejos cambiaron y ninguno por casualidad**: los de la
      ficha abren la tarjeta antes de mirarla (comportamiento nuevo), los del
      tablero y el rodeo esperan el origen en el `href` (dirección nueva), y el de
      la anulación afirma **dos** refrescos en vez de cuatro — las tarjetas que
      nadie abrió no se refrescan, y refrescarlas sería pagar dos viajes para tirar
      el resultado. 20 tests nuevos, entre ellos los bordes de `diaAnterior` (1900
      contra 2000, que es donde falla el `% 4`). Typecheck limpio y build en verde.
      **Sigue pendiente lo visual**, por lo mismo que en las Partes 1 y 2.
- [x] Parte 4 — `34599d9` — Los cuatro puntos hechos, **más la deuda que la Parte 2
      había dejado anotada**: la corrida hereda los filtros del rodeo, así que el
      contador dice "quedan 30" y no "quedan 197". La cuenta se sacó a `filtros.ts`
      y la usan las dos pantallas: escrita dos veces, el día que se agregue un
      filtro habría dos listas que se despegan y un contador que miente.
      **Lo que apareció al hacerlo, y no estaba en el prompt:**
      (1) *resaltar el número cambia cómo se lee el rótulo.* Lo natural era ponerlo
      adelante y grande, y eso convierte el encabezado en "3 Para revisar" para
      quien usa un lector de pantalla. Se estiliza el paréntesis y no se mueve
      nada: sigue diciendo "Para revisar (3)". Tiene su test.
      (2) *un filtro que viaja en la dirección se puede tipear mal.* Un
      `?repro=PRENIADA` tomado en serio no matchea ninguna fila y deja una corrida
      vacía **sin decir por qué**. `deParametros` descarta lo que no reconoce: la
      corrida recorre de más —que se ve— en vez de recorrer de menos, que no se ve.
      (3) *las de baja no pueden viajar a una corrida.* A un animal de baja no se
      le carga nada, así que una corrida con ellas adentro termina en un rechazo
      por fila; el `conBajas` del rodeo se queda en el rodeo.
      (4) *la corrida filtrada tiene que decir qué recorta.* Treinta filas cuando
      el rodeo tiene doscientas, sin explicación, se lee como que faltan animales.
      **Sobre la jerarquía del tablero**: se destaca la lista de trabajo **con**
      animales y no la vacía, que es lo que hace que una mañana tranquila se vea
      distinta de una con cuatro vacas esperando antes de leer una palabra. Tres
      señales y ninguna es solo el color (borde, número en ámbar, y la ausencia
      del destaque). La composición del rodeo y el tanque no se tocaron: quedan
      secundarios por contraste, que era el objetivo.
      262 tests. Los dos que usaban `selectOptions` ahora tocan chips —el
      desplegable ya no existe—, y 9 nuevos. Typecheck limpio y build en verde.
      **Sigue pendiente lo visual**, y en esta parte pesa más que en las otras tres:
      es la única cuyo entregable **es** jerarquía visual, y está verificada por la
      clase que se aplica y no por haberla mirado.
- [ ] Parte 5 — El escritorio, y la verificación contra la demo de verdad
