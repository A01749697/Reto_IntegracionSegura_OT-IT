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

  general: {
    cargando: 'Cargando...',
    actualizar: 'Actualizar',
    cargarMas: 'Cargar más',
    cancelar: 'Cancelar',
    buscar: 'Buscar',
    reintentar: 'Reintentar',
    sinCorreo: 'Sin correo',
    sinIp: 'Sin IP',
    noSePudoCargar: 'No se pudo cargar',
    ultimaLectura: 'Última lectura {{hace}}',
    sinLecturas: 'Aún no llega ninguna lectura',
    campoNombre: 'Nombre:',
    campoCorreo: 'Correo:',
    campoRol: 'Rol:',
    roles: {
      administrador: 'administrador',
      usuario: 'usuario',
    },
  },
  tiempo: {
    segundos: 'hace {{n}} s',
    minutos: 'hace {{n}} min',
    horas: 'hace {{n}} h',
    dias: 'hace {{n}} d',
  },
  encabezado: {
    secciones: 'Secciones',
    pestanas: {
      inicio: 'Inicio',
      cuentas: 'Cuentas',
      bitacora: 'Bitácora',
      datos: 'Datos',
      estado: 'Estado',
      gemelo: 'Gemelo',
      cuenta: 'Mi cuenta',
    },
  },
  menu: {
    boton: 'Menú de {{nombre}}',
    etiqueta: 'Menú de la cuenta',
    miCuenta: 'Mi cuenta',
    idioma: 'Idioma',
    cambiarIdioma: 'Idioma: {{actual}}. Cambiar a {{otro}}',
    ayuda: 'Ayuda',
    cerrarSesion: 'Cerrar sesión',
    errorCerrar: 'No se pudo cerrar la sesión. Inténtalo otra vez.',
  },
  noEncontrada: {
    titulo: 'Página no encontrada',
    texto: 'La dirección que abriste no existe en este panel.',
    volver: 'Ir al inicio',
  },
  inicio: {
    titulo: 'Inicio',
    hola: 'Hola,',
    pendientes: {
      titulo: 'Cuentas pendientes',
      algunas: 'Esperan que las apruebes o las rechaces',
      ninguna: 'Nadie espera aprobación',
      accion: 'Revisar cuentas',
    },
    servicios: {
      titulo: 'Servicios',
      todoResponde: 'Todo responde',
      conFalla: '{{n}} con falla',
      detalle: 'API del panel y las dos bases de datos',
      accion: 'Ver estado',
    },
    llegada: {
      titulo: 'Llegada de datos',
      detalle: 'Lecturas del agente IT',
      accion: 'Ver lecturas',
      estados: {
        al_dia: 'Al día',
        retrasado: 'Retrasado',
        sin_datos: 'Sin lecturas',
        desconocido: 'No se pudo saber',
      },
    },
    variables: {
      titulo: 'Variables vigiladas',
      detalle: 'Variables de PLC con al menos una lectura',
      accion: 'Ver detalle',
    },
    eventos: {
      etiqueta: 'Últimos eventos',
      titulo: 'Últimos eventos de seguridad',
      verBitacora: 'Ver bitácora',
      error: 'No se pudieron cargar los eventos.',
      vacio: 'Todavía no hay eventos.',
    },
    sinDashboard: 'Todavía no está el dashboard con las lecturas de los PLC.',
  },
  estado: {
    titulo: 'Estado del sistema',
    error: 'No se pudo consultar el estado. Inténtalo otra vez.',
    responde: 'Responde',
    noResponde: 'No responde',
    api: {
      nombre: 'API del panel',
      detalle: 'Atiende las peticiones de esta página',
    },
    basePanel: {
      nombre: 'Base de datos del panel',
      detalle: 'Cuentas, sesiones y bitácora',
    },
    baseLecturas: {
      nombre: 'Base de datos de lecturas',
      detalle: 'Lecturas que manda el agente IT',
    },
    llegada: {
      nombre: 'Llegada de datos',
      estados: {
        al_dia: 'Al día',
        retrasado: 'Retrasado',
        sin_datos: 'Sin lecturas todavía',
        desconocido: 'No se pudo saber',
      },
    },
    sinVariables:
      'Cuando el agente empiece a mandar datos a la nube, aquí aparecerá cada variable con la hora de su última lectura.',
    tabla: {
      titulo: 'Última lectura por variable',
      plc: 'PLC',
      variable: 'Variable',
      lectura: 'Lectura',
      llego: 'Llegó',
    },
    historial: {
      titulo: 'Historial de disponibilidad',
      subtitulo: 'Llegada de lecturas a la nube',
      periodo: 'Periodo',
      ventanas: {
        '24h': 'Últimas 24 h',
        '7d': 'Últimos 7 días',
      },
      cargando: 'Cargando el historial...',
      error: 'No se pudo cargar el historial.',
      sinHistoria:
        'Todavía no hay lecturas para calcular la disponibilidad. Aparecerá cuando el agente empiece a mandar datos.',
      porcentaje: 'Disponibilidad',
      interrupciones: 'Interrupciones',
      mayorCorte: 'Mayor corte',
      ninguna: 'Ninguna',
      inicioEje: {
        '24h': 'Hace 24 h',
        '7d': 'Hace 7 días',
      },
      ahora: 'Ahora',
      grafica:
        'Disponibilidad. {{periodo}}: {{porcentaje}} %, {{interrupciones}}.',
      sinPorcentaje:
        'Disponibilidad. {{periodo}}: todavía no hay lecturas para calcularla.',
      interrupciones_one: '{{count}} interrupción',
      interrupciones_other: '{{count}} interrupciones',
      lecturas_one: '{{count}} lectura',
      lecturas_other: '{{count}} lecturas',
      leyenda: {
        con_datos: 'Llegaron lecturas',
        sin_datos: 'Sin lecturas',
        sin_historial: 'Antes de la primera lectura',
        en_curso: 'Tramo en curso',
      },
      cortes: {
        titulo: 'Interrupciones recientes',
        ninguno: 'No hubo interrupciones en este periodo.',
        enCurso: 'En curso',
        desdeHasta: '{{desde}} a {{hasta}}',
        duro: 'Duración: {{tiempo}}',
      },
      nota: 'Cada barra es un tramo de {{tramo}}. Cuenta como disponible si llegó al menos una lectura en ese tramo. Mide la llegada de datos a la nube, no si el servidor estuvo encendido.',
    },
  },
  cuentas: {
    titulo: 'Cuentas',
    filtros: {
      pendiente: 'Pendientes',
      aprobado: 'Aprobadas',
      rechazado: 'Rechazadas',
      todas: 'Todas',
    },
    vacio: {
      pendiente: 'No hay cuentas pendientes.',
      aprobado: 'No hay cuentas aprobadas.',
      rechazado: 'No hay cuentas rechazadas.',
      todas: 'No hay cuentas.',
    },
    estados: {
      pendiente: 'Pendiente',
      aprobado: 'Aprobada',
      rechazado: 'Rechazada',
    },
    errores: {
      no_existe: 'La cuenta ya no existe.',
      no_permitido: 'Esa cuenta no se puede cambiar desde el panel.',
      sin_cambio: 'La cuenta ya tenía ese estado.',
      fallo: 'No se pudo completar. Inténtalo otra vez.',
    },
    buscar: 'Buscar por nombre',
    errorLista: 'No se pudo cargar la lista. Inténtalo otra vez.',
    total_one: '{{count}} cuenta',
    total_other: '{{count}} cuentas',
    encontradas: '{{visibles}} de {{total}} cuentas con «{{texto}}»',
    nadie: 'Nadie coincide con «{{texto}}».',
    bloqueada: 'Bloqueada',
    solicitada: 'Solicitada el {{fecha}}',
    administrador: 'Administrador',
    confirmarAntes: '¿Dar acceso de administrador a',
    confirmarDespues: '? Desde el panel no se puede deshacer.',
    acciones: {
      aprobar: 'Aprobar',
      rechazar: 'Rechazar',
      desactivar: 'Desactivar',
      reactivar: 'Reactivar',
      desbloquear: 'Desbloquear',
      hacerAdmin: 'Hacer administrador',
      siHacerAdmin: 'Sí, hacer administrador',
    },
    accionesPara: {
      aprobar: 'Aprobar a {{nombre}}',
      rechazar: 'Rechazar a {{nombre}}',
      desactivar: 'Desactivar a {{nombre}}',
      reactivar: 'Reactivar a {{nombre}}',
      desbloquear: 'Desbloquear a {{nombre}}',
      hacerAdmin: 'Hacer administrador a {{nombre}}',
    },
    avisos: {
      aprobada: 'Cuenta aprobada: {{nombre}}.',
      reactivada: 'Cuenta reactivada: {{nombre}}.',
      desactivada: 'Cuenta desactivada: {{nombre}}.',
      rechazada: 'Cuenta rechazada: {{nombre}}.',
      desbloqueada: 'Cuenta desbloqueada: {{nombre}}.',
      ahoraAdmin: '{{nombre}} ahora es administrador.',
    },
  },
  bitacora: {
    titulo: 'Bitácora de seguridad',
    filtros: {
      todos: 'Todo',
      alertas: 'Alertas',
    },
    descargar: 'Descargar CSV',
    descargando: 'Descargando...',
    descargado: 'Archivo descargado.',
    descargadoTruncado:
      'Archivo descargado. Solo incluye los 5000 eventos más recientes.',
    errorDescarga: 'No se pudo descargar el archivo. Inténtalo otra vez.',
    errorCarga: 'No se pudo cargar la bitácora. Inténtalo otra vez.',
    errorMas: 'No se pudieron cargar más eventos. Inténtalo otra vez.',
    vacioAlertas: 'No hay alertas registradas.',
    vacio: 'Todavía no hay eventos registrados.',
    region: 'Eventos de la bitácora',
    columnas: {
      evento: 'Evento',
      cuenta: 'Cuenta',
      ip: 'IP',
      fecha: 'Fecha y hora',
    },
    alerta: 'Alerta',
  },
  eventos: {
    por: '{{texto}} por {{actor}}',
    tipos: {
      entrada_correcta: 'Inició sesión',
      entrada_fallida: 'Intento de entrada con datos incorrectos',
      entrada_bloqueada: 'Intento de entrada con la cuenta bloqueada',
      cuenta_bloqueada: 'Cuenta bloqueada por demasiados intentos',
      entrada_pendiente:
        'Intentó entrar con una cuenta pendiente de aprobación',
      entrada_rechazada: 'Intentó entrar con una cuenta rechazada',
      cuenta_solicitada: 'Pidió una cuenta nueva',
      solicitud_repetida: 'Pidió una cuenta con un correo que ya existe',
      reinicio_solicitado: 'Pidió cambiar su contraseña',
      reinicio_fallido: 'Usó un enlace de recuperación inválido o caducado',
      contrasena_restablecida: 'Cambió su contraseña con el enlace del correo',
      sesion_cerrada: 'Cerró sesión',
      cuenta_aprobada: 'Cuenta aprobada',
      cuenta_rechazada: 'Cuenta rechazada',
      cuenta_desbloqueada: 'Cuenta desbloqueada',
      rol_cambiado: 'Cuenta promovida a administrador',
      contrasena_cambiada: 'Cambió su contraseña desde Mi cuenta',
      cambio_contrasena_fallido:
        'Intentó cambiar su contraseña con la actual incorrecta',
      bitacora_exportada: 'Descargó la bitácora en CSV',
      datos_cuentas_consultadas: 'Consultó la tabla de cuentas en Datos',
      datos_bitacora_consultada: 'Consultó la tabla de bitácora en Datos',
    },
  },
  datos: {
    titulo: 'Datos',
    aviso:
      'Solo lectura. Cada vez que abres o buscas en una tabla queda anotado en la bitácora de seguridad.',
    errorTablas: 'No se pudo cargar la lista de tablas. Inténtalo otra vez.',
    etiquetaTabla: 'Tabla',
    tablas: {
      cuentas: 'Cuentas',
      bitacora: 'Bitácora',
    },
    buscarEnTabla: 'Buscar en la tabla',
    pistas: {
      cuentas: 'Buscar por nombre o correo',
      bitacora: 'Buscar por tipo, correo o IP',
    },
    errorTabla: 'No se pudo cargar la tabla. Inténtalo otra vez.',
    errorMas: 'No se pudieron cargar más filas. Inténtalo otra vez.',
    sinFilas: 'La tabla no tiene filas.',
    ningunaCoincide: 'Ninguna fila coincide con «{{texto}}».',
    filas_one: '{{count}} fila',
    filas_other: '{{count}} filas',
    hayMas: ' (hay más)',
    con: ' con «{{texto}}»',
    orden: ', de la más nueva a la más vieja.',
    region: 'Tabla {{nombre}}',
    si: 'sí',
    no: 'no',
  },
  miCuenta: {
    titulo: 'Mi cuenta',
    tusDatos: 'Tus datos',
    cambiar: 'Cambiar contraseña',
    guardando: 'Guardando...',
    mostrar: 'Mostrar contraseñas',
    campos: {
      actual: 'Contraseña actual',
      nueva: 'Contraseña nueva',
      repetida: 'Repite la contraseña nueva',
    },
    pistas: {
      minimo: 'Mínimo {{minimo}} caracteres',
      repite: 'Escríbela otra vez',
    },
    errores: {
      actual_incorrecta: 'La contraseña actual no es correcta.',
      bloqueada:
        'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
      limite: 'Demasiadas peticiones desde esta red. Espera unos minutos.',
      invalido: 'Revisa las contraseñas e inténtalo otra vez.',
      fallo: 'No se pudo completar. Inténtalo más tarde.',
      completa: 'Completa los tres campos.',
      largo:
        'La contraseña nueva debe tener de {{minimo}} a {{maximo}} caracteres.',
      noCoincide: 'La contraseña nueva no coincide.',
      igual: 'La contraseña nueva debe ser distinta de la actual.',
    },
    exito: 'Tu contraseña se cambió. Cerramos tus otras sesiones.',
    sesion: {
      titulo: 'Cómo se cuida tu sesión',
      inactividad: 'Se cierra sola después de 30 minutos sin uso.',
      maximo: 'Dura 8 horas como máximo, aunque la sigas usando.',
      bloqueo: 'Tras 3 intentos fallidos la cuenta se bloquea 15 minutos.',
      otras: 'Al cambiar tu contraseña se cierran tus otras sesiones.',
    },
  },
  ayuda: {
    titulo: 'Ayuda',
    pestanasTitulo: 'Qué hay en cada pestaña',
    pestanas: {
      inicio: 'Tu saludo y tu rol.',
      cuentas:
        'Aprobar o rechazar solicitudes, desactivar, reactivar, desbloquear y hacer administrador.',
      bitacora:
        'Los accesos, bloqueos y cambios de rol. Se puede descargar en CSV.',
      datos:
        'Las tablas de cuentas y bitácora, solo para leer. Cada consulta queda anotada.',
      estado:
        'Si la API, las bases de datos y la llegada de datos están al día.',
      gemelo:
        'La celda clasificadora en 3D. Sigue las lecturas que llegan o corre una simulación.',
      cuenta: 'Tus datos y el cambio de tu contraseña.',
    },
    preguntasTitulo: 'Preguntas frecuentes',
    preguntas: {
      bloqueo: {
        pregunta: 'Mi cuenta se bloqueó',
        respuesta:
          'Después de 3 contraseñas incorrectas seguidas la cuenta se bloquea 15 minutos. Pasado ese tiempo puedes volver a intentar, o puedes pedirle a un administrador que la desbloquee.',
      },
      olvido: {
        pregunta: 'Olvidé mi contraseña',
        respuesta:
          'En «Entrar al panel» pulsa «¿Olvidaste tu contraseña?», escribe tu correo y recibirás un enlace que sirve 10 minutos.',
      },
      sesion: {
        pregunta: 'Mi sesión se cerró sola',
        respuesta:
          'La sesión se cierra después de 30 minutos sin usar el panel y, en todo caso, a las 8 horas. Solo hay que entrar de nuevo.',
      },
    },
  },
}
