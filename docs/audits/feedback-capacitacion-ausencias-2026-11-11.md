# Implementación del feedback de Capacitación y ausencias

## Alcance acordado

- Objetivos y Tarifas/servicios: retirar guías y accesos, conservar datos, funciones y rutas históricas con sus permisos.
- Finanzas: ocultar sus guías hasta validarlas. Las pantallas financieras siguen disponibles para los perfiles autorizados.
- Consolidar Cartera, gestión financiera del proyecto y la antigua guía de entregables en un recorrido documentado sobre funciones disponibles.
- Corregir la cancelación de vacaciones aprobadas desde Operaciones y completar los recorridos de las demás guías.

## Trazabilidad

| Feedback | Implementación | Evidencia |
| --- | --- | --- |
| Orden de tareas Asana | Conserva el orden por vencimiento y la paginación corregidos previamente | `server/domain/task-list.ts`, pruebas de paginación PostgreSQL y navegador |
| Último mensaje repetido en daily | Conserva el editor vacío y el envío únicamente de texto nuevo | `e2e/daily-message.spec.ts` |
| Horas estimadas en gráficos | Conserva la comparación semanal y por proyecto | `tests/weekly-hours.test.ts`, `tests/hours-feedback.test.ts` |
| Cancelar vacaciones aprobadas | Operaciones puede cancelar directamente; diálogo con persona, fechas, días, motivo obligatorio y declaración de días no tomados | `e2e/feedback-training-absences.spec.ts` |
| Seguridad de la cancelación | Estado, evento y notificación en la misma transacción; bloqueo compartido con Finanzas, control de versión de fila, reintentos sin duplicación | `tests/absence-cancellation.integration.test.ts`, prueba HTTP concurrente |
| Saldo y capacidad | El registro cancelado deja de consumir saldo y disponibilidad; se invalidan saldos, ausencias, capacidad y calendario | Pruebas HTTP de saldo, disponibilidad, capacidad semanal y cruce de año |
| Unificar explicaciones | Una sola sección «Aclaraciones y situaciones frecuentes» en todas las guías | `client/src/pages/training.tsx`, pruebas de navegador |
| Inicio | Resumen personal, horas semanales/mensuales, cumpleaños y accesos según perfil | Guía `inicio` versión 3 |
| Notificaciones | Revisar contexto, marcar leído, configurar canales/categorías y recuperar historial como pasos separados | Guía `notificaciones` versión 3 |
| Mis facturas | Base publicada por Operaciones; TC al facturar; autorización de importe; revisión documental; cobro y segundo TC; ARS, extras y modalidad sin factura | Guía `facturas-personales`, ocho pasos; prueba móvil |
| Costos adicionales | Ubicación en revisión financiera y ejemplos: IA, software, licencias, comisiones y encuestas | Guía `cotizaciones`; la función existente se conserva |
| Lista, kanban y Cartera | Distingue tareas por proyecto, etapas operativas de proyectos y gestión económica | Guías `proyectos-tareas` y `cartera` |
| Entregables/calidad/recurrencia | Retira el recorrido no validado; los enlaces antiguos de las dos guías fusionadas abren Cartera | Alias compartidos y pruebas HTTP/navegador |
| Objetivos | Retira guía, acceso lateral y botón de Status; conserva ruta y almacenamiento | Política de publicación y pruebas de navegación |
| Alta de proyectos | Cotización aprobada obligatoria para nuevas altas comerciales; cliente/variante coherentes y aprobación revalidada bajo bloqueo; internos sin cotización | Prueba HTTP de rechazo, alta interna, alta comercial y duplicado |
| Cierre del equipo | Base, publicación, declaración de la persona, autorización de Operaciones y revisión de Administración explicadas por etapa | Guía `cierre-equipo` versión 3 |
| Tarifas/servicios y recetas | Retira guía y acceso al catálogo desde Propuestas; mantiene Personal y configuración. Explica la calibración histórica existente de recetas sin añadir un circuito paralelo | Guías `cotizaciones`, `personal-tarifas`; rutas históricas conservadas |
| Finanzas TBD | Ninguna guía del módulo se publica, incluso para Admin; acceso directo a contenido, medios y progreso devuelve 404 | Pruebas de API por perfil, búsqueda y filtros |
| Progreso previo | Versiones 1 y 2 y guías retiradas conservan sus registros; versión 3 requiere su propia marca opcional de lectura | `tests/training.integration.test.ts` |

