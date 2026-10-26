# Transición financiera de Mind — 9 de octubre de 2026

## Resultado y alcance

Implementación preparada en la rama de trabajo; no desplegada por esta auditoría. La transición funcional todavía no está aprobada. Producción se consultó exclusivamente en una transacción de solo lectura.

La configuración productiva es `hours_data_source=1` y `app_mode_cutover_date=2026-08`. La fecha estaba activada para horas, pero no cerraba todos los importadores financieros.

## Actualización del 26 de octubre

La rama financiera incorpora `main` 1.14.6 mediante un merge, preservando los permisos por membresía, las horas propias, la aceptación externa de cotizaciones y el acceso a facturas personales. Sigue siendo la versión propuesta 1.15.0; no está desplegada ni se declara conciliada por aprobar sus pruebas técnicas.

- Validación local: **1.037 pruebas aprobadas y 11 omitidas**, tipos y build correctos. PostgreSQL 16 y 18 se ejecutaron en forma secuencial y en instancias locales aisladas.
- Respaldo real de producción obtenido con una transacción repetible de sólo lectura y un snapshot compartido con `pg_dump`. Restaurado en PostgreSQL 18: coinciden los conteos de las **172 tablas** y las huellas completas de las filas de **25 tablas financieras**. El respaldo y los datos de comparación permanecen privados en `.context/finance-transition-2026-10-26/`; no se versionan ni se envían a otro servicio.
- Las migraciones 0087–0089 se aplicaron dos veces sobre esa restauración. Se conservaron las columnas y valores financieros originales y se comprobó el rechazo de una escritura de Excel posterior al corte. No se ejecutaron migraciones ni escrituras financieras en producción.
- La revisión detectó una incompatibilidad con el contrato actual de horas: son fechas civiles, incluidas las guardadas a medianoche UTC, no instantes que deban trasladarse a otro día. La guarda financiera ahora conserva el mes del día ingresado, como liquidación y costo laboral. Pruebas reales de inserción, modificación y borrado protegen también el primer día del mes. El instante del corte automático continúa siendo las 23:59 de Buenos Aires.
- HTTP con autenticación real y datos exclusivamente sintéticos: USD/ARS hasta Pasivo, autorización previa y versiones, factura privada, denegación a otra persona y a Finanzas sin permiso. Sólo ARS se completa sin TC; vacaciones y días Epical conservan la base contractual y sólo la licencia sin goce explícita la reduce. Se verificó también pre-cierre, revisión, snapshot inmutable y reapertura auditada.
- Facturación muestra la **base del mes** separada del importe autorizado. El desglose incluye bono, adicionales de Operaciones y extras del colaborador; sólo ARS no presenta referencias a TC ni comisiones USD.

### Evidencia disponible para conciliar

