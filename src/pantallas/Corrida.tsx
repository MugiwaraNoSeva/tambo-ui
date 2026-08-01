// ─────────────────────────────────────────────────────────────────────────────
// La corrida: un tipo de evento, muchos animales.
//
// Es la pantalla que da vuelta el eje de la app. Todo lo demás está armado como
// "un animal → muchos eventos posibles": se entra a una ficha y se elige qué
// cargarle. El trabajo de la mañana es al revés — viene el veterinario y tacta
// veinticinco seguidas, el inseminador recorre las que están en celo, el control
// lechero pasa por el rodeo entero el mismo día—: **lo constante es el tipo y lo
// que cambia es la caravana**.
//
// Acá tampoco hay una regla de dominio. La corrida no sabe qué animal puede
// recibir un tacto: manda el evento y muestra lo que la API contesta, uno por
// uno. Lo único que agrega es el orden en que se hacen las cosas.
//
// Lo que se decidió y por qué está en el README, en *La corrida*. En corto, y
// porque es lo que se descubre tarde:
//
//   · **la lista se congela** al abrir la pantalla y no se vuelve a pedir. La
//     vaca recién tactada ya no está "para revisar", pero sacarla de la lista
//     mientras el dedo va bajando hace perder el lugar, que es el defecto que
//     esta pantalla vino a arreglar;
//   · **un rechazo no frena la corrida**: ese animal queda apartado con su
//     mensaje y se sigue con el siguiente. Los apartados se atienden juntos al
//     final, que es donde vive el "Confirmar igual" — pide observaciones, o sea
//     teclado, y el teclado no puede aparecer en el medio de un recorrido;
//   · **los pedidos van de a uno**. Contra una API que duerme y un celular con
//     una barra de señal, veinticinco POST simultáneos es la forma más rápida de
//     que fallen todos.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo, useRef, useState } from 'react';
import { ErrorApi, api } from '../api/cliente';
import type { AnimalDeLista, CuerpoError, CuerpoEvento } from '../api/tipos';
import { Armazon } from '../componentes/armazon';
import { Aviso, Cargando, Cifra, SoloLectura, Tarjeta, TarjetaCaida } from '../componentes/basicos';
import { Campo, Rechazo, Segmentado, type Opcion } from '../componentes/formulario';
import { usarEstablecimiento } from '../establecimiento';
import { TIPO_EVENTO, caravanaVisible, numero } from '../formato';
import { hoyDelServidor } from '../reloj';
import { aRodeo, aTablero, type OrigenDeCorrida } from '../ruteo';
import { nuevoUuid } from '../uuid';
import { mensajeDe, usarPedido } from '../usarPedido';

/**
 * Los tipos que se pueden cargar en serie: aquellos cuyo payload **es el mismo
 * para todas o cabe en un campo**.
 *
 * Los cuatro primeros no llevan payload. El control lechero lleva un solo número
 * por animal, que es un input y el siguiente — sigue siendo una corrida. Grasa,
 * proteína y RCS no se piden acá: para eso está la carga suelta.
 *
 * **El parto y la baja no entran**, y no es un olvido: cada uno lleva un payload
 * propio y distinto por animal (las crías con su sexo y su resultado, el motivo
 * de la salida), y un formulario largo repetido veinticinco veces no es una
 * corrida — es la pantalla que ya existe, con más pasos.
 */
const EN_SERIE = ['tacto_positivo', 'tacto_negativo', 'celo', 'secado', 'control_lechero'] as const;

type TipoEnSerie = (typeof EN_SERIE)[number];

const OPCIONES: readonly Opcion<TipoEnSerie>[] = EN_SERIE.map((t) => ({
  valor: t,
  rotulo: TIPO_EVENTO[t],
}));

/**
 * De qué lista sale cada corrida, cómo se llama y con qué tipo arranca.
 *
 * El tipo por default **sale del origen**, y es la mitad del arreglo: hasta acá
 * el formulario de carga volvía a `celo` en cada evento, así que cargar un tacto
 * costaba abrir un desplegable y elegir, veinticinco veces. Quien entra desde
 * "Para revisar" viene a tactar; quien entra desde "Para secar", a secar.
 */
const ORIGEN: Record<
  OrigenDeCorrida,
  { titulo: string; vuelveA: string; tipo: TipoEnSerie; vacia: string }
