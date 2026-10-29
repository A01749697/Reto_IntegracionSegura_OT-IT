import { describe, expect, it, vi } from 'vitest'
import { crearServicioCorreo } from './correo.servicio'

const TOKEN = 'a1b2c3d4'.repeat(8)

function crearServicio() {
  const enviar = vi.fn().mockResolvedValue(undefined)
  const servicio = crearServicioCorreo({
    enviar,
    remitente: 'panel@ejemplo.com',
    urlPublica: 'https://18.119.219.73',
  })
  return { enviar, servicio }
}

describe('servicio de correo', () => {
  it('envía desde el remitente configurado al destinatario', async () => {
    const { enviar, servicio } = crearServicio()

    await servicio.enviarEnlaceReinicio('ana@ejemplo.com', TOKEN)

    expect(enviar).toHaveBeenCalledTimes(1)
    const entrada = enviar.mock.calls[0]?.[0]
    expect(entrada.FromEmailAddress).toBe('panel@ejemplo.com')
    expect(entrada.Destination.ToAddresses).toEqual(['ana@ejemplo.com'])
    expect(entrada.Content.Simple.Subject.Data).toBe('Restablece tu contraseña')
  })

  it('el enlace usa la dirección pública y pone el código después del #', async () => {
    const { enviar, servicio } = crearServicio()

    await servicio.enviarEnlaceReinicio('ana@ejemplo.com', TOKEN)

    const texto = enviar.mock.calls[0]?.[0].Content.Simple.Body.Text.Data
    expect(texto).toContain(`https://18.119.219.73/#restablecer=${TOKEN}`)
    expect(texto).not.toContain('?')
  })

  it('dice cuántos minutos dura el enlace', async () => {
    const { enviar, servicio } = crearServicio()

    await servicio.enviarEnlaceReinicio('ana@ejemplo.com', TOKEN)

    const texto = enviar.mock.calls[0]?.[0].Content.Simple.Body.Text.Data
    expect(texto).toContain('10 minutos')
  })

  it('es solo texto plano, sin HTML', async () => {
    const { enviar, servicio } = crearServicio()

    await servicio.enviarEnlaceReinicio('ana@ejemplo.com', TOKEN)

    expect(enviar.mock.calls[0]?.[0].Content.Simple.Body.Html).toBeUndefined()
  })

  it('si el envío falla, el error sube', async () => {
    const { enviar, servicio } = crearServicio()
    enviar.mockRejectedValue(new Error('SES no responde'))

    await expect(
      servicio.enviarEnlaceReinicio('ana@ejemplo.com', TOKEN),
    ).rejects.toThrow('SES no responde')
  })
})
