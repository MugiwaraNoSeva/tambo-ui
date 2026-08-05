// ─────────────────────────────────────────────────────────────────────────────
// Los parámetros del tambo: los veintidós con los que decide el núcleo.
//
// Es la pantalla más peligrosa del panel, y por eso la mitad de lo que hay acá
// no es formulario sino explicación. Cambiar estos números no toca el historial
// —el log es el log— pero **cambia al instante lo que el sistema concluye de él**:
// las listas de la mañana, las categorías de alimentación y los KPIs se calculan
// al leer, con la configuración vigente. El tambero puede entrar mañana y
// encontrar seis vacas nuevas en "para secar" sin que nadie haya cargado nada.
// Eso se dice arriba de todo, no en el README.
//
// Lo que NO cambia y también se dice: el parto probable de las preñadas de hoy,
// que quedó congelado en la proyección cuando se cargó el diagnóstico.
//
// Dos cosas que hacen que esto no sea un formulario común:
//
//   · **se manda la `Config` entera y se guarda de una sola vez.** Hay cinco
//     reglas que atan unos parámetros con otros, así que guardar de a uno haría
//     imposible un cambio coherente que toca dos campos a la vez —subir el mínimo
//     y el máximo de gestación juntos, por ejemplo—;
//   · **los valores de fábrica vienen de la API.** La decisión 51 le prohíbe a
//     esta UI importar valores del núcleo, así que copiarlos acá sería duplicar el
//     dominio en el peor lugar posible. Los trae `GET /config-default`.
//
// La validación local es **de forma** —un número mayor que cero—, como en toda la
// app. Que la combinación cierre lo dice `validarConfig` en el núcleo, y su
// mensaje se muestra tal cual: está redactado para explicar por qué no cierra
// ("el sistema marcaría tarde a su propia sugerencia"), y reescribirlo acá sería
// duplicar dominio en el lugar que nadie mira cuando la regla cambia.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/cliente';
import type { Config, UsuarioAdmin, VersionDeConfig } from '../api/tipos';
import { Armazon } from '../componentes/armazon';
import { Aviso, Cargando, Tarjeta, TarjetaCaida } from '../componentes/basicos';
import { Campo } from '../componentes/formulario';
import { fechaCorta } from '../formato';
import { aPanelTambo } from '../ruteo';
import { mensajeDe, usarPedido } from '../usarPedido';

/**
 * Los veintidós, con el nombre que usa la gente y no el de la variable.
 *
 * Los textos salen de §5.5 de la spec, que es donde están escritos una vez. Acá
 * no se decide nada del dominio: se decide **cómo se lee**, que es trabajo de
 * esta capa.
 *
 * **Veintiuno son números sueltos y uno es una lista** —los factores de madurez
 * de la decisión 105—. Esa diferencia no es cosmética: hasta que se agregó, esta
 * pantalla podía tratar la `Config` entera como "un `Number()` por campo", y esa
 * suposición estaba escrita en tres lugares distintos. Ver `Borrador`.
 */
interface Parametro {
  campo: ParametroNumerico;
  etiqueta: string;
  ayuda: string;
  unidad: 'días' | 'litros' | 'DEL' | 'kg' | 'factor';
  /**
   * Cuánto se mueve la flecha del input. Uno salvo en los dos parámetros del
   * equivalente maduro, que son decimales chicos: con `step=1` el navegador
   * rechaza un 0,0005 perfectamente válido.
   */
  paso?: number;
  /** El piso del input. Cero en los que lo admiten: desactivar un ajuste es legítimo. */
  minimo?: number;
}

/** Los campos de `Config` que son un número suelto: todos menos `factores_madurez`. */
type ParametroNumerico = Exclude<keyof Config, 'factores_madurez'>;

interface Grupo {
  titulo: string;
  /** La relación que tiene que valer entre estos parámetros, dicha en criollo. */
  regla?: string;
  parametros: Parametro[];
}