> = {
  'para-revisar': {
    titulo: 'Corrida — para revisar',
    vuelveA: aTablero(),
    tipo: 'tacto_positivo',
    vacia: 'Ninguna para revisar: las inseminadas tienen su tacto al día.',
  },
  'para-secar': {
    titulo: 'Corrida — para secar',
    vuelveA: aTablero(),
    tipo: 'secado',
    vacia: 'Ninguna para secar.',
  },
  rodeo: {
    titulo: 'Corrida — el rodeo',
    vuelveA: aRodeo(),
    tipo: 'celo',
    vacia: 'El rodeo está vacío.',
  },
};

/** En qué anda cada animal de la corrida. */
type Paso =
  | { paso: 'pendiente' }
  | { paso: 'yendo' }
  | { paso: 'hecha'; tipo: TipoEnSerie }
  | { paso: 'apartada'; tipo: TipoEnSerie; error: CuerpoError };

interface EnLaCorrida {
  animalId: string;
  caravana: string | null;
  /**
   * Su id de cliente, generado **al armar la corrida** y estable a través de los
   * reintentos y del "confirmar igual". Es lo que hace que insistir después de un
   * pozo de señal vuelva como `EVENTO_DUPLICADO` en vez de cargar dos veces
   * (decisiones 63 y 67).
   *
   * `undefined` cuando el browser no supo dar bytes aleatorios: ahí el id lo pone
   * el servidor y lo único que se pierde es la protección contra el reintento.
   * Inventar uno con `Math.random` sería peor —dos ids iguales harían que la API
   * rechace una carga buena por duplicada— y por eso viaja el hueco.
   */
  idDelEvento: string | undefined;
  estado: Paso;
}

/**
 * La puerta. Al de `lectura` el tablero no le ofrece empezar una corrida; esto
 * es para el que igual llegó por la barra de direcciones, y le dice por qué no
 * puede en vez de dejarlo recorrer una lista entera cuyo único final posible es
 * un 403 por cada animal.
 */
export function Corrida({ origen }: { origen: OrigenDeCorrida }) {
  const { id: est, puedeCargar } = usarEstablecimiento();
  const donde = ORIGEN[origen];

  const traer = useCallback(async (): Promise<AnimalDeLista[]> => {
    if (origen === 'rodeo') {
      const r = await api.animales(est);
      return r.animales.map((a) => ({ animal_id: a.animal_id, caravana: a.caravana }));
    }
    const r = await api.alertas(est);
    return origen === 'para-revisar' ? r.para_revisar : r.para_secar;
  }, [est, origen]);

  const { datos, cargando, error, recargar } = usarPedido(traer);

  if (!puedeCargar) {
    return (
      <Armazon titulo="Corrida" volverA={donde.vuelveA}>
        <SoloLectura>No podés cargar eventos en este tambo.</SoloLectura>
      </Armazon>
    );
  }

  return (
    <Armazon titulo={donde.titulo} volverA={donde.vuelveA}>
      {cargando && <Cargando que="Armando la corrida…" />}
      {!cargando && (error !== null || datos === null) && (
        <TarjetaCaida titulo="La lista" error={error} reintentar={recargar} />
      )}
      {!cargando && datos !== null && error === null && (
        // `LaCorrida` se monta **con la lista ya traída**, y por eso su estado
        // inicial la congela sin ningún esfuerzo: no hay un efecto que la
        // sincronice después ni un pedido que la pueda pisar a mitad de camino.
        <LaCorrida animales={datos} origen={origen} />
      )}
    </Armazon>
  );
}

