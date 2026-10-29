// Lógica de las lecturas: primero se valida el cuerpo y, solo si es válido, se guarda.
import { validarCuerpo, type Lectura } from '../esquemas/lecturas.esquema'

export type ResultadoRegistro =
  { ok: true; recibidas: number } | { ok: false; error: string }

type Dependencias = {
  guardarLecturas: (lecturas: Lectura[]) => Promise<void>
  ahora: () => number
}

export function crearServicioLecturas({
  guardarLecturas,
  ahora,
}: Dependencias) {
  return {
    async registrar(cuerpo: unknown): Promise<ResultadoRegistro> {
      const validacion = validarCuerpo(cuerpo, ahora())
      if (!validacion.ok) return validacion

      await guardarLecturas(validacion.lecturas)
      return { ok: true, recibidas: validacion.lecturas.length }
    },
  }
}

export type ServicioLecturas = ReturnType<typeof crearServicioLecturas>
