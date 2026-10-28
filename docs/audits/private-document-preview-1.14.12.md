# Comprobantes y adicionales — 1.14.12

## Problema y alcance

El reporte de Victoria Achabal muestra `ERR_BLOCKED_BY_CLIENT` al abrir un comprobante en otra pestaña, y confusión entre adicionales de Operaciones ya incluidos y extras nuevos del colaborador. La consulta productiva de sólo lectura confirmó 89.000 ARS en adicionales de Operaciones y 0 en extras nuevos. La factura USD estaba aprobada por la usuaria; la verificación no modificó datos reales ni descargó su comprobante.

El PDF sintético válido se abrió con el visor nativo del Chrome de prueba, por lo que la causa exacta del bloqueo en el equipo reportado no quedó reproducida. No se atribuye concluyentemente a extensiones, archivo, permisos ni CSP.

## Resultado

- Mis facturas y Facturas del equipo abren el comprobante dentro de Mind, con PDF renderizado en canvas mediante PDF.js, páginas, zoom y descarga del original. Imágenes y texto plano tienen vista propia; formatos activos o desconocidos sólo se descargan.
- El documento se solicita con la autenticación existente, únicamente en el origen de Mind, sin redirecciones ni caché. El worker y los recursos de PDF.js se publican desde la propia aplicación. Se revocan las URLs temporales al cerrar.
- Los endpoints privados, sus permisos, CSP sandbox, `nosniff` y `private, no-store` conservan su comportamiento. No se amplía acceso ni se cambia almacenamiento.
- Mis facturas muestra por separado lo ya cargado por Operaciones, extras nuevos y total de adicionales. El campo editable identifica que sólo recibe extras nuevos. No cambia la fórmula financiera ni el contrato del envío.

## Verificación

- 1.032 pruebas pasadas, 11 omitidas por la suite existente. Typecheck y build productivo correctos.
- Base local aislada con esquema restaurado sin datos productivos, usuarios sintéticos y notificaciones externas desactivadas. PDF de prueba válido generado y comprobado visualmente antes de subirlo por la API normal.
- Finanzas abrió el PDF dentro del diálogo. El colaborador también abrió su comprobante en viewport móvil. Capturas locales en `.context/document-preview-fix/`.
- La descarga desde el diálogo produjo exactamente el SHA-256 del PDF subido.
- 89.000 de Operaciones + 0 nuevos: importe ARS 574.000,40 al TC 1505; al agregar 1.000 nuevos: total adicionales 90.000 e importe 575.000,40. Envío y recarga conservaron esos valores; el monto de Operaciones siguió siendo 89.000.
- Ambos endpoints de documento devolvieron 200 al dueño y Finanzas, 403 a otra persona y Operaciones sin Finanzas, y 401 anónimo. Se verificaron bytes originales y cabeceras privadas.
- Pruebas de límites: rechazar orígenes externos/esquemas activos; no embeber HTML, SVG, JS, Office ni MIME desconocido.

## Publicación

Antes del merge, Mind seguía saludable en el SHA e6b04dd60514230290265b29d3dfcd60267619cb (1.14.11). Railway reportaba un incidente activo de despliegues detenidos en inicialización el 28 de octubre a las 17:49 UTC, según https://status.railway.com/. La existencia de un PR o CI verde no demuestra publicación; se debe registrar el SHA servido y verificar los assets del visor después del despliegue.
