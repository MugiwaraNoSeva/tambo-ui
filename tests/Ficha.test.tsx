// La ficha del animal. Se prueba que muestre lo que las respuestas traen
// —incluidos los `null`, que son el caso interesante (decisión 37)— y que el
// historial distinga un evento anulado de la anulación que lo deshizo.
//
// Desde la Parte 3 **los números no se piden al entrar**: viven en una tarjeta
// que trae lo suyo recién cuando alguien la abre. Las lactancias se fueron un
// paso más allá —a su propia pantalla, `Partos.test.tsx`— y desde acá no se
// piden nunca; lo que queda en la ficha es el renglón que lleva a ellas.

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { anotarFechaDeLaRespuesta } from '../src/reloj';
import { aAnimal, aPartos, aRodeo } from '../src/ruteo';
import { montarApi, type ApiFalsa, type Manejador } from './servidor';
import {
  EST,
  HOY,
  V102,
  V106,
  animal102,
  establecimiento,
  eventos102,
  eventos105,
  eventos106,
  kpis102,
  kpis106,
  rutasDeLaFicha,
  sesionDePrueba,
} from './fixtures';

function montarFicha(cambios: Record<string, Manejador> = {}): ApiFalsa {
  window.localStorage.setItem('tambo.establecimiento', EST);
  window.location.hash = `#/animales/${V102}`;
  return montarApi({
    ...sesionDePrueba(),
    [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
    ...rutasDeLaFicha,
    ...cambios,
  });
}

const cifra = (rotulo: string): string => {
  const caja = screen.getByText(rotulo).closest('.cifra');
  return caja?.querySelector('.valor')?.textContent ?? '';
};

const dato = (rotulo: string): string => {
  const caja = screen.getByText(rotulo).closest('.dato');
  return caja?.querySelector('dd')?.textContent ?? '';
};

/**
 * Lo que sí llega solo: el estado del animal, que es lo que bloquea la pantalla
 * porque de ahí sale la caravana del encabezado.
 */
const esperarFicha = () => screen.findByText('Nacimiento');

/** El historial sí se pide al entrar: es lo segundo que se mira siempre. */
// Con la cuenta adentro: mientras carga, la tarjeta ya se llama "El historial"
// a secas, así que sin el `(n)` esto resolvería antes de que llegue el log.
const esperarHistorial = () => screen.findByRole('heading', { name: /^El historial \(\d+\)/ });

/** Abre una tarjeta plegable, que es lo que dispara su pedido. */
const abrir = async (titulo: string): Promise<void> => {
  await userEvent.click(await screen.findByRole('button', { name: titulo }));
};

describe('la raza y el lote, que identifican al animal', () => {
  it('los muestra cuando el animal los tiene', async () => {
    montarFicha();
    render(<App />);
    await esperarFicha();

    // La raza es **descriptiva** y no entra en ninguna regla (decisión 109): va
    // arriba con lo que identifica al animal y no abajo con los indicadores.
    expect(dato('Raza')).toBe('Holando');
    expect(dato('Lote')).toBe('Ordeñe 1');
  });

  it('y no deja un "sin datos" cuando el tambo no los usa', async () => {
    // Un rodeo que nunca cargó razas vería el mismo reproche cuatrocientas veces.
    // Lo que falta acá no es un dato que el sistema no pudo calcular —eso sí se
    // dice— sino un atributo opcional que nadie llenó.
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}`]: {
        cuerpo: {
          ...animal102,
          raza: null,
          raza_codigo: null,
          proyeccion: {
            ...animal102.proyeccion,
            estado: { ...animal102.proyeccion.estado, lote: null },
          },
        },
      },
    });
    render(<App />);
    await esperarFicha();

    expect(screen.queryByText('Raza')).not.toBeInTheDocument();
    expect(screen.queryByText('Lote')).not.toBeInTheDocument();
  });
});

describe('la sanidad, que es la única alerta con consecuencia legal', () => {
  /** La misma 102 con el tratamiento todavía en período de retiro. */
  const enRetiro = {
    ...animal102,
    proyeccion: {
      ...animal102.proyeccion,
      tratamientos: [
        {
          ...animal102.proyeccion.tratamientos[0]!,
          fecha: '2026-07-27',
          leche_apta_desde: '2026-07-31',
        },
      ],
    },
  };

  it('avisa cuando la leche de hoy no puede ir al tanque', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}`]: { cuerpo: enRetiro },
    });
    // El hoy sale del servidor y **nunca del celular** (decisión 52): con el reloj
    // del corral corrido un día, la ficha diría que la leche ya es apta el día que
    // todavía no lo es. Acá se fija el mismo hoy que ve la app de verdad, o el
    // test dependería del día en que se corre.
    anotarFechaDeLaRespuesta({ fecha: HOY });
    render(<App />);
    await esperarFicha();

    const aviso = screen
      .getByText(/hoy su leche no va al tanque/i)
      .closest('.aviso') as HTMLElement;
    // La fecha va **en el aviso** y no solo en la lista de abajo: es el dato que
    // decide qué se hace con esa vaca esta mañana.
    expect(aviso.textContent).toContain('31/07/2026');
    expect(aviso.textContent).toMatch(/arruina la carga entera del tambo/i);
  });

  it('y con el retiro ya vencido lista el tratamiento sin avisar nada', async () => {
    // El mismo tratamiento, cuatro meses después. Si el aviso apareciera igual,
    // aparecería siempre — y una alerta que está siempre no es una alerta.
    montarFicha();
    anotarFechaDeLaRespuesta({ fecha: HOY });
    render(<App />);
    await esperarFicha();

    expect(screen.getByText(/mastijet/i)).toBeInTheDocument();
    expect(screen.getByText(/leche apta desde el 18\/01\/2026/i)).toBeInTheDocument();
    expect(screen.queryByText(/hoy su leche no va al tanque/i)).not.toBeInTheDocument();
  });

  it('sin tratamientos no dibuja la tarjeta', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}`]: {
        cuerpo: { ...animal102, proyeccion: { ...animal102.proyeccion, tratamientos: [] } },
      },
    });
    render(<App />);
    await esperarFicha();

    expect(screen.queryByRole('heading', { name: 'Sanidad' })).not.toBeInTheDocument();
  });
});

describe('el cuerpo del animal (decisión 108)', () => {
  it('las mediciones van plegadas, de la última a la primera', async () => {
    montarFicha();
    render(<App />);
    await esperarFicha();

    await abrir('Peso y condición');
    // Acotado a **su** tarjeta: la de sanidad, que va arriba, también dibuja una
    // `.lista-simple`, y sin acotar este test leería los tratamientos.
    const tarjeta = screen
      .getByRole('button', { name: 'Peso y condición' })
      .closest('section') as HTMLElement;
    const renglones = [...tarjeta.querySelectorAll('.lista-simple li')].map(
      (li) => li.textContent,
    );
    // La del 15/06 primero: lo que se lee de estas es una tendencia, y se empieza
    // por dónde está hoy. La condición va con dos decimales porque se califica de
    // a cuartos: con uno solo, un 3,25 se mostraría como 3,3.
    expect(renglones[0]).toContain('15/06/2026');
    expect(renglones[0]).toContain('condición 2,75');
    expect(renglones[1]).toContain('10/01/2026');
    expect(renglones[1]).toContain('585 kg');
  });

  it('los KPIs traen el cuerpo aparte, porque explica a los de arriba', async () => {
    montarFicha();
    render(<App />);
    await esperarFicha();

    await abrir('Los números');
    await screen.findByText('Días abiertos');
    expect(cifra('Condición corporal')).toBe('2,75');
    expect(cifra('Peso')).toBe('585 kg');
    expect(cifra('Condición al parto')).toBe('3,25');
    // La 102 entró al tambo hecha: no tiene pesadas de recría con las que
    // calcularla. "Sin datos" y no 0 (decisión 37).
    expect(cifra('Ganancia en recría')).toBe('sin datos');
  });
});

describe('el estado del animal', () => {
  it('pone la caravana en el encabezado y los dos ejes con palabras', async () => {
    montarFicha();
    render(<App />);

    // La caravana, y no el uuid, en la barra de arriba: es lo que identifica al
    // animal para quien lo está mirando.
    expect(await screen.findByRole('heading', { name: '102' })).toBeInTheDocument();
    expect(screen.getByText('Vacía')).toBeInTheDocument();
    expect(screen.getByText('En ordeñe')).toBeInTheDocument();
  });

  it('muestra las fechas en DD/MM/AAAA y dice "sin datos" donde no hay', async () => {
    montarFicha();
    render(<App />);
    await esperarFicha();

    expect(dato('Nacimiento')).toBe('12/03/2022');
    expect(dato('Último parto')).toBe('13/01/2026');
    // La 102 está vacía: no hay celo ni inseminación registrados, y eso se dice.
    expect(dato('Último celo')).toBe('sin datos');
    expect(dato('Última inseminación')).toBe('sin datos');
  });
});

describe('los números', () => {
  it('muestra los KPIs y nunca convierte un null en 0 (decisión 37)', async () => {
    montarFicha();
    render(<App />);
    await abrir('Los números');

    expect(await screen.findByText('Días abiertos')).toBeInTheDocument();
    expect(cifra('Días abiertos')).toBe('197 días');
    expect(cifra('Servicios por preñez')).toBe('1,0');
    expect(cifra('Hembras nacidas vivas')).toBe('1');
    // 1600 días son 4,4 años, que es como se lee una edad.
    expect(cifra('Edad')).toBe('4,4 años');
    // Todavía no hay un segundo parto ni un primer servicio de este ciclo.
    expect(cifra('Entre partos')).toBe('sin datos');
    expect(cifra('Parto a 1er servicio')).toBe('sin datos');
    expect(cifra('Edad al primer parto')).toBe('sin datos');
  });

  it('avisa cuando hay ciclos forzados que quedan fuera de la cuenta', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/kpis`]: { cuerpo: kpis106 },
    });
    render(<App />);
    await abrir('Los números');

    expect(await screen.findByText(/hay ciclos que no cuentan/i)).toBeInTheDocument();
    expect(screen.getByText(/1 ciclo tiene/)).toBeInTheDocument();
  });
});

