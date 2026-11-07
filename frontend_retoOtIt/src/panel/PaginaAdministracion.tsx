import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle } from 'reicon-react'
import MarcoPanel from './MarcoPanel'
import type {
  Cuenta,
  DecisionCuenta,
  EstadoCuenta,
  MotivoDecision,
  ResultadoDecision,
  ResultadoLista,
} from './apiAdministracion'

type Props = {
  listar: (estado: EstadoCuenta) => Promise<ResultadoLista>
  decidir: (id: number, decision: DecisionCuenta) => Promise<ResultadoDecision>
  volver: () => void
  sesionCaducada: () => void
}

const FILTROS: { estado: EstadoCuenta; texto: string }[] = [
  { estado: 'pendiente', texto: 'Pendientes' },
  { estado: 'aprobado', texto: 'Aprobadas' },
  { estado: 'rechazado', texto: 'Rechazadas' },
]

const VACIO: Record<EstadoCuenta, string> = {
  pendiente: 'No hay cuentas pendientes.',
  aprobado: 'No hay cuentas aprobadas.',
  rechazado: 'No hay cuentas rechazadas.',
}

const MENSAJES_ERROR: Record<Exclude<MotivoDecision, 'sesion'>, string> = {
  no_existe: 'La cuenta ya no existe.',
  no_permitido: 'Esa cuenta no se puede cambiar desde el panel.',
  sin_cambio: 'La cuenta ya tenía ese estado.',
  fallo: 'No se pudo completar. Inténtalo otra vez.',
}

const BOTON =
  'h-11 cursor-pointer rounded-lg px-5 text-[15px] font-semibold focus-visible:ring-[3px] focus-visible:ring-turquesa/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60'

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type Carga = {
  filtro: EstadoCuenta
  version: number
  resultado: ResultadoLista
}

export default function PaginaAdministracion({
  listar,
  decidir,
  volver,
  sesionCaducada,
}: Props) {
  const [filtro, setFiltro] = useState<EstadoCuenta>('pendiente')
  const [version, setVersion] = useState(0)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [ocupada, setOcupada] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(
    null,
  )

  useEffect(() => {
    let vigente = true
    listar(filtro).then((resultado) => {
      if (!vigente) return
      if (!resultado.ok && resultado.motivo === 'sesion') sesionCaducada()
      else setCarga({ filtro, version, resultado })
    })
    return () => {
      vigente = false
    }
  }, [listar, filtro, version, sesionCaducada])

  const cargando =
    carga === null || carga.filtro !== filtro || carga.version !== version

  function cambiarFiltro(nuevo: EstadoCuenta) {
    setAviso(null)
    setFiltro(nuevo)
  }

  async function decidirSobre(cuenta: Cuenta, decision: DecisionCuenta) {
    setOcupada(cuenta.id)
    setAviso(null)
    let resultado: ResultadoDecision
    try {
      resultado = await decidir(cuenta.id, decision)
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setOcupada(null)
    if (resultado.ok) {
      const verbo = decision === 'aprobado' ? 'aprobada' : 'rechazada'
      setAviso({ error: false, texto: `Cuenta ${verbo}: ${cuenta.nombre}.` })
      setVersion((v) => v + 1)
    } else if (resultado.motivo === 'sesion') {
      sesionCaducada()
    } else {
      setAviso({ error: true, texto: MENSAJES_ERROR[resultado.motivo] })
      // si ya cambio de estado o no existe, la lista estaba vieja
      if (resultado.motivo !== 'fallo') setVersion((v) => v + 1)
    }
  }

  return (
    <MarcoPanel titulo="Cuentas" volver={volver}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro">
        {FILTROS.map(({ estado, texto }) => (
          <button
            key={estado}
            type="button"
            aria-pressed={filtro === estado}
            onClick={() => cambiarFiltro(estado)}
            className={`${BOTON} border-2 ${
              filtro === estado
                ? 'border-azul-idmz bg-[#174ea6] text-white'
                : 'border-azul-idmz bg-white text-[#174ea6] hover:bg-[#eef4ff]'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {aviso && (
        <div
          role={aviso.error ? 'alert' : 'status'}
          className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[15px] leading-snug ${
            aviso.error
              ? 'border-[#e5848c] bg-[#fdecee] text-[#8a1c26]'
              : 'border-turquesa bg-[#e6f6f6] text-[#064e4e]'
          }`}
        >
          {aviso.error ? (
            <AlertCircle
              size={18}
              aria-hidden="true"
              className="mt-px shrink-0"
            />
          ) : (
            <CheckCircle
              size={18}
              aria-hidden="true"
              className="mt-px shrink-0"
            />
          )}
          <span>{aviso.texto}</span>
        </div>
      )}

      {cargando && <p className="text-tinta-suave">Cargando...</p>}

      {!cargando && !carga.resultado.ok && (
        <p role="alert" className="text-[15px] text-[#8a1c26]">
          No se pudo cargar la lista. Inténtalo otra vez.
        </p>
      )}

      {!cargando && carga.resultado.ok && (
        <>
          {carga.resultado.cuentas.length === 0 && (
            <p className="text-tinta-suave">{VACIO[filtro]}</p>
          )}
          <ul className="flex flex-col gap-4">
            {carga.resultado.cuentas.map((cuenta) => (
              <li
                key={cuenta.id}
                className="flex flex-col gap-4 rounded-xl border border-borde bg-campo px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold break-words">
                    {cuenta.nombre}
                  </p>
                  <p className="text-[15px] break-all text-tinta-suave">
                    {cuenta.correo}
                  </p>
                  <p className="text-[14px] text-gris-azul">
                    Solicitada el {fechaCorta(cuenta.creadoEn)}
                    {cuenta.rol === 'administrador' && ' · Administrador'}
                  </p>
                </div>
                {cuenta.rol === 'usuario' && (
                  <div className="flex shrink-0 gap-2">
                    {cuenta.estado !== 'aprobado' && (
                      <button
                        type="button"
                        disabled={ocupada === cuenta.id}
                        onClick={() => decidirSobre(cuenta, 'aprobado')}
                        aria-label={`Aprobar a ${cuenta.nombre}`}
                        className={`${BOTON} bg-[#174ea6] text-white hover:bg-[#123f86]`}
                      >
                        Aprobar
                      </button>
                    )}
                    {cuenta.estado !== 'rechazado' && (
                      <button
                        type="button"
                        disabled={ocupada === cuenta.id}
                        onClick={() => decidirSobre(cuenta, 'rechazado')}
                        aria-label={`Rechazar a ${cuenta.nombre}`}
                        className={`${BOTON} border-2 border-[#b3202d] bg-white text-[#8a1c26] hover:bg-[#fdecee]`}
                      >
                        Rechazar
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </MarcoPanel>
  )
}
