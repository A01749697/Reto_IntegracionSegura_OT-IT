import { useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle, Lock, ShieldCheck } from 'reicon-react'
import { avisoClases, boton, TARJETA } from '../comun/estilos'
import { iniciales } from '../comun/iniciales'
import CampoTexto from '../login/CampoTexto'
import type { Usuario } from '../login/apiPanel'
import type { ResultadoCambioClave } from './apiCuenta'
import MarcoPanel from './MarcoPanel'

type Props = {
  usuario: Usuario
  cambiar: (actual: string, nueva: string) => Promise<ResultadoCambioClave>
  sesionCaducada: () => void
}

const LARGO_MINIMO = 12
const LARGO_MAXIMO = 128

const MENSAJES: Record<
  Exclude<Extract<ResultadoCambioClave, { ok: false }>['motivo'], 'sesion'>,
  string
> = {
  actual_incorrecta: 'La contraseña actual no es correcta.',
  bloqueada:
    'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
  limite: 'Demasiadas peticiones desde esta red. Espera unos minutos.',
  invalido: 'Revisa las contraseñas e inténtalo otra vez.',
  fallo: 'No se pudo completar. Inténtalo más tarde.',
}

export default function PaginaMiCuenta({
  usuario,
  cambiar,
  sesionCaducada,
}: Props) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [ver, setVer] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(
    null,
  )

  function validar(): string | null {
    if (!actual || !nueva || !repetida) return 'Completa los tres campos.'
    if (nueva.length < LARGO_MINIMO || nueva.length > LARGO_MAXIMO) {
      return `La contraseña nueva debe tener de ${LARGO_MINIMO} a ${LARGO_MAXIMO} caracteres.`
    }
    if (nueva !== repetida) return 'La contraseña nueva no coincide.'
    if (nueva === actual) {
      return 'La contraseña nueva debe ser distinta de la actual.'
    }
    return null
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const problema = validar()
    if (problema) {
      setAviso({ error: true, texto: problema })
      return
    }
    setEnviando(true)
    setAviso(null)
    let resultado: ResultadoCambioClave
    try {
      resultado = await cambiar(actual, nueva)
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setEnviando(false)
    if (resultado.ok) {
      setActual('')
      setNueva('')
      setRepetida('')
      setAviso({
        error: false,
        texto: 'Tu contraseña se cambió. Cerramos tus otras sesiones.',
      })
    } else if (resultado.motivo === 'sesion') {
      sesionCaducada()
    } else {
      setAviso({ error: true, texto: MENSAJES[resultado.motivo] })
    }
  }

  const tipo = ver ? 'text' : 'password'

  return (
    <MarcoPanel titulo="Mi cuenta">
      <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className={`${TARJETA} flex flex-col gap-4 px-5 py-5`}>
          <h2 className="text-[18px] font-bold">Tus datos</h2>
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-acento text-[16px] font-bold text-sobre"
            >
              {iniciales(usuario.nombre)}
            </span>
            <dl className="flex min-w-0 flex-col gap-1 text-[14px] text-suave">
              <div className="flex gap-2">
                <dt className="font-semibold">Nombre:</dt>
                <dd>{usuario.nombre}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">Correo:</dt>
                <dd className="break-all">{usuario.correo}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">Rol:</dt>
                <dd>{usuario.rol}</dd>
              </div>
            </dl>
          </div>
        </section>

        <form
          onSubmit={enviar}
          noValidate
          aria-label="Cambiar contraseña"
          className={`${TARJETA} flex flex-col gap-5 px-5 py-5`}
        >
          <h2 className="text-[18px] font-bold">Cambiar contraseña</h2>

          {aviso && (
            <div
              role={aviso.error ? 'alert' : 'status'}
              className={avisoClases(aviso.error)}
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

          <CampoTexto
            id="clave-actual"
            etiqueta="Contraseña actual"
            Icono={Lock}
            valor={actual}
            alCambiar={setActual}
            type={tipo}
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <CampoTexto
            id="clave-nueva"
            etiqueta="Contraseña nueva"
            Icono={Lock}
            valor={nueva}
            alCambiar={setNueva}
            type={tipo}
            autoComplete="new-password"
            placeholder={`Mínimo ${LARGO_MINIMO} caracteres`}
          />
          <CampoTexto
            id="clave-repetida"
            etiqueta="Repite la contraseña nueva"
            Icono={Lock}
            valor={repetida}
            alCambiar={setRepetida}
            type={tipo}
            autoComplete="new-password"
            placeholder="Escríbela otra vez"
          />

          <label className="flex cursor-pointer items-center gap-2 text-[13.5px]">
            <input
              type="checkbox"
              checked={ver}
              onChange={(e) => setVer(e.target.checked)}
              className="h-4 w-4 accent-acento"
            />
            Mostrar contraseñas
          </label>

          <button
            type="submit"
            disabled={enviando}
            className={`${boton('principal', 'grande')} w-full`}
          >
            {enviando ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>

        <section className={`${TARJETA} flex flex-col gap-3 px-5 py-5`}>
          <h2 className="flex items-center gap-2.5 text-[18px] font-bold">
            <ShieldCheck size={20} aria-hidden="true" className="text-acento" />
            Cómo se cuida tu sesión
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[13.5px] text-suave">
            <li>Se cierra sola después de 30 minutos sin uso.</li>
            <li>Dura 8 horas como máximo, aunque la sigas usando.</li>
            <li>Tras 3 intentos fallidos la cuenta se bloquea 15 minutos.</li>
            <li>Al cambiar tu contraseña se cierran tus otras sesiones.</li>
          </ul>
        </section>
      </div>
    </MarcoPanel>
  )
}