El maestro conectado es [Seguimiento Financiero/Economico](https://docs.google.com/spreadsheets/d/1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc/edit), revisión observada `106950`, modificada el 26/10 a las 15:17 UTC. Se comprobó que la fecha de modificación no cambió durante la lectura. Esa revisión todavía no fue identificada por Finanzas como la versión aprobada de agosto.

Las doce métricas monetarias comparables del Resumen Ejecutivo para julio, agosto y septiembre —36 comparaciones— coinciden con el resumen importado a precisión de centavos. Esto acredita consistencia del resumen de referencia, no una reconstrucción nativa ni conciliación documental. `income_sot` y el resumen no se comparan como si fueran la misma base.

El detalle de agosto conserva 13 filas de Activo, 179 de Pasivo y 184 de CashFlow del maestro. Hay 80 movimientos de referencia en el ledger importado: se conservan ambos conjuntos para revisar mapeos, transferencias y posibles faltantes; la diferencia de cantidad no se clasifica automáticamente como 104 movimientos faltantes. Entre los pasivos hay una fecha de emisión vacía y diez referencias documentales vacías. Los movimientos leídos tienen fecha dentro de agosto.

Los saldos de julio agrupan Santander/Galicia/Nación y una fila de Transferwise carece de monto original, aunque tiene total USD. Se requieren los saldos y monedas por cuenta respaldados por extractos antes de convertir esas filas en aperturas nativas. No se crea una cuenta, fecha, autorización histórica ni importe original por inferencia.

La auditoría actual sigue sin encontrar cuentas, ingresos, cierres nativos, liquidaciones publicadas ni facturas personales. Por lo tanto, no hay comprobantes personales históricos que convertir en nuevas autorizaciones en esta instancia. Faltan la identificación de la versión aprobada, los extractos/saldos de apertura, resolver las excepciones documentales y el presupuesto aprobado. La consulta al usuario sobre esos respaldos queda pendiente. No se desactiva definitivamente el maestro ni se publica el corte financiero con estos faltantes.

## Hallazgos productivos

- No hay períodos en `financial_close_periods`, eventos en `revenue_events`, cuentas en `financial_accounts` ni elementos en la bandeja financiera.
- Los registros posteriores al corte que existen en Activo, Pasivo y Cashflow tienen origen `excel`: agosto contiene 13 activos, 179 pasivos y 80 movimientos; septiembre contiene 1 activo y 2 pasivos.
- Hay ingresos de referencia en `income_sot` desde agosto de 2026 hasta mayo de 2027 y presupuestos importados hasta diciembre de 2026. Su presencia no acredita que existan facturas, cuentas o presupuestos aprobados en el circuito nativo.
- No se copiaron totales a los libros nativos, no se inventaron fechas de emisión/cobranza ni se aprobaron cierres. El usuario confirmó en esta conversación que agosto de 2026 es el último cierre del maestro validado por Finanzas. Esa confirmación identifica el período de referencia; no acredita que las filas importadas correspondan a la versión aprobada ni aprueba un cierre nativo.

## Base de conciliación confirmada

- Último cierre del maestro validado por Finanzas: **agosto de 2026**, confirmado por el usuario el 9 de octubre de 2026.
- Agosto será el primer período a reconstruir y comparar en Mind. Se mantiene `app_mode_cutover_date=2026-08`: también gobierna horas y costos operativos. La confirmación del cierre del maestro no desplaza ese corte ni crea un cierre nativo automáticamente.
- Para reconstruir agosto, respaldar los saldos de apertura al inicio de agosto (cierre del 31 de julio) y los movimientos/documentos de agosto. Comparar el resultado con la versión aprobada del cierre al 31 de agosto. No usar los saldos finales de agosto como apertura de agosto: duplicaría los movimientos del mes.
- Septiembre es el siguiente período a conciliar, con continuidad desde los saldos de agosto conciliados. Todavía no se considera un cierre aprobado por Finanzas.
- Conservar la versión o exportación exacta del maestro aprobada y sus extractos/comprobantes. Hasta verificar esa evidencia, los importes existentes en la base siguen siendo referencias importadas.

## Cambios implementados

1. Una política común bloquea importaciones operativas desde Excel cuando existe fecha de corte. Los jobs financieros salen antes de contactar Google; los importadores de tarifas, FX/REM, ventas, costos, provisiones, resúmenes y normalizaciones también validan el límite. El backfill explícito sólo acepta períodos anteriores al corte y abiertos.
2. La migración `0087` instala protecciones en PostgreSQL. Verifica período anterior y nuevo, ventanas de devengamiento y presupuesto, y coordina escrituras con cierre mediante el mismo bloqueo transaccional. Un mes cerrado o en revisión no admite cambios; cambiar un dato de un pre-cierre lo invalida. Sólo el cierre nativo puede publicar el resumen posterior al corte.
3. Presupuesto de costos en `/finance/presupuesto`: concepto, categoría, directo/indirecto, moneda, importe mensual y vigencia de hasta 60 meses. Tiene auditoría y control de versión para evitar que dos ediciones se pisen. Se puede desactivar; no se borra historia. Si la vigencia afecta un cierre, requiere reapertura.
4. La proyección consume presupuesto nativo en períodos abiertos y snapshots en los cerrados. Conserva el histórico anterior al corte. Ausencia de presupuesto o FX produce importes pendientes y totales incompletos, no costo cero. Los importes del maestro posteriores al corte permanecen como referencia de conciliación y no se usan como presupuesto vigente.
5. El cierre muestra controles de transición y comparación de ingresos/presupuesto importados contra Mind. Agrega controles críticos para saldos de apertura y para impedir cerrar con ingresos nativos vacíos cuando hay ingresos importados de referencia. Estos controles detectan faltantes; no certifican la integridad documental ni sustituyen la aprobación de Finanzas.
6. Tarifas continúan editándose en Configuración → Personal; se ocultan/desactivan controles de sincronización con el maestro después del corte. FX y REM se cargan en Variables económicas o por la Bandeja; dólar e IPC mantienen sus fuentes externas independientes.
7. Los adaptadores de costos y FX dejaron de leer Sheets durante la operación nativa. Las cuentas y agregados importados quedan como referencia; los cálculos nativos excluyen filas de origen Excel. El agregado de costos conserva su origen hasta reconstruirse desde Mind, evitando que un total importado se presente como costo nativo. La migración `0088` limita el P&L de BI a historia anterior al corte y cierres nativos, y alimenta Cashflow con el ledger nativo, excluyendo anulaciones y transferencias propias.
8. Ambas migraciones se instalan en una transacción antes de servir solicitudes; si fallan, el servidor no arranca sin esas protecciones.

## Revisión de integración entre áreas

La revisión posterior encontró y corrigió recorridos que no estaban cubiertos por la primera validación:

- Un período en revisión no tenía vuelta a corrección. Ahora Finanzas puede devolverlo a abierto con motivo auditado; requiere un nuevo pre-cierre. No permite reabrir por esta vía un mes cerrado.
- Las horas originales podían guardarse aunque su recálculo posterior fuera rechazado por cierre. La protección en PostgreSQL alcanza ahora `task_time_entries` y `time_entries`, comprobando fechas anteriores/nuevas en el mes civil de Buenos Aires.
- El costo laboral y el checklist se calculaban en transacciones separadas. Ahora se ejecutan bajo el mismo bloqueo transaccional; tarifas/FX incompletos o sincronizaciones pendientes bloquean el cierre.
- El cierre vuelve a consultar controles críticos para detectar nuevas cargas pendientes; los extractos también se identifican por las fechas de sus líneas. Los controles de documentos operativos excluyen referencias importadas.
- La aceptación previa de una advertencia deja de reutilizarse si cambian sus valores o evidencia.
- La liberación de una provisión puede reducir su saldo en un período posterior abierto, sin cambiar el importe reconocido ni el snapshot original.

| Conexión | Evidencia disponible |
| --- | --- |
| Horas de tarea → costo laboral → pre-cierre → corrección → cierre | Circuito ejecutado con servicios reales y PostgreSQL local; tarifa faltante bloquea, corrección actualiza costos y el cierre impide editar/borrar horas. |
| Factura de cliente → cuenta a cobrar → cobro posterior | Circuito ejecutado con servicios reales; documento importado duplicado no se aplica y el snapshot anterior no cambia. |
| Factura de proveedor → Pasivo/costos → pago posterior | Circuito ejecutado con servicios reales; la factura alimenta costo indirecto y el pago cancela el saldo sin reescribir el cierre anterior. |
| Provisión → cierre → liberación posterior | HTTP con router real: rechazo sobre mes cerrado y liberación en el siguiente mes con saldo/gasto actualizados. |
| Presupuesto → proyección; cierre → BI | HTTP/SQL local: importes pendientes sin FX/presupuesto y exclusión de snapshots reabiertos de BI. |
| Facturas del equipo aprobadas → Pasivo | Actualización 22/10: circuito completo por HTTP real, con autorización previa, carga USD/ARS y aprobación de Administración. El tratamiento `balance_only` evita duplicar el costo laboral. |

La automatización hace cálculos, propagaciones y controles; no reemplaza la carga/confirmación de documentos, la conciliación de excepciones ni la aprobación de Finanzas y Admin. No se certificó una conexión bancaria automática ni un circuito productivo de punta a punta. Estas pruebas no son una garantía de ausencia de bugs.

## Validación

- Migraciones aplicadas sobre una base PostgreSQL 16 local con copia de la estructura productiva, sin filas productivas; comprobación de idempotencia.
- Pruebas PostgreSQL de límites del corte, meses cerrados, movimientos entre períodos, ventanas de devengamiento, invalidación de pre-cierre, FX faltante, presupuesto mensual y cierre concurrente. Se incorporan a CI con PostgreSQL local.
- HTTP local con rutas reales: permisos financieros, alta y edición, rechazo de moneda inválida, conflicto por versión desactualizada, proyección y reporte de transición.
- Cierre completo con datos sintéticos: pre-cierre → revisión → snapshot, rechazo de modificación del snapshot, reapertura y evento de auditoría. El saldo de caja se conservó. También se verifica el cierre con ingresos registrados y la aplicación de pagos posteriores sobre facturas de meses cerrados, sin permitir cambiar sus importes económicos.
- Revisión en Chrome de alta/edición del presupuesto y panel de transición. Evidencia local en `.context/financial-budget-qa.jpg` y `.context/financial-transition-qa.jpg`.
- Pruebas adicionales PostgreSQL sobre estados, concurrencia, controles de costos, extractos sin período general y excepciones cuya evidencia cambia. Devolución verificada en Chrome, con evidencia en `.context/financial-correction-qa.jpg`.
- Los resultados finales de tests, TypeScript y build se detallan en el PR. Ninguna prueba implica conciliación ni aprobación financiera productiva.

## Secuencia para completar la transición

### Requisito operativo confirmado: liquidación y facturación del equipo

Actualización del 22 de octubre: el circuito solicitado está implementado en esta rama, con pruebas locales y sin despliegue ni cambios productivos. Reemplaza los faltantes identificados en la revisión anterior. Integrado con `main` (1.14.4) como versión 1.15.0; migraciones renumeradas 0087–0089 para conservar cumpleaños y OAuth. Pasaron 1.024 pruebas (11 omitidas), TypeScript y build, incluidas las suites PostgreSQL financiera y MCP. El presupuesto nativo se incorpora al catálogo MCP con permiso de Finanzas.

| Paso | Comportamiento implementado |
| --- | --- |
| Corte y borradores | Último día hábil según feriados configurados, 23:59 de Buenos Aires. Job nativo independiente de Excel, con recuperación cada cinco minutos y activación desde el mes del despliegue; no procesa automáticamente meses históricos. Reapertura explícita con motivo, antes de publicar. |
| Fijos y freelance | Fijos: horas contractuales × tarifa histórica. Vacaciones, feriados y días Epical son pagos. Sólo se descuentan horas sin goce explícitas con motivo. Freelance: horas reales conciliadas entre fuentes, sin duplicar registros ni sumar horas rechazadas. |
| Operaciones | Un único Cierre del equipo: «Base a cobrar» y «Facturación y seguimiento». Publica porcentaje USD, bonos USD/ARS y extras, y autoriza cada tramo antes de emitir. Conserva sugerencias del mes anterior y protege cambios concurrentes. |
| Colaborador | Mi gestión → Mis facturas → mes. TC comprador al facturar; luego factura USD aprobada, confirmación de recepción, segundo TC y extras ARS con detalle. Cada importe se envía a Operaciones y la carga del comprobante se habilita después de autorizarlo. |
| Sólo ARS | Base más bono y extras, sin exigir TC bancario. Misma autorización previa y revisión documental posterior. |
| Administración | Compara comprobantes contra el importe autorizado y registra Pasivo; documentos aprobados no pueden sustituirse ni eliminarse por el colaborador. |
| Costo financiero | Reconcilia costo por horas con base contractual. Capacidad fija no asignada, bonos y extras autorizados se incorporan al costo indirecto. La asignación directa se limita a la base contractual; las facturas alimentan Pasivo sin duplicar el gasto. |
| Cierre financiero | Bloquea mientras falten liquidaciones, autorizaciones o comprobantes requeridos. Permite saldo ARS cero sin factura; un saldo negativo requiere resolución de la diferencia. |

**Ejemplo confirmado:** total ARS 10.000, 90%, TC al facturar 1.500, TC al recibir 1.505 y extras ARS 5.000 → USD 6 y ARS 5.970 (`10.000 − 6 × 1.505 + 5.000`). Se redondea el tramo USD antes de calcular el saldo ARS.

Validación: pruebas PostgreSQL del corte, horas pagas, secuencia, concurrencia, permisos, estados financieros y costos sin FX; migración 0089 aplicada dos veces. HTTP real con cuentas sintéticas recorrió ambas monedas hasta Pasivo, comprobó rechazo de carga anticipada y de modificaciones a documentos aprobados. Chrome verificó el diálogo de descuento excepcional, 120 horas contractuales y la carga/envío del TC personal. Evidencia local: `.context/team-paid-leave-qa.png` y `.context/team-fx-qa.png`.

Revisión UX/UI adicional del 22 de octubre: selector de mes compartido, pestañas que conservan borradores y aviso de cambios sin guardar, responsables de cada pendiente corregidos, filtros por responsable, base en ARS y TC personales explícitos. Tablas con tarjetas móviles y desplazamiento contenido en escritorio; campos/etiquetas alineados y comprobantes aprobados resumidos para acceder al siguiente paso. ARS-only no muestra instrucciones ni fórmulas de TC.

Chrome con datos sintéticos locales verificó anchos de 320, 390, 1280 y 1440 px, cambios de pestaña sin perder borradores, publicación ARS, primer TC, factura USD pendiente/aprobada, segundo TC con extras, revisión documental y cierre financiero. Se encontró y corrigió un rechazo falso de revisión por timestamp sin zona horaria: el listado devuelve UTC compatible con Drizzle; una regresión PostgreSQL conserva el rechazo de versiones realmente distintas. La aprobación desde la UI y el envío del segundo TC funcionaron después de corregirlo. Las pruebas de horas pagas cubren jornadas completas, parciales y bases contractuales personalizadas, no una excepción por persona. Evidencia: `.context/team-ux-desktop.png`, `.context/team-ux-mobile.png`, `.context/team-ux-paid-leave.png` y `.context/team-ux-approval.png`.

Los avisos de publicación/autorización y recordatorios de pendientes utilizan el sistema de notificaciones existente. El corte depende del calendario de feriados configurado y del job habilitado (`DISABLE_TEAM_PAYROLL=true` permite desactivarlo). Las horas excepcionales posteriores al corte requieren reapertura previa a publicar. Preparar borradores no publica ni autoriza importes.

La carga del TC bancario, la confirmación de recepción, la emisión fiscal, las aprobaciones y los pagos siguen siendo acciones humanas; no hay conexión bancaria ni emisión fiscal automática. La extracción automática del PDF no se certificó en este QA: se verificó el ingreso explícito del importe y su validación. Las facturas históricas conservan evidencia y no reciben autorizaciones nuevas por inferencia: antes de desplegar hay que inventariar liquidaciones ya publicadas/facturadas y definir su conciliación con Finanzas; no intentar migrarlas como facturas nuevas. Los escenarios productivos y pagos parciales deben validarse durante esa conciliación. Estas pruebas no certifican ausencia de bugs.

### Preparación de datos y puesta en marcha

1. Último cierre del maestro confirmado: agosto de 2026. Identificar y conservar su versión aprobada y los respaldos. Conciliar agosto en Mind manteniendo el corte vigente; no cambiarlo para esconder diferencias.
2. Conservar backup de base y evidencia documental. Restaurarlo en una instancia aislada y verificar conteos/saldos antes del corte operativo definitivo. La prueba local de estructura y datos sintéticos no reemplaza esa restauración de producción. Después de CI, desplegar el cambio y revisar configuración, migraciones y logs. Los presupuestos abiertos figurarán pendientes hasta completar su carga nativa.
3. Registrar cuentas, moneda, fecha y saldo inicial de apertura de agosto respaldado por extracto (cierre del 31 de julio). No sumar cada snapshot histórico del Excel como si fuera una nueva cuenta por cobrar/pagar.
4. Revisar las facturas pendientes al corte y cargarlas con saldo residual; aplicar luego cobros/pagos reales. Conservar número, contraparte, monto original, impuestos, FX y evidencia.
5. Completar eventos de ingreso y ventanas de prestación desde contratos/facturas. No inferir el día de factura o cobro a partir del mes de un agregado del maestro.
6. Aprobar y cargar presupuesto mensual, tarifas y FX/REM en Mind. La migración no convierte los importes históricos en decisiones aprobadas.
7. Conciliar por documento, proyecto, cuenta y período: facturación/devengado/cobranza, costo directo/indirecto, impuestos, provisiones, cuentas a cobrar/pagar y saldo de caja. Documentar cada diferencia por redondeo, moneda, timing, regla o dato faltante.
8. Ejecutar agosto como primer cierre de validación contra el maestro aprobado y septiembre como segundo período. Aprobar las diferencias de ambos con Finanzas; septiembre sigue pendiente de validación. Los contadores del panel no son un certificado de aprobación.
9. Verificar los reportes productivos y retirar el maestro como operación mensual sólo cuando la conciliación esté aprobada. Conservar el archivo histórico.

## Reapertura y recuperación

- Si el período está en revisión, usar «Devolver a corrección» con motivo. Queda abierto y exige repetir el pre-cierre antes de una nueva revisión.
- Usar Cierre financiero → Reabrir con motivo y permiso Admin. Corregir el origen en Mind, volver a ejecutar el pre-cierre, enviar a revisión y cerrar. El cierre produce una nueva versión y auditoría.
- No deshabilitar triggers ni cambiar el corte para corregir importes. Las importaciones técnicas anteriores al corte siguen sujetas a cierres.
- Si el despliegue falla antes de instalar las dos migraciones, la transacción revierte y el servidor no inicia. No reactivar los jobs del maestro como recuperación automática.
- Una reversión de versión de aplicación debe preservar la base y sus guardas. Cualquier restauración de datos requiere el respaldo y las aprobaciones de conciliación, no recalcular desde el Excel en producción.
