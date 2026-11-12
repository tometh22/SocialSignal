# Notificaciones y correo

La configuración productiva se administra en Railway → proyecto **Mind** → **production** → servicio `mind-epical-web` (`https://mind.epical.digital`). Nunca guardar claves en el repositorio.

## Proveedor compartido

Notificaciones, CRM, ajustes IPC y propuestas usan `server/services/email-transport.ts`. Por defecto se elige Resend si existe `RESEND_API_KEY`; sin esa clave se conserva compatibilidad con SendGrid. `MAIL_PROVIDER=resend|sendgrid` fija explícitamente el proveedor. La selección es única para todos los flujos y no cambia automáticamente de proveedor ante un fallo.

| Variable | Uso |
| --- | --- |
| `RESEND_API_KEY` | Clave de envío restringida al dominio verificado. |
| `RESEND_FROM_EMAIL` | Remitente verificado; configuración existente: `Mind <notificaciones@epical.digital>`. |
| `APP_URL` o `PUBLIC_APP_URL` | Origen HTTPS público para enlaces y marca del correo. |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | Alternativa cuando se elige SendGrid. |
| `RESEND_WEBHOOK_SECRET` | Secreto de firma del webhook de Resend, independiente de la API key. |
| `SENDGRID_WEBHOOK_PUBLIC_KEY` | Clave pública de verificación del webhook de SendGrid (base64 DER o PEM). |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push; la clave privada queda en el servidor. |

Las propuestas y correos manuales conservan sus aprobaciones y confirmación explícita. Las preferencias personales de notificaciones no modifican esos envíos comerciales.

## Invitaciones y recuperación de acceso

Crear una cuenta desde **Administración → Usuarios** envía automáticamente una invitación al email de esa persona. El administrador define sus permisos y no necesita asignar ni compartir una contraseña. El alta de la cuenta y el enlace se guardan juntos; hasta que la persona configure su contraseña, la cuenta tiene una clave aleatoria desconocida.

La invitación vence en 48 horas y se usa una sola vez. Usuarios muestra si está pendiente, aceptada, vencida o si no se confirmó el envío; **Enviar acceso / Reenviar** permite invitar a las cuentas existentes o reemplazar un enlace. Cada nuevo enlace invalida la invitación anterior y hay un minuto de espera entre intentos. Reenviar a una cuenta existente mantiene su contraseña actual hasta que la persona configure otra.

Desde el login, **¿Olvidaste tu contraseña?** envía un enlace válido por una hora. La respuesta pública es igual para direcciones desconocidas, cuentas inactivas y solicitudes recientes. Hay límites por IP y por cuenta. Estos correos de acceso usan el transporte compartido y se envían independientemente de las preferencias de notificaciones.

La migración 0097 agrega `account_access_links`, excluida del catálogo MCP. Solo persiste hashes SHA-256: el token viaja en el fragmento del enlace para no aparecer en logs HTTP ni encabezados Referer. Validar el enlace no lo consume, lo que permite abrirlo desde un escáner de correo. Al guardar la contraseña, se consume con bloqueo transaccional, se invalidan los demás enlaces y se eliminan las sesiones anteriores. Cambiar el email o la contraseña desde administración, o desactivar la cuenta, también invalida sus enlaces y sesiones.

Un error del proveedor conserva el usuario y se informa como envío no confirmado, sin fingir que falló el alta. Si el proceso se interrumpe entre el alta y el envío, el estado pendiente sin confirmación queda visible en administración para reenviarlo. No se reintentan automáticamente los enlaces: el reenvío explícito genera uno nuevo. Ningún enlace ni contraseña se incluye en las respuestas administrativas o logs.

## Destinatarios y permisos

La política común está en `server/services/notification-access.ts`. Se comprueba al crear el aviso, al consultar la bandeja —incluidas las consultas de MCP— y antes de cada intento de email o push. Ser administrador no agrega automáticamente a una persona a los destinatarios.

| Tipo | Relevancia y acceso exigidos |
| --- | --- |
| Respuesta en Mind | Participación previa en ese hilo, permiso `status` y membresía vigente en la sala no archivada. |
| Daily | Membresía de la sala y permiso `status`; se excluye a quien la completó. |
| Asignación de tarea | Nueva persona responsable o colaboradora, permiso de tareas y acceso vigente al proyecto. |
| Respuesta de tarea | Responsable, colaboradores y participantes previos, con acceso vigente al proyecto y al módulo. |
| CRM | Creador del recordatorio o responsable del lead, con permiso `crm`. |
| Cotización | Acceso a cotizaciones y capacidad real de aprobación; se excluye al solicitante. La revisión debe seguir pendiente y ser la vigente. |
| Ausencias | Operaciones recibe solicitudes/cancelaciones; la persona titular recibe los avisos y decisiones sobre su ausencia. |
| Liquidaciones | La audiencia es la persona titular, Operaciones o Finanzas según el paso y la pantalla de destino. |

No se crean avisos para cuentas inactivas ni tipos desconocidos. Una pérdida de acceso oculta el aviso y cancela los envíos pendientes al procesarlos. Las preferencias de categorías también se muestran según los accesos disponibles.

## Frecuencia, privacidad y dispositivos

El primer ingreso permite **Configurar después** y continuar solo con la bandeja. No exige activar email o escritorio.

Por defecto, las nuevas preferencias agrupan los mails de conversaciones y dailies en un resumen diario a las 09:00 de Buenos Aires. Cada persona puede elegir envío inmediato, resumen o apagar esos mails, cambiar la hora/zona y establecer un horario silencioso. Asignaciones, aprobaciones y recordatorios se envían en el momento, respetando el horario silencioso y los canales elegidos. La programación usa instantes con zona horaria y contempla cambios de día y horario de verano.

