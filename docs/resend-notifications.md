# Configurar Resend para notificaciones

La app usa Resend para emails de notificaciones. El entorno productivo está en Railway → proyecto **Mind** → **production** → servicio `mind-epical-web` (`https://mind.epical.digital`). Variables necesarias:

| Variable | Valor |
| --- | --- |
| `RESEND_API_KEY` | Clave de producción limitada a permisos de envío y al dominio verificado `epical.digital`. Guardarla como variable sensible. |
| `RESEND_FROM_EMAIL` | Configurada como `Mind <notificaciones@epical.digital>`; Resend informa `epical.digital` verificado. |
| `APP_URL` | Ya está configurada en producción. Se usa para los enlaces de los emails. |

No guardes la API key en el repositorio ni en archivos `.env` versionados. Cada persona activa **Email** desde el menú de la campana y puede elegir categorías. La vista privada viene activada para que los asuntos y cuerpos de los correos no muestren detalles sensibles en la bandeja de entrada.

Los emails se guardan en una cola persistente junto con la notificación. Los fallos de red, HTTP 429 y respuestas 5xx se reintentan hasta seis veces (desde 15 segundos hasta 3 horas); los errores definitivos quedan en estado `failed`. El proceso recupera automáticamente envíos que hayan quedado bloqueados por una caída.

La clave anterior con acceso completo fue revocada después de activar la clave restringida. Los cambios recientes de UX y las migraciones `0081`–`0082` se deben incluir en el despliegue para que aparezcan en producción.

La migración `0077` prepara las preferencias existentes. La migración `0080` vuelve a mostrar la configuración a quienes tienen escritorio y email apagados. Las cuentas nuevas eligen al menos un canal en el primer ingreso para continuar; el permiso de escritorio siempre se pide después de una acción explícita en el navegador.

Los avisos de escritorio usan Web Push: cada navegador registra este dispositivo con un service worker y el servidor los puede entregar aunque Mind esté cerrado. La persona da permiso desde el botón **Activar**; la suscripción se asocia a su cuenta y se puede retirar desde Preferencias. El modo privado también oculta título y contenido del aviso. Para producción, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` se guardan como variables sensibles del servicio. La clave pública se entrega al navegador mediante un endpoint autenticado; la privada queda solo en el servidor. La migración `0082` crea la tabla de dispositivos. La bandeja in-app conserva el historial, filtros, agrupación, marcado de lectura y paginación.

Un administrador puede revisar contadores y los últimos envíos pendientes o fallidos con `GET /api/admin/notification-email-deliveries`. Los correos fallidos se pueden reencolar con `POST /api/admin/notification-email-deliveries/:id/retry`. Ambos endpoints requieren autenticación de administrador.
