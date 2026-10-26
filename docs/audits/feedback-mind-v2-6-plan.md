# Mapa y plan del feedback de Mind del 23 de octubre

Fecha de revisión: 26 de octubre de 2026.

El feedback contiene 11 observaciones accionables. La prioridad es restringir la información del equipo al alcance correcto y destrabar las cotizaciones ya aprobadas fuera de Mind. Después siguen la unificación de Status y Daily, el calendario personal y la navegación.

## Alcance y estado de referencia

- Fuente: [Feedback Mind V2-6](../../.context/attachments/wUNOjy/Feedback%20Mind%20V2-6.pdf), seis páginas, incluidas sus capturas y la actualización del pedido de aprobación.
- Producción consultada el 26 de octubre: commit `28044720`, versión 1.14.4, `/api/health` con estado `ok`. Esta comprobación identifica el código desplegado; no certifica los permisos efectivos de las cuentas de Vanu, Pau o Vicky.
- Rama de trabajo: `tometh22/excel-master-transici-n`, commit `824bccc8`. El [PR 313](https://github.com/tometh22/SocialSignal/pull/313), con cierre del equipo y transición financiera, sigue abierto como borrador. Su CI está aprobado, pero ese flujo todavía no está publicado.
- El mapa siguiente conserva el diagnóstico inicial. La implementación y su evidencia están en [Cierre del feedback del 23 de octubre](feedback-mind-23-10-implementation.md).

## Mapa al iniciar la implementación

P0 significa exposición de información o bloqueo de la operación. P1 significa integración o simplificación necesaria para el uso diario.

| ID | Página y área | Pedido recibido | Estado encontrado | Prioridad | Resultado requerido |
|---|---|---|---|---|---|
| F01 | 1 · Proyectos de tareas | PM y analistas ven y acceden únicamente a proyectos de los que son miembros; Ops ve todos. | Pendiente. `task_manager` recibe alcance global; además, el acceso actual admite asignaciones o colaboraciones aunque no exista membresía explícita. | P0 | Listado, detalle y acciones limitados por membresía; alcance global exclusivo de Ops y administración. |
| F02 | 1 · Kanban de proyectos | La misma restricción de proyectos en Kanban. | Pendiente. Comparte la consulta de proyectos y solicita `scope=all` para `isTeamManager`. | P0 | Mismo conjunto de proyectos que F01; filtros, contadores y cambios de etapa respetan ese alcance. |
| F03 | 2 · Carga de horas | Imputar siempre al responsable de la tarea, sin selector de otras personas; explicar el criterio. | Implementado en 1.14.4. La captura muestra el selector anterior. Falta comprobar el caso actual del equipo tras recargar. | P1 · validación | Responsable visible, sin selector; carga rápida, detalle y cronómetro atribuyen a la misma persona. |
| F04 | 2 y 3 · Calendario en Tareas | Aplicar el mismo desglose del calendario general al calendario personal de Tareas. | Pendiente. `TaskCalendarView` usa tres carriles y un popover de desborde; el calendario de equipo expande semanas y muestra más información. | P1 | Expandir y contraer la semana, ver todas las tareas y su detalle, con el alcance personal. |
| F05 | 3 y 4 · Calendario de equipo | Restringir la vista global a Ops; cada persona usa su calendario en Tareas. | Pendiente. La ruta permite los perfiles de tareas y la API usa el alcance de proyectos, que es global para `task_manager`. | P0 | Menú, ruta y API de calendario global exclusivos de Ops y administración; calendario personal independiente. |
| F06 | 4 · Panel de horas | Ops ve el equipo completo; cada persona ve solamente sus propias horas. | Pendiente. `getTaskAccessContext` trata a `task_manager` como Ops y el cliente muestra capacidad del equipo para `isTeamManager`. | P0 | Filtro de persona impuesto en servidor para no Ops; sin horas, estimaciones ni capacidad de terceros. |
| F07 | 4 y 5 · Objetivos | Retirar Objetivos de los perfiles no Ops hasta que el módulo esté listo y en uso. | Pendiente. El menú y la ruta dependen de `status`, no de Ops. | P1 | Objetivos disponible solo para Ops y administración; Status conserva su acceso propio. |
| F08 | 5 · Costos extra en cotizaciones | Incorporar costos ajenos al equipo, especialmente herramientas de IA. | Parcial. Existe `Costos de Herramientas (USD)` dentro de `Ajustar precio`; participa del cálculo, pero es difícil de encontrar y demasiado específico para el pedido. | P0 | Bloque visible de costos adicionales con ejemplos de IA, software y licencias; importes consistentes al guardar, reabrir y crear el proyecto. |
| F09 | 5 · Aprobación de cotizaciones | Simplificar las etapas y permitir cargar una cotización aprobada previamente sin enviarla otra vez al cliente. | Parcial. La 1.14.4 mejora el acceso a aprobación interna. La aprobación final sigue dependiendo de la decisión del cliente en el portal; el PATCH genérico rechaza `approved`. Falta registrar aceptación externa. | P0 | Selector de etapas con acciones válidas y registro de aprobación externa; aprobación final habilita crear el proyecto asociado. |
| F10 | 5 y 6 · Status y Daily | Unificar Estado actual y Daily; retirar Próximo paso y asegurar que lo escrito aparezca en ambos. | Pendiente. Estado actual usa `currentAction`; Daily publica updates separados y muestra los últimos dos del hilo. Si hay hilo, ese contexto no presenta necesariamente el Estado actual. | P1 | Un único Estado actual visible y editable en ambas vistas, con historial y actualización inmediata. |
| F11 | 6 · Mis facturas | Mostrar Mis facturas junto a Inicio y Mis ausencias; eliminar la sección Mi gestión. | Parcial. El módulo existe, pero `hideWhenTaskManagerOnly` oculta el enlace y `MyInvoicesRoute` rechaza ese perfil. El cierre ampliado está en el PR 313. | P1 | Acceso a facturas y liquidación propias para cada colaborador interno, con navegación simple y sin acceso a información de terceros. |

Los títulos **Inicio**, **Gestor de ausencias** y **Configuración** aparecen sin observaciones adicionales. No agregan tres requerimientos nuevos. El pedido de navegación de facturas está registrado en F11.

## Causas y decisiones de implementación

### Permisos por proyecto y datos personales

`task_manager` significa actualmente más que gestión de tareas sin costos: también concede alcance global en `getTaskAccessContext`, en el listado de proyectos y en el lector MCP. Esa equivalencia explica la exposición reportada, aunque aún hay que revisar los permisos efectivos y las membresías de las cuentas mencionadas.

La política propuesta separa las facultades de editar tareas, administrar un proyecto y consultar todo el equipo. El rol de PM permite gestionar sus proyectos; no da visibilidad sobre proyectos ajenos ni sobre horas de otras personas. El alcance global corresponde a `operations` y a la administración existente.

Para cumplir literalmente el pedido de pertenencia, la membresía explícita pasa a ser la fuente de acceso al proyecto. Antes del cambio se debe listar la diferencia entre miembros y personas asignadas o colaboradoras. Los casos válidos se regularizan con una vista previa; no se incorporan miembros en lote sin revisar qué acceso otorgaría cada incorporación. Una asignación nueva a alguien externo al proyecto debe resolver su membresía dentro del flujo autorizado, evitando asignaciones que luego resulten inaccesibles.

Restringir el calendario global no vuelve privada una tarea dentro de un proyecto compartido. Los temas sensibles deben quedar en un proyecto con miembros limitados. En la revisión de datos se deben identificar los ejemplos del PDF y comprobar quién integra esos proyectos, sin cambiar sus miembros automáticamente.

Las mismas reglas deben aplicarse a listas, detalles por URL, comentarios, horas, cronómetros, estimaciones, miembros, selectores, contadores, búsqueda y MCP. Ocultar un menú no alcanza para cumplir el pedido.

### Cotizaciones cargadas después de la aprobación real

El flujo visible debe ofrecer las etapas solicitadas: **Aprobada internamente**, **Enviada a cliente**, **En negociación** y **Aprobación final**. Borrador y pendiente de revisión siguen existiendo para propuestas en preparación. El selector ejecuta acciones comerciales con validaciones; no escribe estados sin sus datos asociados.

Para una propuesta que el cliente ya aceptó fuera de Mind, agregar **Registrar aprobación externa**. El formulario mínimo recoge fecha de aceptación, canal, referencia o fundamento y variante aceptada cuando corresponda. Mind registra el usuario y la revisión sobre la que actúa. No requiere enviar un correo ni generar un envío ficticio. La autorización de esta acción debe ser explícita para Ops o el permiso comercial definido, con trazabilidad equivalente al flujo del portal.

La revisión interna y la aceptación del cliente deben conservar su significado: registrar una aceptación externa no inventa decisiones de revisores internos. Si la revisión interna sigue siendo necesaria, la interfaz muestra esa condición de forma clara. El caso de carga histórica debe poder completarse con las facultades autorizadas, sin recorrer etapas ficticias. La operación debe ser atómica, controlar cambios concurrentes y reutilizar la lógica de aceptación del portal para importes, variante, CRM y habilitación del proyecto.

Al terminar, mostrar **Crear proyecto** con la cotización ya seleccionada. Verificar nombre, cliente, variante, presupuesto, PM, miembros y posibilidad de cargar horas. El alta debe detectar un proyecto ya vinculado para evitar duplicados por reintentos. Los grupos de propuestas necesitan el mismo comportamiento por cotización y una actualización coherente de su estado agregado.

### Costos adicionales visibles

Primera entrega: exponer el importe adicional existente como un bloque visible **Costos adicionales** en Inversión, con ejemplos de IA, herramientas, software y licencias, unidad USD explícita y resumen visible aunque el importe sea cero. Reutilizar el campo canónico evita dos montos que puedan duplicarse. El PDF no pide un estimador automático de tokens o consumo.

Comprobar precio recomendado y precio manual: con precio manual, un costo adicional puede reducir el margen manteniendo el precio acordado. La interfaz debe explicar ese efecto. Verificar conversión ARS/USD, descuentos, variantes, guardado y reapertura, rentabilidad y presupuesto del proyecto; distinguir el costo presupuestado de un gasto real para que no se contabilice dos veces. No recalcular cotizaciones históricas en lote.

### Estado actual compartido entre Status y Daily

Usar el mismo Estado actual como dato canónico en lista, detalle y Daily. Daily debe mostrarlo siempre, incluso cuando haya comentarios recientes, y permitir actualizarlo sin volver a escribirlo en otra pantalla. Guardar el cambio y su evento de historial de forma consistente; los comentarios continúan siendo conversación.

Retirar Próximo paso de la edición habitual. Conservar los valores históricos y permitir consultarlos como antecedentes; no borrarlos ni mezclarlos automáticamente con el Estado actual. Probar ítems de proyecto e ítems personalizados en cada sala, incluyendo actualización de caché, recarga y errores de guardado.

### Facturas personales y navegación

Ubicar **Inicio**, **Mis ausencias** y **Mis facturas** juntos, sin el encabezado Mi gestión. Habilitar las facturas propias para colaboradores internos con `task_manager`, incluso si no tienen permiso financiero. La falta de liquidación publicada debe mostrar un estado vacío claro, no hacer desaparecer el módulo.

La excepción debe ser específica de datos personales: hoy el servidor aplica un filtro de campos financieros a respuestas de perfiles `task_manager` y rechaza algunas consultas de liquidaciones. Hay que permitir los importes y archivos del titular en las rutas propias, sin conceder acceso a Finanzas ni desactivar globalmente ese filtro. Probar descarga de comprobantes, vínculo usuario-persona y acceso por ID de otra persona. El rol de proveedor externo conserva su recorrido propio.

El cambio de navegación y acceso personal puede publicarse separado del PR 313. La publicación del cierre ampliado conserva sus dependencias de conciliación y transición financiera; este feedback no las da por cumplidas.

## Orden de ejecución

| Entrega | Alcance | Dependencias | Condición para considerarla terminada |
|---|---|---|---|
| 1 · Privacidad y permisos | F01, F02, F05 y F06. Separar `task_manager` de Ops, unificar política de acceso y ajustar cliente, API y MCP. | Inventario de roles efectivos, vínculo con Personal y membresías. | PM y analista sin pertenencia no obtienen proyecto, tareas ni horas ajenas por pantalla, URL o API. Ops conserva el equipo completo. |
| 2 · Desbloqueo comercial | F08 y F09. Costos visibles, etapas simples, aceptación externa y alta de proyecto asociada. | Autorización comercial y lógica compartida con aceptación del portal. | Una cotización de IA ya aceptada puede registrarse sin correo, convertirse en proyecto y recibir una carga de horas de un miembro. |
| 3 · Navegación personal | F07 y F11. Ocultar Objetivos a no Ops, mover Mis facturas y habilitar datos propios. | Política personal de facturas y exclusiones específicas del filtro financiero. | Colaborador accede a sus facturas desde el primer bloque del menú y por URL; no accede a facturas de terceros ni a Objetivos. |
| 4 · Calendario y Status | F04 y F10. Unificar interacción de calendario y fuente de Estado actual. | Alcance personal resuelto en entrega 1. | Calendario personal expande semanas sin datos ajenos; edición de Estado actual se refleja en lista y Daily tras guardar y recargar. |
| 5 · Validación y publicación | Validación F03, recorridos integrados de las once observaciones y comprobación productiva. | Cada entrega debe tener su propia validación antes de publicarse. | Evidencia por observación, versión activa y revisión con perfiles representativos; sin usar aprobaciones o cargas reales como datos de prueba. |

Las entregas 1 y 2 son las primeras prioridades. Conviene mantener cambios y revisiones separados por propósito para poder publicar la corrección de permisos y el desbloqueo comercial sin esperar el cierre financiero completo. La entrega 5 es el cierre integral; no reemplaza las verificaciones de cada publicación.

## Criterios de aceptación por observación

1. **F01:** Ops ve todos los proyectos operativos; PM y analista ven únicamente sus membresías. Un ID ajeno no permite leer ni modificar el proyecto. Usuario sin vínculo con Personal recibe un resultado seguro y una explicación accionable.
2. **F02:** Kanban y listado presentan los mismos proyectos autorizados; el selector de PM y los contadores no revelan proyectos ajenos. No se puede mover una tarjeta ajena enviando la petición directamente.
3. **F03:** no aparece selector de persona en detalle ni carga rápida. Tarea y subtarea usan el responsable correcto; una subtarea sin responsable aplica la regla vigente de herencia del padre. Sin responsable, Mind pide asignarlo. Un cambio de responsable durante la carga se informa antes de guardar. El cronómetro conserva la identidad de su inicio y detecta cambios. Las horas históricas mantienen su titular original. La carga por PM respeta su proyecto y una autorización expresa para cargar a otro responsable.
4. **F04:** día o `+N más` expande la semana completa, sin perder ni duplicar tareas de varios días. Se ven título, proyecto, rango y estado; se puede abrir el detalle. Contraer y cambiar de mes funcionan con teclado y en móvil. Responsables o colaboradores se muestran cuando aporten contexto dentro del alcance permitido.
5. **F05:** no Ops no ve el enlace global ni puede consultar su API. Su calendario personal muestra sus tareas asignadas o como colaborador dentro de los proyectos autorizados. Filtros manuales no permiten ampliar el alcance. Una tarea sensible ajena no aparece por calendario, búsqueda o detalle.
6. **F06:** no Ops solo recibe horas propias en entradas, agregados, gráficos, estimaciones y cualquier descarga disponible. Enviar otro `personnelId` se rechaza. Se ocultan selector de personas y capacidad global; la página se presenta como Mis horas. Ops puede filtrar todo el equipo.
7. **F07:** Objetivos desaparece del menú, atajos y accesos de Inicio para no Ops; la URL y las API del módulo aplican la misma restricción. Las salas de Status conservan sus permisos existentes.
8. **F08:** costo adicional localizado sin abrir opciones avanzadas; moneda e impacto sobre precio y margen explícitos. El valor persiste al reabrir, afecta la variante correcta y se conserva en el presupuesto del proyecto. Precio manual y recomendado tienen comportamiento coherente; cero no genera un cargo adicional.
9. **F09:** propuesta nueva conserva revisión y aceptación del portal; propuesta ya aceptada permite registrar la aceptación externa sin envío. Se exige la variante correcta, se registra autor y fecha y se comprueban permisos. Un reintento no duplica eventos ni proyectos. Una revisión obsoleta o una modificación concurrente se rechaza de forma clara.
10. **F10:** editar Estado actual en lista lo muestra en Daily, y editarlo en Daily lo muestra en lista y detalle, incluso con comentarios previos. Recarga conserva el valor. Próximo paso deja de competir en la edición habitual y su contenido histórico sigue recuperable. Se respetan salas, autores y permisos.
11. **F11:** un colaborador con `task_manager` ve Mis facturas junto a Inicio y Mis ausencias; abre su información y comprobantes. Sin liquidación ve un estado vacío útil. Manipular IDs no expone importes o archivos de terceros. Ops y Finanzas mantienen sus funciones de revisión existentes.

## Verificación y publicación

Crear fixtures representativas de Ops, PM, analista, colaborador `task_manager`, usuario sin vínculo con Personal y proveedor externo. Incluir proyectos compartidos y ajenos, una tarea sensible, asignaciones sin membresía, horas de distintas personas, cotizaciones individuales y agrupadas, precio manual y costos en USD. Las cuentas reales de Vanu y Pau se verifican en modo de lectura una vez publicada cada corrección.

Las pruebas de permisos deben ejercer endpoints reales y consultas MCP con PostgreSQL, además de las políticas puras. Las pruebas comerciales deben cubrir aceptación externa, revisión vigente, variante aceptada, presupuesto y creación de proyecto sin envío de correo. Status requiere comprobar persistencia y comunicación entre vistas, no solamente la presencia de textos.

Revisar interfaz en 390, 768 y 1440 píxeles: menú, selector de etapas, formulario de aceptación externa, costos, calendario expandido y estados vacíos. Verificar teclado, mensajes de error, elementos superpuestos y nombres largos.

Cada release actualiza juntos `VERSION`, `package.json` y `CHANGELOG.md`, sincroniza el lockfile si corresponde y pasa pruebas, tipos y build en CI desde un checkout limpio. Si hacen falta migraciones, definir una única ejecución y verificar compatibilidad y recuperación antes de publicar. Comprobar el commit desplegado, health y recorridos de lectura; mantener las mutaciones de prueba en el entorno de QA.

## Referencias de implementación

| Área | Archivos y puntos a intervenir |
|---|---|
| Política de tareas | `server/routes.ts`: `hasTaskManagementAccess`, `getTaskAccessContext`, `canAccessTaskProject`, `canManageTaskProject`, `accessibleTaskProjectIds`; consultas `/api/tasks/projects`, calendario y resumen de horas. Revisar todos sus consumidores antes de cambiar la semántica del helper. |
| Cliente y navegación | `client/src/hooks/use-permissions.ts`, `client/src/components/layout/sidebar-fixed.tsx`, `client/src/App.tsx`, `client/src/pages/tasks/projects-hub.tsx`, `projects-kanban.tsx` y `client/src/pages/hours-dashboard.tsx`. |
| Acceso conectado | `server/mcp/data.ts`: política por fila de recursos de tareas y horas; no basta con ajustar las pantallas. |
| Carga de horas existente | `shared/utils/task-hour-owner.ts`, `QuickTaskHours.tsx`, `TaskDetailPanel.tsx`, `GlobalTimerWidget.tsx` y sus rutas de carga y cronómetro. |
| Calendario | `client/src/components/tasks/TaskCalendarView.tsx`, `client/src/pages/team-calendar.tsx` y `client/src/pages/tasks/tasks-home.tsx`; extraer la interacción común sin compartir un alcance global por defecto. |
| Costos de cotización | `client/src/components/optimized/financial-review-final.tsx`, `client/src/context/optimized-quote-context.tsx`, `shared/utils/quotation-pricing.ts` y `quotation-profitability.ts`. |
| Aprobación comercial | `client/src/components/quotation/commercial-workflow-card.tsx`, estados y transiciones comerciales, rutas de decisión pública y de revisión en `server/routes.ts`, alta de proyectos y estado agregado de grupos. |
| Estado actual | `client/src/pages/status-semanal.tsx`: `currentAction`, `nextMilestone`, `DailyItemContext`, `DailyRunner`; rutas de ítems y updates, permisos de salas e invalidación de consultas. |
| Facturas personales | `MyInvoicesRoute`, menú, `client/src/pages/my-invoices.tsx`, endpoints de facturas y liquidaciones propias y `stripTaskManagerFinancialData`. Revisar la interacción con el PR 313 antes de integrar. |

## Supuestos para iniciar

- Administración conserva su acceso global actual como perfil superior a Ops.
- Gestionar las tareas de un proyecto no implica consultar la carga horaria personal de sus integrantes. Si el producto muestra totales operativos en el proyecto, hay que definirlos expresamente y evitar que permitan reconstruir horas individuales contrarias a F06.
- La primera mejora de costos usa el importe adicional existente. Un desglose de múltiples proveedores, monedas o consumo de IA sería una ampliación posterior, no un requisito explícito de este PDF.
- Las etapas son fáciles de seleccionar, pero Mind mantiene historial, permisos y consistencia económica. No se registran envíos ni decisiones del cliente que no ocurrieron.
- Los valores históricos de Próximo paso y las horas ya cargadas se conservan.

