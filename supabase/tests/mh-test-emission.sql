-- Synthetic fixtures only. All changes are rolled back; no MH requests or emails.
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
 ('f1111000-0000-4000-8000-000000000001','mh-owner@example.invalid','{}'),
 ('f1111000-0000-4000-8000-000000000002','mh-billing@example.invalid','{}'),
 ('f1111000-0000-4000-8000-000000000003','mh-accountant@example.invalid','{}'),
 ('f1111000-0000-4000-8000-000000000004','mh-outsider@example.invalid','{}'),
 ('f1111000-0000-4000-8000-000000000005','mh-admin@example.invalid','{}');
INSERT INTO public.companies(id,name,nit,nrc,economic_activity_code,economic_activity_desc,email,phone,address,mh_environment) VALUES
 ('f1112000-0000-4000-8000-000000000001','MH prueba A','0000-000000-000-0','1','62010','QA','qa@example.invalid','00000000','QA','PRUEBAS'),
 ('f1112000-0000-4000-8000-000000000002','MH prueba B','0000-000000-000-0','2','62010','QA','qa@example.invalid','00000000','QA','PRUEBAS'),
 ('f1112000-0000-4000-8000-000000000003','MH producción bloqueada','0000-000000-000-0','3','62010','QA','qa@example.invalid','00000000','QA','PRODUCCION');
INSERT INTO public.company_members(company_id,user_id,role) VALUES
 ('f1112000-0000-4000-8000-000000000001','f1111000-0000-4000-8000-000000000001','owner'),
 ('f1112000-0000-4000-8000-000000000001','f1111000-0000-4000-8000-000000000002','billing'),
 ('f1112000-0000-4000-8000-000000000001','f1111000-0000-4000-8000-000000000003','accountant'),
 ('f1112000-0000-4000-8000-000000000001','f1111000-0000-4000-8000-000000000005','admin'),
 ('f1112000-0000-4000-8000-000000000002','f1111000-0000-4000-8000-000000000004','owner'),
 ('f1112000-0000-4000-8000-000000000003','f1111000-0000-4000-8000-000000000001','owner');
INSERT INTO public.invoices(id,company_id,dte_type,control_number,generation_code,client_name,client_doc_type,client_doc_number,total_pagar,total_letras,status)
SELECT ('f1113000-0000-4000-8000-'||lpad(n::TEXT,12,'0'))::UUID,'f1112000-0000-4000-8000-000000000001',
 CASE WHEN n=4 THEN '03' ELSE '01' END,'QA-MH-'||n,gen_random_uuid(),'CLIENTE FICTICIO','OTRO','',1.13,'UN DOLAR 13/100','BORRADOR'
FROM generate_series(1,4) n;
CREATE TEMP TABLE mh_reservations(label TEXT PRIMARY KEY,data JSONB);
GRANT ALL ON pg_temp.mh_reservations TO service_role;

