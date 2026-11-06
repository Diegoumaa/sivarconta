-- Synthetic data only. Never commit this transaction or call an email provider.
BEGIN;
CREATE FUNCTION pg_temp.email_check(ok BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(ok,FALSE) THEN RAISE EXCEPTION 'INVOICE EMAIL TEST FAILED: %',label; END IF;
END $$;

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('11111111-1111-4111-8111-111111111111','bulk-mail-a@example.invalid','{}'),
 ('22222222-2222-4222-8222-222222222222','bulk-mail-b@example.invalid','{}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',TRUE);
SELECT public.create_company('{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","name":"Mail fixture A","nit":"0000-000000-000-0","nrc":"1","economic_activity_code":"1","economic_activity_desc":"Fixture","phone":"0000","email":"bulk-mail-a@example.invalid","address":"Fixture","department":"Santa Ana","municipality":"Santa Ana Centro","taxpayer_type":"MEDIANO","mh_environment":"PRODUCCION","establishment_code":"M002","pos_code":"P003"}');
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',TRUE);
SELECT public.create_company('{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","name":"Mail fixture B","nit":"0000-000000-000-0","nrc":"2","economic_activity_code":"1","economic_activity_desc":"Fixture","phone":"0000","email":"bulk-mail-b@example.invalid","address":"Fixture","department":"Santa Ana","municipality":"Santa Ana Centro","taxpayer_type":"MEDIANO","mh_environment":"PRODUCCION","establishment_code":"M002","pos_code":"P003"}');
RESET ROLE;

INSERT INTO public.invoices(id,company_id,dte_type,control_number,generation_code,client_name,client_doc_type,client_doc_number,client_email,total_pagar,total_letras,status,mh_reception_stamp,mh_response_json)
SELECT v.id, v.company, '03', v.control, v.generation, 'Cliente fixture','NIT','0000-000000-000-0', v.email, 113, 'Fixture', v.status, repeat('A',40),
  jsonb_build_object('ambiente',v.environment,'estado','PROCESADO','codigoGeneracion',upper(v.generation::TEXT),'selloRecibido',repeat('A',40))
FROM (VALUES
  ('a1000000-0000-4000-8000-000000000001'::UUID,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::UUID,'FIX-MAIL-A','a2000000-0000-4000-8000-000000000001'::UUID,'uno@example.invalid','PROCESADO','01'),
  ('a1000000-0000-4000-8000-000000000002'::UUID,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::UUID,'FIX-MAIL-C','a2000000-0000-4000-8000-000000000002'::UUID,'dos@example.invalid','PROCESADO','01'),
  ('a1000000-0000-4000-8000-000000000003'::UUID,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::UUID,'FIX-MAIL-DEMO','a2000000-0000-4000-8000-000000000003'::UUID,'demo@example.invalid','PROCESADO','00'),
  ('b1000000-0000-4000-8000-000000000001'::UUID,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::UUID,'FIX-MAIL-B','b2000000-0000-4000-8000-000000000001'::UUID,'otro@example.invalid','PROCESADO','01'),
  ('a1000000-0000-4000-8000-000000000004'::UUID,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::UUID,'FIX-MAIL-DRAFT','a2000000-0000-4000-8000-000000000004'::UUID,'borrador@example.invalid','BORRADOR','01')
) AS v(id,company,control,generation,email,status,environment);
INSERT INTO public.invoice_items(invoice_id,num_item,description,quantity,unit_price,total)
SELECT id,1,'Partida fixture',1,100,100 FROM public.invoices WHERE control_number IN ('FIX-MAIL-A','FIX-MAIL-C','FIX-MAIL-DEMO','FIX-MAIL-B','FIX-MAIL-DRAFT');

SELECT pg_temp.email_check(NOT has_table_privilege('anon','public.invoice_email_jobs','SELECT'),'anon no lee');
SELECT pg_temp.email_check(NOT has_table_privilege('authenticated','public.invoice_email_jobs','UPDATE'),'authenticated no altera bitácora');
SELECT pg_temp.email_check(NOT has_function_privilege('authenticated','public.claim_invoice_email_jobs(uuid,uuid,jsonb)','EXECUTE'),'authenticated no reserva directamente');
SELECT pg_temp.email_check(NOT has_function_privilege('anon','public.claim_invoice_email_jobs(uuid,uuid,jsonb)','EXECUTE'),'anon no reserva');
SET LOCAL ROLE service_role;
DO $$
DECLARE
  cid UUID := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  actor UUID := '11111111-1111-4111-8111-111111111111';
  invoice UUID := 'a1000000-0000-4000-8000-000000000001';
  documents JSONB := '[{"invoiceId":"a1000000-0000-4000-8000-000000000001","email":"uno@example.invalid"}]';
  other JSONB := '[{"invoiceId":"a1000000-0000-4000-8000-000000000002","email":"dos@example.invalid"}]';
  job UUID;
  previous TEXT;
  failed BOOLEAN;
  input JSONB;
BEGIN
  SELECT r.job_id INTO job FROM public.claim_invoice_email_jobs(cid,actor,documents) r;
  PERFORM pg_temp.email_check(job IS NOT NULL AND EXISTS(SELECT 1 FROM public.invoice_email_jobs j WHERE j.id=job AND j.invoice_id=invoice AND j.state='sending' AND j.recipient_email='uno@example.invalid'),'servicio reserva con destinatario exacto');
  SELECT r.previous_state INTO previous FROM public.claim_invoice_email_jobs(cid,actor,documents) r WHERE r.job_id IS NULL;
  PERFORM pg_temp.email_check(previous='sending','segundo intento concurrente no reserva');
  UPDATE public.invoice_email_jobs SET state='accepted',provider_message_id='fixture-brevo-id',completed_at=now() WHERE id=job;
  SELECT r.previous_state INTO previous FROM public.claim_invoice_email_jobs(cid,actor,documents) r WHERE r.job_id IS NULL;
  PERFORM pg_temp.email_check(previous='accepted','correo aceptado no se reenvía');
  SELECT r.job_id INTO job FROM public.claim_invoice_email_jobs(cid,actor,other) r;
  UPDATE public.invoice_email_jobs SET state='rejected',completed_at=now() WHERE id=job;
  SELECT r.job_id INTO job FROM public.claim_invoice_email_jobs(cid,actor,other) r;
  PERFORM pg_temp.email_check(job IS NOT NULL,'rechazo confirmado admite otro intento');
  UPDATE public.invoice_email_jobs SET state='uncertain',completed_at=now() WHERE id=job;
  SELECT r.previous_state INTO previous FROM public.claim_invoice_email_jobs(cid,actor,other) r WHERE r.job_id IS NULL;
  PERFORM pg_temp.email_check(previous='uncertain','resultado incierto bloquea duplicación');

  failed:=FALSE;
  BEGIN PERFORM public.claim_invoice_email_jobs(cid,'22222222-2222-4222-8222-222222222222',documents);
  EXCEPTION WHEN insufficient_privilege THEN failed:=TRUE; END;
  PERFORM pg_temp.email_check(failed,'usuario de otra empresa no reserva');
  FOR input IN SELECT value FROM jsonb_array_elements('[
    [{"invoiceId":"a1000000-0000-4000-8000-000000000001","email":"falso@example.invalid"}],
    [{"invoiceId":"b1000000-0000-4000-8000-000000000001","email":"otro@example.invalid"}],
    [{"invoiceId":"a1000000-0000-4000-8000-000000000003","email":"demo@example.invalid"}],
    [{"invoiceId":"a1000000-0000-4000-8000-000000000004","email":"borrador@example.invalid"}]
  ]'::JSONB)
  LOOP
    failed:=FALSE;
    BEGIN PERFORM public.claim_invoice_email_jobs(cid,actor,input);
    EXCEPTION WHEN invalid_parameter_value THEN failed:=TRUE; END;
    PERFORM pg_temp.email_check(failed,'bloquea destino alterado, documento ajeno, demo o borrador');
  END LOOP;

  UPDATE public.invoice_email_jobs SET state='rejected',completed_at=now() WHERE id=job;
  INSERT INTO public.invoice_email_jobs(company_id,invoice_id,requested_by,recipient_email,state,completed_at)
    SELECT cid,invoice,actor,'uno@example.invalid','rejected',now() FROM generate_series(1,300);
  failed:=FALSE;
  BEGIN PERFORM public.claim_invoice_email_jobs(cid,actor,other);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='invoice_email_daily_limit' THEN failed:=TRUE; ELSE RAISE; END IF;
  END;
  PERFORM pg_temp.email_check(failed,'cupo global protege el plan gratuito');
END $$;
RESET ROLE;
ROLLBACK;
SELECT '15 comprobaciones de correo aprobadas con ROLLBACK' AS resultado,
  (SELECT count(*) FROM auth.users WHERE email IN ('bulk-mail-a@example.invalid','bulk-mail-b@example.invalid')) AS usuarios_de_prueba_restantes;
