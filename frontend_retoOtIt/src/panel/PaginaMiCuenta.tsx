import { useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle, Lock } from 'reicon-react'
import { avisoClases, boton } from '../comun/estilos'
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
      <dl className="flex flex-col gap-1 text-[14px] text-suave">
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

      <form
        onSubmit={enviar}
        noValidate
        aria-label="Cambiar contraseña"
        className="flex max-w-[460px] flex-col gap-5"
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
    </MarcoPanel>
  )
}