SELECT pg_temp.mh_check(NOT has_function_privilege('anon','public.reserve_mh_test_emission(uuid,uuid,uuid)','EXECUTE'),'anónimo no puede emitir');
SELECT pg_temp.mh_check(NOT has_function_privilege('authenticated','public.reserve_mh_test_emission(uuid,uuid,uuid)','EXECUTE'),'navegador no puede suplantar al actor');
SELECT pg_temp.mh_check(NOT has_function_privilege('authenticated','public.finish_mh_test_emission(uuid,uuid,jsonb)','EXECUTE'),'navegador no puede fabricar sellos');
SELECT pg_temp.mh_check(NOT has_table_privilege('authenticated','public.mh_test_emissions','SELECT'),'tabla interna no expuesta al navegador');
SET LOCAL ROLE service_role;
SELECT pg_temp.mh_denied($q$SELECT public.reserve_mh_test_emission('f1112000-0000-4000-8000-000000000001','f1113000-0000-4000-8000-000000000001','f1111000-0000-4000-8000-000000000003')$q$,'42501','contador no puede emitir');
SELECT pg_temp.mh_denied($q$SELECT public.reserve_mh_test_emission('f1112000-0000-4000-8000-000000000001','f1113000-0000-4000-8000-000000000001','f1111000-0000-4000-8000-000000000004')$q$,'42501','usuario ajeno no puede emitir');
SELECT pg_temp.mh_denied($q$SELECT public.reserve_mh_test_emission('f1112000-0000-4000-8000-000000000002','f1113000-0000-4000-8000-000000000001','f1111000-0000-4000-8000-000000000004')$q$,'42501','factura de otra empresa bloqueada');
SELECT pg_temp.mh_denied($q$SELECT public.reserve_mh_test_emission('f1112000-0000-4000-8000-000000000003','f1113000-0000-4000-8000-000000000001','f1111000-0000-4000-8000-000000000001')$q$,'22023','ambiente de producción bloqueado');
-- Desde 20261111b el CCF se emite desde la aplicación con su propio prefijo y contador (sin el piso de los pilotos de Factura).
SELECT pg_temp.mh_check(public.reserve_mh_test_emission('f1112000-0000-4000-8000-000000000001','f1113000-0000-4000-8000-000000000004','f1111000-0000-4000-8000-000000000001')#>>'{invoice,control_number}'='DTE-03-M001P001-000000000000001','CCF usa su propio prefijo y contador');
INSERT INTO pg_temp.mh_reservations VALUES('first',public.reserve_mh_test_emission('f1112000-0000-4000-8000-000000000001','f1113000-0000-4000-8000-000000000001','f1111000-0000-4000-8000-000000000001'));
INSERT INTO pg_temp.mh_reservations VALUES('second',public.reserve_mh_test_emission('f1112000-0000-4000-8000-000000000001','f1113000-0000-4000-8000-000000000002','f1111000-0000-4000-8000-000000000002'));
INSERT INTO pg_temp.mh_reservations VALUES('third',public.reserve_mh_test_emission('f1112000-0000-4000-8000-000000000001','f1113000-0000-4000-8000-000000000003','f1111000-0000-4000-8000-000000000005'));
SELECT pg_temp.mh_check((SELECT data#>>'{invoice,control_number}'='DTE-01-M001P001-000000000000003' FROM pg_temp.mh_reservations WHERE label='first'),'correlativos 1 y 2 nunca se reutilizan');
SELECT pg_temp.mh_check((SELECT data#>>'{invoice,control_number}'='DTE-01-M001P001-000000000000004' FROM pg_temp.mh_reservations WHERE label='second'),'facturador obtiene siguiente correlativo');
SELECT pg_temp.mh_check((SELECT data#>>'{invoice,control_number}'='DTE-01-M001P001-000000000000005' FROM pg_temp.mh_reservations WHERE label='third'),'administrador obtiene siguiente correlativo');
SELECT pg_temp.mh_check((SELECT count(DISTINCT data#>>'{invoice,generation_code}')=3 FROM pg_temp.mh_reservations),'UUID nuevos por documento');
SELECT pg_temp.mh_denied($q$SELECT public.reserve_mh_test_emission('f1112000-0000-4000-8000-000000000001','f1113000-0000-4000-8000-000000000001','f1111000-0000-4000-8000-000000000002')$q$,'55P03','reserva activa bloquea doble clic');
DO $$
DECLARE r JSONB; d JSONB; bad JSONB; saved JSONB; retry JSONB; iid UUID:='f1113000-0000-4000-8000-000000000001'; ticket UUID;
BEGIN
 SELECT data INTO r FROM pg_temp.mh_reservations WHERE label='first'; ticket:=(r->>'lease')::UUID;
 d:=jsonb_build_object('identificacion',jsonb_build_object('ambiente','00','tipoDte','01','codigoGeneracion',upper(r#>>'{invoice,generation_code}'),
  'numeroControl',r#>>'{invoice,control_number}','fecEmi',timezone('America/El_Salvador',statement_timestamp())::DATE,
  'horEmi',to_char(timezone('America/El_Salvador',statement_timestamp()),'HH24:MI:SS')),'emisor',jsonb_build_object('nit','00000000000000'));
 BEGIN PERFORM public.prepare_mh_test_emission(iid,ticket,jsonb_set(d,'{identificacion,ambiente}','"01"')); RAISE EXCEPTION 'accepted bad environment';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'payload 01 bloqueado'); END;
 BEGIN PERFORM public.prepare_mh_test_emission(iid,ticket,jsonb_set(d,'{identificacion,codigoGeneracion}',to_jsonb(gen_random_uuid()::TEXT))); RAISE EXCEPTION 'accepted bad UUID';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'UUID distinto de reserva bloqueado'); END;
 BEGIN PERFORM public.prepare_mh_test_emission(iid,gen_random_uuid(),d); RAISE EXCEPTION 'accepted bad lease';
 EXCEPTION WHEN lock_not_available THEN PERFORM pg_temp.mh_check(TRUE,'lease ajeno bloqueado'); END;
 PERFORM public.prepare_mh_test_emission(iid,ticket,d);
 PERFORM public.start_mh_test_emission(iid,ticket);
 PERFORM pg_temp.mh_check((SELECT state='ENVIO_INCIERTO' AND attempted_at IS NOT NULL FROM public.mh_test_emissions WHERE invoice_id=iid),'intento queda registrado antes de transmitir');
 BEGIN PERFORM public.start_mh_test_emission(iid,ticket); RAISE EXCEPTION 'accepted duplicate start';
 EXCEPTION WHEN lock_not_available THEN PERFORM pg_temp.mh_check(TRUE,'segundo intento bloqueado'); END;
 BEGIN PERFORM public.prepare_mh_test_emission(iid,ticket,d); RAISE EXCEPTION 'accepted mutated document';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'JSON congelado después del primer intento'); END;
 bad:=jsonb_build_object('estado','PROCESADO','estadoReportado','PROCESADO','ambiente','00','codigoGeneracion',upper(r#>>'{invoice,generation_code}'),'ambienteReportado','01','codigoGeneracionReportado',upper(r#>>'{invoice,generation_code}'),'http',202,'selloRecibido',repeat('A',40));
 BEGIN PERFORM public.finish_mh_test_emission(iid,ticket,bad); RAISE EXCEPTION 'accepted production seal';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'sello de ambiente distinto no aceptado'); END;
 bad:=jsonb_set(bad,'{ambienteReportado}','"00"');
 BEGIN PERFORM public.finish_mh_test_emission(iid,ticket,jsonb_set(bad,'{codigoGeneracionReportado}',to_jsonb(gen_random_uuid()::TEXT))); RAISE EXCEPTION 'accepted foreign seal';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'sello de UUID distinto no aceptado'); END;
 BEGIN PERFORM public.finish_mh_test_emission(iid,ticket,jsonb_set(bad,'{http}','400')); RAISE EXCEPTION 'accepted non-success HTTP';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'HTTP de error no confirma un sello'); END;
 BEGIN PERFORM public.finish_mh_test_emission(iid,ticket,jsonb_set(bad,'{selloRecibido}',to_jsonb(repeat('A',39)))); RAISE EXCEPTION 'accepted short seal';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.mh_check(TRUE,'sello incompleto no aceptado'); END;
 BEGIN PERFORM public.finish_mh_test_emission(iid,NULL,bad); RAISE EXCEPTION 'accepted null lease';
 EXCEPTION WHEN lock_not_available THEN PERFORM pg_temp.mh_check(TRUE,'lease nulo no finaliza un documento'); END;
 saved:=public.finish_mh_test_emission(iid,ticket,bad||jsonb_build_object('ambiente','00','codigoGeneracion',upper(r#>>'{invoice,generation_code}'),'codigoMsg','001','fhProcesamiento','11/11/2026 09:00:01'));
 PERFORM pg_temp.mh_check(saved->>'status'='PROCESADO' AND saved->>'mh_reception_stamp'=repeat('A',40),'estado y sello se guardan juntos');
 PERFORM pg_temp.mh_check(saved->>'mh_environment'='00' AND saved->>'mh_message_code'='001' AND saved->>'mh_processed_at'='11/11/2026 09:00:01','ambiente fecha y código guardados');
 PERFORM pg_temp.mh_check(saved#>'{mh_response_json,documento}'=d,'JSON sin firma conservado para auditoría');
 retry:=public.reserve_mh_test_emission('f1112000-0000-4000-8000-000000000001',iid,'f1111000-0000-4000-8000-000000000002');
 PERFORM pg_temp.mh_check(retry#>>'{invoice,generation_code}'=r#>>'{invoice,generation_code}' AND retry#>>'{invoice,control_number}'=r#>>'{invoice,control_number}','consulta posterior conserva identidad y correlativo');
 saved:=public.finish_mh_test_emission(iid,(retry->>'lease')::UUID,'{"estado":"SIN_CONFIRMAR","codigoMsg":"999"}');
 PERFORM pg_temp.mh_check(saved->>'status'='PROCESADO' AND saved->>'mh_reception_stamp'=repeat('A',40),'una consulta fallida nunca borra sello confirmado');
END; $$;
RESET ROLE;
SELECT count(*) AS comprobaciones_aprobadas,jsonb_agg(label ORDER BY label) AS detalle FROM pg_temp.mh_checks;
ROLLBACK;
