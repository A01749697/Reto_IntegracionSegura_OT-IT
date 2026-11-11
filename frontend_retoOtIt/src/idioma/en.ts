import type { Diccionario } from './diccionario'
import type { es } from './es'

export const en: Diccionario<typeof es> = {
  comun: {
    marca: 'OT-IT Challenge Panel',
  },
  tema: {
    cambiarAClaro: 'Switch to light mode',
    cambiarAOscuro: 'Switch to dark mode',
  },
  idioma: {
    etiqueta: 'Language',
    es: 'Español',
    en: 'English',
  },
  camino: {
    etiqueta:
      'Data path: from the OT zone to the IDMZ, then to the IT zone and finally to the cloud',
    zonas: {
      ot: { nombre: 'OT', descripcion: 'Plant and PLCs' },
      idmz: { nombre: 'IDMZ', descripcion: 'Intermediate zone' },
      it: { nombre: 'IT', descripcion: 'Office network' },
      nube: { nombre: 'Cloud', descripcion: 'Server on AWS' },
    },
  },
  landing: {
    crearCuenta: 'Create account',
    iniciarSesion: 'Sign in',
    titulo: 'Your plant data, secure all the way to the cloud',
    intro:
      'A panel to watch the path your information follows from the PLCs to the server, through every zone of the network.',
    funciones: {
      cuentas: {
        titulo: 'Accounts with approval',
        texto:
          'Anyone who asks for access waits for an administrator to approve it.',
      },
      bitacora: {
        titulo: 'Security log',
        texto: 'Every sign-in, lockout and role change is recorded.',
      },
      estado: {
        titulo: 'System status',
        texto:
          'Check whether the API, the databases and the data arrival are up to date.',
      },
    },
  },
  login: {
    irAlInicio: 'OT-IT Challenge Panel, go to the home page',
    encabezados: {
      login: {
        titulo: 'Sign in to the panel',
        subtitulo:
          'Supervise the secure communication between the plant and the cloud.',
      },
      olvido: {
        titulo: 'Recover password',
        subtitulo: 'We will help you get back in.',
      },
      crear: {
        titulo: 'Create account',
        subtitulo: 'Request access to the challenge panel.',
      },
      restablecer: {
        titulo: 'New password',
        subtitulo: 'Type the new password for your account.',
      },
    },
    formularios: {
      iniciarSesion: 'Sign in',
      recuperar: 'Recover password',
      crear: 'Create account',
      restablecer: 'Reset password',
    },
    campos: {
      correo: 'Email',
      clave: 'Password',
      claveNueva: 'New password',
      repiteClave: 'Repeat the password',
      repiteClaveNueva: 'Repeat the new password',
      nombre: 'Full name',
    },
    pistas: {
      correo: 'email@example.com',
      tuClave: 'Your password',
      nombre: 'First and last name',
      minimo: 'At least {{minimo}} characters',
      repite: 'Type it again',
    },
    acciones: {
      mostrarClave: 'Show password',
      ocultarClave: 'Hide password',
      iniciarSesion: 'Sign in',
      verificando: 'Checking...',
      olvidaste: 'Forgot your password?',
      sinCuenta: "Don't have an account yet?",
      crearCuenta: 'Create account',
      enviarInstrucciones: 'Send instructions',
      volverALogin: 'Back to sign in',
      enviarSolicitud: 'Send request',
      yaTengoCuenta: 'I already have an account, back to sign in',
      cambiarClave: 'Change password',
      irALogin: 'Go to sign in',
    },
    avisos: {
      bloqMayus: 'Caps Lock is on',
      olvidoIntro:
        'Type your email. If the account exists, we will send you the instructions to create a new password.',
      olvidoEnviado:
        "Done. Check your email in a few minutes, and the spam folder too. If it doesn't arrive, tell a member of the team.",
      crearIntro:
        'Fill in your details. An administrator on the team will review your request before activating the account.',
      crearEnviada:
        'Request sent. You will be able to sign in once an administrator approves it.',
      claveCambiada: 'Your password was changed. You can sign in now.',
    },
    errores: {
      entrar: {
        credenciales: 'Wrong email or password.',
        pendiente: 'Your account is still waiting for approval.',
        rechazada: 'Your account was not approved.',
        bloqueada:
          'Too many failed attempts. Wait a few minutes and try again.',
        limite: 'Too many attempts from this network. Wait a few minutes.',
        invalido: 'Check that the email and the password are typed correctly.',
        fallo: 'Could not connect to the server. Try again later.',
      },
      simples: {
        limite: 'Too many requests from this network. Wait a few minutes.',
        fallo: 'Could not complete it. Try again later.',
      },
      escribeCorreoYClave: 'Type your email and your password.',
      escribeCorreo: 'Type your email.',
      correoInvalido: 'Type a valid email.',
      completaTodo: 'Fill in all the fields.',
      completaDos: 'Fill in both fields.',
      claveCorta: 'The password must have at least {{minimo}} characters.',
      noCoinciden: 'The passwords do not match.',
      crearConMensaje: 'Could not create the account: {{mensaje}}.',
      revisaDatos: 'Check the details you typed.',
      enlaceInvalido:
        'The link is not valid or has expired. Request a new one from "Forgot your password?".',
    },
  },
}