describe('el historial', () => {
  it('va del último al primero y describe lo que el evento trae adentro', async () => {
    montarFicha();
    render(<App />);
    await esperarHistorial();

    const eventos = [...document.querySelectorAll('.historial > li')];
    expect(eventos[0]?.textContent).toContain('12/07/2026 — Control lechero');
    expect(eventos[0]?.textContent).toContain('19,0 L · grasa 4,0 % · proteína 3,5 % · RCS 320');
    expect(eventos[eventos.length - 1]?.textContent).toContain('16/03/2025 — Alta');
    expect(eventos[eventos.length - 1]?.textContent).toContain(
      'nacida el 12/03/2022 · entra con 2 lactancias',
    );
    expect(screen.getByText(/toro Urubó · pajuela HOL-4521/)).toBeInTheDocument();
    const parto = eventos.find((e) => e.textContent?.includes('— Parto'));
    expect(parto?.textContent).toContain('1 cría: hembra, nacida viva');
  });

  /**
   * Bajo qué reglas se juzgó cada evento (decisión 92). La decisión de pantalla
   * es **no decir nada cuando son las de hoy**: escribir "reglas vigentes" en los
   * cuarenta renglones sería ruido que tapa los dos que importan.
   */
  it('marca los eventos que se cargaron con otros parámetros, y dice cuáles', async () => {
    montarFicha();
    render(<App />);
    await esperarHistorial();

    const eventos = [...document.querySelectorAll('.historial > li')];
    // El control lechero de julio es posterior al cambio: se juzgó con lo de hoy
    // y no dice nada.
    expect(eventos[0]?.textContent).toContain('Control lechero');
    expect(eventos[0]?.textContent).not.toContain('otras reglas');

    // El alta de 2025 es anterior: se juzgó con el PVE viejo, y lo dice con el
    // número, que es lo que sirve — no con el id de una versión.
    const alta = eventos[eventos.length - 1];
    expect(alta?.textContent).toContain('otras reglas');
    expect(alta?.textContent).toContain('período voluntario de espera: 45 en vez de 60');
  });

  it('si el historial de reglas no vino, los eventos se muestran igual', async () => {
    // Es un dato al lado, no lo que se vino a mirar.
    montarFicha({
      [`GET /establecimientos/${EST}/configuraciones`]: { status: 502, ilegible: true },
    });
    render(<App />);
    await esperarHistorial();

    const eventos = [...document.querySelectorAll('.historial > li')];
    expect(eventos).toHaveLength(4);
    expect(document.body.textContent).not.toContain('otras reglas');
  });

  it('distingue el evento anulado de la anulación que lo deshizo', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: eventos105 },
    });
    render(<App />);
    await esperarHistorial();

    const eventos = [...document.querySelectorAll('.historial > li')];
    // Arriba de todo, la anulación: no está anulada, deshace.
    expect(eventos[0]?.textContent).toContain('Anulación');
    expect(eventos[0]?.className).not.toContain('anulado');
    expect(eventos[0]?.textContent).toContain('deshace un evento anterior');
    expect(eventos[0]?.textContent).toContain('Fecha equivocada al pasar de la libreta');

    // Y el celo del 30/04 sí quedó anulado, dicho con la palabra.
    const anulado = eventos.find((e) => e.textContent?.includes('30/04/2026'));
    expect(anulado?.className).toContain('anulado');
    expect(anulado?.textContent).toContain('anulado');
  });

  /**
   * Cuándo se cargó, que es la respuesta a "por qué esta vaca no estaba en la
   * lista de esa mañana". El atajo "Ayer" existe porque se cargan tarde.
   */
  it('dice cuándo se cargó un evento que se anotó otro día', async () => {
    // El parto del 13, anotado el 15: dos días después, que es lo normal.
    const anotadoTarde = {
      ...eventos102,
      eventos: eventos102.eventos.map((e) =>
        e.tipo === 'parto' ? { ...e, fecha_registro: '2026-01-15T12:00:00.000Z' } : e,
      ),
    };
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: anotadoTarde },
    });
    render(<App />);
    await esperarHistorial();

    const parto = [...document.querySelectorAll('.historial > li')].find((e) =>
      e.textContent?.includes('— Parto'),
    );
    expect(parto?.textContent).toContain('13/01/2026 — Parto');
    expect(parto?.textContent).toContain('cargado el 15/01/2026');
  });

  it('y no dice nada cuando se cargó el mismo día que pasó', async () => {
    // Las fixtures traen `fecha_registro` del día del evento, que es el caso
    // normal: escribir "cargado el mismo día" en cuarenta renglones sería ruido
    // que tapa los pocos que tienen algo que contar.
    montarFicha();
    render(<App />);
    await esperarHistorial();

    expect(screen.queryByText(/^cargado el /)).not.toBeInTheDocument();
  });

  it('marca los forzados: el que se cargó con "confirmar igual"', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: eventos106 },
    });
    render(<App />);
    await esperarHistorial();

    expect(screen.getByText('cargado con "confirmar igual"')).toBeInTheDocument();
    expect(screen.getByText(/1 cría: hembra, nacida muerta/)).toBeInTheDocument();
  });
});

