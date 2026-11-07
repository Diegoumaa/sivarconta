BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
  ('f0707000-0000-4000-8000-000000000001','f07-owner-qa@example.invalid','{}'),
  ('f0707000-0000-4000-8000-000000000002','f07-clerk-qa@example.invalid','{}');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f0707000-0000-4000-8000-000000000001',true);
SELECT public.create_company('{"id":"f0707000-0000-4000-8000-000000000010","name":"F07 QA","nit":"0000-000000-000-0","nrc":"1","economic_activity_code":"1","economic_activity_desc":"QA","phone":"0","email":"qa@example.invalid","address":"QA"}');
SELECT public.create_company('{"id":"f0707000-0000-4000-8000-000000000011","name":"F07 QA 2","nit":"0000-000000-000-1","nrc":"2","economic_activity_code":"1","economic_activity_desc":"QA","phone":"0","email":"qa@example.invalid","address":"QA"}');
RESET ROLE;
INSERT INTO public.company_members (company_id,user_id,role)
  VALUES('f0707000-0000-4000-8000-000000000010','f0707000-0000-4000-8000-000000000002','billing');

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  cid constant uuid := 'f0707000-0000-4000-8000-000000000010';
  other_company constant uuid := 'f0707000-0000-4000-8000-000000000011';
  pid constant uuid := 'f0707000-0000-4000-8000-000000000020';
  iid constant uuid := 'f0707000-0000-4000-8000-000000000030';
  expense constant jsonb := '{"operation":"1","classification":"2","sector":"4","cost":"2"}';
  sale constant jsonb := '{"operation":"1","income":"2"}';
  changed constant jsonb := '{"operation":"1","income":"3"}';
  draft jsonb; result jsonb;
BEGIN
  INSERT INTO public.purchases(id,company_id,dte_type,control_number,generation_code,supplier_name,supplier_nit,supplier_nrc,date,total)
    VALUES(pid,cid,'03','F07-QA',gen_random_uuid(),'QA','0000-000000-000-0','1','2026-10-26',51.90);
  IF (SELECT f07_renta IS NOT NULL FROM public.purchases WHERE id=pid) THEN
    RAISE EXCEPTION 'La compra anterior debe quedar sin clasificación';
  END IF;
  PERFORM public.set_f07_renta('purchase',cid,pid,expense);
  IF NOT EXISTS (SELECT 1 FROM public.purchases WHERE id=pid AND f07_renta=expense AND total=51.90) THEN
    RAISE EXCEPTION 'No persistió el gasto o se alteró el importe';
  END IF;
  BEGIN
    PERFORM public.set_f07_renta('purchase',cid,pid,expense || '{"cost":"5"}');
    RAISE EXCEPTION 'Se guardó un código de costo para un gasto';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.set_f07_renta('purchase',other_company,pid,expense);
    RAISE EXCEPTION 'Se cambió una compra desde otra empresa';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub','f0707000-0000-4000-8000-000000000002',true);
  BEGIN
    PERFORM public.set_f07_renta('purchase',cid,pid,expense);
    RAISE EXCEPTION 'Un facturador editó una compra';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  draft := '{"dte_type":"01","client_name":"QA","client_doc_type":"DUI","client_doc_number":"00000000-0","condition":"CONTADO","credit_term_days":0,"payment_method":"01","subtotal_gravado":113,"subtotal_exento":0,"subtotal_no_sujeto":0,"descuento_total":0,"iva13":13,"retencion1":0,"percepcion1":0,"retencion_renta10":0,"total_pagar":113,"total_letras":"QA","items":[{"description":"Servicio QA","quantity":1,"unit_price":113,"discount":0,"tax_type":"GRAVADO","unit_of_measure":"99","total":113}]}'
    || jsonb_build_object('id',iid,'company_id',cid,'generation_code',gen_random_uuid(),'f07_renta',sale);
  result := public.save_invoice_draft(draft);
  IF result->'f07_renta' IS DISTINCT FROM sale THEN
    RAISE EXCEPTION 'El borrador no guardó la clasificación del facturador';
  END IF;
  PERFORM set_config('request.jwt.claim.sub','f0707000-0000-4000-8000-000000000001',true);
  PERFORM public.set_f07_renta('sale',cid,iid,changed);
  result := public.save_invoice_draft(draft);
  IF result->'f07_renta' IS DISTINCT FROM changed OR (result->>'total_pagar')::numeric <> 113 THEN
    RAISE EXCEPTION 'El reintento debe conservar la corrección y los importes';
  END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
SELECT 'Clasificación F-07 verificada' AS resultado,
  (SELECT count(*) FROM auth.users WHERE id IN ('f0707000-0000-4000-8000-000000000001','f0707000-0000-4000-8000-000000000002')) AS usuarios_sinteticos_restantes;
