# Capacitación interactiva

La sección /training y su ayuda usan el catálogo versionado de server/content/training-catalog.ts. Las prácticas solo escriben respuestas y progreso personal; no invocan servicios operativos. El contenido se sirve desde el servidor después de verificar permisos, sin soluciones en el payload inicial.

## Mantenimiento

- Mantener el id estable. Incrementar version si cambian de forma sustancial la explicación, los ejercicios o su criterio de aprobación. Las correcciones de estilo no requieren reiniciar el avance.
- Cada lección tiene tres pasos: explicación, práctica y comprobación. Se completa al guardar la lectura y resolver ambos ejercicios. Los errores también se guardan para retomar; los reintentos son ilimitados. Repetir no borra un completado.
- access debe reflejar los permisos de las funciones enseñadas. Los proveedores nunca heredan contenido interno, incluso si tienen permisos internos cargados por error. Las horas externas requieren perfil activo, vínculo con personal y al menos un proyecto abierto habilitado.
- covers es el inventario de rutas de cada lección. Las pruebas fallan si una nueva ruta funcional protegida queda sin cubrir. Los enlaces de salida abren pantallas existentes sin inventar ids de registros.
- Los enlaces públicos de propuestas se explican en el recorrido comercial; la capacitación sigue siendo privada. Los aliases y redirecciones no agregan lecciones. /currency-demo se excluye por ser una herramienta demostrativa, no un flujo de negocio.
- El avance histórico se conserva si cambian los permisos. Los totales solo incluyen versiones actuales y lecciones accesibles. Una versión nueva muestra Actualización disponible si había una anterior completada.

## Contrato y persistencia

- GET /api/training: catálogo autorizado, progreso actual, indicador de actualización, permisos efectivos y estado de la invitación.
- GET /api/training/lessons/:lessonId: contenido autorizado y progreso. Una lección desconocida o no accesible devuelve 404.
- PUT /api/training/lessons/:lessonId/progress: {version, step, answer?}. step: learn | practice | check. El servidor valida ejercicios y devuelve {progress, feedback}; 409 si la versión cambió. No acepta userId ni banderas de completado.
- PUT /api/training/invitation: {dismissed: true}. La preferencia pertenece al usuario autenticado y se sincroniza entre dispositivos.
- training_progress usa clave (user_id, lesson_id, version); guarda pasos resueltos, últimas respuestas, fecha de completado y actualización. Una transacción con bloqueo de fila combina escrituras concurrentes sin perder completados.
- training_preferences guarda el descarte de la invitación. Las dos tablas se eliminan en cascada al borrar al usuario. Migración 0094 incluida tanto en arranque como en SQL manual; no modifica registros operativos.

## Verificación

Ejecutar npm run check, npm test, npm run build y npm run check:bundle. Las pruebas PostgreSQL de capacitación se habilitan con TRAINING_TEST_DATABASE_URL apuntando a una base local; crean y eliminan un schema propio. CI ya configura esa variable.

Las pruebas e2e/training.spec.ts usan las cuentas e2e-training-* creadas por scripts/seed-performance-e2e.ts en una base local dedicada mind_e2e*. Incluyen permisos, continuidad entre sesiones, recuperación de errores, teclado y móvil. No se deben ejecutar contra producción. Las capturas se guardan en .context/training-*.png.

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
