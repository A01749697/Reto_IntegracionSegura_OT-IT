import { TARJETA } from '../comun/estilos'
import MarcoPanel from './MarcoPanel'

type Props = {
  esAdmin: boolean
}

// En el mismo orden que las pestañas del encabezado.
const PESTANAS = [
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
    nombre: 'Mi cuenta',
    texto: 'Tus datos y el cambio de tu contraseña.',
    soloAdmin: false,
  },
]

const PREGUNTAS = [
  {
    pregunta: 'Mi cuenta se bloqueó',
    respuesta:
      'Después de 3 contraseñas incorrectas seguidas la cuenta se bloquea 15 minutos. Pasado ese tiempo puedes volver a intentar, o puedes pedirle a un administrador que la desbloquee.',
  },
  {
    pregunta: 'Olvidé mi contraseña',
    respuesta:
      'En «Entrar al panel» pulsa «¿Olvidaste tu contraseña?», escribe tu correo y recibirás un enlace que sirve 10 minutos.',
  },
  {
    pregunta: 'Mi sesión se cerró sola',
    respuesta:
      'La sesión se cierra después de 30 minutos sin usar el panel y, en todo caso, a las 8 horas. Solo hay que entrar de nuevo.',
  },
]

function Lista({ elementos }: { elementos: typeof PESTANAS }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {elementos.map(({ nombre, texto }) => (
        <li key={nombre} className="text-[13.5px] leading-snug">
          <span className="font-bold">{nombre}</span>
          <span className="text-suave"> · {texto}</span>
        </li>
      ))}
    </ul>
  )
}

// Respuestas cortas a lo que más se pregunta. Se llega desde el menú de la cuenta.
export default function PaginaAyuda({ esAdmin }: Props) {
  return (
    <MarcoPanel titulo="Ayuda">
      <section className={`${TARJETA} p-5`}>
        <h2 className="mb-3 text-[15px] font-bold">Qué hay en cada pestaña</h2>
        <Lista elementos={PESTANAS.filter((p) => esAdmin || !p.soloAdmin)} />
      </section>

      <section className={`${TARJETA} p-5`}>
        <h2 className="mb-3 text-[15px] font-bold">Preguntas frecuentes</h2>
        <dl className="flex flex-col gap-4">
          {PREGUNTAS.map(({ pregunta, respuesta }) => (
            <div key={pregunta}>
              <dt className="text-[13.5px] font-bold">{pregunta}</dt>
              <dd className="mt-1 text-[13.5px] leading-snug text-suave">
                {respuesta}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </MarcoPanel>
  )
}
