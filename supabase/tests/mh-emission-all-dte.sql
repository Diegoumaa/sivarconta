-- Synthetic fixtures only. All changes are rolled back; no MH requests or emails.
-- Requires 20261111_mh_test_emission.sql and 20261111b_mh_emission_all_dte.sql.
BEGIN;
CREATE TEMP TABLE mh_checks(label TEXT);
GRANT SELECT,INSERT ON pg_temp.mh_checks TO authenticated,service_role;
CREATE FUNCTION pg_temp.mh_check(ok BOOLEAN,label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT coalesce(ok,FALSE) THEN RAISE EXCEPTION 'MH TEST FAILED: %',label; END IF;
  INSERT INTO pg_temp.mh_checks VALUES(label);
END; $$;
CREATE FUNCTION pg_temp.mh_denied(command TEXT,expected TEXT,label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE command; RAISE EXCEPTION 'MH TEST FAILED: %',label;
EXCEPTION WHEN others THEN
  IF SQLSTATE<>expected THEN RAISE; END IF;
  PERFORM pg_temp.mh_check(TRUE,label);
END; $$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('f2221000-0000-4000-8000-000000000001','mh2-owner@example.invalid','{}'),
 ('f2221000-0000-4000-8000-000000000002','mh2-accountant@example.invalid','{}');
INSERT INTO public.companies(id,name,nit,nrc,economic_activity_code,economic_activity_desc,email,phone,address,mh_environment) VALUES
 ('f2222000-0000-4000-8000-000000000001','MH tipos A','0000-000000-000-0','1','62010','QA','qa@example.invalid','00000000','QA','PRUEBAS');
INSERT INTO public.company_members(company_id,user_id,role) VALUES
 ('f2222000-0000-4000-8000-000000000001','f2221000-0000-4000-8000-000000000001','owner'),
 ('f2222000-0000-4000-8000-000000000001','f2221000-0000-4000-8000-000000000002','accountant');
INSERT INTO public.invoices(id,company_id,dte_type,control_number,generation_code,client_name,client_doc_type,client_doc_number,total_pagar,total_letras,status)
SELECT ('f2223000-0000-4000-8000-'||lpad(n::TEXT,12,'0'))::UUID,'f2222000-0000-4000-8000-000000000001',
 (ARRAY['03','03','05','14'])[n],'QA2-MH-'||n,gen_random_uuid(),'CLIENTE FICTICIO','NIT','44444444444443',11.3,'ONCE 30/100','BORRADOR'
FROM generate_series(1,4) n;
CREATE TEMP TABLE mh_ctx(label TEXT PRIMARY KEY,data JSONB);
GRANT ALL ON pg_temp.mh_ctx TO service_role;

-- Privilegios: el navegador no puede reservar, liberar ni fabricar invalidaciones.
SELECT pg_temp.mh_check(NOT has_function_privilege('authenticated','public.release_mh_test_emission(uuid,uuid,jsonb)','EXECUTE'),'navegador no puede liberar reservas');
SELECT pg_temp.mh_check(NOT has_function_privilege('anon','public.reserve_mh_test_invalidation(uuid,uuid,uuid)','EXECUTE'),'anónimo no puede invalidar');
SELECT pg_temp.mh_check(NOT has_function_privilege('authenticated','public.finish_mh_test_invalidation(uuid,uuid,jsonb)','EXECUTE'),'navegador no puede fabricar sellos de invalidación');
SELECT pg_temp.mh_check(NOT has_table_privilege('authenticated','public.mh_test_invalidations','SELECT'),'tabla de invalidaciones no expuesta');
-- Distrito del cliente (CAT-008): dos dígitos o vacío.
SELECT pg_temp.mh_denied($q$INSERT INTO public.clients(company_id,name,doc_type,doc_number,email,phone,address,district_code) VALUES('f2222000-0000-4000-8000-000000000001','X','NIT','1','','','','1')$q$,'23514','distrito mal formado rechazado');
INSERT INTO public.clients(company_id,name,doc_type,doc_number,email,phone,address,district_code) VALUES('f2222000-0000-4000-8000-000000000001','X','NIT','1','','','','14');
SELECT pg_temp.mh_check(EXISTS(SELECT 1 FROM public.clients WHERE company_id='f2222000-0000-4000-8000-000000000001' AND district_code='14'),'distrito válido guardado');

SET LOCAL ROLE service_role;
INSERT INTO pg_temp.mh_ctx VALUES('ccf',public.reserve_mh_test_emission('f2222000-0000-4000-8000-000000000001','f2223000-0000-4000-8000-000000000001','f2221000-0000-4000-8000-000000000001'));
INSERT INTO pg_temp.mh_ctx VALUES('nc',public.reserve_mh_test_emission('f2222000-0000-4000-8000-000000000001','f2223000-0000-4000-8000-000000000003','f2221000-0000-4000-8000-000000000001'));
INSERT INTO pg_temp.mh_ctx VALUES('fse',public.reserve_mh_test_emission('f2222000-0000-4000-8000-000000000001','f2223000-0000-4000-8000-000000000004','f2221000-0000-4000-8000-000000000001'));
SELECT pg_temp.mh_check((SELECT data#>>'{invoice,control_number}'='DTE-03-M001P001-000000000000001' FROM pg_temp.mh_ctx WHERE label='ccf'),'CCF con prefijo 03 y contador propio');
SELECT pg_temp.mh_check((SELECT data#>>'{invoice,control_number}'='DTE-05-M001P001-000000000000001' FROM pg_temp.mh_ctx WHERE label='nc'),'NC con prefijo 05 y contador propio');
SELECT pg_temp.mh_check((SELECT data#>>'{invoice,control_number}'='DTE-14-M001P001-000000000000001' FROM pg_temp.mh_ctx WHERE label='fse'),'FSE con prefijo 14 y contador propio');
SELECT pg_temp.mh_denied($q$SELECT public.reserve_mh_test_emission('f2222000-0000-4000-8000-000000000001','f2223000-0000-4000-8000-000000000002','f2221000-0000-4000-8000-000000000002')$q$,'42501','contador no puede emitir CCF');

DO $$
DECLARE r JSONB; d JSONB; again JSONB; saved JSONB; iid UUID:='f2223000-0000-4000-8000-000000000003'; ticket UUID;
BEGIN
 -- Liberación: datos faltantes antes de congelar el JSON devuelven el borrador.
 SELECT data INTO r FROM pg_temp.mh_ctx WHERE label='nc'; ticket:=(r->>'lease')::UUID;
 BEGIN PERFORM public.release_mh_test_emission(iid,gen_random_uuid(),'{}'); RAISE EXCEPTION 'released with foreign lease';
 EXCEPTION WHEN lock_not_available THEN PERFORM pg_temp.mh_check(TRUE,'liberar exige el lease vigente'); END;
 saved:=public.release_mh_test_emission(iid,ticket,'{"descripcionMsg":"La nota debe referirse a un CCF"}');
 PERFORM pg_temp.mh_check(saved->>'status'='BORRADOR' AND saved->>'mh_emission_state' IS NULL AND saved#>>'{mh_response_json,estado}'='SIN_ENVIAR','documento liberado vuelve a borrador editable');
 PERFORM pg_temp.mh_check(NOT EXISTS(SELECT 1 FROM public.mh_test_emissions WHERE invoice_id=iid),'reserva liberada no deja registro de envío');
 again:=public.reserve_mh_test_emission('f2222000-0000-4000-8000-000000000001',iid,'f2221000-0000-4000-8000-000000000001');
 PERFORM pg_temp.mh_check(again#>>'{invoice,control_number}'='DTE-05-M001P001-000000000000002' AND again#>>'{invoice,generation_code}'<>r#>>'{invoice,generation_code}','nueva reserva: UUID nuevo y número nunca reutilizado');

 -- CCF: el tipo del JSON debe coincidir con el documento guardado.
 SELECT data INTO r FROM pg_temp.mh_ctx WHERE label='ccf'; ticket:=(r->>'lease')::UUID; iid:='f2223000-0000-4000-8000-000000000001';
 d:=jsonb_build_object('identificacion',jsonb_build_object('ambiente','00','tipoDte','03','codigoGeneracion',upper(r#>>'{invoice,generation_code}'),
  'numeroControl',r#>>'{invoice,control_number}','fecEmi',timezone('America/El_Salvador',statement_timestamp())::DATE,
  'horEmi',to_char(timezone('America/El_Salvador',statement_timestamp()),'HH24:MI:SS')),'emisor',jsonb_build_object('nit','00000000000000'),
  'receptor',jsonb_build_object('nit','44444444444443','nombre','PRUEBA PERSONA JURIDICA'));
 BEGIN PERFORM public.prepare_mh_test_emission(iid,ticket,jsonb_set(d,'{identificacion,tipoDte}','"01"')); RAISE EXCEPTION 'accepted wrong type';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'JSON de otro tipo bloqueado'); END;
 PERFORM public.prepare_mh_test_emission(iid,ticket,d);
 BEGIN PERFORM public.release_mh_test_emission(iid,ticket,'{}'); RAISE EXCEPTION 'released prepared document';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'JSON ya preparado no se libera'); END;
 PERFORM public.start_mh_test_emission(iid,ticket);
 saved:=public.finish_mh_test_emission(iid,ticket,jsonb_build_object('estado','PROCESADO','estadoReportado','PROCESADO','ambiente','00','ambienteReportado','00',
  'codigoGeneracion',upper(r#>>'{invoice,generation_code}'),'codigoGeneracionReportado',upper(r#>>'{invoice,generation_code}'),'http',202,
  'selloRecibido',repeat('A',40),'codigoMsg','001','fhProcesamiento','11/11/2026 09:00:01'));
 PERFORM pg_temp.mh_check(saved->>'status'='PROCESADO' AND saved->>'mh_reception_stamp'=repeat('A',40),'CCF aceptado con su sello');
 INSERT INTO pg_temp.mh_ctx VALUES('ccf_doc',d);
END; $$;

-- Invalidación del CCF aceptado.
SELECT pg_temp.mh_denied($q$SELECT public.reserve_mh_test_invalidation('f2222000-0000-4000-8000-000000000001','f2223000-0000-4000-8000-000000000001','f2221000-0000-4000-8000-000000000002')$q$,'42501','contador no puede invalidar');
SELECT pg_temp.mh_denied($q$SELECT public.reserve_mh_test_invalidation('f2222000-0000-4000-8000-000000000001','f2223000-0000-4000-8000-000000000002','f2221000-0000-4000-8000-000000000001')$q$,'22023','borrador no se puede invalidar');
DO $$
DECLARE r JSONB; ev JSONB; saved JSONB; iid UUID:='f2223000-0000-4000-8000-000000000001'; ticket UUID; first_code TEXT; ccf JSONB;
BEGIN
 r:=public.reserve_mh_test_invalidation('f2222000-0000-4000-8000-000000000001',iid,'f2221000-0000-4000-8000-000000000001');
 ticket:=(r->>'lease')::UUID; first_code:=r->>'eventCode';
 SELECT data INTO ccf FROM pg_temp.mh_ctx WHERE label='ccf_doc';
 PERFORM pg_temp.mh_check(r->'dteDocument'=ccf AND r->>'state'='PREPARADO','reserva entrega el JSON aceptado del documento');
 PERFORM pg_temp.mh_denied(format('SELECT public.reserve_mh_test_invalidation(%L,%L,%L)','f2222000-0000-4000-8000-000000000001',iid,'f2221000-0000-4000-8000-000000000001'),'55P03','invalidación activa bloquea doble clic');
 ev:=jsonb_build_object('identificacion',jsonb_build_object('ambiente','00','codigoGeneracion',upper(first_code)),
  'emisor',jsonb_build_object('nit','00000000000000'),
  'documento',jsonb_build_object('tipoDte','03','codigoGeneracion',upper(r#>>'{invoice,generation_code}'),'selloRecibido',repeat('A',40)));
 BEGIN PERFORM public.prepare_mh_test_invalidation(iid,ticket,jsonb_set(ev,'{documento,selloRecibido}',to_jsonb(repeat('B',40)))); RAISE EXCEPTION 'accepted foreign seal';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'evento con sello ajeno bloqueado'); END;
 BEGIN PERFORM public.prepare_mh_test_invalidation(iid,ticket,jsonb_set(ev,'{documento,codigoGeneracion}',to_jsonb(gen_random_uuid()::TEXT))); RAISE EXCEPTION 'accepted foreign document';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'evento de otro documento bloqueado'); END;
 BEGIN PERFORM public.prepare_mh_test_invalidation(iid,ticket,jsonb_set(ev,'{identificacion,ambiente}','"01"')); RAISE EXCEPTION 'accepted production event';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'evento de producción bloqueado'); END;
 PERFORM public.prepare_mh_test_invalidation(iid,ticket,ev);
 PERFORM public.start_mh_test_invalidation(iid,ticket);
 PERFORM pg_temp.mh_check((SELECT state='ENVIO_INCIERTO' AND attempted_at IS NOT NULL FROM public.mh_test_invalidations WHERE invoice_id=iid),'intento de invalidación registrado antes de transmitir');
 BEGIN PERFORM public.finish_mh_test_invalidation(iid,ticket,'{"estado":"PROCESADO","http":200,"selloRecibido":"CORTO"}'); RAISE EXCEPTION 'accepted short seal';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'sello de evento incompleto no aceptado'); END;
 -- Rechazo: el evento no quedó registrado en Hacienda; se prepara otro con código nuevo.
 saved:=public.finish_mh_test_invalidation(iid,ticket,'{"estado":"RECHAZADO","http":400,"codigoMsg":"020"}');
 PERFORM pg_temp.mh_check(saved->>'status'='PROCESADO','rechazo del evento no cambia el documento');
 PERFORM pg_temp.mh_check((SELECT state='PREPARADO' AND document IS NULL AND event_code::TEXT<>first_code FROM public.mh_test_invalidations WHERE invoice_id=iid),'evento rechazado se reemplaza por uno nuevo');
 r:=public.reserve_mh_test_invalidation('f2222000-0000-4000-8000-000000000001',iid,'f2221000-0000-4000-8000-000000000001');
 ticket:=(r->>'lease')::UUID; ev:=jsonb_set(ev,'{identificacion,codigoGeneracion}',to_jsonb(upper(r->>'eventCode')));
 PERFORM public.prepare_mh_test_invalidation(iid,ticket,ev);
 PERFORM public.start_mh_test_invalidation(iid,ticket);
 saved:=public.finish_mh_test_invalidation(iid,ticket,jsonb_build_object('estado','PROCESADO','http',200,'selloRecibido',repeat('C',40),'fhProcesamiento','11/11/2026 09:10:00'));
 PERFORM pg_temp.mh_check(saved->>'status'='ANULADO' AND saved->>'mh_reception_stamp'=repeat('A',40),'documento invalidado conserva su sello original');
 PERFORM pg_temp.mh_check(saved#>>'{mh_response_json,invalidacion,selloRecibido}'=repeat('C',40) AND saved#>'{mh_response_json,invalidacion,evento}'=ev,'sello y evento de invalidación guardados para auditoría');
 r:=public.reserve_mh_test_invalidation('f2222000-0000-4000-8000-000000000001',iid,'f2221000-0000-4000-8000-000000000001');
 PERFORM pg_temp.mh_check(r->>'state'='PROCESADO' AND r#>>'{response,selloRecibido}'=repeat('C',40),'reintento posterior no crea otro evento');
 saved:=public.finish_mh_test_invalidation(iid,(r->>'lease')::UUID,'{"estado":"SIN_CONFIRMAR"}');
 PERFORM pg_temp.mh_check(saved->>'status'='ANULADO','una respuesta posterior no revierte la invalidación');
END; $$;
RESET ROLE;
SELECT count(*) AS comprobaciones_aprobadas,jsonb_agg(label ORDER BY label) AS detalle FROM pg_temp.mh_checks;
ROLLBACK;
