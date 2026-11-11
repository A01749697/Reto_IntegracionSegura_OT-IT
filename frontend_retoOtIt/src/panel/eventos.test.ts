import { describe, expect, it } from 'vitest'
import type { EventoBitacora } from './apiBitacora'
import { ALERTAS, DESCRIPCIONES, describir, esAlerta } from './eventos'

const evento = (cambios: Partial<EventoBitacora>): EventoBitacora => ({
  id: 1,
  ocurrioEn: '2026-11-06T18:00:00.000Z',
  tipo: 'entrada_correcta',
  usuarioId: 1,
  correo: 'a@ejemplo.com',
  ip: null,
  actorCorreo: null,
  ...cambios,
})

describe('eventos', () => {
  it('describe el tipo conocido en español', () => {
    expect(describir(evento({}))).toBe('Inició sesión')
  })

  it('agrega quién lo hizo cuando hay actor', () => {
    expect(
      describir(evento({ tipo: 'cuenta_aprobada', actorCorreo: 'adm@e.com' })),
    ).toBe('Cuenta aprobada por adm@e.com')
  })

  it('un tipo desconocido se muestra tal cual', () => {
    expect(describir(evento({ tipo: 'tipo_nuevo' }))).toBe('tipo_nuevo')
  })

  it('marca como alerta los intentos sospechosos y no los normales', () => {
    expect(esAlerta('entrada_fallida')).toBe(true)
    expect(esAlerta('cuenta_bloqueada')).toBe(true)
    expect(esAlerta('entrada_correcta')).toBe(false)
  })

  it('toda alerta tiene descripción', () => {
    for (const tipo of ALERTAS) expect(DESCRIPCIONES[tipo]).toBeDefined()
  })
})