const GRUPOS: Grupo[] = [
  {
    titulo: 'Reproducción',
    regla: 'La alerta por falta de diagnóstico no puede caer antes del mínimo para tactar.',
    parametros: [
      {
        campo: 'dias_validez_celo',
        etiqueta: 'Validez del celo',
        ayuda: 'Cuántos días vale un celo para poder inseminar sin forzar.',
        unidad: 'días',
      },
      {
        campo: 'dias_min_entre_celos',
        etiqueta: 'Mínimo entre celos',
        ayuda: 'Dos celos más juntos que esto no son dos celos.',
        unidad: 'días',
      },
      {
        campo: 'dias_retorno_celo',
        etiqueta: 'Celo de retorno',
        ayuda: 'A los cuántos días del servicio se espera el celo de retorno.',
        unidad: 'días',
      },
      {
        campo: 'dias_pve',
        etiqueta: 'Período voluntario de espera',
        ayuda: 'Del parto al primer servicio: antes de esto no se insemina.',
        unidad: 'días',
      },
      {
        campo: 'dias_edad_min_primer_servicio',
        etiqueta: 'Edad al primer servicio',
        ayuda: 'Edad mínima de la vaquillona para el primer servicio.',
        unidad: 'días',
      },
      {
        campo: 'dias_min_para_tacto',
        etiqueta: 'Mínimo para tactar',
        ayuda: 'Antes de esto el tacto no puede diagnosticar nada.',
        unidad: 'días',
      },
      {
        campo: 'dias_alerta_sin_diagnostico',
        etiqueta: 'Alerta sin diagnóstico',
        ayuda: 'Inseminada sin tacto por más de esto: entra a la lista de revisión.',
        unidad: 'días',
      },
    ],
  },
  {
    titulo: 'Gestación y parto',
    regla: 'La gestación promedio tiene que caer entre la mínima y la máxima.',
    parametros: [
      {
        campo: 'dias_gestacion_min',
        etiqueta: 'Gestación mínima',
        ayuda: 'La más corta que se considera plausible.',
        unidad: 'días',
      },
      {
        campo: 'dias_gestacion',
        etiqueta: 'Gestación promedio',
        ayuda: 'De acá sale el parto probable de cada preñez nueva.',
        unidad: 'días',
      },
      {
        campo: 'dias_gestacion_max',
        etiqueta: 'Gestación máxima',
        ayuda: 'La más larga que se considera plausible.',
        unidad: 'días',
      },
      {
        campo: 'dias_tolerancia_gestacion',
        etiqueta: 'Tolerancia de la edad de preñez',
        ayuda:
          'Cuánto puede diferir la edad que declara el veterinario al tactar de la que sale del servicio anotado. Un ciclo estral: el error que importa es estar corrido un servicio entero.',
        unidad: 'días',
      },
    ],
  },
  {
    titulo: 'Secado y preparto',
    regla:
      'El preparto tiene que empezar después del secado más tardío admitido, y ese no puede superar al secado planificado.',
    parametros: [
      {
        campo: 'dias_secado_preparto',
        etiqueta: 'Secado planificado',
        ayuda: 'Cuántos días antes del parto probable se seca.',
        unidad: 'días',
      },
      {
        campo: 'dias_min_secado_preparto',
        etiqueta: 'Secado más tardío admitido',
        ayuda: 'Más cerca del parto que esto, el secado llegó tarde.',
        unidad: 'días',
      },
      {
        campo: 'dias_preparto',
        etiqueta: 'Preparto',
        ayuda: 'Cuántos días antes del parto probable la seca pasa a dieta de transición.',
        unidad: 'días',
      },
    ],
  },
  {
    titulo: 'Producción y dieta',
    regla: 'El corte de lactancia temprana tiene que ser anterior al de media.',
    parametros: [
      {
        campo: 'del_lactancia_temprana',
        etiqueta: 'Fin de lactancia temprana',
        ayuda: 'Hasta este día en leche la vaca come dieta de lactancia temprana.',
        unidad: 'DEL',
      },
      {
        campo: 'del_lactancia_media',
        etiqueta: 'Fin de lactancia media',
        ayuda: 'Hasta este día en leche es media; de ahí en más, tardía.',
        unidad: 'DEL',
      },
      {
        campo: 'dias_lactancia_estandar',
        etiqueta: 'Lactancia estándar',
        ayuda: 'A cuántos días se normaliza la lactancia para poder comparar.',
        unidad: 'días',
      },
      {
        campo: 'litros_max_control',
        etiqueta: 'Techo de litros por control',
        ayuda: 'Más que esto en un control diario es un error de carga.',
        unidad: 'litros',
      },
      {
        campo: 'peso_max_medicion',
        etiqueta: 'Techo de kilos por pesada',
        ayuda:
          'Espeja al de litros: atrapa la balanza pesada con el corral adentro, no un animal grande de verdad.',
        unidad: 'kg',
      },
    ],
  },
  {
    titulo: 'Equivalente maduro',
    regla:
      'Son de la raza y no del manejo: la tabla de un Holando no es la de un Jersey. Sirven para comparar la lactancia de una vaquillona con la de una vaca hecha.',
    parametros: [
      {
        campo: 'edad_referencia_primer_parto',
        etiqueta: 'Edad de referencia al primer parto',
        ayuda: 'La edad para la que el factor de la primera lactancia vale tal cual.',
        unidad: 'días',
      },
      {
        campo: 'ajuste_por_dia_edad_primer_parto',
        etiqueta: 'Ajuste por día de edad',
        ayuda:
          'Cuánto baja el factor de la primera lactancia por cada día de edad al parto por encima de la referencia: una vaquillona que parió más grande necesita menos corrección. En cero, no se ajusta por edad.',
        unidad: 'factor',
        paso: 0.0001,
        minimo: 0,
      },
    ],
  },
];

