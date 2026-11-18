import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { boton, TARJETA } from '../comun/estilos'
import Segmentos from '../comun/Segmentos'
import MarcoPanel from '../panel/MarcoPanel'
import { fechaHora } from '../panel/tiempo'
import type { ResultadoLecturas } from './apiLecturas'
import {
  estadoEnlace,
  piezasNuevas,
  resumirLecturas,
  type Enlace,
  type LecturasCelda,
} from './enVivo'
import {
  crearGemelo,
  pedirCiclos,
  ponerModo,
  ponerVelocidad,
  pulsar,
  tomarInstantanea,
  type Instantanea,
  type Mando,
  type Modo,
} from './gemelo'
import { ENTRADAS, PASOS, SALIDAS, type FilaSenal, type Tono } from './senales'
import { NOMBRES_VISTAS, type Vista } from './vistas'

// three.js solo se descarga al abrir esta pantalla
const VistaCelda = lazy(() => import('./VistaCelda'))

type Props = {
  obtenerLecturas: () => Promise<ResultadoLecturas>
  sesionCaducada: () => void
}

type Consulta = { enlace: Enlace; lecturas: LecturasCelda | null }

const SEGUNDOS_ENTRE_CONSULTAS = 5

const MODOS: { valor: Modo; texto: string }[] = [
  { valor: 'vivo', texto: 'En vivo' },
  { valor: 'simulacion', texto: 'Simulación' },
]

const ENLACES: Record<Enlace, { texto: string; clases: string }> = {
  conectando: { texto: 'Conectando...', clases: 'border-linea text-suave' },
  en_vivo: { texto: 'Datos en vivo', clases: 'border-ok/50 bg-ok/10 text-ok' },
  atrasado: {
    texto: 'Lecturas atrasadas',
    clases: 'border-alerta/50 bg-alerta/10 text-alerta',
  },
  sin_lecturas: {
    texto: 'Sin lecturas todavía',
    clases: 'border-linea text-suave',
  },
  sin_conexion: {
    texto: 'Sin conexión',
    clases: 'border-alerta/50 bg-alerta/10 text-alerta',
  },
}

const FOCO: Record<Tono, string> = {
  ok: 'bg-ok',
  acento: 'bg-acento',
  aviso: 'bg-[#f2b233]',
  alerta: 'bg-alerta',
}

// Lo que pasa en cada paso, dicho sin tecnicismos.
const FRASES = [
  '',
  'El alimentador empuja una pieza a la banda.',
  'Los sensores revisan si la pieza es de aluminio o de plástico.',
  'La pieza se sujeta y el marcador le pone su sello.',
  'La banda lleva la pieza hasta el punto de toma.',
  'La pinza baja y toma la pieza.',
  'El pórtico lleva la pieza a su carril.',
]

const MATERIAL = { al: 'Aluminio', pl: 'Plástico', '': 'Sin pieza' }

const CHIP =
  'rounded-md border px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap'
const PANEL = `${TARJETA} mt-3 flex flex-col gap-4 p-4 lg:absolute lg:mt-0 lg:bg-panel/90 lg:backdrop-blur`
const SUBTITULO =
  'mb-2 text-[12px] font-bold tracking-wide text-suave uppercase'

function frase(i: Instantanea, modo: Modo, enlace: Enlace): string {
  if (i.emergencia)
    return 'Paro de emergencia activo. Pulsa Restablecer para continuar.'
  if (i.paso > 0) return FRASES[i.paso]
  if (i.empacando) return 'La caja llena se cierra y pasa a la tarima.'
  if (modo === 'simulacion')
    return 'La celda está en reposo. Pulsa Marcha para empezar.'
  if (enlace === 'en_vivo')
    return 'Esperando a que la celda cuente la siguiente pieza.'
  return 'Cuando lleguen lecturas, cada pieza contada se verá aquí.'
}

