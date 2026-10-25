// TEMPORAL: todavia no existe la API del panel.
// Cuando exista, estas tres funciones se reemplazan por llamadas a `/api/`.
// Ojo: el bloqueo por intentos fallidos debe aplicarse tambien en el servidor.

export async function autenticarTemporal(): Promise<boolean> {
  return false
}

export async function solicitarCuentaTemporal(): Promise<void> {}

export async function recuperarClaveTemporal(): Promise<void> {}