/** Los rótulos, sin los grupos: los usa quien no dibuja el formulario. */
const ETIQUETAS: Partial<Record<keyof Config, string>> = {
  ...Object.fromEntries(GRUPOS.flatMap((g) => g.parametros.map((p) => [p.campo, p.etiqueta]))),
  factores_madurez: 'Factores de madurez',
};

/**
 * Qué cambió entre dos versiones, dicho para leer.
 *
 * Vive acá porque acá están los rótulos, y lo usa **la ficha del animal**: es lo
 * que convierte "este evento se juzgó con la versión 019fbb…" —que no le dice
 * nada a nadie— en "cuando se cargó, el período voluntario de espera era 45".
 * Comparar dos objetos y elegir palabras es presentación, no dominio.
 */
export function diferenciasDeConfig(vieja: Config, actual: Config): string[] {
  return (Object.keys(ETIQUETAS) as (keyof Config)[])
    .filter((campo) => comoTexto(vieja[campo]) !== comoTexto(actual[campo]))
    .map(
      (campo) =>
        `${(ETIQUETAS[campo] ?? campo).toLowerCase()}: ${comoTexto(vieja[campo])} en vez de ${comoTexto(actual[campo])}`,
    );
}

// ── El borrador, y el parámetro que no es un número ──────────────────────────
//
// El formulario trabaja con texto: un input vacío no es un número. Eso alcanzaba
// mientras la `Config` eran diecisiete enteros, y `factores_madurez` (decisión
// 105) rompió la suposición — es un **array**.
//
// La trampa no fue teórica y conviene dejarla anotada, porque no se vio: con la
// conversión vieja, `String([1.32, 1.16])` daba `"1.32,1.16"` —que hasta se lee
// bien— y `Number("1.32,1.16")` daba `NaN`, que `JSON.stringify` serializa como
// `null`. O sea: la pantalla mostraba los factores correctos, el botón de guardar
// quedaba habilitado siempre —`NaN !== array` es cierto en cada dibujo— y al
// guardar mandaba un `null` en el lugar de la tabla que corrige la producción de
// las vaquillonas. Nada de eso tira una excepción.
//
// Por eso ahora la conversión pasa por dos funciones con nombre en vez de un
// `Number()` derramado sobre `Object.entries`, y `ParametroNumerico` deja que el
// compilador vigile que nadie meta el array en la lista de los números.

/** Lo que se muestra en el input. La lista va separada por comas, que es como se lee. */
const comoTexto = (valor: number | number[]): string =>
  Array.isArray(valor) ? valor.join(', ') : String(valor);

/** Y la vuelta: de lo que se escribió al número —o a la lista— que espera la API. */
const desdeTexto = (campo: keyof Config, texto: string): number | number[] =>
  campo === 'factores_madurez'
    ? texto
        .split(',')
        .map((parte) => Number(parte.trim()))
        .filter((n) => !Number.isNaN(n))
    : Number(texto);

type Borrador = Record<keyof Config, string>;

const aBorrador = (config: Config): Borrador =>
  Object.fromEntries(Object.entries(config).map(([k, v]) => [k, comoTexto(v)])) as Borrador;

