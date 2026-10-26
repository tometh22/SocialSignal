# Cierre del equipo — publicación independiente 1.14.7

Fecha: 26 de octubre de 2026. Responsable de integración, migración y verificación del despliegue: workspace Curitiba. Publicación autorizada por Tomás para el cierre mensual y la liquidación ampliados.

## Alcance

Operaciones → Cierre del equipo reúne Base a cobrar y Facturación y seguimiento, con un mes compartido y protección de cambios sin guardar. Cada persona completa sus TC y extras en Mis facturas. Finanzas revisa los documentos en Facturas equipo y cada factura aprobada genera Pasivo con `cost_treatment=balance_only`, sin duplicar gastos.

Fijos: horas contractuales por tarifa histórica. Vacaciones, feriados y días Epical son pagos para todas las personas. Sólo una licencia sin goce explícita con motivo descuenta horas. Freelance: horas reales reconciliadas entre fuentes sin duplicar ni sumar cargas rechazadas. El corte se ejecuta el último día hábil a las 23:59 de Buenos Aires; la automatización comienza en el mes del despliegue, prepara borradores y avisa, sin publicar ni aprobar importes. Operaciones puede preparar nuevamente las bases para resolver tarifas faltantes y reabrir las horas antes de publicar, con motivo.

Operaciones define porcentaje USD, bonos en ARS/USD y adicionales. La persona envía el primer TC, espera autorización y sube factura USD; Administración la aprueba. Después del cobro confirma recepción y segundo TC, agrega extras con motivo y solicita autorización ARS. Sólo ARS no requiere TC. Se mantienen control de versiones, propiedad de archivos y protección de comprobantes aprobados.

Ejemplo validado: base ARS 10.000, 90% USD, TC 1.500/1.505 y extras ARS 5.000 → USD 6 + ARS 5.970.

## Separación de la transición financiera

El PR313, versión propuesta 1.15.0, conserva la transición financiera pendiente. Esta publicación extrae solamente el cierre del equipo desde su SHA `43891236`, sobre main 1.14.6.

Se aplica únicamente la migración 0089, transaccional e idempotente antes de servir solicitudes. No se instalan 0087/0088 ni los bloqueos de importación, no se cambia `app_mode_cutover_date` ni `hours_data_source`, no se activa el presupuesto o BI nativo, y preparar/publicar/autorizar liquidaciones no reconstruye los hechos financieros importados. Las vistas auxiliares de la 0089 quedan disponibles para la integración financiera posterior, sin reemplazar los reportes vigentes.

La carga de TC bancario, confirmación de recepción, emisión fiscal, aprobaciones y pagos siguen siendo acciones humanas. No se incorpora una conexión bancaria ni emisión fiscal automática.

## Verificación previa a publicar

- 1.008 pruebas aprobadas, 11 omitidas; integraciones PostgreSQL de horas civiles, corte, licencia paga, USD/ARS, sólo ARS, concurrencia y permisos. Automatización probada sin cierres retroactivos ni publicación de importes. Corrección de pendientes por tarifa comprobada tras preparar nuevamente las bases.
- TypeScript y build de producción correctos.
- Respaldo productivo real restaurado en PostgreSQL 18 aislado: 172 conteos coincidentes. Migración 0089 aplicada dos veces: las 25 tablas financieras conservan sus columnas anteriores y huellas de datos. Una actualización de prueba de ingreso importado sigue permitida en el clon y se revierte; no se instalan guardas de transición ni cortes históricos.
- HTTP real con datos sintéticos y schema productivo: base contractual y licencia sin goce, autorización por tramo, primer y segundo TC, bonos/extras, facturas USD/ARS y sólo ARS hasta Pasivo, importes/archivos propios y rechazo de terceros. Los hechos financieros no se sobrescriben. Sin escrituras financieras productivas durante QA.
- Chrome: pantalla unificada, mes compartido, facturación completa y desglose de importe base frente a importe autorizado. Revisión de escritorio y móvil de 390 px. Evidencia privada bajo `.context/team-close-release/`.

La publicación exige CI desde un checkout limpio. Después del merge se verifica el despliegue automático existente de Railway por SHA exacto, migración, salud, assets y acceso sin autenticar. Los respaldos y datos reales permanecen privados y fuera de Git.
