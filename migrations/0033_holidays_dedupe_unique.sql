-- Feriados: elimina duplicados existentes (mismo date+name) conservando la fila
-- más antigua, y agrega una restricción única para que no puedan volver a
-- crearse (bug reportado: "Paso a la Inmortalidad del Gral. San Martín" x3).

BEGIN;

DELETE FROM holidays h
USING holidays dup
WHERE h.date = dup.date
  AND h.name = dup.name
  AND h.id > dup.id;

ALTER TABLE holidays
  ADD CONSTRAINT unique_holiday_date_name UNIQUE (date, name);

COMMIT;