export function ConfigDelTambo({ id }: { id: string }) {
  const traerTambo = useCallback(() => api.establecimiento(id), [id]);
  const tambo = usarPedido(traerTambo);
  const traerHistorial = useCallback(() => api.configuraciones(id), [id]);
  const historial = usarPedido(traerHistorial);
  const traerFabrica = useCallback(() => api.configDefault(), []);
  const fabrica = usarPedido(traerFabrica);
  const traerPersonas = useCallback(() => api.usuarios(), []);
  const personas = usarPedido(traerPersonas);

  if (tambo.cargando && tambo.datos === null) {
    return (
      <Armazon ancha titulo="Los parámetros" volverA={aPanelTambo(id)}>
        <Cargando que="Buscando los parámetros…" />
      </Armazon>
    );
  }

  if (tambo.error !== null || tambo.datos === null) {
    return (
      <Armazon ancha titulo="Los parámetros" volverA={aPanelTambo(id)}>
        <TarjetaCaida titulo="El tambo" error={tambo.error} reintentar={tambo.recargar} />
      </Armazon>
    );
  }

  return (
    <Armazon ancha titulo={tambo.datos.nombre} volverA={aPanelTambo(id)}>
      <Aviso tono="atencion" titulo="Qué cambia cuando los cambiás">
        El historial de eventos no se toca: lo que cargó cada uno queda como está, y el parto
        probable de las preñadas de hoy también, porque quedó fijado cuando se cargó el
        diagnóstico. Lo que cambia <strong>al instante y para todo el rodeo</strong> son las listas
        de la mañana, las categorías de alimentación y los indicadores. Alguien puede entrar mañana
        y encontrar vacas nuevas en "para secar" sin que se haya cargado nada.
      </Aviso>

      <Formulario
        id={id}
        config={tambo.datos.config}
        fabrica={fabrica.datos?.config ?? null}
        alGuardar={() => {
          tambo.recargar();
          historial.recargar();
        }}
      />

      <Historial
        versiones={historial.datos?.configuraciones ?? null}
        error={historial.error}
        reintentar={historial.recargar}
        personas={personas.datos?.usuarios ?? null}
      />
    </Armazon>
  );
}

