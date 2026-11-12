# Pipeline comercial

Ruta: `/crm/pipeline`, accesible desde CRM. Vistas navegables mediante `view`; `snapshotId` abre un corte congelado. API: `/api/crm/pipeline` (oportunidades, resumen, alertas, configuración, checklist, cortes, decisiones, registro y resumen ejecutivo).

## Modelo y permisos

`pipeline_opportunities` representa alcances independientes, vinculados mediante IDs existentes. No modifica etapas nativas, no crea contactos ni proyectos y no interpreta aprobación interna como aceptación. Cuenta, responsable y contacto primario vinculados se resuelven desde CRM al leer la cartera; los cortes congelan los valores resueltos. Los campos externos son contexto hasta conciliar los vínculos.

CRM habilita lectura y edición, conforme al permiso vigente del repositorio: no existe un permiso CRM separado de solo lectura. Los cortes son siempre de lectura. Configurar el umbral requiere administrador. Los alcances con referencias de cotizaciones requieren además `quotations`, antes de agregarlos o exportarlos. Registro y decisiones requieren también `quotations`, por contener fundamentos comerciales que pueden citar esas fuentes. No se incluyen ingresos financieros en la API.

Importes `numeric`, cálculo entero en centavos y redondeo al final. Probabilidad independiente de confianza y etapa. `eligible=false` excluye alternativas, revisiones reemplazadas o componentes superpuestos; exige motivo. La elección del alcance se concilia explícitamente, no se deduce del estado interno de una cotización. La API acepta equivalencias aprobadas con tasa, dirección, fecha, fuente y criterio; el formulario deja la conversión pendiente si todavía no existe esa validación.

Las mutaciones de oportunidades usan `version` y una transacción con auditoría. Cortes y cargas tienen clave idempotente. Los cortes y el registro tienen protección SQL contra UPDATE/DELETE. La edición posterior de la cartera no cambia un corte. Los parámetros guardados incluyen versión de reglas, umbral, zona horaria y antigüedad de evidencia.

## Migración

`migrations/0096_commercial_pipeline.sql` y su copia runtime en `server/migrations/commercial-pipeline.ts`. `applyPendingMigrations()` la ejecuta de forma idempotente mediante el mecanismo ya usado por Mind. El despliegue autorizado puede ejecutar `npm run db:migrate`. No ejecutar `db:push` como sustituto de los triggers de inmutabilidad.

## Carga privada con conciliación

El anexo comercial no está incluido como fixture ni como archivo público. Mantener entrada, vista previa y manifiesto dentro de `.context/` o almacenamiento privado equivalente.

1. Vista previa sin conexión, sin escrituras:

   ```sh
   npx tsx scripts/prepare-pipeline-import.ts RUTA_PRIVADA_AL_PROMPT.md
   ```

   Genera `.context/pipeline-reconciliation-preview.json`: hash del origen, conteos, métricas, claves de origen y fichas a conciliar. Sin `--database` no afirma haber verificado IDs actuales.

2. Con la conexión autorizada configurada, repetir con `--database`. Solo lee CRM, usuarios y cotizaciones. Revisar candidatos de lead, números reales de cotización, revisiones, responsable, estado nativo y fecha de actualización. Múltiples candidatos requieren decisión humana. Las partidas de un paquete pueden compartir cotización: no sumar también el paquete. Confirmar por separado la alternativa seleccionada y las versiones reemplazadas.

3. Crear un manifiesto privado:

   ```json
   {
     "inputHash": "HASH_DE_LA_VISTA_PREVIA",
     "actorId": 123,
     "reason": "Motivo documentado de la carga histórica",
     "live": []
   }
   ```

   Con `live: []` se guarda únicamente el corte histórico. Conserva fecha de evidencia original y fecha real de creación. Para promover alcances a la cartera, agregar entradas `{ "importKey": "CLAVE_DE_ORIGEN", "reason": "Decisión de conciliación", "data": { ...campos verificados actuales... } }`. Revisar relaciones y evidencia antes de promover. El script no actualiza una clave ya importada ni pisa ediciones humanas posteriores.

4. Aplicación explícita, únicamente en entorno autorizado:

   ```sh
   npx tsx scripts/prepare-pipeline-import.ts RUTA_PRIVADA_AL_PROMPT.md --database --apply .context/pipeline-manifest.json
   ```

   La aplicación valida el actor CRM y los vínculos. Un reintento conserva el corte y las claves existentes.

La vista previa preparada para este trabajo verificó el anexo fuera de línea. Falta conciliar contra la base de Mind: no había `DATABASE_URL` del entorno. No se ejecutó carga ni migración productiva. La facturación Warner mensual sigue pendiente de conciliación con Finanzas; la referencia declarada se muestra separada y solo con permiso financiero.

## Verificación

- `npm run check`
- `npx vitest run tests/commercial-pipeline.test.ts`
- `npm run build`
- `PIPELINE_TEST_DATABASE_URL=URL_DE_BASE_LOCAL_VACIA npx vitest run tests/commercial-pipeline.integration.test.ts`

La integración crea tablas mínimas en una base **descartable vacía**, nunca en Mind. Cubre permiso denegado, acceso a cotizaciones, idempotencia, concurrencia, checklist y permanencia de cortes. La prueba de navegador local usa respuestas sintéticas: valida ruta, formulario, cierre y disposición móvil; no reemplaza el smoke test en Mind con usuarios y datos reales.