/**
 * Los chips del historial. Son cuatro grupos y no once tipos: lo que se busca en
 * un historial es "cuándo parió" o "cuántas veces la inseminaron", y para eso el
 * celo y los dos tactos son una sola pregunta.
 *
 * Acá sí es el componente `Chips` y no el marcado de los atajos de fecha: son
 * filtros que se sueltan, y soltarlo devuelve la línea de tiempo entera.
 */
describe('la corrección, que no se ve si no se marca', () => {
  it('marca el evento que una corrección superseded (decisión 102)', async () => {
    // El evento se muestra **como se cargó** —el log es append-only— así que sin
    // la marca un renglón que ya no vale se lee igual que uno intacto. Es la
    // única forma en que una corrección puede hacer daño.
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: {
        cuerpo: {
          ...eventos102,
          eventos: eventos102.eventos.map((e) =>
            e.id === 'e102-4' ? { ...e, corregido_por: 'corr-1' } : e,
          ),
        },
      },
    });
    render(<App />);
    await esperarHistorial();

    const control = screen
      .getByText(/12\/07\/2026 — Control lechero/)
      .closest('li') as HTMLElement;
    expect(within(control).getByText('corregido después')).toBeInTheDocument();
    // Y los demás no la llevan: una marca en los cuarenta renglones no marca nada.
    expect(screen.getAllByText('corregido después')).toHaveLength(1);
  });
});

