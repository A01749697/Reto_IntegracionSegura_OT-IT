import { useTranslation } from 'react-i18next'
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

export default function PaginaMiCuenta({
  usuario,
  cambiar,
  sesionCaducada,
}: Props) {
  const { t } = useTranslation()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [ver, setVer] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(
    null,
  )

  function validar(): string | null {
    if (!actual || !nueva || !repetida) return t('miCuenta.errores.completa')
    if (nueva.length < LARGO_MINIMO || nueva.length > LARGO_MAXIMO) {
      return t('miCuenta.errores.largo', {
        minimo: LARGO_MINIMO,
        maximo: LARGO_MAXIMO,
      })
    }
    if (nueva !== repetida) return t('miCuenta.errores.noCoincide')
    if (nueva === actual) {
      return t('miCuenta.errores.igual')
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
        texto: t('miCuenta.exito'),
      })
    } else if (resultado.motivo === 'sesion') {
      sesionCaducada()
    } else {
      setAviso({
        error: true,
        texto: t(`miCuenta.errores.${resultado.motivo}`),
      })
    }
  }

  const tipo = ver ? 'text' : 'password'

  return (
    <MarcoPanel titulo={t('miCuenta.titulo')}>
      <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className={`${TARJETA} flex flex-col gap-4 px-5 py-5`}>
          <h2 className="text-[18px] font-bold">{t('miCuenta.tusDatos')}</h2>
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-acento text-[16px] font-bold text-sobre"
            >
              {iniciales(usuario.nombre)}
            </span>
            <dl className="flex min-w-0 flex-col gap-1 text-[14px] text-suave">
              <div className="flex gap-2">
                <dt className="font-semibold">{t('general.campoNombre')}</dt>
                <dd>{usuario.nombre}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">{t('general.campoCorreo')}</dt>
                <dd className="break-all">{usuario.correo}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">{t('general.campoRol')}</dt>
                <dd>{t(`general.roles.${usuario.rol}`)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <form
          onSubmit={enviar}
          noValidate
          aria-label={t('miCuenta.cambiar')}
          className={`${TARJETA} flex flex-col gap-5 px-5 py-5`}
        >
          <h2 className="text-[18px] font-bold">{t('miCuenta.cambiar')}</h2>

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
            etiqueta={t('miCuenta.campos.actual')}
            Icono={Lock}
            valor={actual}
            alCambiar={setActual}
            type={tipo}
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <CampoTexto
            id="clave-nueva"
            etiqueta={t('miCuenta.campos.nueva')}
            Icono={Lock}
            valor={nueva}
            alCambiar={setNueva}
            type={tipo}
            autoComplete="new-password"
            placeholder={t('miCuenta.pistas.minimo', { minimo: LARGO_MINIMO })}
          />
          <CampoTexto
            id="clave-repetida"
            etiqueta={t('miCuenta.campos.repetida')}
            Icono={Lock}
            valor={repetida}
            alCambiar={setRepetida}
            type={tipo}
            autoComplete="new-password"
            placeholder={t('miCuenta.pistas.repite')}
          />

          <label className="flex cursor-pointer items-center gap-2 text-[13.5px]">
            <input
              type="checkbox"
              checked={ver}
              onChange={(e) => setVer(e.target.checked)}
              className="h-4 w-4 accent-acento"
            />
            {t('miCuenta.mostrar')}
          </label>

          <button
            type="submit"
            disabled={enviando}
            className={`${boton('principal', 'grande')} w-full`}
          >
            {enviando ? t('miCuenta.guardando') : t('miCuenta.cambiar')}
          </button>
        </form>

        <section className={`${TARJETA} flex flex-col gap-3 px-5 py-5`}>
          <h2 className="flex items-center gap-2.5 text-[18px] font-bold">
            <ShieldCheck size={20} aria-hidden="true" className="text-acento" />
            {t('miCuenta.sesion.titulo')}
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[13.5px] text-suave">
            <li>{t('miCuenta.sesion.inactividad')}</li>
            <li>{t('miCuenta.sesion.maximo')}</li>
            <li>{t('miCuenta.sesion.bloqueo')}</li>
            <li>{t('miCuenta.sesion.otras')}</li>
          </ul>
        </section>
      </div>
    </MarcoPanel>
  )
}
