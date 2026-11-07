import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle } from 'reicon-react'
import type { EstadoDatos, EstadoSistema, ResultadoEstado } from './apiSistema'
import MarcoPanel from './MarcoPanel'
import { fechaHora, hace } from './tiempo'

type Props = {
  obtener: () => Promise<ResultadoEstado>
  volver: () => void
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
  bien: 'border-turquesa bg-[#e6f6f6] text-[#064e4e]',
  mal: 'border-[#e5848c] bg-[#fdecee] text-[#8a1c26]',
  neutro: 'border-borde bg-campo text-tinta-suave',
}

function Tarjeta({
  nombre,
  tono,
  texto,
}: {
  nombre: string
  tono: Tono
  texto: string
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border px-5 py-4 ${ESTILOS[tono]}`}
    >
      <p className="text-[15px] font-semibold">{nombre}</p>
      <p className="flex items-center gap-2 text-[17px] font-semibold">
        {tono === 'bien' ? (
          <CheckCircle size={20} aria-hidden="true" />
        ) : (
          <AlertCircle size={20} aria-hidden="true" />
        )}
        <span>{texto}</span>
      </p>
    </div>
  )
}

const tonoDe = (parte: 'ok' | 'falla'): Tono =>
  parte === 'ok' ? 'bien' : 'mal'

type Carga = { version: number; estado: EstadoSistema | null }

export default function PaginaEstado({
  obtener,
  volver,
  sesionCaducada,
}: Props) {
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
    <MarcoPanel titulo="Estado del sistema" volver={volver}>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={cargando}
          onClick={() => setVersion((v) => v + 1)}
          className="h-11 cursor-pointer rounded-lg border-2 border-azul-idmz bg-white px-5 text-[15px] font-semibold text-[#174ea6] hover:bg-[#eef4ff] focus-visible:ring-[3px] focus-visible:ring-turquesa/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          Actualizar
        </button>
      </div>

      {cargando && <p className="text-tinta-suave">Cargando...</p>}

      {!cargando && !estado && (
        <p role="alert" className="text-[15px] text-[#8a1c26]">
          No se pudo consultar el estado. Inténtalo otra vez.
        </p>
      )}

      {estado && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Tarjeta nombre="API del panel" tono="bien" texto="Responde" />
            <Tarjeta
              nombre="Base de datos del panel"
              tono={tonoDe(estado.baseDatosPanel)}
              texto={
                estado.baseDatosPanel === 'ok' ? 'Responde' : 'No responde'
              }
            />
            <Tarjeta
              nombre="Base de datos de lecturas"
              tono={tonoDe(estado.baseDatosLecturas)}
              texto={
                estado.baseDatosLecturas === 'ok' ? 'Responde' : 'No responde'
              }
            />
            <Tarjeta
              nombre="Llegada de datos"
              tono={DATOS[estado.datos].tono}
              texto={DATOS[estado.datos].texto}
            />
          </div>

          {estado.variables.length === 0 ? (
            <p className="text-tinta-suave">
              Cuando el agente empiece a mandar datos a la nube, aquí aparecerá
              cada variable con la hora de su última lectura.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[15px]">
                <caption className="pb-2 text-left text-[16px] font-semibold">
                  Última lectura por variable
                </caption>
                <thead className="text-gris-azul">
                  <tr className="border-b border-borde">
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
                      className="border-b border-borde"
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