describe('los servicios del ciclo (decisión 112)', () => {
  it('los lista cuando hay más de uno, que es el celo falso', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}`]: {
        cuerpo: {
          ...animal102,
          proyeccion: {
            ...animal102.proyeccion,
            estado: {
              ...animal102.proyeccion.estado,
              servicios_del_ciclo: [
                { evento_id: 'ins-1', fecha: '2026-05-20' },
                { evento_id: 'ins-2', fecha: '2026-06-10' },
              ],
            },
          },
        },
      },
    });
    render(<App />);
    await esperarFicha();

    // Es lo único que deja ver el caso que esa decisión resolvió: una vaca que se
    // sirvió, mostró celo estando preñada y se re-sirvió. Con "última
    // inseminación" sola, el primero de los dos no existe en ninguna pantalla.
    expect(screen.getByText(/servicios de este ciclo/i).textContent).toContain(
      '20/05/2026 · 10/06/2026',
    );
  });

  it('y con uno solo no dice nada: ya lo dice "última inseminación"', async () => {
    montarFicha();
    render(<App />);
    await esperarFicha();

    expect(screen.queryByText(/servicios de este ciclo/i)).not.toBeInTheDocument();
  });
});

describe('filtrar el historial por tipo', () => {
  const tipo = (rotulo: string): HTMLElement =>
    within(screen.getByRole('group', { name: 'Filtrar el historial por tipo' })).getByRole(
      'button',
      { name: rotulo },
    );

  const renglones = (): string[] =>
    [...document.querySelectorAll('.historial > li')].map((e) => e.textContent ?? '');

  it('cada chip deja solo los eventos de ese tipo, y el título dice cuántos', async () => {
    montarFicha();
    render(<App />);
    await esperarHistorial();
    expect(renglones()).toHaveLength(4);

    await userEvent.click(tipo('Partos'));

    expect(renglones()).toHaveLength(1);
    expect(renglones()[0]).toContain('— Parto');
    // La cuenta del título es la de lo que se está mostrando: un "(4)" arriba de
    // un renglón se leería como que faltan tres.
    expect(screen.getByRole('heading', { name: 'El historial (1)' })).toBeInTheDocument();
  });

  it('"Celos y tactos" junta los tres tipos del ciclo', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/eventos`]: { cuerpo: eventos105 },
    });
    render(<App />);
    await esperarHistorial();

    await userEvent.click(tipo('Celos y tactos'));

    // Los dos celos de la 105 —el anulado y el que lo corrigió—, y ni el alta ni
    // la inseminación ni la anulación.
    expect(renglones()).toHaveLength(2);
    expect(renglones().every((r) => r.includes('Celo'))).toBe(true);
  });

  it('soltar el chip devuelve la línea de tiempo entera', async () => {
    montarFicha();
    render(<App />);
    await esperarHistorial();

    await userEvent.click(tipo('Partos'));
    expect(renglones()).toHaveLength(1);

    await userEvent.click(tipo('Partos'));

    expect(renglones()).toHaveLength(4);
    expect(tipo('Partos')).toHaveAttribute('aria-pressed', 'false');
  });

  it('con cero resultados lo dice, en vez de dejar una lista en blanco', async () => {
    // La 102 no tiene ningún celo ni tacto. Una lista vacía se leería como que la
    // tarjeta no cargó, y de acá se sale soltando el chip — que es lo que se dice.
    montarFicha();
    render(<App />);
    await esperarHistorial();

    await userEvent.click(tipo('Celos y tactos'));

    expect(renglones()).toHaveLength(0);
    expect(screen.getByText(/ningún evento de ese tipo/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'El historial (0)' })).toBeInTheDocument();
  });

  it('no pide nada: filtra sobre el log que ya está cargado', async () => {
    const falsa = montarFicha();
    render(<App />);
    await esperarHistorial();
    const antes = falsa.pedidos.length;

    await userEvent.click(tipo('Partos'));
    await userEvent.click(tipo('Inseminaciones'));

    expect(falsa.pedidos.length).toBe(antes);
  });
});

