-- Sesiones de "daily" por sala de review: cada vez que alguien recorre el room
-- ítem por ítem en Modo Daily queda registrado cuánto duró, cuántos ítems revisó
-- y un resumen de lo que cambió. Sirve para la racha, el "ayer duró X" y para
-- que el resumen semanal se pueda armar sumando las dailies.
CREATE TABLE IF NOT EXISTS review_daily_sessions (
  id serial PRIMARY KEY,
  room_id integer NOT NULL REFERENCES review_rooms(id) ON DELETE CASCADE,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamp NOT NULL,
  finished_at timestamp NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0,
  reviewed_count integer NOT NULL DEFAULT 0,
  changed_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rds_room_finished ON review_daily_sessions(room_id, finished_at DESC);
