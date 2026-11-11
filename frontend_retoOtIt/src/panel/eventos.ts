import type { EventoBitacora } from './apiBitacora'

export const DESCRIPCIONES: Record<string, string> = {
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

export const ALERTAS = new Set([
  'entrada_fallida',
  'entrada_bloqueada',
  'cuenta_bloqueada',
  'entrada_pendiente',
  'entrada_rechazada',
  'solicitud_repetida',
  'reinicio_fallido',
  'cambio_contrasena_fallido',
])

export const esAlerta = (tipo: string) => ALERTAS.has(tipo)

export function describir(evento: EventoBitacora) {
  const texto = DESCRIPCIONES[evento.tipo] ?? evento.tipo
  return evento.actorCorreo ? `${texto} por ${evento.actorCorreo}` : texto
}
