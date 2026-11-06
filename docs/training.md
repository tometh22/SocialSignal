# Capacitación: guías de uso

La sección /training ofrece instrucciones de consulta por función y permiso. No tiene ejercicios, evaluaciones, recorridos obligatorios ni metas de progreso. Todas las instrucciones están disponibles al abrir una guía; los enlaces a las pantallas de trabajo están al inicio. La búsqueda y el filtro por área permiten ir directo a la tarea necesaria.

## Contenido y mantenimiento

- El catálogo versionado vive en server/content/training-catalog.ts. Cada guía incluye finalidad, instrucciones numeradas, qué revisar, un ejemplo y detalles adicionales desplegables. La duración estima tiempo de lectura.
- Mantener el id estable e incrementar version ante un cambio sustancial. La versión 2 reemplaza los ejercicios de la versión 1 por procedimientos. Se conserva el historial previo sin alterarlo.
- Marcar como leída es opcional y personal. No hace falta guardar la lectura para navegar, abrir la función o consultar otra guía. Un error de guardado permite reintentar y no bloquea el trabajo.
- access refleja permisos efectivos; los proveedores no heredan contenido interno. Las horas externas requieren proveedor activo, vínculo con Personal y al menos un proyecto abierto habilitado.
- covers mantiene el inventario de rutas. Las pruebas detectan rutas funcionales protegidas sin cubrir. Los enlaces deben abrir destinos existentes sin inventar identificadores; su etiqueta describe la pantalla de destino.
- Una actualización conserva el historial y se muestra como Guía actualizada si se había completado una versión anterior. Los cambios de permisos no borran lecturas anteriores.

## Capturas de referencia

Las 37 guías incluyen imágenes reales de la app, tomadas en un entorno local con cuentas y datos de ejemplo. Se muestran como miniaturas opcionales con el paso al que corresponden, texto alternativo y una indicación concreta. El visor permite ampliar, ajustar a pantalla o consultar el tamaño original; funciona con teclado y móvil. No hay reproducción automática. Un error de imagen no impide consultar las instrucciones.

- `server/content/training-media.ts` vincula cada imagen con la guía y su paso. `server/content/training-media/` conserva los JPEG originales revisados. No se usan capturas de producción ni se alteran los controles con imágenes generadas.
- La API autentica y verifica los permisos de la guía también para cada imagen. Los archivos no están en `public/`; el build los copia a `dist/training-media`, fuera de `dist/public`. Las respuestas usan `Cache-Control: no-store`.
- Para renovar las imágenes, iniciá la app con una base local de pruebas, sembrada con `scripts/seed-performance-e2e.ts`. Ejecutá `npx tsx scripts/capture-training-media.ts`; `TRAINING_CAPTURE_URL` debe ser local y `TRAINING_CAPTURE_LESSONS` puede limitar la lista de identificadores separados por comas.
- El script genera candidatos y sus dimensiones en `.context/training-media/`. Revisá cada captura antes de copiarla al directorio del servidor: debe mostrar controles útiles, sin errores, indicadores de carga ni datos reales. Algunos ejemplos requieren preparar registros ficticios válidos en esa base aislada. Ajustá la leyenda y el paso cuando cambie la interfaz. Las guías de horas usan `horas-formulario.jpg`; las guías que parten de Cartera comparten `cartera.jpg`.

## Contrato y persistencia

- GET /api/training: catálogo autorizado, lectura actual, actualización y preferencia de invitación.
- GET /api/training/lessons/:lessonId: instrucciones y progreso. Devuelve 404 si no hay acceso. No envía ejercicios ni soluciones.
- PUT /api/training/lessons/:lessonId/progress: {version, step: "learn"}. Registra la lectura y devuelve {progress, feedback}. Rechaza respuestas, userId y banderas de completado; 409 ante versión obsoleta.
- GET /api/training/lessons/:lessonId/media/:mediaId: imagen autorizada de la guía, con 404 si no existe o no hay acceso.
- PUT /api/training/invitation: {dismissed: true}. Conserva el descarte entre dispositivos.
- training_progress conserva su clave (user_id, lesson_id, version) y las respuestas históricas. La lectura de una versión nueva se registra en otra fila. Una transacción con bloqueo de fila hace idempotentes las escrituras simultáneas.
- No se requiere otra migración. Las tablas de capacitación permanecen privadas y las guías no escriben en APIs operativas.

## Verificación

Ejecutar npm run check, npm test, npm run build y npm run check:bundle. TRAINING_TEST_DATABASE_URL habilita las pruebas PostgreSQL contra una base local aislada; cada ejecución usa su propio schema.

