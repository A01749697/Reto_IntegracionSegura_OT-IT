// Sin acentos ni mayusculas, para que "tomas" encuentre "Tomás".
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function coincide(texto: string, busqueda: string): boolean {
  return normalizar(texto).includes(normalizar(busqueda.trim()))
}
