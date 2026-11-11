import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { AlertCircle, CheckCircle, Database, Pulse, Server } from 'reicon-react'
import { boton, TARJETA } from '../comun/estilos'
import type { EstadoDatos, EstadoSistema, ResultadoEstado } from './apiSistema'
import MarcoPanel from './MarcoPanel'
import { fechaHora, hace } from './tiempo'

type Props = {
  obtener: () => Promise<ResultadoEstado>
  sesionCaducada: () => void
}

type Tono = 'bien' | 'mal' | 'neutro'

const DATOS: Record<EstadoDatos, { tono: Tono; texto: string }> = {
  al_dia: { tono: 'bien', texto: 'Al día' },
  retrasado: { tono: 'mal', texto: 'Retrasado' },
  sin_datos: { tono: 'neutro', texto: 'Sin lecturas todavía' },
  desconocido: { tono: 'mal', texto: 'No se pudo saber' },
}

const ESTILOS: Record<Tono, string> = {
  bien: 'border-ok/50 bg-ok/10 text-ok',
  mal: 'border-alerta/50 bg-alerta/10 text-alerta',
  neutro: 'border-linea bg-panel text-suave',
}

type Icono = ComponentType<{ size?: number; className?: string }>

function Tarjeta({
  nombre,
  tono,
  texto,
  detalle,
  Icono,
}: {
  nombre: string
  tono: Tono
  texto: string
  detalle: string
  Icono: Icono
}) {
  return (
    <div
      className={`flex items-start gap-3.5 rounded-[10px] border px-5 py-4 ${ESTILOS[tono]}`}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-current/30"
      >
        <Icono size={20} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[13px] font-semibold">{nombre}</p>
        <p className="flex items-center gap-2 text-[15px] font-bold">
          {tono === 'bien' ? (
            <CheckCircle size={18} aria-hidden="true" />
          ) : (
            <AlertCircle size={18} aria-hidden="true" />
          )}
          <span>{texto}</span>
        </p>
        <p className="text-[12.5px] text-suave">{detalle}</p>
      </div>
    </div>
  )
}

// la lectura mas reciente de todas, para la tarjeta de llegada de datos
function detalleDatos(estado: EstadoSistema): string {
  if (estado.variables.length === 0) return 'Aún no llega ninguna lectura'
  const menor = Math.min(
    ...estado.variables.map((v) => v.segundosDesdeRecibida),
  )
  return `Última lectura ${hace(menor)}`
}

const tonoDe = (parte: 'ok' | 'falla'): Tono =>
  parte === 'ok' ? 'bien' : 'mal'

type Carga = { version: number; estado: EstadoSistema | null }

export default function PaginaEstado({ obtener, sesionCaducada }: Props) {
  const [version, setVersion] = useState(0)
  const [carga, setCarga] = useState<Carga | null>(null)

  useEffect(() => {
    let vigente = true
    obtener().then((resultado) => {
      if (!vigente) return
      if (!resultado.ok && resultado.motivo === 'sesion') sesionCaducada()
      else setCarga({ version, estado: resultado.ok ? resultado.estado : null })
    })
    return () => {
      vigente = false
    }
  }, [obtener, version, sesionCaducada])

  const cargando = carga === null || carga.version !== version
  const estado = !cargando ? carga.estado : null

  return (
    <MarcoPanel titulo="Estado del sistema">
      <div className="flex justify-end">
        <button
          type="button"
          disabled={cargando}
          onClick={() => setVersion((v) => v + 1)}
          className={boton('neutro')}
        >
          Actualizar
        </button>
      </div>

      {cargando && <p className="text-suave">Cargando...</p>}

      {!cargando && !estado && (
        <p role="alert" className="text-[14px] text-alerta">
          No se pudo consultar el estado. Inténtalo otra vez.
        </p>
      )}

      {estado && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tarjeta
              nombre="API del panel"
              tono="bien"
              texto="Responde"
              detalle="Atiende las peticiones de esta página"
              Icono={Server}
            />
            <Tarjeta
              nombre="Base de datos del panel"
              tono={tonoDe(estado.baseDatosPanel)}
              texto={
                estado.baseDatosPanel === 'ok' ? 'Responde' : 'No responde'
              }
              detalle="Cuentas, sesiones y bitácora"
              Icono={Database}
            />
            <Tarjeta
              nombre="Base de datos de lecturas"
              tono={tonoDe(estado.baseDatosLecturas)}
              texto={
                estado.baseDatosLecturas === 'ok' ? 'Responde' : 'No responde'
              }
              detalle="Lecturas que manda el agente IT"
              Icono={Database}
            />
            <Tarjeta
              nombre="Llegada de datos"
              tono={DATOS[estado.datos].tono}
              texto={DATOS[estado.datos].texto}
              detalle={detalleDatos(estado)}
              Icono={Pulse}
            />
          </div>

          {estado.variables.length === 0 ? (
            <p className="text-[14px] text-suave">
              Cuando el agente empiece a mandar datos a la nube, aquí aparecerá
              cada variable con la hora de su última lectura.
            </p>
          ) : (
            <div className={`${TARJETA} overflow-x-auto px-5 py-4`}>
              <table className="w-full text-left text-[14px]">
                <caption className="pb-2 text-left text-[15px] font-bold">
                  Última lectura por variable
                </caption>
                <thead className="text-suave">
                  <tr className="border-b border-linea">
                    <th className="py-2 pr-4 font-semibold">PLC</th>
                    <th className="py-2 pr-4 font-semibold">Variable</th>
                    <th className="py-2 pr-4 font-semibold">Lectura</th>
                    <th className="py-2 font-semibold">Llegó</th>
                  </tr>
                </thead>
                <tbody>
                  {estado.variables.map((v) => (
                    <tr
                      key={`${v.plc}/${v.variable}`}
                      className="border-b border-linea"
                    >
                      <td className="py-2 pr-4">{v.plc}</td>
                      <td className="py-2 pr-4">{v.variable}</td>
                      <td className="py-2 pr-4">{fechaHora(v.ts)}</td>
                      <td className="py-2">{hace(v.segundosDesdeRecibida)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </MarcoPanel>
  )
}
