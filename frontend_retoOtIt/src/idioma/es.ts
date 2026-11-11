export const es = {
  comun: {
    marca: 'Panel Reto OT-IT',
  },
  tema: {
    cambiarAClaro: 'Cambiar a modo claro',
    cambiarAOscuro: 'Cambiar a modo oscuro',
  },
  idioma: {
    etiqueta: 'Idioma',
    es: 'Español',
    en: 'English',
  },
  camino: {
    etiqueta:
      'Camino de los datos: de la zona OT a la IDMZ, luego a la zona IT y por último a la nube',
    zonas: {
      ot: { nombre: 'OT', descripcion: 'Planta y PLC' },
      idmz: { nombre: 'IDMZ', descripcion: 'Zona intermedia' },
      it: { nombre: 'IT', descripcion: 'Red de oficina' },
      nube: { nombre: 'Nube', descripcion: 'Servidor en AWS' },
    },
  },
  landing: {
    crearCuenta: 'Crear cuenta',
    iniciarSesion: 'Iniciar sesión',
    titulo: 'Tus datos de planta, seguros hasta la nube',
    intro:
      'Un panel para vigilar el camino que sigue la información desde los PLC hasta el servidor, pasando por cada zona de la red.',
    funciones: {
      cuentas: {
        titulo: 'Cuentas con aprobación',
        texto: 'Quien pide acceso espera a que un administrador lo apruebe.',
      },
      bitacora: {
        titulo: 'Bitácora de seguridad',
        texto: 'Cada acceso, bloqueo y cambio de rol queda registrado.',
      },
      estado: {
        titulo: 'Estado del sistema',
        texto:
          'Revisa si la API, las bases de datos y la llegada de datos están al día.',
      },
    },
  },
  login: {
    irAlInicio: 'Panel Reto OT-IT, ir al inicio',
    encabezados: {
      login: {
        titulo: 'Entrar al panel',
        subtitulo:
          'Supervisa la comunicación segura entre la planta y la nube.',
      },
      olvido: {
        titulo: 'Recuperar contraseña',
        subtitulo: 'Te ayudamos a volver a entrar.',
      },
      crear: {
        titulo: 'Crear cuenta',
        subtitulo: 'Solicita acceso al panel del reto.',
      },
      restablecer: {
        titulo: 'Contraseña nueva',
        subtitulo: 'Escribe la contraseña nueva de tu cuenta.',
      },
    },
    formularios: {
      iniciarSesion: 'Iniciar sesión',
      recuperar: 'Recuperar contraseña',
      crear: 'Crear cuenta',
      restablecer: 'Restablecer contraseña',
    },
    campos: {
      correo: 'Correo',
      clave: 'Contraseña',
      claveNueva: 'Contraseña nueva',
      repiteClave: 'Repite la contraseña',
      repiteClaveNueva: 'Repite la contraseña nueva',
      nombre: 'Nombre completo',
    },
    pistas: {
      correo: 'correo@ejemplo.com',
      tuClave: 'Tu contraseña',
      nombre: 'Nombre y apellido',
      minimo: 'Mínimo {{minimo}} caracteres',
      repite: 'Escríbela otra vez',
    },
    acciones: {
      mostrarClave: 'Mostrar contraseña',
      ocultarClave: 'Ocultar contraseña',
      iniciarSesion: 'Iniciar sesión',
      verificando: 'Verificando...',
      olvidaste: '¿Olvidaste tu contraseña?',
      sinCuenta: '¿Aún no tienes cuenta?',
      crearCuenta: 'Crear cuenta',
      enviarInstrucciones: 'Enviar instrucciones',
      volverALogin: 'Volver a iniciar sesión',
      enviarSolicitud: 'Enviar solicitud',
      yaTengoCuenta: 'Ya tengo cuenta, volver a iniciar sesión',
      cambiarClave: 'Cambiar contraseña',
      irALogin: 'Ir a iniciar sesión',
    },
    avisos: {
      bloqMayus: 'Bloq Mayús está activado',
      olvidoIntro:
        'Escribe tu correo. Si la cuenta existe, te enviaremos las instrucciones para crear una contraseña nueva.',
      olvidoEnviado:
        'Listo. Revisa tu correo en unos minutos, también la carpeta de spam. Si no llega, avisa a un integrante del equipo.',
      crearIntro:
        'Llena tus datos. Un administrador del equipo revisará tu solicitud antes de activar la cuenta.',
      crearEnviada:
        'Solicitud enviada. Podrás entrar cuando un administrador la apruebe.',
      claveCambiada: 'Tu contraseña se cambió. Ya puedes iniciar sesión.',
    },
    errores: {
      entrar: {
        credenciales: 'Correo o contraseña incorrectos.',
        pendiente: 'Tu cuenta todavía está pendiente de aprobación.',
        rechazada: 'Tu cuenta no fue aprobada.',
        bloqueada:
          'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
        limite: 'Demasiados intentos desde esta red. Espera unos minutos.',
        invalido: 'Revisa que el correo y la contraseña estén bien escritos.',
        fallo: 'No se pudo conectar con el servidor. Inténtalo más tarde.',
      },
      simples: {
        limite: 'Demasiadas peticiones desde esta red. Espera unos minutos.',
        fallo: 'No se pudo completar. Inténtalo más tarde.',
      },
      escribeCorreoYClave: 'Escribe tu correo y tu contraseña.',
      escribeCorreo: 'Escribe tu correo.',
      correoInvalido: 'Escribe un correo válido.',
      completaTodo: 'Completa todos los campos.',
      completaDos: 'Completa los dos campos.',
      claveCorta: 'La contraseña debe tener al menos {{minimo}} caracteres.',
      noCoinciden: 'Las contraseñas no coinciden.',
      crearConMensaje: 'No se pudo crear la cuenta: {{mensaje}}.',
      revisaDatos: 'Revisa los datos que escribiste.',
      enlaceInvalido:
        'El enlace no es válido o ya caducó. Pide uno nuevo desde "¿Olvidaste tu contraseña?".',
    },
  },
}
