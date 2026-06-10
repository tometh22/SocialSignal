-- Fase 1.5: Seed de aliases de personal del Excel MAESTRO
-- Matchea cada alias contra personnel por el último token del nombre (apellido).
-- Si no hay match, inserta con personnel_id NULL para que el admin lo resuelva
-- desde /api/admin/alias-coverage.

INSERT INTO sheet_personnel_aliases (sheet_name, personnel_id)
SELECT v.alias, match.id
FROM (VALUES
  ('Vicky Achabal'),
  ('Vicky Puricelli'),
  ('Tomi Criado'),
  ('Lola Camara'),
  ('Vanu Lanza'),
  ('Romi Figueroa'),
  ('Gast Guntren'),
  ('Xavi Aranzana'),
  ('Tomi Facio'),
  ('Trini Petreigne'),
  ('Aylu Tamer'),
  ('Maricel Perez'),
  ('Mati Gonzalez'),
  ('To Merello'),
  ('Cata Astiz'),
  ('Ina Ceravolo'),
  ('Male Quiroga'),
  ('Sandra Heyman'),
  ('Santi Berisso'),
  ('Sol Ayala'),
  ('Sil Vera'),
  ('Denise Sielfeld'),
  ('Ana Dalila Pop'),
  ('Cami Burstein'),
  ('Paula Setrini'),
  ('Ali Crosa'),
  ('Fernanda Di Benedetto'),
  ('Sandra Gomes'),
  ('Pablo Ovejero'),
  ('Gastón Julian'),
  ('Belen Lebrón'),
  ('People')
) AS v(alias)
LEFT JOIN LATERAL (
  SELECT p.id
  FROM personnel p
  WHERE translate(lower(p.name), 'áéíóúüñ', 'aeiouun')
        LIKE '%' || translate(lower(
          -- último token del alias (apellido); 'People' matchea 'Pechi'
          CASE WHEN v.alias = 'People' THEN 'Pechi'
               ELSE reverse(split_part(reverse(v.alias), ' ', 1))
          END
        ), 'áéíóúüñ', 'aeiouun') || '%'
  ORDER BY p.id
  LIMIT 1
) AS match ON true
ON CONFLICT (sheet_name) DO NOTHING;
