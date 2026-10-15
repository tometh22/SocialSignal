-- Minimal existing Mind schema for isolated connector integration tests.
CREATE TABLE users (id integer PRIMARY KEY, first_name text, last_name text, is_active boolean DEFAULT true,
  is_admin boolean DEFAULT false, role text DEFAULT 'member', permissions text[] DEFAULT ARRAY['status']);
CREATE TABLE review_rooms (id integer PRIMARY KEY, name text, description text, archived_at timestamp);
CREATE TABLE review_room_members (room_id integer REFERENCES review_rooms, user_id integer REFERENCES users, PRIMARY KEY(room_id,user_id));
CREATE TABLE clients (id integer PRIMARY KEY, name text);
CREATE TABLE quotations (id integer PRIMARY KEY, project_name text);
CREATE TABLE active_projects (id integer PRIMARY KEY, name text, quotation_id integer, client_id integer, status text);
CREATE TABLE project_status_reviews (id integer PRIMARY KEY, room_id integer, project_id integer,
  health_status text, margin_status text, team_strain text, main_risk text, current_action text, next_milestone text,
  next_milestone_date timestamp, deadline timestamp, owner_id integer, decision_needed text, updated_at timestamp DEFAULT now(), hidden_from_weekly boolean DEFAULT false);
CREATE TABLE weekly_status_items (id integer PRIMARY KEY, room_id integer, title text, subtitle text,
  health_status text, margin_status text, team_strain text, main_risk text, current_action text, next_milestone text,
  deadline timestamp, owner_id integer, decision_needed text, updated_at timestamp DEFAULT now(), hidden_from_weekly boolean DEFAULT false);
CREATE TABLE project_review_notes (id integer PRIMARY KEY, room_id integer, project_id integer, weekly_status_item_id integer,
  content text, author_id integer, created_at timestamp DEFAULT now(), note_date timestamp DEFAULT now());
CREATE TABLE status_update_entries (id integer PRIMARY KEY, room_id integer, project_id integer, weekly_status_item_id integer,
  content text, author_id integer, created_at timestamp DEFAULT now());
CREATE TABLE status_change_log (id integer PRIMARY KEY, room_id integer, project_id integer, weekly_status_item_id integer,
  field_name text, old_value text, new_value text, user_id integer, created_at timestamp DEFAULT now());

INSERT INTO users(id,first_name,last_name) VALUES (1,'Tomi','Test'),(2,'Vicky','Test'),(3,'Sin','Salas'),(4,'Inactivo','Test');
UPDATE users SET is_active=false WHERE id=4;
INSERT INTO review_rooms VALUES (10,'Status semanal','Compartido con Vick',NULL),(20,'Privada','No compartir',NULL),(30,'Archivo',NULL,now());
INSERT INTO review_room_members VALUES (10,1),(10,2),(20,2),(30,1);
INSERT INTO clients VALUES(1,'Cliente Test');
INSERT INTO quotations VALUES(1,'Nombre viejo');
INSERT INTO active_projects VALUES(100,'Nombre operativo',1,1,'active'),(101,'Oculto',1,1,'active');
INSERT INTO project_status_reviews(id,room_id,project_id,health_status,main_risk,owner_id,decision_needed) VALUES
  (1,10,100,'rojo','Demora en entrega',2,'recursos'),(2,20,100,'verde','SECRETO DE OTRA SALA',2,'ninguna');
INSERT INTO project_status_reviews(id,room_id,project_id,hidden_from_weekly) VALUES(3,10,101,true);
INSERT INTO weekly_status_items(id,room_id,title,health_status,current_action,owner_id,decision_needed) VALUES
  (200,10,'Tema adicional','amarillo','Coordinar con Vick',1,'priorizacion');
INSERT INTO weekly_status_items(id,room_id,title,hidden_from_weekly) VALUES(201,10,'Tema oculto',true);
INSERT INTO project_review_notes(id,room_id,project_id,weekly_status_item_id,content,author_id) VALUES
  (1,10,100,NULL,'Nota visible',2),(2,20,100,NULL,'NOTA SECRETA',2),(3,10,101,NULL,'NOTA OCULTA',2),(4,10,NULL,201,'TEMA OCULTO',2);
INSERT INTO status_update_entries(id,room_id,weekly_status_item_id,content,author_id) VALUES(1,10,200,'Actualización del tema',1);
INSERT INTO status_change_log(id,room_id,project_id,field_name,old_value,new_value,user_id) VALUES(1,10,100,'healthStatus','verde','rojo',2);
