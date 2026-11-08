import type { Usuario } from '../login/apiPanel'
import MarcoPanel from './MarcoPanel'

type Props = {
  usuario: Usuario
}

// Pantalla provisional mientras no esta el dashboard.
export default function PaginaInicio({ usuario }: Props) {
  return (
    <MarcoPanel titulo="Inicio">
      <p className="text-[17px]">
        Hola, <strong>{usuario.nombre}</strong>.
      </p>
      <dl className="flex flex-col gap-1 text-[14px] text-suave">
        <div className="flex gap-2">
          <dt className="font-semibold">Correo:</dt>
          <dd className="break-all">{usuario.correo}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold">Rol:</dt>
          <dd>{usuario.rol}</dd>
        </div>
      </dl>
      <p className="text-[14px] text-suave">
        Todavía no está el dashboard con las lecturas de los PLC.
      </p>
    </MarcoPanel>
  )
}
