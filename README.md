# `tambo-ui` — la UI web del tambo

La pantalla del tambero: pensada para el **celular en el corral**, que es donde
se carga un celo. Es un cliente del contrato de §9 y **no tiene una sola regla de
dominio** — manda el evento y muestra lo que la API contesta.

Se adelanta a propósito a la Fase 6 (autenticación): la cerradura se pone cuando
hay alguien que use la puerta. Mientras tanto el establecimiento se elige una vez
escribiendo su id y queda en `localStorage`.

## Correrla contra la demo

Dos comandos, en dos terminales:

```bash
# en el repo del backend
DEMO_PORT=3000 npm run demo --prefix api   # API + Postgres embebido + un tambo poblado
# en este repo
npm run dev                                # http://localhost:5173
```

La demo imprime el **id del establecimiento** al terminar de poblar: se copia y se
pega en la primera pantalla. Trae ocho animales en distintos estados, un parto
forzado, una anulación, alertas con contenido y el tanque de diez días con uno
olvidado — así que todas las pantallas tienen algo que mostrar.

**No apuntes `VITE_API_URL` a la demo.** La API no manda cabeceras CORS —no tiene
por qué: hasta la Fase 6 no sabe quién le habla— y el browser bloquea el pedido
antes de que salga. Para eso está el **proxy del servidor de desarrollo**, que
reenvía `/establecimientos` y `/salud` al `DEMO_URL` (por default
`http://127.0.0.1:3000`, ver `vite.config.ts` y la decisión 55). `VITE_API_URL` es
para producción, donde la API vive en otro host y sí resuelve el origen.

Para entrar desde el celular, el servidor escucha en la red local: la URL
`Network:` que imprime Vite anda desde el teléfono conectado al mismo wifi.

## Cómo se prueba

```bash
npm test         # Vitest + Testing Library sobre jsdom, con `fetch` mockeado
npm run typecheck
npm run build
```

**No hace falta ni base ni API levantada.** La verificación pesada vive en los 354
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
  api/          El contrato de §9 escrito una vez: tipos y cliente HTTP
  componentes/  Lo que se repite: tarjetas, avisos, cifras, formularios, la curva
  pantallas/    Una por ruta
  formato.ts    Presentación: fechas DD/MM/AAAA, números con coma, el vocabulario
  reloj.ts      Qué día es hoy, según el servidor
  ruteo.ts      Treinta líneas sobre el hash, sin dependencias
  estilos.css   El sistema de diseño entero
```

Seis pantallas: conexión, tablero, rodeo, ficha, carga de evento, alta y tanque.

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

## Dónde está el resto

El backend vive en **`https://github.com/MugiwaraNoSeva/tambo.git`**: el núcleo
(`mu/`), la persistencia (`db/`), la API (`api/`) y la demo. Ahí está también la
spec, **`proyecto_app_tambo-1.md`**: §5.6 (los códigos de error y su columna
"¿Forzable?"), §7 (las decisiones — de la 50 a la 66 son de la UI) y **§9 (el
contrato de la API, la única fuente de verdad sobre requests y respuestas)**.