Las pruebas e2e/training.spec.ts usan las cuentas e2e-training-* en una base local mind_e2e*. Verifican consulta directa sin pasos obligatorios, lectura opcional entre sesiones, recuperación de errores sin bloquear enlaces, permisos, búsqueda, teclado y móvil. Las capturas se guardan en .context/training-*.png.

## Inventario de funciones

| Lección | Área | Rutas cubiertas |
|---|---|---|
| bienvenida — Conocer Mind | Primeros pasos | `/training`, `/training/:lessonId` |
| inicio — Inicio | Primeros pasos | `/` |
| notificaciones — Notificaciones | Primeros pasos | `/notifications` |
| ausencias-personales — Mis ausencias | Gestión personal | `/absences` |
| facturas-personales — Mis facturas | Gestión personal | `/my-invoices` |
| crm — CRM | Comercial | `/crm`, `/crm/:id` |
| clientes — Clientes | Comercial | `/clients` |
| cotizaciones — Cotizaciones | Comercial | `/quotations`, `/optimized-quote`, `/optimized-quote/:id`, `/quotations/:id` |
| propuestas — Propuestas y aprobaciones | Comercial | `/quotations/:id/studio`, `/quotation-groups/:id`, `/proposal/:token`, `/proposal-group/:token` |
| proyectos-tareas — Proyectos de tareas y kanban | Proyectos y tareas | `/tasks/projects`, `/tasks/projects/kanban`, `/tasks/projects/:id` |
| tareas — Tareas y responsables | Proyectos y tareas | `/tasks`, `/tasks/my-tasks` |
| horas — Registrar y revisar horas | Proyectos y tareas | `/tasks/hours-dashboard` |
| status — Status | Status y objetivos | `/review`, `/review/:roomId` |
| objetivos — Objetivos | Status y objetivos | `/review/objectives` |
| cartera — Cartera de proyectos | Operaciones | `/active-projects`, `/active-projects/new`, `/active-projects/:id`, `/active-projects/:id/edit`, `/project-settings/:id` |
| finanzas-proyecto — Gestión financiera del proyecto | Operaciones | `/active-projects/:id/financial-management`, `/active-projects/:id/time-entries`, `/time-entries/project/:projectId` |
| entregables — Entregables, calidad y recurrencia | Proyectos y tareas | `/client-summary/:clientId`, `/quality-scores/:clientId`, `/quarterly-nps/:clientId`, `/edit-deliverable/:id`, `/edit-indicators/:id`, `/always-on-project/:projectId`, `/recurring-templates/:projectId` |
| capacidad-calendario — Capacidad y calendario | Operaciones | `/operations/capacity`, `/tasks/team-calendar` |
| ausencias-equipo — Gestión de ausencias y feriados | Operaciones | `/operations/absences`, `/operations/holidays` |
| cierre-equipo — Cierre del equipo | Operaciones | `/operations/monthly-closing`, `/operations/liquidaciones-equipo` |
| tarifas-servicios — Tarifas y servicios | Operaciones | `/operations/estimated-rates`, `/operations/service-blueprints`, `/operations/portfolio-import` |
| carga-financiera — Cargar datos | Finanzas | `/finance/cargar` |
| facturas-equipo — Facturas equipo | Finanzas | `/finance/facturas-equipo` |
| cierre-financiero — Cierre financiero | Finanzas | `/finance/cierre` |
| cashflow — Cashflow | Finanzas | `/finance/cashflow` |
| activo-pasivo — Activo y Pasivo | Finanzas | `/finance/activo`, `/finance/pasivo` |
| provisiones — Provisiones | Finanzas | `/finance/provisions` |
| reportes — Resumen financiero y reportes | Finanzas | `/dashboard`, `/finance/proyeccion`, `/finance/arr`, `/finance/rendimiento`, `/finance/costos`, `/executive/operativo` |
| analisis-financiero — Análisis por cliente y proyecto | Finanzas | `/clients/:id/pnl`, `/project-analytics/:projectId`, `/executive/finanzas` |
| administracion — Configuración y usuarios | Administración | `/admin`, `/admin/users` |
| personal-tarifas — Personal, roles y tarifas | Administración | `/admin` |
| configuracion-precios — Multiplicadores y tipos de cambio | Administración | `/admin` |
| admin-proveedores — Proveedores | Administración | `/admin/providers` |
| fuentes-definiciones — Fuentes de datos y definiciones | Administración | `/admin/data-sources`, `/admin/definitions`, `/google-sheets` |
| proveedor-panel — Mi panel de proveedor | Proveedores | `/provider/dashboard` |
| proveedor-horas — Cargar horas como proveedor | Proveedores | `/provider/dashboard` |
| proveedor-facturas — Mis facturas de proveedor | Proveedores | `/my-invoices` |
