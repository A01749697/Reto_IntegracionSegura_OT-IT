import { useEffect, useState } from 'react'
import type {
  EventoBitacora,
  GrupoBitacora,
  ResultadoBitacora,
  ResultadoExportar,
} from './apiBitacora'
import { boton, TARJETA } from '../comun/estilos'
import Segmentos from '../comun/Segmentos'
import MarcoPanel from './MarcoPanel'
import { fechaHora } from './tiempo'

type Props = {
  listar: (grupo: GrupoBitacora, antes?: number) => Promise<ResultadoBitacora>
  exportar: (grupo: GrupoBitacora) => Promise<ResultadoExportar>
  descargar: (nombre: string, archivo: Blob) => void
  sesionCaducada: () => void
}

const FILTROS: { valor: GrupoBitacora; texto: string }[] = [
  { valor: 'todos', texto: 'Todo' },
  { valor: 'alertas', texto: 'Alertas' },
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
  cuenta_desbloqueada: 'Cuenta desbloqueada',
  rol_cambiado: 'Cuenta promovida a administrador',
  contrasena_cambiada: 'Cambió su contraseña desde Mi cuenta',
  cambio_contrasena_fallido:
    'Intentó cambiar su contraseña con la actual incorrecta',
  bitacora_exportada: 'Descargó la bitácora en CSV',
  datos_cuentas_consultadas: 'Consultó la tabla de cuentas en Datos',
  datos_bitacora_consultada: 'Consultó la tabla de bitácora en Datos',
}

const ALERTAS = new Set([
  'entrada_fallida',
  'entrada_bloqueada',
  'cuenta_bloqueada',
  'entrada_pendiente',
  'entrada_rechazada',
  'solicitud_repetida',
  'reinicio_fallido',
  'cambio_contrasena_fallido',
])

function describir(evento: EventoBitacora) {
  const texto = DESCRIPCIONES[evento.tipo] ?? evento.tipo
  return evento.actorCorreo ? `${texto} por ${evento.actorCorreo}` : texto
}

type Datos = { eventos: EventoBitacora[]; hayMas: boolean }
type Carga = { grupo: GrupoBitacora; version: number; datos: Datos | null }

export default function PaginaBitacora({
  listar,
  exportar,
  descargar,
  sesionCaducada,
}: Props) {
  const [grupo, setGrupo] = useState<GrupoBitacora>('todos')
  const [version, setVersion] = useState(0)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [errorMas, setErrorMas] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(
    null,
  )

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
    setAviso(null)
    setGrupo(nuevo)
  }

  async function descargarCsv() {
    setExportando(true)
    setAviso(null)
    let resultado: ResultadoExportar
    try {
      resultado = await exportar(grupo)
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setExportando(false)
    if (resultado.ok) {
      const fecha = new Date().toISOString().slice(0, 10)
      const sufijo = grupo === 'alertas' ? '-alertas' : ''
      descargar(`bitacora${sufijo}-${fecha}.csv`, resultado.archivo)
      setAviso({
        error: false,
        texto: resultado.truncado
          ? 'Archivo descargado. Solo incluye los 5000 eventos más recientes.'
          : 'Archivo descargado.',
      })
    } else if (resultado.motivo === 'sesion') {
      sesionCaducada()
    } else {
      setAviso({
        error: true,
        texto: 'No se pudo descargar el archivo. Inténtalo otra vez.',
      })
    }
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
    <MarcoPanel titulo="Bitácora de seguridad">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmentos opciones={FILTROS} valor={grupo} alCambiar={cambiarGrupo} />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={exportando}
            onClick={descargarCsv}
            className={boton('neutro')}
          >
            {exportando ? 'Descargando...' : 'Descargar CSV'}
          </button>
          <button
            type="button"
            disabled={cargando}
            onClick={() => setVersion((v) => v + 1)}
            className={boton('neutro')}
          >
            Actualizar
          </button>
        </div>
      </div>

      {aviso && (
        <p
          role={aviso.error ? 'alert' : 'status'}
          className={`text-[14px] ${aviso.error ? 'text-alerta' : 'text-ok'}`}
        >
          {aviso.texto}
        </p>
      )}

      {cargando && <p className="text-suave">Cargando...</p>}

      {!cargando && !carga.datos && (
        <p role="alert" className="text-[14px] text-alerta">
          No se pudo cargar la bitácora. Inténtalo otra vez.
        </p>
      )}

      {!cargando && carga.datos && (
        <>
          {carga.datos.eventos.length === 0 && (
            <p className="text-suave">
              {grupo === 'alertas'
                ? 'No hay alertas registradas.'
                : 'Todavía no hay eventos registrados.'}
            </p>
          )}
          <ul className={`${TARJETA} flex flex-col`}>
            {carga.datos.eventos.map((evento) => (
              <li
                key={evento.id}
                className="flex flex-col gap-0.5 border-b border-linea px-5 py-3.5 last:border-b-0"
              >
                <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold">
                  <span>{describir(evento)}</span>
                  {ALERTAS.has(evento.tipo) && (
                    <span className="rounded-[5px] bg-alerta/15 px-2 py-0.5 text-[12px] font-bold text-alerta">
                      Alerta
                    </span>
                  )}
                </p>
                <p className="text-[13px] break-all text-suave">
                  {evento.correo ?? 'Sin correo'} · {evento.ip ?? 'Sin IP'}
                </p>
                <p className="text-[12.5px] text-suave">
                  {fechaHora(evento.ocurrioEn)}
                </p>
              </li>
            ))}
          </ul>
          {errorMas && (
            <p role="alert" className="text-[14px] text-alerta">
              No se pudieron cargar más eventos. Inténtalo otra vez.
            </p>
          )}
          {carga.datos.hayMas && (
            <button
              type="button"
              disabled={cargandoMas}
              onClick={cargarMas}
              className={`${boton('neutro')} self-center`}
            >
              {cargandoMas ? 'Cargando...' : 'Cargar más'}
            </button>
          )}
        </>
      )}
    </MarcoPanel>
  )
}
