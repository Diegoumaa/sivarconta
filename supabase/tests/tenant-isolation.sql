-- Integration checks against real PostgreSQL. All synthetic fixtures are rolled back.
-- Run as postgres after migrations/20261021_security.sql. Never COMMIT this file.
BEGIN;
CREATE TEMP TABLE rls_checks(name TEXT);
GRANT SELECT, INSERT ON pg_temp.rls_checks TO authenticated;
CREATE FUNCTION pg_temp.check_rls(ok BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(ok,FALSE) THEN RAISE EXCEPTION 'RLS TEST FAILED: %', label; END IF;
  INSERT INTO pg_temp.rls_checks VALUES(label);
END;
$$;
DO $$ DECLARE tab TEXT; BEGIN
  FOREACH tab IN ARRAY ARRAY['profiles','companies','company_members','clients','products','invoices','invoice_items','purchases'] LOOP
    PERFORM pg_temp.check_rls(NOT has_table_privilege('anon','public.'||tab,'SELECT,INSERT,UPDATE,DELETE'), 'anon bloqueado: '||tab);
  END LOOP;
END; $$;
CREATE FUNCTION pg_temp.fixture_draft(cid UUID,iid UUID,clientid UUID,productid UUID,kind TEXT DEFAULT '03') RETURNS JSONB LANGUAGE sql AS $$
SELECT jsonb_build_object('id',iid,'company_id',cid,'dte_type',kind,'generation_code',gen_random_uuid(),
 'client_id',clientid,'client_name','Fixture cliente','client_doc_type','NIT','client_doc_number','0000-000000-000-0',
 'client_nrc','1','client_email','fixture@example.invalid','client_phone','0000','client_address','Fixture dirección',
 'client_department','Santa Ana','client_municipality','Santa Ana Centro','condition','CREDITO','credit_term_days',45,
 'payment_method','04','subtotal_gravado',100,'subtotal_exento',0,'subtotal_no_sujeto',0,'descuento_total',0,
 'iva13',CASE WHEN kind='14' THEN 0 WHEN kind='01' THEN 11.50 ELSE 13 END,'retencion1',0,'percepcion1',0,
 'retencion_renta10',CASE WHEN kind='14' THEN 10 ELSE 0 END,'total_pagar',CASE WHEN kind='14' THEN 90 WHEN kind='01' THEN 100 ELSE 113 END,
 'total_letras','Importe de prueba','observations','Notas conservadas','referenced_dte','Referencia de prueba',
 'items',jsonb_build_array(jsonb_build_object('product_id',productid,'description','Servicio conservado','code','FIX-001',
 'quantity',2,'unit_price',50,'discount',0,'tax_type','GRAVADO','unit_of_measure','59','total',100)));
$$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
('11111111-1111-4111-8111-111111111111','rls-a@example.invalid','{}'),
('22222222-2222-4222-8222-222222222222','rls-b@example.invalid','{}'),
('33333333-3333-4333-8333-333333333333','rls-c@example.invalid','{}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',TRUE);
SELECT public.create_company('{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","name":"RLS fixture A","nit":"0000-000000-000-0","nrc":"1","economic_activity_code":"1","economic_activity_desc":"Fixture","phone":"0000","email":"rls-a@example.invalid","address":"Fixture"}');
DO $$ BEGIN
  PERFORM pg_temp.check_rls((SELECT count(*)=1 FROM public.companies),'propietario ve solo su empresa');
  PERFORM pg_temp.check_rls((SELECT count(*)=1 FROM public.company_members WHERE role='owner'),'alta transaccional crea propietario');
  PERFORM pg_temp.check_rls((SELECT count(*)=1 FROM public.profiles),'perfil propio aislado');
  UPDATE public.companies SET trade_name='Fixture actualizada' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  PERFORM pg_temp.check_rls((SELECT trade_name='Fixture actualizada' FROM public.companies WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'propietario puede editar su empresa');
  BEGIN
    PERFORM mh_api_key FROM public.companies;
    RAISE EXCEPTION 'RLS TEST FAILED: credencial fiscal visible';
  EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.check_rls(TRUE,'credencial fiscal fuera del frontend'); END;
END; $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',TRUE);
SELECT public.create_company('{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","name":"RLS fixture B","nit":"0000-000000-000-0","nrc":"2","economic_activity_code":"1","economic_activity_desc":"Fixture","phone":"0000","email":"rls-b@example.invalid","address":"Fixture"}');
INSERT INTO public.clients(id,company_id,name,doc_number,email,phone,address) VALUES('b1000000-0000-4000-8000-000000000000','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Fixture B','0','rls-b@example.invalid','0','Fixture');
INSERT INTO public.products(id,company_id,code,name,price) VALUES('b2000000-0000-4000-8000-000000000000','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','RLS-B','Fixture B',1);
SELECT public.save_invoice_draft(pg_temp.fixture_draft('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b3000000-0000-4000-8000-000000000000','b1000000-0000-4000-8000-000000000000','b2000000-0000-4000-8000-000000000000'));
INSERT INTO public.purchases(company_id,control_number,generation_code,supplier_name,supplier_nit,supplier_nrc,date,total) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','RLS-B','RLS-B','Fixture','0','0',CURRENT_DATE,1);
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',TRUE);
DO $$ DECLARE affected INTEGER; BEGIN
  PERFORM pg_temp.check_rls((SELECT count(*)=0 FROM public.companies WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'otra empresa invisible');
  PERFORM pg_temp.check_rls((SELECT count(*)=0 FROM public.clients),'clientes de otra empresa invisibles');
  PERFORM pg_temp.check_rls((SELECT count(*)=0 FROM public.products),'productos de otra empresa invisibles');
  PERFORM pg_temp.check_rls((SELECT count(*)=0 FROM public.invoices),'facturas de otra empresa invisibles');
  PERFORM pg_temp.check_rls((SELECT count(*)=0 FROM public.invoice_items),'partidas de otra empresa invisibles');
  PERFORM pg_temp.check_rls((SELECT count(*)=0 FROM public.purchases),'compras de otra empresa invisibles');
  BEGIN
    INSERT INTO public.clients(company_id,name,doc_number,email,phone,address) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Intrusion','0','rls-a@example.invalid','0','Fixture');
    RAISE EXCEPTION 'RLS TEST FAILED: escritura cruzada permitida';
  EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.check_rls(TRUE,'insercion cruzada rechazada'); END;
  UPDATE public.clients SET name='Intrusion' WHERE id='b1000000-0000-4000-8000-000000000000';
  GET DIAGNOSTICS affected=ROW_COUNT;
  PERFORM pg_temp.check_rls(affected=0,'edicion cruzada rechazada');
  PERFORM public.save_invoice_draft(pg_temp.fixture_draft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000000',NULL,NULL));
  BEGIN
    INSERT INTO public.invoice_items(invoice_id,num_item,product_id,description,quantity,unit_price,total) VALUES('a3000000-0000-4000-8000-000000000000',1,'b2000000-0000-4000-8000-000000000000','Intrusion',1,1,1);
    RAISE EXCEPTION 'RLS TEST FAILED: producto cruzado permitido';
  EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.check_rls(TRUE,'escritura directa de partidas rechazada'); END;
  BEGIN
    UPDATE public.invoices SET status='PROCESADO',mh_reception_stamp='SELLO-FALSO' WHERE id='a3000000-0000-4000-8000-000000000000';
    RAISE EXCEPTION 'RLS TEST FAILED: aceptacion fiscal falsa permitida';
  EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.check_rls(TRUE,'no se puede fabricar aceptacion fiscal'); END;
END; $$;
INSERT INTO public.company_members(company_id,user_id,role) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','billing');
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',TRUE);
DO $$ DECLARE affected INTEGER; BEGIN
  PERFORM pg_temp.check_rls((SELECT count(*)=2 FROM public.company_members),'miembros sin recursion');
  UPDATE public.company_members SET role='owner' WHERE user_id=auth.uid();
  GET DIAGNOSTICS affected=ROW_COUNT;
  PERFORM pg_temp.check_rls(affected=0,'facturador no puede elevar su rol');
  BEGIN
    INSERT INTO public.purchases(company_id,control_number,generation_code,supplier_name,supplier_nit,supplier_nrc,date,total) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','RLS-C','RLS-C','Fixture','0','0',CURRENT_DATE,1);
    RAISE EXCEPTION 'RLS TEST FAILED: facturador administra compras';
  EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.check_rls(TRUE,'compras reservadas a contabilidad y administracion'); END;
  PERFORM pg_temp.check_rls((SELECT count(*)=1 FROM public.invoices),'facturador puede consultar su empresa');
END; $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM pg_temp.rls_checks) <> 27 THEN RAISE EXCEPTION 'Expected 27 successful checks'; END IF;
END; $$;
ROLLBACK;
SELECT '27 comprobaciones RLS aprobadas. Fixtures revertidas con ROLLBACK.' AS resultado,
  (SELECT count(*) FROM auth.users WHERE id IN('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333')) AS usuarios_de_prueba_restantes;