describe('los ciclos', () => {
  it('van del último al primero con su resultado en palabras', async () => {
    montarFicha();
    render(<App />);
    await esperarHistorial();

    const ciclos = [...document.querySelectorAll('.tarjeta')].find((t) =>
      t.querySelector('h2')?.textContent?.includes('Los ciclos'),
    );
    const filas = [...(ciclos?.querySelectorAll('li') ?? [])];
    expect(filas[0]?.textContent).toContain('Ciclo 2 — En curso');
    expect(filas[1]?.textContent).toContain('Ciclo 1 — Terminó en parto');
    expect(filas[1]?.textContent).toContain('1 servicio');
  });
});

describe('cuando una lectura de la ficha no vuelve', () => {
  it('la proyección es la única que voltea la pantalla: de ella sale la caravana', async () => {
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}`]: {
        status: 404,
        cuerpo: { codigo: 'NO_ENCONTRADO', mensaje: `No existe el animal con id ${V102}.` },
      },
    });
    render(<App />);

    expect(await screen.findByText(`No existe el animal con id ${V102}.`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ficha del animal' })).toBeInTheDocument();
  });

  it('cada tarjeta se cae sola y se reintenta sin recargar la ficha', async () => {
    let intentos = 0;
    montarFicha({
      [`GET /establecimientos/${EST}/animales/${V102}/kpis`]: () => {
        intentos += 1;
        return intentos === 1
          ? { status: 500, cuerpo: { codigo: 'ERROR_INTERNO', mensaje: 'Se cayó la base.' } }
          : { cuerpo: kpis102 };
      },
    });
    render(<App />);
    await abrir('Los números');

    expect(await screen.findByText('Se cayó la base.')).toBeInTheDocument();
    // El historial llegó igual (decisión 56): que una tarjeta se caiga no se
    // lleva puesta la pantalla, y ahora tampoco a la que ni se pidió.
    expect(await screen.findByText(/toro Urubó/)).toBeInTheDocument();

    // Se reintenta adentro de la plegable, sin cerrarla ni recargar la ficha.
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Días abiertos')).toBeInTheDocument();
  });

  it('ni los números ni las lactancias se piden al entrar', async () => {
    // La cuenta de la remodelación: entrar a una ficha costaba cinco lecturas y
    // en el corral se entra a cargar lo que se acaba de ver, no a leer la curva.
    // Los números siguen colgando de su plegable; las lactancias se fueron
    // enteras a su pantalla y desde acá no se piden nunca.
    const falsa = montarFicha();
    render(<App />);
    await esperarHistorial();

    const pedidas = (cola: string) =>
      falsa.pedidos.filter((p) => p.ruta.endsWith(cola)).length;
    expect(pedidas('/kpis')).toBe(0);
    expect(pedidas('/lactancias')).toBe(0);

    await abrir('Los números');
    await screen.findByText('Días abiertos');
    expect(pedidas('/kpis')).toBe(1);
    // Y abrir esa no trae la otra: la ficha entera nunca pide `/lactancias`.
    expect(pedidas('/lactancias')).toBe(0);
  });

  it('el renglón de partos dice cuántas hay y lleva a su pantalla', async () => {
    // El número sale de `ultimo_numero_lactancia`, que ya venía en la proyección:
    // sin él, "Partos y lactancias" no distingue una vaca con tres de una con
    // ninguna y hay que entrar para enterarse.
    montarFicha();
    render(<App />);
    await esperarFicha();

    const renglon = screen.getByRole('link', { name: /Partos y lactancias/ });
    expect(renglon).toHaveTextContent('3');
    expect(renglon).toHaveAttribute(
      'href',
      aPartos(V102, { desde: aAnimal(V102, aRodeo()), caravana: '102' }),
    );
  });
});

describe('el animal de baja', () => {
  it('lo dice con un aviso, no solo con una etiqueta', async () => {
    window.localStorage.setItem('tambo.establecimiento', EST);
    window.location.hash = `#/animales/${V106}`;
    const deBaja = {
      ...animal102,
      animal_id: V106,
      caravana: '107',
      proyeccion: {
        ...animal102.proyeccion,
        estado: { ...animal102.proyeccion.estado, vida: 'BAJA' as const, motivo_baja: 'venta' as const },
      },
    };
    montarApi({
    ...sesionDePrueba(),
      [`GET /establecimientos/${EST}`]: { cuerpo: establecimiento },
      [`GET /establecimientos/${EST}/animales/${V106}`]: { cuerpo: deBaja },
      [`GET /establecimientos/${EST}/animales/${V106}/kpis`]: { cuerpo: kpis106 },
      [`GET /establecimientos/${EST}/animales/${V106}/eventos`]: { cuerpo: eventos106 },
    });
    render(<App />);

    expect(await screen.findByText(/fuera del rodeo/i)).toBeInTheDocument();
    expect(screen.getByText(/salió por venta/i)).toBeInTheDocument();
    expect(screen.getByText('De baja')).toBeInTheDocument();

    // Y no se le ofrece cargar eventos: la baja es terminal (decisión 7), así
    // que el botón sería un formulario entero cuyo único final es un rechazo
    // que ni siquiera se puede forzar. Lo encontró la auditoría de cierre
    // (decisión 65). La salida sí está: anular la baja desde el historial.
    expect(screen.queryByRole('link', { name: 'Cargar un evento' })).not.toBeInTheDocument();
    expect(screen.getByText(/anulá la baja desde el historial/i)).toBeInTheDocument();
  });
});
