# Transición financiera de Mind — 9 de octubre de 2026

## Resultado y alcance

Implementación preparada en la rama de trabajo; no desplegada por esta auditoría. La transición funcional todavía no está aprobada. Producción se consultó exclusivamente en una transacción de solo lectura.

La configuración productiva es `hours_data_source=1` y `app_mode_cutover_date=2026-08`. La fecha estaba activada para horas, pero no cerraba todos los importadores financieros.

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
2. La migración `0084` instala protecciones en PostgreSQL. Verifica período anterior y nuevo, ventanas de devengamiento y presupuesto, y coordina escrituras con cierre mediante el mismo bloqueo transaccional. Un mes cerrado o en revisión no admite cambios; cambiar un dato de un pre-cierre lo invalida. Sólo el cierre nativo puede publicar el resumen posterior al corte.
3. Presupuesto de costos en `/finance/presupuesto`: concepto, categoría, directo/indirecto, moneda, importe mensual y vigencia de hasta 60 meses. Tiene auditoría y control de versión para evitar que dos ediciones se pisen. Se puede desactivar; no se borra historia. Si la vigencia afecta un cierre, requiere reapertura.
4. La proyección consume presupuesto nativo en períodos abiertos y snapshots en los cerrados. Conserva el histórico anterior al corte. Ausencia de presupuesto o FX produce importes pendientes y totales incompletos, no costo cero. Los importes del maestro posteriores al corte permanecen como referencia de conciliación y no se usan como presupuesto vigente.
5. El cierre muestra controles de transición y comparación de ingresos/presupuesto importados contra Mind. Agrega controles críticos para saldos de apertura y para impedir cerrar con ingresos nativos vacíos cuando hay ingresos importados de referencia. Estos controles detectan faltantes; no certifican la integridad documental ni sustituyen la aprobación de Finanzas.
6. Tarifas continúan editándose en Configuración → Personal; se ocultan/desactivan controles de sincronización con el maestro después del corte. FX y REM se cargan en Variables económicas o por la Bandeja; dólar e IPC mantienen sus fuentes externas independientes.
7. Los adaptadores de costos y FX dejaron de leer Sheets durante la operación nativa. Las cuentas y agregados importados quedan como referencia; los cálculos nativos excluyen filas de origen Excel. El agregado de costos conserva su origen hasta reconstruirse desde Mind, evitando que un total importado se presente como costo nativo. La migración `0085` limita el P&L de BI a historia anterior al corte y cierres nativos, y alimenta Cashflow con el ledger nativo, excluyendo anulaciones y transferencias propias.
8. Ambas migraciones se instalan en una transacción antes de servir solicitudes; si fallan, el servidor no arranca sin esas protecciones.

## Validación

- Migraciones aplicadas sobre una base PostgreSQL 16 local con copia de la estructura productiva, sin filas productivas; comprobación de idempotencia.
- Pruebas PostgreSQL de límites del corte, meses cerrados, movimientos entre períodos, ventanas de devengamiento, invalidación de pre-cierre, FX faltante, presupuesto mensual y cierre concurrente. Se incorporan a CI con PostgreSQL local.
- HTTP local con rutas reales: permisos financieros, alta y edición, rechazo de moneda inválida, conflicto por versión desactualizada, proyección y reporte de transición.
- Cierre completo con datos sintéticos: pre-cierre → revisión → snapshot, rechazo de modificación del snapshot, reapertura y evento de auditoría. El saldo de caja se conservó. También se verifica el cierre con ingresos registrados y la aplicación de pagos posteriores sobre facturas de meses cerrados, sin permitir cambiar sus importes económicos.
- Revisión en Chrome de alta/edición del presupuesto y panel de transición. Evidencia local en `.context/financial-budget-qa.jpg` y `.context/financial-transition-qa.jpg`.
- Los resultados finales de tests, TypeScript y build se detallan en el PR. Ninguna prueba implica conciliación ni aprobación financiera productiva.

## Secuencia para completar la transición

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

- Usar Cierre financiero → Reabrir con motivo y permiso Admin. Corregir el origen en Mind, volver a ejecutar el pre-cierre, enviar a revisión y cerrar. El cierre produce una nueva versión y auditoría.
- No deshabilitar triggers ni cambiar el corte para corregir importes. Las importaciones técnicas anteriores al corte siguen sujetas a cierres.
- Si el despliegue falla antes de instalar las dos migraciones, la transacción revierte y el servidor no inicia. No reactivar los jobs del maestro como recuperación automática.
- Una reversión de versión de aplicación debe preservar la base y sus guardas. Cualquier restauración de datos requiere el respaldo y las aprobaciones de conciliación, no recalcular desde el Excel en producción.
