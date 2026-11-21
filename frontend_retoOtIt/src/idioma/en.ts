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

  general: {
    cargando: 'Loading...',
    actualizar: 'Refresh',
    cargarMas: 'Load more',
    cancelar: 'Cancel',
    buscar: 'Search',
    reintentar: 'Retry',
    sinCorreo: 'No email',
    sinIp: 'No IP',
    noSePudoCargar: 'Could not load',
    ultimaLectura: 'Last reading {{hace}}',
    sinLecturas: 'No reading has arrived yet',
    campoNombre: 'Name:',
    campoCorreo: 'Email:',
    campoRol: 'Role:',
    roles: {
      administrador: 'administrator',
      usuario: 'user',
    },
  },
  tiempo: {
    segundos: '{{n}} s ago',
    minutos: '{{n}} min ago',
    horas: '{{n}} h ago',
    dias: '{{n}} d ago',
  },
  encabezado: {
    secciones: 'Sections',
    pestanas: {
      inicio: 'Home',
      cuentas: 'Accounts',
      bitacora: 'Log',
      datos: 'Data',
      estado: 'Status',
      gemelo: 'Digital twin',
      cuenta: 'My account',
    },
  },
  menu: {
    boton: "{{nombre}}'s menu",
    etiqueta: 'Account menu',
    miCuenta: 'My account',
    idioma: 'Language',
    cambiarIdioma: 'Language: {{actual}}. Switch to {{otro}}',
    ayuda: 'Help',
    cerrarSesion: 'Sign out',
    errorCerrar: 'Could not sign out. Try again.',
  },
  noEncontrada: {
    titulo: 'Page not found',
    texto: 'The address you opened does not exist in this panel.',
    volver: 'Go to the home page',
  },
  inicio: {
    titulo: 'Home',
    hola: 'Hello,',
    pendientes: {
      titulo: 'Pending accounts',
      algunas: 'They are waiting for you to approve or reject them',
      ninguna: 'Nobody is waiting for approval',
      accion: 'Review accounts',
    },
    servicios: {
      titulo: 'Services',
      todoResponde: 'Everything responds',
      conFalla: '{{n}} failing',
      detalle: 'Panel API and both databases',
      accion: 'View status',
    },
    llegada: {
      titulo: 'Data arrival',
      detalle: 'Readings from the IT agent',
      accion: 'View readings',
      estados: {
        al_dia: 'Up to date',
        retrasado: 'Delayed',
        sin_datos: 'No readings',
        desconocido: 'Could not tell',
      },
    },
    variables: {
      titulo: 'Watched variables',
      detalle: 'PLC variables with at least one reading',
      accion: 'View details',
    },
    eventos: {
      etiqueta: 'Latest events',
      titulo: 'Latest security events',
      verBitacora: 'View log',
      error: 'Could not load the events.',
      vacio: 'There are no events yet.',
    },
    sinDashboard: 'The dashboard with the PLC readings is not ready yet.',
  },
  estado: {
    titulo: 'System status',
    error: 'Could not check the status. Try again.',
    responde: 'Responding',
    noResponde: 'Not responding',
    api: {
      nombre: 'Panel API',
      detalle: 'Handles the requests from this page',
    },
    basePanel: {
      nombre: 'Panel database',
      detalle: 'Accounts, sessions and log',
    },
    baseLecturas: {
      nombre: 'Readings database',
      detalle: 'Readings sent by the IT agent',
    },
    llegada: {
      nombre: 'Data arrival',
      estados: {
        al_dia: 'Up to date',
        retrasado: 'Delayed',
        sin_datos: 'No readings yet',
        desconocido: 'Could not tell',
      },
    },
    sinVariables:
      'When the agent starts sending data to the cloud, each variable will appear here with the time of its last reading.',
    tabla: {
      titulo: 'Last reading per variable',
      plc: 'PLC',
      variable: 'Variable',
      lectura: 'Reading',
      llego: 'Arrived',
    },
    historial: {
      titulo: 'Availability history',
      subtitulo: 'Readings arriving in the cloud',
      periodo: 'Period',
      ventanas: {
        '24h': 'Last 24 h',
        '7d': 'Last 7 days',
      },
      cargando: 'Loading the history...',
      error: 'Could not load the history.',
      sinHistoria:
        'There are no readings yet to calculate availability. It will appear once the agent starts sending data.',
      porcentaje: 'Availability',
      interrupciones: 'Interruptions',
      mayorCorte: 'Longest gap',
      ninguna: 'None',
      inicioEje: {
        '24h': '24 h ago',
        '7d': '7 days ago',
      },
      ahora: 'Now',
      grafica:
        'Availability. {{periodo}}: {{porcentaje}} %, {{interrupciones}}.',
      sinPorcentaje:
        'Availability. {{periodo}}: there are no readings to calculate it yet.',
      interrupciones_one: '{{count}} interruption',
      interrupciones_other: '{{count}} interruptions',
      lecturas_one: '{{count}} reading',
      lecturas_other: '{{count}} readings',
      leyenda: {
        con_datos: 'Readings arrived',
        sin_datos: 'No readings',
        sin_historial: 'Before the first reading',
        en_curso: 'Current slot',
      },
      cortes: {
        titulo: 'Recent interruptions',
        ninguno: 'There were no interruptions in this period.',
        enCurso: 'Ongoing',
        desdeHasta: '{{desde}} to {{hasta}}',
        duro: 'Duration: {{tiempo}}',
      },
      nota: 'Each bar is a {{tramo}} slot. It counts as available if at least one reading arrived in that slot. It measures data arriving in the cloud, not whether the server was up.',
    },
  },
  cuentas: {
    titulo: 'Accounts',
    filtros: {
      pendiente: 'Pending',
      aprobado: 'Approved',
      rechazado: 'Rejected',
      todas: 'All',
    },
    vacio: {
      pendiente: 'There are no pending accounts.',
      aprobado: 'There are no approved accounts.',
      rechazado: 'There are no rejected accounts.',
      todas: 'There are no accounts.',
    },
    estados: {
      pendiente: 'Pending',
      aprobado: 'Approved',
      rechazado: 'Rejected',
    },
    errores: {
      no_existe: 'The account no longer exists.',
      no_permitido: 'That account cannot be changed from the panel.',
      sin_cambio: 'The account already had that status.',
      fallo: 'Could not complete it. Try again.',
    },
    buscar: 'Search by name',
    errorLista: 'Could not load the list. Try again.',
    total_one: '{{count}} account',
    total_other: '{{count}} accounts',
    encontradas: '{{visibles}} of {{total}} accounts with “{{texto}}”',
    nadie: 'Nobody matches “{{texto}}”.',
    bloqueada: 'Locked',
    solicitada: 'Requested on {{fecha}}',
    administrador: 'Administrator',
    confirmarAntes: 'Give administrator access to',
    confirmarDespues: '? It cannot be undone from the panel.',
    acciones: {
      aprobar: 'Approve',
      rechazar: 'Reject',
      desactivar: 'Deactivate',
      reactivar: 'Reactivate',
      desbloquear: 'Unlock',
      hacerAdmin: 'Make administrator',
      siHacerAdmin: 'Yes, make administrator',
    },
    accionesPara: {
      aprobar: 'Approve {{nombre}}',
      rechazar: 'Reject {{nombre}}',
      desactivar: 'Deactivate {{nombre}}',
      reactivar: 'Reactivate {{nombre}}',
      desbloquear: 'Unlock {{nombre}}',
      hacerAdmin: 'Make {{nombre}} an administrator',
    },
    avisos: {
      aprobada: 'Account approved: {{nombre}}.',
      reactivada: 'Account reactivated: {{nombre}}.',
      desactivada: 'Account deactivated: {{nombre}}.',
      rechazada: 'Account rejected: {{nombre}}.',
      desbloqueada: 'Account unlocked: {{nombre}}.',
      ahoraAdmin: '{{nombre}} is now an administrator.',
    },
  },
  bitacora: {
    titulo: 'Security log',
    filtros: {
      todos: 'All',
      alertas: 'Alerts',
    },
    descargar: 'Download CSV',
    descargando: 'Downloading...',
    descargado: 'File downloaded.',
    descargadoTruncado:
      'File downloaded. It only includes the 5000 most recent events.',
    errorDescarga: 'Could not download the file. Try again.',
    errorCarga: 'Could not load the log. Try again.',
    errorMas: 'Could not load more events. Try again.',
    vacioAlertas: 'There are no alerts recorded.',
    vacio: 'There are no events recorded yet.',
    region: 'Log events',
    columnas: {
      evento: 'Event',
      cuenta: 'Account',
      ip: 'IP',
      fecha: 'Date and time',
    },
    alerta: 'Alert',
  },
  eventos: {
    por: '{{texto}} by {{actor}}',
    tipos: {
      entrada_correcta: 'Signed in',
      entrada_fallida: 'Sign-in attempt with wrong details',
      entrada_bloqueada: 'Sign-in attempt with the account locked',
      cuenta_bloqueada: 'Account locked after too many attempts',
      entrada_pendiente: 'Tried to sign in with an account pending approval',
      entrada_rechazada: 'Tried to sign in with a rejected account',
      cuenta_solicitada: 'Requested a new account',
      solicitud_repetida:
        'Requested an account with an email that already exists',
      reinicio_solicitado: 'Asked to change their password',
      reinicio_fallido: 'Used an invalid or expired recovery link',
      contrasena_restablecida: 'Changed their password with the emailed link',
      sesion_cerrada: 'Signed out',
      cuenta_aprobada: 'Account approved',
      cuenta_rechazada: 'Account rejected',
      cuenta_desbloqueada: 'Account unlocked',
      rol_cambiado: 'Account promoted to administrator',
      contrasena_cambiada: 'Changed their password from My account',
      cambio_contrasena_fallido:
        'Tried to change their password with the wrong current one',
      bitacora_exportada: 'Downloaded the log as CSV',
      datos_cuentas_consultadas: 'Viewed the accounts table in Data',
      datos_bitacora_consultada: 'Viewed the log table in Data',
    },
  },
  datos: {
    titulo: 'Data',
    aviso:
      'Read only. Every time you open or search a table it is noted in the security log.',
    errorTablas: 'Could not load the list of tables. Try again.',
    etiquetaTabla: 'Table',
    tablas: {
      cuentas: 'Accounts',
      bitacora: 'Log',
    },
    buscarEnTabla: 'Search the table',
    pistas: {
      cuentas: 'Search by name or email',
      bitacora: 'Search by type, email or IP',
    },
    errorTabla: 'Could not load the table. Try again.',
    errorMas: 'Could not load more rows. Try again.',
    sinFilas: 'The table has no rows.',
    ningunaCoincide: 'No row matches “{{texto}}”.',
    filas_one: '{{count}} row',
    filas_other: '{{count}} rows',
    hayMas: ' (there are more)',
    con: ' with “{{texto}}”',
    orden: ', from newest to oldest.',
    region: '{{nombre}} table',
    si: 'yes',
    no: 'no',
  },
  miCuenta: {
    titulo: 'My account',
    tusDatos: 'Your details',
    cambiar: 'Change password',
    guardando: 'Saving...',
    mostrar: 'Show passwords',
    campos: {
      actual: 'Current password',
      nueva: 'New password',
      repetida: 'Repeat the new password',
    },
    pistas: {
      minimo: 'At least {{minimo}} characters',
      repite: 'Type it again',
    },
    errores: {
      actual_incorrecta: 'The current password is not correct.',
      bloqueada: 'Too many failed attempts. Wait a few minutes and try again.',
      limite: 'Too many requests from this network. Wait a few minutes.',
      invalido: 'Check the passwords and try again.',
      fallo: 'Could not complete it. Try again later.',
      completa: 'Fill in the three fields.',
      largo:
        'The new password must have between {{minimo}} and {{maximo}} characters.',
      noCoincide: 'The new password does not match.',
      igual: 'The new password must be different from the current one.',
    },
    exito: 'Your password was changed. We closed your other sessions.',
    sesion: {
      titulo: 'How your session is protected',
      inactividad: 'It closes by itself after 30 minutes without use.',
      maximo: 'It lasts 8 hours at most, even if you keep using it.',
      bloqueo: 'After 3 failed attempts the account is locked for 15 minutes.',
      otras: 'When you change your password, your other sessions are closed.',
    },
  },
  ayuda: {
    titulo: 'Help',
    pestanasTitulo: 'What is in each tab',
    pestanas: {
      inicio: 'Your greeting and your role.',
      cuentas:
        'Approve or reject requests, deactivate, reactivate, unlock and make administrator.',
      bitacora:
        'Sign-ins, lockouts and role changes. It can be downloaded as CSV.',
      datos: 'The accounts and log tables, read only. Every query is noted.',
      estado:
        'Whether the API, the databases and the data arrival are up to date.',
      gemelo:
        'The 3D sorting cell. It follows the readings as they arrive or runs a simulation.',
      cuenta: 'Your details and changing your password.',
    },
    preguntasTitulo: 'Frequently asked questions',
    preguntas: {
      bloqueo: {
        pregunta: 'My account got locked',
        respuesta:
          'After 3 wrong passwords in a row the account is locked for 15 minutes. After that you can try again, or you can ask an administrator to unlock it.',
      },
      olvido: {
        pregunta: 'I forgot my password',
        respuesta:
          'In “Sign in to the panel” press “Forgot your password?”, type your email and you will receive a link that works for 10 minutes.',
      },
      sesion: {
        pregunta: 'My session closed by itself',
        respuesta:
          'The session closes after 30 minutes without using the panel and, in any case, after 8 hours. You only have to sign in again.',
      },
    },
  },
}