function Formulario({
  id,
  config,
  fabrica,
  alGuardar,
}: {
  id: string;
  config: Config;
  /** Los valores del núcleo, o null si ese pedido no volvió. */
  fabrica: Config | null;
  alGuardar: () => void;
}) {
  const [borrador, setBorrador] = useState<Borrador>(() => aBorrador(config));
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  // Si el tambo se recarga —después de guardar— el borrador arranca de nuevo con
  // lo que quedó guardado, que es lo que el servidor dice que hay.
  useEffect(() => {
    setBorrador(aBorrador(config));
  }, [config]);

  // Se comparan **los textos** y no los valores: comparar un array con `!==`
  // siempre da distinto —son referencias— y el botón de guardar quedaría
  // habilitado sin que nadie haya tocado nada.
  const cambio = Object.entries(borrador).some(
    ([campo, valor]) => valor !== comoTexto(config[campo as keyof Config]),
  );

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    setListo(false);
    try {
      // La `Config` entera, no el campo que cambió: se validan entre ellos, así
      // que uno suelto no se puede juzgar solo.
      const nueva = Object.fromEntries(
        Object.entries(borrador).map(([k, v]) => [k, desdeTexto(k as keyof Config, v)]),
      ) as unknown as Config;
      await api.editarEstablecimiento(id, {
        config: nueva,
        ...(motivo.trim() === '' ? {} : { motivo: motivo.trim() }),
      });
      setMotivo('');
      setListo(true);
      alGuardar();
    } catch (causa) {
      setError(mensajeDe(causa));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      {GRUPOS.map((grupo) => (
        <Tarjeta key={grupo.titulo} titulo={grupo.titulo} subtitulo={grupo.regla}>
          {grupo.parametros.map((p) => {
            const deFabrica = fabrica?.[p.campo];
            const distinto = deFabrica !== undefined && Number(borrador[p.campo]) !== deFabrica;
            return (
              <Campo
                key={p.campo}
                etiqueta={`${p.etiqueta} (${p.unidad})`}
                ayuda={
                  distinto ? `${p.ayuda} De fábrica son ${String(deFabrica)}.` : p.ayuda
                }
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min={p.minimo ?? 1}
                  step={p.paso ?? 1}
                  value={borrador[p.campo]}
                  onChange={(e) =>
                    setBorrador((b) => ({ ...b, [p.campo]: e.target.value }))
                  }
                  required
                />
              </Campo>
            );
          })}

          {/* Los factores van en **su** grupo y con un campo de texto, porque son
              una lista de largo variable y no un número: uno por número de
              lactancia, y el último se aplica a todas las siguientes —el "5+" de
              las tablas publicadas—.

              El aviso no es decorativo: los valores que trae el sistema son del
              orden de magnitud de las tablas de Holando y **no son una tabla
              oficial**. Un factor equivocado no rompe nada; devuelve un número
              plausible y equivocado, que es la peor forma de fallar. */}
          {grupo.titulo === 'Equivalente maduro' && (
            <Campo
              etiqueta="Factores de madurez (uno por lactancia)"
              ayuda="Separados por coma, de la primera lactancia en adelante. El último se aplica a esa y a todas las siguientes. Termina en 1 porque la vaca madura es la referencia; un solo 1 desactiva el ajuste."
            >
              <input
                value={borrador.factores_madurez}
                onChange={(e) =>
                  setBorrador((b) => ({ ...b, factores_madurez: e.target.value }))
                }
                inputMode="decimal"
                autoComplete="off"
                required
              />
            </Campo>
          )}
        </Tarjeta>
      ))}

      <Tarjeta titulo="Guardar el cambio">
        <Campo
          etiqueta="Por qué se cambia"
          ayuda="Queda en el historial. Es lo que va a explicar el número dentro de un año."
        >
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Subimos el PVE a 60 después de la charla con el veterinario."
          />
        </Campo>

        <button className="boton ancho" type="submit" disabled={guardando || !cambio}>
          {guardando ? 'Guardando…' : 'Guardar los parámetros'}
        </button>

        {/* Rellena el formulario, **no guarda**: quien vuelve a fábrica igual
            tiene que mirar lo que queda y confirmarlo. */}
        {fabrica !== null && (
          <button
            className="boton ancho secundario"
            type="button"
            disabled={guardando}
            onClick={() => setBorrador(aBorrador(fabrica))}
          >
            Volver a los valores de fábrica
          </button>
        )}

        {listo && !cambio && (
          <Aviso tono="bien" titulo="Parámetros guardados">
            Quedaron en el historial, con la fecha y con quién los cambió.
          </Aviso>
        )}
        {error !== null && <Aviso titulo="No se pudo guardar">{error}</Aviso>}
      </Tarjeta>
    </form>
  );
}

/**
 * El historial, que es la razón de ser de todo esto: **bajo qué reglas se
 * decidió lo que se decidió**.
 *
 * La primera versión de cada tambo no tiene quién: no la puso nadie, vino con el
 * sistema. Se dice así en vez de inventar un usuario.
 */
function Historial({
  versiones,
  error,
  reintentar,
  personas,
}: {
  versiones: VersionDeConfig[] | null;
  error: string | null;
  reintentar: () => void;
  personas: UsuarioAdmin[] | null;
}) {
  if (error !== null) {
    return <TarjetaCaida titulo="El historial" error={error} reintentar={reintentar} />;
  }
  if (versiones === null) return <Cargando que="Buscando el historial…" />;

  const quien = (usuarioId: string | null): string => {
    if (usuarioId === null) return 'vino con el sistema';
    return personas?.find((p) => p.id === usuarioId)?.nombre ?? 'alguien';
  };

  return (
    <Tarjeta
      titulo="El historial de reglas"
      subtitulo="Con esto se puede saber bajo qué parámetros se decidió cada cosa."
    >
      <ul className="lista-simple">
        {versiones.map((v, indice) => (
          <li key={v.id}>
            <div className="etiquetas">
              {/* Solo el día: la hora exacta de un cambio de reglas no le dice
                  nada a nadie, y `fechaCorta` es el único lugar que sabe que acá
                  se escribe DD/MM/AAAA (decisiones 47 y 52). */}
              <strong>{fechaCorta(v.vigente_desde.slice(0, 10))}</strong>
              {indice === 0 && <span className="etiqueta verde">vigente</span>}
            </div>
            <span className="renglon">La puso: {quien(v.usuario_id)}</span>
            {v.motivo !== null && <span className="renglon observaciones">{v.motivo}</span>}
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
