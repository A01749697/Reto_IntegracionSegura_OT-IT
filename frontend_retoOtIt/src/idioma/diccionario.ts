// Misma forma que otro diccionario, pero con cualquier texto: si falta o sobra
// una frase en un idioma, TypeScript lo marca al compilar.
export type Diccionario<T> = {
  [K in keyof T]: T[K] extends string ? string : Diccionario<T[K]>
}
