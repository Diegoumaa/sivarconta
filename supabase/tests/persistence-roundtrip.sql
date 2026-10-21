-- Synthetic records only; never COMMIT. No passwords or emails are created/sent.
BEGIN;
CREATE TEMP TABLE persistence_checks(name TEXT);
GRANT SELECT,INSERT ON pg_temp.persistence_checks TO authenticated;
CREATE FUNCTION pg_temp.check_persistence(ok BOOLEAN,label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(ok,FALSE) THEN RAISE EXCEPTION 'PERSISTENCE TEST FAILED: %',label; END IF;
  INSERT INTO pg_temp.persistence_checks VALUES(label);
END;
$$;
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
SELECT public.create_company('{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","name":"Persistencia fixture A","nit":"0000-000000-000-0","nrc":"1","economic_activity_code":"1","economic_activity_desc":"Fixture","phone":"0000","email":"rls-a@example.invalid","address":"Fixture","department":"Santa Ana","municipality":"Santa Ana Centro","taxpayer_type":"MEDIANO","mh_user":"USUARIO-FIXTURE","establishment_code":"M002","pos_code":"P003"}');
INSERT INTO public.clients(id,company_id,name,commercial_name,taxpayer_type,doc_number,email,phone,address) VALUES('a1000000-0000-4000-8000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Fixture cliente','Comercial conservado','MEDIANO','0','fixture@example.invalid','0000','Fixture');
INSERT INTO public.products(id,company_id,code,name,price,category) VALUES('a2000000-0000-4000-8000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','FIX-001','Servicio conservado',50,'Servicios conservados');
INSERT INTO public.purchases(company_id,control_number,generation_code,supplier_name,supplier_nit,supplier_nrc,date,total,concept,payment_method,retencion_renta10) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','FIX-COMPRA','FIX-COMPRA','Fixture proveedor','0','0',CURRENT_DATE,90,'Concepto conservado','04',10);
DO $$
DECLARE
 cid UUID:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; iid UUID:='a3000000-0000-4000-8000-000000000000';
 cli UUID:='a1000000-0000-4000-8000-000000000000'; prod UUID:='a2000000-0000-4000-8000-000000000000';
 payload JSONB; saved JSONB; retry JSONB; second JSONB; before_counter BIGINT;
BEGIN
 PERFORM pg_temp.check_persistence((SELECT department='Santa Ana' AND municipality='Santa Ana Centro' AND taxpayer_type='MEDIANO' AND mh_user='USUARIO-FIXTURE' FROM public.companies WHERE id=cid),'empresa conserva ubicación tipo y usuario');
 PERFORM pg_temp.check_persistence((SELECT count(*)=1 FROM public.company_members WHERE role='owner'),'empresa conserva propietario');
 PERFORM pg_temp.check_persistence((SELECT commercial_name='Comercial conservado' AND taxpayer_type='MEDIANO' FROM public.clients WHERE id=cli),'cliente conserva nombre comercial y tipo');
 PERFORM pg_temp.check_persistence((SELECT category='Servicios conservados' FROM public.products WHERE id=prod),'producto conserva categoría');
 PERFORM pg_temp.check_persistence((SELECT concept='Concepto conservado' AND payment_method='04' AND retencion_renta10=10 FROM public.purchases WHERE company_id=cid),'compra conserva concepto pago y renta');
 payload:=pg_temp.fixture_draft(cid,iid,cli,prod);
 saved:=public.save_invoice_draft(payload);
 PERFORM pg_temp.check_persistence(saved->>'status'='BORRADOR' AND saved->>'mh_reception_stamp' IS NULL,'borrador sin aceptación fiscal fabricada');
 PERFORM pg_temp.check_persistence((SELECT count(*)=1 FROM public.invoices WHERE id=iid) AND (SELECT count(*)=1 FROM public.invoice_items WHERE invoice_id=iid),'encabezado y partida confirmados juntos');
 PERFORM pg_temp.check_persistence(saved#>>'{invoice_items,0,product_id}'=prod::TEXT AND (saved#>>'{invoice_items,0,tax_amount}')::NUMERIC=13,'relación de producto e IVA conservados');
 PERFORM pg_temp.check_persistence(saved->>'observations'='Notas conservadas' AND saved->>'payment_method'='04' AND (saved->>'credit_term_days')::INTEGER=45 AND saved->>'referenced_dte'='Referencia de prueba','pago plazo notas y referencia conservados');
 PERFORM pg_temp.check_persistence(saved->>'control_number'='DTE-03-M002P003-000000000000001' AND (saved->>'emission_date')::DATE=timezone('America/El_Salvador',statement_timestamp())::DATE,'correlativo y fecha emitidos por servidor');
 retry:=public.save_invoice_draft(payload);
 PERFORM pg_temp.check_persistence(retry=saved AND (SELECT count(*)=1 FROM public.invoices WHERE company_id=cid),'reintento idéntico sin duplicado');
 BEGIN
   PERFORM public.save_invoice_draft(payload||'{"observations":"Alteración"}'::JSONB);
   RAISE EXCEPTION 'Reintento alterado aceptado';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.check_persistence(TRUE,'reintento con otros datos rechazado'); END;
 BEGIN
   PERFORM public.save_invoice_draft(jsonb_set(pg_temp.fixture_draft(cid,'a3000000-0000-4000-8000-000000000001',cli,prod),'{items,0,unit_of_measure}','null'));
   RAISE EXCEPTION 'Partida nula aceptada';
 EXCEPTION WHEN not_null_violation THEN
   PERFORM pg_temp.check_persistence(NOT EXISTS(SELECT 1 FROM public.invoices WHERE id='a3000000-0000-4000-8000-000000000001'),'fallo del detalle revierte encabezado');
 END;
 second:=public.save_invoice_draft(pg_temp.fixture_draft(cid,'a3000000-0000-4000-8000-000000000002',cli,prod));
 PERFORM pg_temp.check_persistence(second->>'control_number'='DTE-03-M002P003-000000000000002','fallo no consume correlativo y nuevo borrador avanza');
 BEGIN
   PERFORM public.save_invoice_draft(jsonb_set(pg_temp.fixture_draft(cid,gen_random_uuid(),cli,prod),'{items,0,quantity}','0'));
   RAISE EXCEPTION 'Cantidad cero aceptada';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.check_persistence(TRUE,'cantidad inválida rechazada'); END;
 BEGIN
   PERFORM public.save_invoice_draft(pg_temp.fixture_draft(cid,gen_random_uuid(),cli,prod)||'{"total_pagar":1}'::JSONB);
   RAISE EXCEPTION 'Total alterado aceptado';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.check_persistence(TRUE,'totales alterados rechazados'); END;
 BEGIN
   PERFORM public.save_invoice_draft(pg_temp.fixture_draft(cid,gen_random_uuid(),cli,prod)||'{"items":[]}'::JSONB);
   RAISE EXCEPTION 'Factura vacía aceptada';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.check_persistence(TRUE,'borrador vacío rechazado'); END;
 BEGIN
   INSERT INTO public.invoices(company_id,dte_type,control_number,generation_code,client_name,client_doc_type,client_doc_number,total_pagar,total_letras,status) VALUES(cid,'03','INTRUSION',gen_random_uuid(),'Fixture','NIT','0',1,'UNO','BORRADOR');
   RAISE EXCEPTION 'Escritura directa aceptada';
 EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.check_persistence(TRUE,'encabezados directos bloqueados'); END;
 BEGIN
   INSERT INTO public.invoice_items(invoice_id,num_item,description,quantity,unit_price,total) VALUES(iid,2,'Intrusión',1,1,1);
   RAISE EXCEPTION 'Detalle directo aceptado';
 EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.check_persistence(TRUE,'partidas directas bloqueadas'); END;
 PERFORM pg_temp.check_persistence(NOT has_table_privilege('authenticated','public.invoice_counters','SELECT,INSERT,UPDATE,DELETE'),'correlativos fuera del navegador');
 second:=public.save_invoice_draft(pg_temp.fixture_draft(cid,gen_random_uuid(),cli,prod,'14'));
 PERFORM pg_temp.check_persistence((second->>'retencion_renta10')::NUMERIC=10 AND (second->>'iva13')::NUMERIC=0 AND (second->>'total_pagar')::NUMERIC=90,'sujeto excluido conserva renta y total');
 second:=public.save_invoice_draft(pg_temp.fixture_draft(cid,gen_random_uuid(),cli,prod,'01')||'{"status":"PROCESADO","mh_reception_stamp":"FALSO"}'::JSONB);
 PERFORM pg_temp.check_persistence(second->>'status'='BORRADOR' AND second->>'mh_reception_stamp' IS NULL,'RPC ignora estado y sello falsos');
END;
$$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',TRUE);
SELECT public.create_company('{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","name":"Persistencia fixture B","nit":"0000-000000-000-0","nrc":"2","economic_activity_code":"1","economic_activity_desc":"Fixture","phone":"0000","email":"rls-b@example.invalid","address":"Fixture","establishment_code":"M002","pos_code":"P003"}');
INSERT INTO public.clients(id,company_id,name,doc_number,email,phone,address) VALUES('b1000000-0000-4000-8000-000000000000','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Fixture B','0','fixture@example.invalid','0000','Fixture');
INSERT INTO public.products(id,company_id,code,name,price) VALUES('b2000000-0000-4000-8000-000000000000','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','FIX-B','Fixture B',50);
DO $$ DECLARE saved JSONB; BEGIN
 saved:=public.save_invoice_draft(pg_temp.fixture_draft('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b3000000-0000-4000-8000-000000000000','b1000000-0000-4000-8000-000000000000','b2000000-0000-4000-8000-000000000000'));
 PERFORM pg_temp.check_persistence(saved->>'control_number'='DTE-03-M002P003-000000000000001','otra empresa tiene secuencia independiente');
 PERFORM pg_temp.check_persistence((SELECT count(*)=1 FROM public.invoices),'lectura aislada después de guardar');
END; $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',TRUE);
DO $$ DECLARE cid UUID:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; BEGIN
 BEGIN
   PERFORM public.save_invoice_draft(pg_temp.fixture_draft(cid,gen_random_uuid(),'b1000000-0000-4000-8000-000000000000',NULL));
   RAISE EXCEPTION 'Cliente cruzado aceptado';
 EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.check_persistence(TRUE,'cliente cruzado rechazado en RPC'); END;
 BEGIN
   PERFORM public.save_invoice_draft(pg_temp.fixture_draft(cid,gen_random_uuid(),NULL,'b2000000-0000-4000-8000-000000000000'));
   RAISE EXCEPTION 'Producto cruzado aceptado';
 EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.check_persistence(TRUE,'producto cruzado rechazado en RPC'); END;
 BEGIN
   PERFORM public.save_invoice_draft(pg_temp.fixture_draft('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',gen_random_uuid(),NULL,NULL));
   RAISE EXCEPTION 'Empresa cruzada aceptada';
 EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.check_persistence(TRUE,'escritura en otra empresa rechazada en RPC'); END;
 PERFORM pg_temp.check_persistence(NOT EXISTS(SELECT 1 FROM public.invoice_items WHERE invoice_id='b3000000-0000-4000-8000-000000000000'),'detalle de otra empresa invisible');
END; $$;
INSERT INTO public.company_members(company_id,user_id,role) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','billing');
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',TRUE);
DO $$ DECLARE saved JSONB; affected INTEGER; BEGIN
 saved:=public.save_invoice_draft(pg_temp.fixture_draft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),'a1000000-0000-4000-8000-000000000000','a2000000-0000-4000-8000-000000000000'));
 PERFORM pg_temp.check_persistence(saved->>'status'='BORRADOR','facturador puede guardar borrador propio');
 UPDATE public.company_members SET role='owner' WHERE user_id=auth.uid();
 GET DIAGNOSTICS affected=ROW_COUNT;
 PERFORM pg_temp.check_persistence(affected=0,'facturador no eleva su rol');
 BEGIN
   INSERT INTO public.purchases(company_id,control_number,generation_code,supplier_name,supplier_nit,supplier_nrc,date,total) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','INTRUSION','INTRUSION','Fixture','0','0',CURRENT_DATE,1);
   RAISE EXCEPTION 'Compra del facturador aceptada';
 EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.check_persistence(TRUE,'facturador no administra compras'); END;
END; $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_temp.persistence_checks)<>31 THEN RAISE EXCEPTION 'Expected 31 persistence checks'; END IF;
END; $$;
ROLLBACK;
SELECT '31 comprobaciones de persistencia aprobadas. Todos los fixtures revertidos con ROLLBACK.' AS resultado,
 (SELECT count(*) FROM auth.users WHERE id IN('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333')) AS usuarios_ficticios_restantes;
