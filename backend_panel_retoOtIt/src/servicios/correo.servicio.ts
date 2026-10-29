// Arma y envía los correos del panel con AWS SES. Es el único archivo que sabe cómo es un correo.
// La conexión real con SES se pasa desde afuera (la función "enviar"), así las pruebas no envían nada.
import type { SendEmailCommandInput } from '@aws-sdk/client-sesv2'
import { seguridad } from '../configuracion/seguridad'

type Dependencias = {
  enviar: (entrada: SendEmailCommandInput) => Promise<void>
  remitente: string
  urlPublica: string
}

export function crearServicioCorreo({
  enviar,
  remitente,
  urlPublica,
}: Dependencias) {
  return {
    // El código va después del símbolo #: el navegador nunca manda esa parte al servidor,
    // así no queda escrito en los registros de nginx ni se filtra por el encabezado Referer.
    async enviarEnlaceReinicio(
      destinatario: string,
      token: string,
    ): Promise<void> {
      const enlace = `${urlPublica}/#restablecer=${token}`
      const minutos = Math.round(seguridad.reinicio.duracionEnlaceMs / 60000)

      const texto = [
        'Recibimos una solicitud para restablecer tu contraseña del panel.',
        '',
        `Abre este enlace para escribir una contraseña nueva. Sirve una sola vez y caduca en ${minutos} minutos:`,
        enlace,
        '',
        'Si tú no lo pediste, ignora este mensaje. Tu contraseña actual sigue funcionando.',
      ].join('\n')

      await enviar({
        FromEmailAddress: remitente,
        Destination: { ToAddresses: [destinatario] },
        Content: {
          Simple: {
            Subject: { Data: 'Restablece tu contraseña', Charset: 'UTF-8' },
            Body: { Text: { Data: texto, Charset: 'UTF-8' } },
          },
        },
      })
    },
  }
}

export type ServicioCorreo = ReturnType<typeof crearServicioCorreo>