## Reglas de cancelación

`cancel_by_operations` requiere Operaciones o Admin. La confirmación de una cancelación solicitada por la persona usa la misma validación de motivo y días no tomados. La persona conserva su flujo de solicitar cancelación; no obtiene la facultad de cancelarse una ausencia aprobada directamente.

Se bloquea la operación si cualquier mes del rango tiene cierre financiero `CLOSED`/`IN_REVIEW`, corte operativo de horas o una liquidación publicada para esa persona. No se reabre ningún período automáticamente. Los meses se bloquean en orden y con la misma clave que publicación/cierre financiero. Los saldos se recalculan desde los registros activos, sin sumar devoluciones manuales que puedan duplicarse.

La confirmación declara que **ningún día fue tomado**. Para una ausencia parcialmente tomada corresponde revisar las fechas; el botón no devuelve automáticamente todo el rango. Motivo, fecha, usuario y estado permanecen registrados. Dos decisiones simultáneas producen una única cancelación; la otra recibe el resultado ya confirmado o un conflicto para actualizar la pantalla.

## Compatibilidad y publicación

No se eliminan tablas, rutas de producto, funciones ni registros históricos. No se necesitan migraciones nuevas: se usan las tablas de ausencias y cierre ya existentes. Los enlaces de guía `/training/finanzas-proyecto` y `/training/entregables` llevan a `/training/cartera`, respetando permisos. Las guías retiradas muestran un estado de indisponibilidad.

La evidencia de implementación y validación corresponde a esta rama. La publicación en producción se registra por separado; no debe inferirse a partir de una prueba local ni de que un cambio ya esté escrito.

## Validación

- Suite Vitest con PostgreSQL local: 130 archivos aprobados, 1 omitido; 1229 pruebas aprobadas y 11 omitidas por sus condiciones existentes.
- TypeScript: `npm run check` aprobado.
- Producción: `npm run build` y `npm run check:bundle` aprobados (222.062 bytes gzip de JavaScript inicial, dentro del presupuesto).
- Suite completa Playwright sobre base recién creada: 31 recorridos aprobados (escritorio, celular, miembros, Operaciones, Admin y proveedores).
- Recorridos específicos: cancelación con Operations sin privilegio Admin, saldo, historial, notificación única, dos decisiones concurrentes, cruce de año, bloqueo/reapertura y aislamiento de guías por perfil.
- Nueve capturas regeneradas y revisadas visualmente; la confirmación de cancelación se añade como medio privado de la guía de ausencias. Originales de verificación bajo `.context/`.
- Después de actualizar los medios y la política de publicación se repitieron las 22 pruebas de Capacitación y cancelación: todas aprobadas.

## Revisión final y release 1.14.38

Se cotejaron nuevamente las nueve capturas del feedback original. No quedaron requisitos funcionales pendientes. Se amplió la regresión HTTP para comprobar también que la capacidad semanal recupera exactamente las horas de la ausencia cancelada. El entorno aislado de navegador aplica ahora la migración de capacidad existente para probar esa vista real. Los cinco recorridos específicos volvieron a pasar.

`VERSION`, `package.json`, `package-lock.json` y `CHANGELOG.md` identifican la release 1.14.38. La publicación autorizada requiere CI de checkout limpio antes del merge, seguido de despliegue web, worker del mismo commit y verificación de salud y recursos privados en producción.