El horario silencioso demora email y push; no oculta la bandeja. Los avisos ya leídos, los hilos silenciados y los accesos revocados se excluyen al entregar. Apagar un canal o categoría, o silenciar un hilo, cancela su trabajo pendiente: reactivarlo no dispara ese backlog. La nueva frecuencia y hora de resumen se aplican al crear los siguientes avisos; el horario silencioso se vuelve a comprobar al entregar.

La vista privada oculta detalles en el asunto, cuerpo y push. Los correos incluyen un enlace a Preferencias. Las respuestas tienen enlaces al tema y comentario concreto; el agrupado usa la identidad del hilo y la distancia entre eventos.

La preferencia de escritorio es global; la conexión se comprueba por navegador. Se puede conectar o desconectar el navegador actual y revocar otros dispositivos. El logout elimina la suscripción de ese navegador mediante una cookie HttpOnly y cierra avisos ya mostrados. Iniciar otra cuenta también revoca la vinculación anterior. El service worker comprueba la cuenta vigente antes de mostrar un push personal que haya quedado en tránsito.

La migración nueva retira suscripciones antiguas que no tienen vinculación revocable por cookie. Esas personas deben conectar el navegador una vez después del despliegue; la interfaz muestra el estado real.

## Persistencia y recuperación

Comentarios, dailies, asignaciones, solicitudes/decisiones de ausencias y cambios/publicaciones de liquidaciones guardan el aviso y sus colas en la misma transacción de la acción. Los pedidos de aprobación de cotizaciones pendientes se reconcilian cada minuto para recuperar un fallo entre su commit y el encolado. Los recordatorios CRM conservan el marcador de éxito solo después de persistir el aviso y se ejecutan aunque se desactive la sincronización financiera.

Email y push tienen colas persistentes, reclamo exclusivo con `FOR UPDATE SKIP LOCKED`, recuperación de trabajo abandonado después de cinco minutos y hasta seis reintentos transitorios. Los push vencidos o leídos se cancelan; las suscripciones que devuelven 404/410 se retiran. Un servidor sin configuración de correo conserva el trabajo pendiente.

Cada resumen congela su contenido en el primer intento y reutiliza la misma clave de idempotencia. Si cambian el destinatario, el acceso o la privacidad durante un reintento, se cancela ese contenido anterior. El historial continúa disponible en la aplicación.

El transporte compartido conserva un registro de aceptación. Repetir una solicitud ya aceptada devuelve el resultado guardado. Los reintentos de contenido distinto con la misma clave se rechazan. Una entrega incierta de SendGrid requiere revisión; no se reenvía automáticamente. Los reintentos de Resend que superan 23 horas desde el primer intento también requieren revisión, para no superar su [ventana de idempotencia de 24 horas](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Confirmaciones de entrega

Configurar el webhook del proveedor elegido para distinguir aceptación de entrega:

- **Resend:** `POST https://mind.epical.digital/api/webhooks/resend`, con `RESEND_WEBHOOK_SECRET`. Seleccionar `email.sent`, `email.delivery_delayed`, `email.delivered`, `email.failed`, `email.bounced`, `email.complained` y `email.suppressed`.
- **SendGrid:** `POST https://mind.epical.digital/api/webhooks/sendgrid`, habilitando firma y guardando su clave pública en `SENDGRID_WEBHOOK_PUBLIC_KEY`. Seleccionar processed, deferred, delivered, bounce, dropped y spamreport.

Se verifican las firmas sobre los bytes originales y la antigüedad del timestamp antes de guardar eventos. Los eventos se deduplican y los estados terminales prevalecen aunque lleguen fuera de orden. También se concilian eventos recibidos antes de guardar la respuesta de envío. Rebotes, quejas y supresiones impiden nuevos mails automáticos a esa dirección; Administración debe corregirla y revisar el bloqueo en el proveedor.

Las verificaciones siguen la documentación de [Svix](https://docs.svix.com/receiving/verifying-payloads/how-manual), [eventos de Resend](https://resend.com/docs/webhooks/event-types) y [firmas de SendGrid](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/getting-started-event-webhook-security-features).

## Administración y validación

Administradores pueden consultar **Estado de los envíos** en Notificaciones: configuración, pendientes/fallos, entregas/rebotes, contadores push y últimos envíos del transporte comercial.

- `GET /api/admin/notification-email-deliveries`: métricas y últimos envíos que requieren atención.
- `POST /api/admin/notification-email-deliveries/:id/retry`: reencola un lote fallido con la misma identidad y contenido. Nunca reenvía uno aceptado.
- `POST /api/admin/notification-email-suppressions/release`, con `{ "email": "persona@dominio" }`: levanta el bloqueo local después de que Administración resuelva el rebote o la queja en el proveedor. También está disponible en los últimos envíos de la pantalla. No reenvía el backlog cancelado.

`sent` en la cola significa aceptado por el proveedor. `delivery_status=delivered` confirma llegada al servidor del destinatario; no acredita lectura. Sin webhook configurado se muestra aceptación, sin inventar confirmación de entrega.

Pruebas locales con PostgreSQL aislado y proveedores simulados:

```sh
NOTIFICATION_TEST_DATABASE_URL=postgresql://localhost/postgres npx vitest run tests/notification-policy.test.ts tests/notification-system.integration.test.ts tests/notification-service-worker.test.ts --maxWorkers=1
```

La suite exige una base local, crea un esquema propio y lo elimina al terminar. No envía emails ni push reales. El despliegue debe aplicar `0093 notification relevance and reliable delivery` y configurar el webhook en el proveedor; los cambios de código por sí solos no habilitan esa configuración externa.
