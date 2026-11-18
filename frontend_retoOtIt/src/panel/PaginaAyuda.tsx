import { useTranslation } from 'react-i18next'
import { TARJETA } from '../comun/estilos'
import MarcoPanel from './MarcoPanel'

type Props = {
  esAdmin: boolean
}

// En el mismo orden que las pestañas del encabezado.
const PESTANAS = [
<<<<<<< HEAD
  { nombre: 'Inicio', texto: 'Tu saludo y tu rol.', soloAdmin: false },
  {
    nombre: 'Cuentas',
    texto:
      'Aprobar o rechazar solicitudes, desactivar, reactivar, desbloquear y hacer administrador.',
    soloAdmin: true,
  },
  {
    nombre: 'Bitácora',
    texto: 'Los accesos, bloqueos y cambios de rol. Se puede descargar en CSV.',
    soloAdmin: true,
  },
  {
    nombre: 'Datos',
    texto:
      'Las tablas de cuentas y bitácora, solo para leer. Cada consulta queda anotada.',
    soloAdmin: true,
  },
  {
    nombre: 'Estado',
    texto: 'Si la API, las bases de datos y la llegada de datos están al día.',
    soloAdmin: false,
  },
  {
    nombre: 'Gemelo',
    texto:
      'La celda clasificadora en 3D. Sigue las lecturas que llegan o corre una simulación.',
    soloAdmin: false,
  },
  {
    nombre: 'Mi cuenta',
    texto: 'Tus datos y el cambio de tu contraseña.',
    soloAdmin: false,
  },
]
=======
  { clave: 'inicio', soloAdmin: false },
  { clave: 'cuentas', soloAdmin: true },
  { clave: 'bitacora', soloAdmin: true },
  { clave: 'datos', soloAdmin: true },
  { clave: 'estado', soloAdmin: false },
  { clave: 'cuenta', soloAdmin: false },
] as const
>>>>>>> 8f6a37cd975fbc94ecaf5bca923178802838cd64

const PREGUNTAS = ['bloqueo', 'olvido', 'sesion'] as const

// Respuestas cortas a lo que más se pregunta. Se llega desde el menú de la cuenta.
export default function PaginaAyuda({ esAdmin }: Props) {
  const { t } = useTranslation()
  return (
    <MarcoPanel titulo={t('ayuda.titulo')}>
      <section className={`${TARJETA} p-5`}>
        <h2 className="mb-3 text-[15px] font-bold">
          {t('ayuda.pestanasTitulo')}
        </h2>
        <ul className="flex flex-col gap-2.5">
          {PESTANAS.filter((p) => esAdmin || !p.soloAdmin).map(({ clave }) => (
            <li key={clave} className="text-[13.5px] leading-snug">
              <span className="font-bold">
                {t(`encabezado.pestanas.${clave}`)}
              </span>
              <span className="text-suave">
                {' '}
                · {t(`ayuda.pestanas.${clave}`)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${TARJETA} p-5`}>
        <h2 className="mb-3 text-[15px] font-bold">
          {t('ayuda.preguntasTitulo')}
        </h2>
        <dl className="flex flex-col gap-4">
          {PREGUNTAS.map((clave) => (
            <div key={clave}>
              <dt className="text-[13.5px] font-bold">
                {t(`ayuda.preguntas.${clave}.pregunta`)}
              </dt>
              <dd className="mt-1 text-[13.5px] leading-snug text-suave">
                {t(`ayuda.preguntas.${clave}.respuesta`)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </MarcoPanel>
  )
}
