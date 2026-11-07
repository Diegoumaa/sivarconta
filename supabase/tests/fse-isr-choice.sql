BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data)
  VALUES('f0711000-0000-4000-8000-000000000001','fse-isr-qa@example.invalid','{}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f0711000-0000-4000-8000-000000000001',TRUE);
SELECT public.create_company('{"id":"f0712000-0000-4000-8000-000000000001","name":"FSE QA","nit":"0000-000000-000-0","nrc":"1","economic_activity_code":"1","economic_activity_desc":"QA","phone":"0","email":"qa@example.invalid","address":"QA"}');
DO $$
DECLARE fixture jsonb; line jsonb; result jsonb;
BEGIN
  line := '{"description":"Servicio QA","quantity":1,"unit_price":27.77,"discount":0,"tax_type":"GRAVADO","unit_of_measure":"99","total":27.77,"apply_isr_retention":false}';
  fixture := '{"id":"f0713000-0000-4000-8000-000000000001","company_id":"f0712000-0000-4000-8000-000000000001","dte_type":"14","client_name":"QA","client_doc_type":"DUI","client_doc_number":"00000000-0","condition":"CONTADO","credit_term_days":0,"payment_method":"01","subtotal_gravado":27.77,"subtotal_exento":0,"subtotal_no_sujeto":0,"descuento_total":0,"iva13":0,"retencion1":0,"percepcion1":0,"retencion_renta10":0,"total_pagar":27.77,"total_letras":"QA"}';
  fixture := fixture || jsonb_build_object('generation_code',gen_random_uuid(),'items',jsonb_build_array(line));
  result := public.save_invoice_draft(fixture);
  IF (result->>'retencion_renta10')::numeric <> 0 OR (result->>'total_pagar')::numeric <> 27.77
    OR result #> '{invoice_items,0,apply_isr_retention}' IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'FSE sin retención incorrecta';
  END IF;
  fixture := fixture || jsonb_build_object('id','f0713000-0000-4000-8000-000000000002','generation_code',gen_random_uuid(),
    'items',jsonb_build_array(line || '{"apply_isr_retention":true}'),'retencion_renta10',2.78,'total_pagar',24.99);
  result := public.save_invoice_draft(fixture);
  IF (result->>'retencion_renta10')::numeric <> 2.78 OR (result->>'total_pagar')::numeric <> 24.99
    OR result #> '{invoice_items,0,apply_isr_retention}' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'FSE con retención incorrecta';
  END IF;
  IF public.save_invoice_draft(fixture)->>'id' IS DISTINCT FROM fixture->>'id' THEN
    RAISE EXCEPTION 'Reintento no conserva el borrador';
  END IF;
  BEGIN
    PERFORM public.save_invoice_draft(fixture || jsonb_build_object('id','f0713000-0000-4000-8000-000000000003',
      'generation_code',gen_random_uuid(),'items',jsonb_build_array(line || '{"unit_of_measure":"59","apply_isr_retention":true}')));
    RAISE EXCEPTION 'Se permitió retener ISR en un bien';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.save_invoice_draft(fixture || jsonb_build_object('id','f0713000-0000-4000-8000-000000000004',
      'generation_code',gen_random_uuid(),'items',jsonb_build_array(line)));
    RAISE EXCEPTION 'Se permitieron totales manipulados';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END;
$$;
RESET ROLE;
ROLLBACK;
SELECT 5 AS comprobaciones_fse,
  (SELECT count(*) FROM auth.users WHERE id='f0711000-0000-4000-8000-000000000001') AS usuarios_sinteticos_restantes;
