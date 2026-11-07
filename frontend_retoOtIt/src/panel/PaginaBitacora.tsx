import { useEffect, useState } from 'react'
import type {
  EventoBitacora,
  GrupoBitacora,
  ResultadoBitacora,
} from './apiBitacora'
import MarcoPanel from './MarcoPanel'
import { fechaHora } from './tiempo'

type Props = {
  listar: (grupo: GrupoBitacora, antes?: number) => Promise<ResultadoBitacora>
  volver: () => void
  sesionCaducada: () => void
}

const FILTROS: { grupo: GrupoBitacora; texto: string }[] = [
  { grupo: 'todos', texto: 'Todo' },
  { grupo: 'alertas', texto: 'Alertas' },
]

const DESCRIPCIONES: Record<string, string> = {
  entrada_correcta: 'Inició sesión',
  entrada_fallida: 'Intento de entrada con datos incorrectos',
  entrada_bloqueada: 'Intento de entrada con la cuenta bloqueada',
  cuenta_bloqueada: 'Cuenta bloqueada por demasiados intentos',
  entrada_pendiente: 'Intentó entrar con una cuenta pendiente de aprobación',
  entrada_rechazada: 'Intentó entrar con una cuenta rechazada',
  cuenta_solicitada: 'Pidió una cuenta nueva',
  solicitud_repetida: 'Pidió una cuenta con un correo que ya existe',
  reinicio_solicitado: 'Pidió cambiar su contraseña',
  reinicio_fallido: 'Usó un enlace de recuperación inválido o caducado',
  contrasena_restablecida: 'Cambió su contraseña con el enlace del correo',
  sesion_cerrada: 'Cerró sesión',
  cuenta_aprobada: 'Cuenta aprobada',
  cuenta_rechazada: 'Cuenta rechazada',
}

const ALERTAS = new Set([
  'entrada_fallida',
  'entrada_bloqueada',
  'cuenta_bloqueada',
  'entrada_pendiente',
  'entrada_rechazada',
  'solicitud_repetida',
  'reinicio_fallido',
])

const BOTON =
  'h-11 cursor-pointer rounded-lg border-2 border-azul-idmz px-5 text-[15px] font-semibold focus-visible:ring-[3px] focus-visible:ring-turquesa/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60'

function describir(evento: EventoBitacora) {
  const texto = DESCRIPCIONES[evento.tipo] ?? evento.tipo
  return evento.actorCorreo ? `${texto} por ${evento.actorCorreo}` : texto
}

type Datos = { eventos: EventoBitacora[]; hayMas: boolean }
type Carga = { grupo: GrupoBitacora; version: number; datos: Datos | null }

export default function PaginaBitacora({
  listar,
  volver,
  sesionCaducada,
}: Props) {
  const [grupo, setGrupo] = useState<GrupoBitacora>('todos')
  const [version, setVersion] = useState(0)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [errorMas, setErrorMas] = useState(false)

  useEffect(() => {
    let vigente = true
    listar(grupo).then((resultado) => {
      if (!vigente) return
      if (!resultado.ok && resultado.motivo === 'sesion') sesionCaducada()
      else {
        const datos = resultado.ok
          ? { eventos: resultado.eventos, hayMas: resultado.hayMas }
          : null
        setCarga({ grupo, version, datos })
      }
    })
    return () => {
      vigente = false
    }
  }, [listar, grupo, version, sesionCaducada])

  const cargando =
    carga === null || carga.grupo !== grupo || carga.version !== version

  function cambiarGrupo(nuevo: GrupoBitacora) {
    setErrorMas(false)
    setGrupo(nuevo)
  }

  async function cargarMas() {
    const ultimo = carga?.datos?.eventos.at(-1)
    if (cargando || cargandoMas || !ultimo) return
    setCargandoMas(true)
    setErrorMas(false)
    let resultado: ResultadoBitacora
    try {
      resultado = await listar(grupo, ultimo.id)
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setCargandoMas(false)
    if (!resultado.ok) {
      if (resultado.motivo === 'sesion') sesionCaducada()
      else setErrorMas(true)
      return
    }
    const { eventos, hayMas } = resultado
    setCarga((previa) =>
      previa?.datos && previa.grupo === grupo && previa.version === version
        ? {
            ...previa,
            datos: { eventos: [...previa.datos.eventos, ...eventos], hayMas },
          }
        : previa,
    )
  }

  return (
    <MarcoPanel titulo="Bitácora de seguridad" volver={volver}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Filtro">
          {FILTROS.map(({ grupo: g, texto }) => (
            <button
              key={g}
              type="button"
              aria-pressed={grupo === g}
              onClick={() => cambiarGrupo(g)}
              className={`${BOTON} ${
                grupo === g
                  ? 'bg-[#174ea6] text-white'
                  : 'bg-white text-[#174ea6] hover:bg-[#eef4ff]'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={cargando}
          onClick={() => setVersion((v) => v + 1)}
          className={`${BOTON} bg-white text-[#174ea6] hover:bg-[#eef4ff]`}
        >
          Actualizar
        </button>
      </div>

      {cargando && <p className="text-tinta-suave">Cargando...</p>}

      {!cargando && !carga.datos && (
        <p role="alert" className="text-[15px] text-[#8a1c26]">
          No se pudo cargar la bitácora. Inténtalo otra vez.
        </p>
      )}

      {!cargando && carga.datos && (
        <>
          {carga.datos.eventos.length === 0 && (
            <p className="text-tinta-suave">
              {grupo === 'alertas'
                ? 'No hay alertas registradas.'
                : 'Todavía no hay eventos registrados.'}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {carga.datos.eventos.map((evento) => (
              <li
                key={evento.id}
                className="flex flex-col gap-1 rounded-xl border border-borde bg-campo px-5 py-4"
              >
                <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold">
                  <span>{describir(evento)}</span>
                  {ALERTAS.has(evento.tipo) && (
                    <span className="rounded-md bg-[#fdecee] px-2 py-0.5 text-[13px] font-semibold text-[#8a1c26]">
                      Alerta
                    </span>
                  )}
                </p>
                <p className="text-[15px] break-all text-tinta-suave">
                  {evento.correo ?? 'Sin correo'} · {evento.ip ?? 'Sin IP'}
                </p>
                <p className="text-[14px] text-gris-azul">
                  {fechaHora(evento.ocurrioEn)}
                </p>
              </li>
            ))}
          </ul>
          {errorMas && (
            <p role="alert" className="text-[15px] text-[#8a1c26]">
              No se pudieron cargar más eventos. Inténtalo otra vez.
            </p>
          )}
          {carga.datos.hayMas && (
            <button
              type="button"
              disabled={cargandoMas}
              onClick={cargarMas}
              className={`${BOTON} self-center bg-white text-[#174ea6] hover:bg-[#eef4ff]`}
            >
              {cargandoMas ? 'Cargando...' : 'Cargar más'}
            </button>
          )}
        </>
      )}
    </MarcoPanel>
  )
}