function estadoCelda(i: Instantanea, modo: Modo) {
  if (i.emergencia)
    return {
      texto: 'Emergencia',
      clases: 'border-alerta bg-alerta text-sobre',
    }
  if (i.paso > 0) {
    const terminando = modo === 'simulacion' && !i.marcha
    return {
      texto: terminando ? 'Terminando ciclo' : 'En ciclo',
      clases: 'border-ok/50 bg-ok/10 text-ok',
    }
  }
  return { texto: 'Reposo', clases: 'border-linea text-suave' }
}

function ListaSenales({
  titulo,
  filas,
  i,
}: {
  titulo: string
  filas: FilaSenal[]
  i: Instantanea
}) {
  return (
    <div>
      <h2 className={SUBTITULO}>{titulo}</h2>
      <ul className="flex flex-col gap-1">
        {filas.map(({ clave, nombre, tono }) => (
          <li key={clave} className="flex items-center gap-2 text-[12.5px]">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${i[clave] ? FOCO[tono] : 'bg-suave/35'}`}
            />
            <span className="flex-1">{nombre}</span>
            <span className="sr-only">
              {i[clave] ? 'encendida' : 'apagada'}
            </span>
            <span className="text-[11px] text-suave">{clave}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Valores({
  titulo,
  valores,
}: {
  titulo: string
  valores: [nombre: string, valor: string][]
}) {
  return (
    <div>
      <h2 className={SUBTITULO}>{titulo}</h2>
      <dl className="flex flex-col gap-1">
        {valores.map(([nombre, valor]) => (
          <div
            key={nombre}
            className="flex items-baseline justify-between gap-3 text-[12.5px]"
          >
            <dt className="text-suave">{nombre}</dt>
            <dd className="font-bold tabular-nums">{valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const siNo = (valor: number | null, si: string, no: string) =>
  valor === null ? 'Sin dato' : valor !== 0 ? si : no

// Lo que manda la celda real. Es de solo lectura: desde aquí no se le ordena nada.
function LecturasReales({ consulta }: { consulta: Consulta }) {
  const { lecturas } = consulta
  if (!lecturas || lecturas.ultima === null) {
    return (
      <div>
        <h2 className={SUBTITULO}>Lecturas de la celda</h2>
        <p className="text-[12.5px] leading-snug text-suave">
          {consulta.enlace === 'sin_conexion'
            ? 'No se pudieron consultar las lecturas. Se vuelve a intentar solo.'
            : 'Aún no llega ninguna lectura. Mientras tanto puedes probar la simulación.'}
        </p>
      </div>
    )
  }
  return (
    <>
      <Valores
        titulo="Lecturas de la celda"
        valores={[
          ['Estación', siNo(lecturas.estacion, 'En marcha', 'Detenida')],
          ['Pistón', siNo(lecturas.piston, 'Afuera', 'Atrás')],
          ['Pieza presente', siNo(lecturas.presencia, 'Sí', 'No')],
          [
            'Piezas contadas',
            lecturas.contador === null ? 'Sin dato' : String(lecturas.contador),
          ],
        ]}
      />
      <p className="text-[12px] leading-snug text-suave">
        Última lectura: {fechaHora(lecturas.ultima)}. Cada pieza que cuenta la
        celda se repite aquí como un ciclo completo.
      </p>
    </>
  )
}

const MANDOS: { mando: Mando; texto: string; clases: string }[] = [
  { mando: 'marcha', texto: 'Marcha', clases: boton('contorno') },
  { mando: 'paro', texto: 'Paro', clases: boton('neutro') },
  {
    mando: 'emergencia',
    texto: 'Paro de emergencia',
    clases: `${boton('alerta')} col-span-2`,
  },
  {
    mando: 'restablecer',
    texto: 'Restablecer',
    clases: `${boton('neutro')} col-span-2`,
  },
]

export default function PaginaGemelo({
  obtenerLecturas,
  sesionCaducada,
}: Props) {
  const [gemelo] = useState(() => crearGemelo('vivo'))
  const [modo, setModo] = useState<Modo>('vivo')
  const [instantanea, setInstantanea] = useState(() => tomarInstantanea(gemelo))
  const [consulta, setConsulta] = useState<Consulta>({
    enlace: 'conectando',
    lecturas: null,
  })
  const [vista, setVista] = useState<Vista>('General')
  const [conEtiquetas, setConEtiquetas] = useState(true)
  const [velocidad, setVelocidad] = useState(1)
  const marco = useRef<HTMLDivElement>(null)
  const contadorAnterior = useRef<number | null>(null)

  // En vivo se consulta la nube cada pocos segundos.
  useEffect(() => {
    if (modo !== 'vivo') return
    let vigente = true
    const consultar = () =>
      obtenerLecturas().then((resultado) => {
        if (!vigente) return
        if (!resultado.ok) {
          if (resultado.motivo === 'sesion') sesionCaducada()
          else setConsulta({ enlace: 'sin_conexion', lecturas: null })
          return
        }
        const lecturas = resumirLecturas(resultado.lecturas)
        pedirCiclos(
          gemelo,
          piezasNuevas(contadorAnterior.current, lecturas.contador),
        )
        if (lecturas.contador !== null)
          contadorAnterior.current = lecturas.contador
        setConsulta({
          enlace: estadoEnlace(lecturas, Date.now()),
          lecturas,
        })
      })
    consultar()
    const reloj = setInterval(consultar, SEGUNDOS_ENTRE_CONSULTAS * 1000)
    return () => {
      vigente = false
      clearInterval(reloj)
    }
  }, [modo, gemelo, obtenerLecturas, sesionCaducada])

  const refrescar = useCallback(
    () => setInstantanea(tomarInstantanea(gemelo)),
    [gemelo],
  )
  const alPulsar = useCallback(
    (mando: Mando) => pulsar(gemelo, mando),
    [gemelo],
  )
  // los paneles que flotan sobre la vista; las etiquetas no se ponen debajo
  const obstaculos = useCallback(
    () =>
      [...(marco.current?.querySelectorAll('[data-obstaculo]') ?? [])].map(
        (panel) => panel.getBoundingClientRect(),
      ),
    [],
  )

  function cambiarModo(nuevo: Modo) {
    ponerModo(gemelo, nuevo)
    contadorAnterior.current = null
    setConsulta({ enlace: 'conectando', lecturas: null })
    setModo(nuevo)
  }

  const i = instantanea
  const enVivo = modo === 'vivo'
  const estado = estadoCelda(i, modo)
  const enlace = ENLACES[consulta.enlace]

  return (
    <MarcoPanel titulo="Gemelo digital">
      <div className="flex flex-wrap items-center gap-3">
        <Segmentos
          etiqueta="Fuente de datos"
          opciones={MODOS}
          valor={modo}
          alCambiar={cambiarModo}
        />
        <span className={`${CHIP} ${estado.clases}`}>{estado.texto}</span>
        <span
          className={`${CHIP} ${enVivo ? enlace.clases : 'border-linea text-suave'}`}
        >
          {enVivo ? enlace.texto : 'Datos simulados'}
        </span>
        <p className="min-w-0 basis-full text-[14px] text-suave xl:basis-auto">
          {frase(i, modo, consulta.enlace)}
        </p>
      </div>

      <ol
        aria-label="Secuencia del proceso"
        className={`${TARJETA} flex overflow-x-auto`}
      >
        {PASOS.map((nombre, indice) => {
          const activo = indice === 6 ? i.empacando : i.paso === indice + 1
          return (
            <li
              key={nombre}
              aria-current={activo ? 'step' : undefined}
              className={`flex shrink-0 items-baseline gap-2 border-b-[3px] px-3.5 py-2.5 text-[12.5px] whitespace-nowrap ${
                activo
                  ? 'border-acento bg-acento/10 font-bold text-texto'
                  : 'border-transparent text-suave'
              }`}
            >
              <span className={activo ? 'text-acento' : undefined}>
                {indice + 1}
              </span>
              {nombre}
            </li>
          )
        })}
      </ol>

      <div ref={marco} className="relative">
        <div className="relative h-[62vh] min-h-[380px] overflow-hidden rounded-[10px] border border-linea bg-[#1c252d] lg:h-[calc(100dvh-20rem)] lg:min-h-[640px]">
          <Suspense
            fallback={
              <p className="flex h-full items-center justify-center text-[14px] text-white/70">
                Cargando la vista 3D...
              </p>
            }
          >
            <VistaCelda
              gemelo={gemelo}
              vista={vista}
              conEtiquetas={conEtiquetas}
              obstaculos={obstaculos}
              alRefrescar={refrescar}
              alPulsar={alPulsar}
            />
          </Suspense>
        </div>

        <section
          data-obstaculo
          aria-label={enVivo ? 'Lecturas y vista' : 'Mandos y vista'}
          className={`${PANEL} lg:top-3 lg:left-3 lg:w-[236px]`}
        >
          {enVivo ? (
            <LecturasReales consulta={consulta} />
          ) : (
            <div>
              <h2 className={SUBTITULO}>Mandos</h2>
              <div className="grid grid-cols-2 gap-2">
                {MANDOS.map(({ mando, texto, clases }) => (
                  <button
                    key={mando}
                    type="button"
                    onClick={() => pulsar(gemelo, mando)}
                    className={clases}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className={SUBTITULO}>Vista</h2>
            <div className="flex flex-wrap gap-1.5">
              {NOMBRES_VISTAS.map((nombre) => (
                <button
                  key={nombre}
                  type="button"
                  aria-pressed={nombre === vista}
                  onClick={() => setVista(nombre)}
                  className={`cursor-pointer rounded-md border px-2 py-1 text-[12px] font-medium focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none ${
                    nombre === vista
                      ? 'border-acento text-acento'
                      : 'border-linea text-suave hover:text-texto'
                  }`}
                >
                  {nombre}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className={SUBTITULO}>Ajustes</h2>
            <label className="flex flex-col gap-1 text-[12.5px] text-suave">
              <span className="flex justify-between">
                Velocidad <span>{velocidad}x</span>
              </span>
              <input
                type="range"
                min="0.25"
                max="3"
                step="0.25"
                value={velocidad}
                onChange={(evento) => {
                  const nueva = Number(evento.target.value)
                  ponerVelocidad(gemelo, nueva)
                  setVelocidad(nueva)
                }}
                className="w-full accent-acento"
              />
            </label>
            <label className="mt-2.5 flex items-center justify-between gap-2 text-[12.5px] text-suave">
              Etiquetas en la escena
              <input
                type="checkbox"
                checked={conEtiquetas}
                onChange={(evento) => setConEtiquetas(evento.target.checked)}
                className="accent-acento"
              />
            </label>
          </div>
        </section>

        <section
          data-obstaculo
          aria-label="Señales"
          className={`${PANEL} lg:top-3 lg:right-3 lg:bottom-3 lg:w-[272px] lg:overflow-y-auto`}
        >
          {enVivo && (
            <p className="text-[12px] leading-snug text-suave">
              La nube solo recibe cuatro variables. El detalle de abajo lo
              recrea el gemelo en cada ciclo.
            </p>
          )}
          <Valores
            titulo="Valores"
            valores={[
              ['Material', MATERIAL[i.material]],
              ['Destino del carro', i.posX ? `Carril ${i.posX}` : 'Toma'],
              ['Posición del carro', `${Math.round(i.posMm)} mm`],
              ['Piezas de aluminio', String(i.piezasAl)],
              ['Piezas de plástico', String(i.piezasPl)],
              ['Cajas de aluminio', String(i.cajasAl)],
              ['Cajas de plástico', String(i.cajasPl)],
              ['Último ciclo', `${i.tCiclo.toFixed(1)} s`],
              ['Presión de aire', `${i.presion.toFixed(2)} bar`],
            ]}
          />
          <ListaSenales titulo="Salidas" filas={SALIDAS} i={i} />
          <ListaSenales titulo="Entradas" filas={ENTRADAS} i={i} />
        </section>
      </div>
    </MarcoPanel>
  )
}
