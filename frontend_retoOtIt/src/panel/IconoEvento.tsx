import type { ComponentType } from 'react'
import {
  Danger,
  Database,
  Download,
  Key,
  Login,
  Logout,
  UserCheck,
} from 'reicon-react'
import { esAlerta } from './eventos'

type Icono = ComponentType<{ size?: number; className?: string }>

const ICONOS: Record<string, Icono> = {
  entrada_correcta: Login,
  sesion_cerrada: Logout,
  cuenta_solicitada: UserCheck,
  cuenta_aprobada: UserCheck,
  cuenta_rechazada: UserCheck,
  cuenta_desbloqueada: UserCheck,
  rol_cambiado: UserCheck,
  reinicio_solicitado: Key,
  contrasena_restablecida: Key,
  contrasena_cambiada: Key,
  bitacora_exportada: Download,
  datos_cuentas_consultadas: Database,
  datos_bitacora_consultada: Database,
}

// cuadrito con el icono del tipo de evento; las alertas van en rojo
export default function IconoEvento({ tipo }: { tipo: string }) {
  const alerta = esAlerta(tipo)
  const Icono = alerta ? Danger : (ICONOS[tipo] ?? Login)
  return (
    <span
      aria-hidden="true"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
        alerta
          ? 'border-alerta/40 bg-alerta/10 text-alerta'
          : 'border-linea bg-fondo text-acento'
      }`}
    >
      <Icono size={16} />
    </span>
  )
}
