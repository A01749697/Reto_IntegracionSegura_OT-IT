import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle } from 'reicon-react'
import MarcoPanel from './MarcoPanel'
import type {
  Cuenta,
  DecisionCuenta,
  EstadoCuenta,
  FiltroCuentas,
  MotivoDecision,
  ResultadoDecision,
  ResultadoLista,
} from './apiAdministracion'

type Props = {
  listar: (filtro: FiltroCuentas) => Promise<ResultadoLista>
  decidir: (id: number, decision: DecisionCuenta) => Promise<ResultadoDecision>
  desbloquear: (id: number) => Promise<ResultadoDecision>
  hacerAdministrador: (id: number) => Promise<ResultadoDecision>
  volver: () => void
  sesionCaducada: () => void
}

const FILTROS: { filtro: FiltroCuentas; texto: string }[] = [
  { filtro: 'pendiente', texto: 'Pendientes' },
  { filtro: 'aprobado', texto: 'Aprobadas' },
  { filtro: 'rechazado', texto: 'Rechazadas' },
  { filtro: 'todas', texto: 'Todas' },
]

const VACIO: Record<FiltroCuentas, string> = {
  pendiente: 'No hay cuentas pendientes.',
  aprobado: 'No hay cuentas aprobadas.',
  rechazado: 'No hay cuentas rechazadas.',
  todas: 'No hay cuentas.',
}

const ETIQUETA_ESTADO: Record<EstadoCuenta, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobada',
  rechazado: 'Rechazada',
}

const MENSAJES_ERROR: Record<Exclude<MotivoDecision, 'sesion'>, string> = {
  no_existe: 'La cuenta ya no existe.',
  no_permitido: 'Esa cuenta no se puede cambiar desde el panel.',
  sin_cambio: 'La cuenta ya tenía ese estado.',
  fallo: 'No se pudo completar. Inténtalo otra vez.',
}

const BOTON =
  'h-11 cursor-pointer rounded-lg px-5 text-[15px] font-semibold focus-visible:ring-[3px] focus-visible:ring-turquesa/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60'
const PRIMARIO = `${BOTON} bg-[#174ea6] text-white hover:bg-[#123f86]`
const CONTORNO = `${BOTON} border-2 border-azul-idmz bg-white text-[#174ea6] hover:bg-[#eef4ff]`
const PELIGRO = `${BOTON} border-2 border-[#b3202d] bg-white text-[#8a1c26] hover:bg-[#fdecee]`

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type Carga = {
  filtro: FiltroCuentas
  version: number
  resultado: ResultadoLista
}