function LaCorrida({ animales, origen }: { animales: AnimalDeLista[]; origen: OrigenDeCorrida }) {
  const { id: est } = usarEstablecimiento();

  const [corrida, setCorrida] = useState<EnLaCorrida[]>(() =>
    animales.map((a) => ({
      animalId: a.animal_id,
      caravana: a.caravana,
      idDelEvento: nuevoUuid(),
      estado: { paso: 'pendiente' },
    })),
  );

  const [tipo, setTipo] = useState<TipoEnSerie>(ORIGEN[origen].tipo);
  // Una sola fecha para toda la corrida. El veterinario que pasa el miércoles
  // carga el miércoles entero: preguntarla por animal es veinticinco veces la
  // misma respuesta. Sale del servidor y nunca del reloj del celular (52).
  const [fecha, setFecha] = useState(hoyDelServidor);
  const [busqueda, setBusqueda] = useState('');

  /**
   * La cola: una cadena de promesas que garantiza **un pedido a la vez**.
   *
   * Con la lista a la vista, el dedo va más rápido que la red — tres toques
   * seguidos serían tres POST en vuelo. Encadenarlos los pone en serie sin un
   * estado de "cola" que haya que dibujar, y de paso el orden en que aparecen
   * los resultados es el orden en que se tocaron.
   */
  const cadena = useRef<Promise<void>>(Promise.resolve());

  /**
   * La sesión se cayó a mitad de la corrida (las 8 horas cumplidas a media
   * mañana). `cliente.ts` ya borró el token y avisó, así que `App` está
   * volviendo al login y esta pantalla se va — pero la cola no lo sabe y tiene
   * veinte pedidos encadenados que ahora son veinte 401 seguros. Esto los corta.
   *
   * Lo que ya entró, entró: nada se pierde. El evento que se comió el 401 es el
   * único que no se guardó, y de eso avisa el mensaje del login.
   */
  const cortada = useRef(false);

  const cambiar = useCallback((animalId: string, estado: Paso) => {
    setCorrida((antes) =>
      antes.map((e) => (e.animalId === animalId ? { ...e, estado } : e)),
    );
  }, []);

  const cargar = useCallback(
    (
      entrada: EnLaCorrida,
      queTipo: TipoEnSerie,
      extra: { payload?: unknown; forzado?: boolean; observaciones?: string } = {},
    ) => {
      cambiar(entrada.animalId, { paso: 'yendo' });

      cadena.current = cadena.current.then(async () => {
        if (cortada.current) {
          cambiar(entrada.animalId, { paso: 'pendiente' });
          return;
        }
        const cuerpo: CuerpoEvento = {
          ...(entrada.idDelEvento === undefined ? {} : { id: entrada.idDelEvento }),
          tipo: queTipo,
          fecha_evento: fecha,
          ...(extra.payload === undefined ? {} : { payload: extra.payload }),
          ...(extra.forzado === true ? { forzado: true } : {}),
          ...(extra.observaciones === undefined ? {} : { observaciones: extra.observaciones }),
        };
        try {
          await api.cargarEvento(est, entrada.animalId, cuerpo);
          cambiar(entrada.animalId, { paso: 'hecha', tipo: queTipo });
        } catch (causa) {
          if (causa instanceof ErrorApi && causa.status === 401) {
            cortada.current = true;
            cambiar(entrada.animalId, { paso: 'pendiente' });
            return;
          }
          cambiar(entrada.animalId, {
            paso: 'apartada',
            tipo: queTipo,
            error:
              causa instanceof ErrorApi
                ? causa.cuerpo
                : { codigo: 'SIN_RESPUESTA', mensaje: mensajeDe(causa) },
          });
        }
      });
    },
    [cambiar, est, fecha],
  );

  const cuenta = useMemo(() => {
    let hechas = 0;
    let apartadas = 0;
    for (const e of corrida) {
      if (e.estado.paso === 'hecha') hechas += 1;
      if (e.estado.paso === 'apartada') apartadas += 1;
    }
    return { hechas, apartadas, quedan: corrida.length - hechas - apartadas };
  }, [corrida]);

  // La búsqueda es por coincidencia parcial, como en el rodeo: en el corral las
  // vacas no vienen en el orden de la lista, así que lo que hace falta es
  // **encontrar la que está adelante**, no bajar en orden.
  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (texto === '') return corrida;
    return corrida.filter((e) => (e.caravana ?? '').toLowerCase().includes(texto));
  }, [corrida, busqueda]);

  const apartadas = corrida.filter(
    (e): e is EnLaCorrida & { estado: Extract<Paso, { paso: 'apartada' }> } =>
      e.estado.paso === 'apartada',
  );

  if (corrida.length === 0) {
    return (
      <Tarjeta titulo="No hay nada que recorrer">
        <p className="vacio">{ORIGEN[origen].vacia}</p>
      </Tarjeta>
    );
  }

  return (
    <>
      <Tarjeta titulo="Qué se carga">
        {/* Un segmentado y no un desplegable: el tipo se elige una vez y se ve
            siempre, y cambiarlo cuesta un toque. Eso importa en una corrida de
            tactos, donde la mayoría son positivos y de vez en cuando cae una
            vacía: pasar a "Tacto negativo" y volver son dos toques, no seis. */}
        <Segmentado
          etiqueta="Tipo de evento"
          opciones={OPCIONES}
          elegida={tipo}
          alElegir={setTipo}
        />
        <Campo etiqueta="Cuándo" ayuda="Vale para toda la corrida. Por default, hoy.">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </Campo>
      </Tarjeta>

      <Tarjeta titulo="Cómo viene">
        <div className="cifras">
          <Cifra rotulo="Cargadas" valor={numero(cuenta.hechas)} />
          <Cifra rotulo="Quedan" valor={numero(cuenta.quedan)} />
          <Cifra rotulo="Apartadas" valor={numero(cuenta.apartadas)} />
        </div>
      </Tarjeta>

      <Tarjeta titulo="La lista" subtitulo="Congelada al abrir: lo cargado queda marcado en su lugar.">
        <Campo etiqueta="Buscar una caravana">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Escribí un número"
          />
        </Campo>

        {visibles.length === 0 ? (
          <p className="vacio">Ninguna caravana con ese número en esta corrida.</p>
        ) : (
          <ul className="lista">
            {visibles.map((entrada) => (
              <FilaDeCorrida
                key={entrada.animalId}
                entrada={entrada}
                tipo={tipo}
                alCargar={cargar}
              />
            ))}
          </ul>
        )}
      </Tarjeta>

      {apartadas.length > 0 && (
        <Tarjeta
          titulo={`Las apartadas (${numero(apartadas.length)})`}
          subtitulo="La API las rechazó y la corrida siguió. Se atienden acá, al final."
        >
          <ul className="lista-simple">
            {apartadas.map((entrada) => (
              <li key={entrada.animalId}>
                <strong>{caravanaVisible(entrada.caravana)}</strong>
                {/* El mensaje de §5.6 tal cual, con su código y su "Confirmar
                    igual" si el servidor dijo que es forzable. Es el mismo
                    componente que la carga suelta: el rechazo se lee igual
                    venga de donde venga. */}
                <Rechazo
                  error={entrada.estado.error}
                  alConfirmar={(observaciones) =>
                    cargar(entrada, entrada.estado.tipo, { forzado: true, observaciones })
                  }
                />
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </>
  );
}

/**
 * Un animal de la corrida.
 *
 * El renglón entero es la acción cuando está pendiente: en el corral el dedo no
 * tiene que apuntar. Lo cargado **no se saca ni se mueve**, se marca — y la
 * marca lleva su palabra, no un color ni un tilde solo.
 */
function FilaDeCorrida({
  entrada,
  tipo,
  alCargar,
}: {
  entrada: EnLaCorrida;
  tipo: TipoEnSerie;
  alCargar: (
    entrada: EnLaCorrida,
    tipo: TipoEnSerie,
    extra?: { payload?: unknown; forzado?: boolean; observaciones?: string },
  ) => void;
}) {
  const [litros, setLitros] = useState('');
  const caravana = caravanaVisible(entrada.caravana);

  if (entrada.estado.paso === 'hecha') {
    return (
      <li className="fila hecha">
        <span className="caravana">{caravana}</span>
        <span className="detalle">
          <span className="marca hecha">cargado — {TIPO_EVENTO[entrada.estado.tipo]}</span>
        </span>
      </li>
    );
  }

  if (entrada.estado.paso === 'apartada') {
    return (
      <li className="fila apartada">
        <span className="caravana">{caravana}</span>
        <span className="detalle">
          <span className="marca apartada">apartada — {entrada.estado.error.codigo}</span>
          <span className="renglon">Se atiende abajo, en "Las apartadas".</span>
        </span>
      </li>
    );
  }

  const yendo = entrada.estado.paso === 'yendo';

  // El control lechero es el único que lleva un dato por animal. Un input y el
  // siguiente: no abre un formulario, así que la corrida sigue siendo corrida.
  if (tipo === 'control_lechero') {
    return (
      <li className="fila">
        <span className="caravana">{caravana}</span>
        <span className="detalle">
          <input
            className="litros"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={litros}
            onChange={(e) => setLitros(e.target.value)}
            aria-label={`Litros de ${caravana}`}
            placeholder="Litros"
          />
        </span>
        <button
          className="boton chico"
          type="button"
          disabled={yendo || litros === ''}
          onClick={() => alCargar(entrada, tipo, { payload: { litros: Number(litros) } })}
        >
          {yendo ? 'Cargando…' : 'Cargar'}
        </button>
      </li>
    );
  }

  return (
    <li>
      <button
        className="fila"
        type="button"
        disabled={yendo}
        onClick={() => alCargar(entrada, tipo)}
      >
        <span className="caravana">{caravana}</span>
        <span className="detalle">
          <span className="renglon">{yendo ? 'Cargando…' : TIPO_EVENTO[tipo]}</span>
        </span>
      </button>
    </li>
  );
}