export default function PaginaAdministracion({
  listar,
  decidir,
  desbloquear,
  hacerAdministrador,
  volver,
  sesionCaducada,
}: Props) {
  const [filtro, setFiltro] = useState<FiltroCuentas>('pendiente')
  const [version, setVersion] = useState(0)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [ocupada, setOcupada] = useState<number | null>(null)
  const [confirmando, setConfirmando] = useState<number | null>(null)
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

  function cambiarFiltro(nuevo: FiltroCuentas) {
    setAviso(null)
    setConfirmando(null)
    setFiltro(nuevo)
  }

  async function ejecutar(
    cuenta: Cuenta,
    accion: () => Promise<ResultadoDecision>,
    exito: string,
  ) {
    setOcupada(cuenta.id)
    setConfirmando(null)
    setAviso(null)
    let resultado: ResultadoDecision
    try {
      resultado = await accion()
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setOcupada(null)
    if (resultado.ok) {
      setAviso({ error: false, texto: exito })
      setVersion((v) => v + 1)
    } else if (resultado.motivo === 'sesion') {
      sesionCaducada()
    } else {
      setAviso({ error: true, texto: MENSAJES_ERROR[resultado.motivo] })
      // si ya cambio de estado o no existe, la lista estaba vieja
      if (resultado.motivo !== 'fallo') setVersion((v) => v + 1)
    }
  }

  function decidirSobre(cuenta: Cuenta, decision: DecisionCuenta) {
    const verbo =
      decision === 'aprobado'
        ? cuenta.estado === 'rechazado'
          ? 'reactivada'
          : 'aprobada'
        : cuenta.estado === 'aprobado'
          ? 'desactivada'
          : 'rechazada'
    return ejecutar(
      cuenta,
      () => decidir(cuenta.id, decision),
      `Cuenta ${verbo}: ${cuenta.nombre}.`,
    )
  }

  return (
    <MarcoPanel titulo="Cuentas" volver={volver}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro">
        {FILTROS.map(({ filtro: f, texto }) => (
          <button
            key={f}
            type="button"
            aria-pressed={filtro === f}
            onClick={() => cambiarFiltro(f)}
            className={`${BOTON} border-2 border-azul-idmz ${
              filtro === f
                ? 'bg-[#174ea6] text-white'
                : 'bg-white text-[#174ea6] hover:bg-[#eef4ff]'
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
            {carga.resultado.cuentas.map((cuenta) => {
              const esUsuario = cuenta.rol === 'usuario'
              const deshabilitado = ocupada === cuenta.id
              return (
                <li
                  key={cuenta.id}
                  className="flex flex-col gap-4 rounded-xl border border-borde bg-campo px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[17px] font-semibold break-words">
                      <span>{cuenta.nombre}</span>
                      {cuenta.bloqueada && (
                        <span className="rounded-md bg-[#fdecee] px-2 py-0.5 text-[13px] font-semibold text-[#8a1c26]">
                          Bloqueada
                        </span>
                      )}
                    </p>
                    <p className="text-[15px] break-all text-tinta-suave">
                      {cuenta.correo}
                    </p>
                    <p className="text-[14px] text-gris-azul">
                      Solicitada el {fechaCorta(cuenta.creadoEn)} ·{' '}
                      {ETIQUETA_ESTADO[cuenta.estado]}
                      {!esUsuario && ' · Administrador'}
                    </p>
                  </div>

                  {confirmando === cuenta.id ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-[15px]">
                        ¿Dar acceso de administrador a{' '}
                        <strong>{cuenta.nombre}</strong>? Desde el panel no se
                        puede deshacer.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() =>
                            ejecutar(
                              cuenta,
                              () => hacerAdministrador(cuenta.id),
                              `${cuenta.nombre} ahora es administrador.`,
                            )
                          }
                          className={PRIMARIO}
                        >
                          Sí, hacer administrador
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmando(null)}
                          className={CONTORNO}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {esUsuario && cuenta.estado === 'pendiente' && (
                        <>
                          <button
                            type="button"
                            disabled={deshabilitado}
                            onClick={() => decidirSobre(cuenta, 'aprobado')}
                            aria-label={`Aprobar a ${cuenta.nombre}`}
                            className={PRIMARIO}
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            disabled={deshabilitado}
                            onClick={() => decidirSobre(cuenta, 'rechazado')}
                            aria-label={`Rechazar a ${cuenta.nombre}`}
                            className={PELIGRO}
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {esUsuario && cuenta.estado === 'aprobado' && (
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() => decidirSobre(cuenta, 'rechazado')}
                          aria-label={`Desactivar a ${cuenta.nombre}`}
                          className={PELIGRO}
                        >
                          Desactivar
                        </button>
                      )}
                      {esUsuario && cuenta.estado === 'rechazado' && (
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() => decidirSobre(cuenta, 'aprobado')}
                          aria-label={`Reactivar a ${cuenta.nombre}`}
                          className={PRIMARIO}
                        >
                          Reactivar
                        </button>
                      )}
                      {cuenta.bloqueada && (
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() =>
                            ejecutar(
                              cuenta,
                              () => desbloquear(cuenta.id),
                              `Cuenta desbloqueada: ${cuenta.nombre}.`,
                            )
                          }
                          aria-label={`Desbloquear a ${cuenta.nombre}`}
                          className={CONTORNO}
                        >
                          Desbloquear
                        </button>
                      )}
                      {esUsuario && cuenta.estado === 'aprobado' && (
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() => setConfirmando(cuenta.id)}
                          aria-label={`Hacer administrador a ${cuenta.nombre}`}
                          className={CONTORNO}
                        >
                          Hacer administrador
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </MarcoPanel>
  )
}
