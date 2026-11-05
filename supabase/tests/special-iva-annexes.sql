-- All data below is synthetic and is rolled back.
BEGIN;
CREATE TEMP TABLE iva_checks(name TEXT);
GRANT SELECT,INSERT ON pg_temp.iva_checks TO authenticated;
CREATE FUNCTION pg_temp.iva_check(ok BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(ok,FALSE) THEN RAISE EXCEPTION 'IVA ANNEX TEST FAILED: %',label; END IF;
  INSERT INTO pg_temp.iva_checks VALUES(label);
END $$;
CREATE FUNCTION pg_temp.voucher(cid UUID,rid UUID,document TEXT DEFAULT '00027') RETURNS JSONB LANGUAGE sql AS $$
 SELECT jsonb_build_object('id',rid,'company_id',cid,'annex_code','163','emission_date','2026-11-04',
   'related_invoice_ids','[]'::JSONB,'related_purchase_ids','[]'::JSONB,'voided',FALSE,'data',
   jsonb_build_object('documentClass','1','partyDocType','NIT','partyDoc','0000-000000-000-0','partyName','Fixture',
     'docType','03','series','FIX-SERIE','documentNumber',document,'amount','1500.00','taxAmount','15.00'));
$$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('11111111-1111-4111-8111-111111111111','iva-a@example.invalid','{}'),
 ('22222222-2222-4222-8222-222222222222','iva-b@example.invalid','{}'),
 ('33333333-3333-4333-8333-333333333333','iva-c@example.invalid','{}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',TRUE);
SELECT public.create_company('{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","name":"IVA fixture A","nit":"0000-000000-000-0","nrc":"1","economic_activity_code":"1","economic_activity_desc":"Fixture","phone":"0000","email":"iva-a@example.invalid","address":"Fixture","department":"Santa Ana","municipality":"Santa Ana Centro","taxpayer_type":"MEDIANO","establishment_code":"M002","pos_code":"P003"}');
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',TRUE);
SELECT public.create_company('{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","name":"IVA fixture B","nit":"0000-000000-000-0","nrc":"2","economic_activity_code":"1","economic_activity_desc":"Fixture","phone":"0000","email":"iva-b@example.invalid","address":"Fixture","department":"Santa Ana","municipality":"Santa Ana Centro","taxpayer_type":"MEDIANO","establishment_code":"M002","pos_code":"P003"}');
INSERT INTO public.purchases(id,company_id,dte_type,control_number,generation_code,supplier_name,supplier_nit,supplier_nrc,date,subtotal_gravado,iva13,percepcion1,total)
VALUES('b1000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','03','FIX-B','FIX-B','Fixture B','0000-000000-000-0','1','2026-11-04',1500,195,15,1710);
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',TRUE);
INSERT INTO public.purchases(id,company_id,dte_type,control_number,generation_code,supplier_name,supplier_nit,supplier_nrc,date,subtotal_gravado,iva13,percepcion1,total)
VALUES('a1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','03','FIX-A','FIX-A','Fixture A','0000-000000-000-0','1','2026-11-04',1500,195,15,1710);
DO $$
DECLARE
 cid UUID:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; bid UUID:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 rid UUID:='a2000000-0000-4000-8000-000000000001'; other UUID:='a2000000-0000-4000-8000-000000000002';
 purchase UUID:='a1000000-0000-4000-8000-000000000001'; foreign_purchase UUID:='b1000000-0000-4000-8000-000000000001';
 payload JSONB; failed BOOLEAN;
BEGIN
 payload:=jsonb_set(pg_temp.voucher(cid,rid),'{related_purchase_ids}',jsonb_build_array(purchase));
 PERFORM pg_temp.iva_check(public.save_iva_annex(payload)=rid,'owner can save');
 PERFORM pg_temp.iva_check((SELECT data->>'taxAmount'='15.00' AND annex_code='163' AND emission_date='2026-11-04' AND related_purchase_ids=ARRAY[purchase] FROM public.iva_annex_records WHERE id=rid),'period, amount and link persist');
 PERFORM pg_temp.iva_check((SELECT percepcion1=15 AND iva13=195 AND total=1710 AND retencion_iva13=0 FROM public.purchases WHERE id=purchase),'purchase tax columns remain separate');
 PERFORM public.save_iva_annex(payload);
 PERFORM pg_temp.iva_check((SELECT count(*)=1 FROM public.iva_annex_records WHERE company_id=cid),'retry keeps a single row');
 failed:=FALSE; BEGIN PERFORM public.save_iva_annex(pg_temp.voucher(cid,other)); EXCEPTION WHEN unique_violation THEN failed:=TRUE; END;
 PERFORM pg_temp.iva_check(failed,'duplicate voucher blocked');
 failed:=FALSE; BEGIN PERFORM public.save_iva_annex(jsonb_set(pg_temp.voucher(cid,other,'00028'),'{related_purchase_ids}',jsonb_build_array(purchase))); EXCEPTION WHEN unique_violation THEN failed:=TRUE; END;
 PERFORM pg_temp.iva_check(failed,'duplicate link blocked');
 failed:=FALSE; BEGIN PERFORM public.save_iva_annex(jsonb_set(pg_temp.voucher(cid,other,'00028'),'{related_purchase_ids}',jsonb_build_array(foreign_purchase))); EXCEPTION WHEN insufficient_privilege THEN failed:=TRUE; END;
 PERFORM pg_temp.iva_check(failed,'cross-company purchase link blocked');
 failed:=FALSE; BEGIN PERFORM public.save_iva_annex(pg_temp.voucher(bid,other)); EXCEPTION WHEN insufficient_privilege THEN failed:=TRUE; END;
 PERFORM pg_temp.iva_check(failed,'cross-company write blocked');
 failed:=FALSE; BEGIN PERFORM public.save_iva_annex(jsonb_set(pg_temp.voucher(cid,other),'{data,taxAmount}','"150.00"')); EXCEPTION WHEN raise_exception THEN failed:=TRUE; END;
 PERFORM pg_temp.iva_check(failed,'incorrect tax rate rejected server-side');
 failed:=FALSE; BEGIN PERFORM public.save_iva_annex(jsonb_set(pg_temp.voucher(cid,other),'{data,series}','"=1+1"')); EXCEPTION WHEN raise_exception THEN failed:=TRUE; END;
 PERFORM pg_temp.iva_check(failed,'CSV formulas rejected server-side');
 failed:=FALSE; BEGIN UPDATE public.iva_annex_records SET voided=TRUE WHERE id=rid; EXCEPTION WHEN insufficient_privilege THEN failed:=TRUE; END;
 PERFORM pg_temp.iva_check(failed,'direct write cannot bypass validation');
 PERFORM public.save_iva_annex(jsonb_set(payload,'{voided}','true'));
 PERFORM pg_temp.iva_check((SELECT voided FROM public.iva_annex_records WHERE id=rid),'excluded voucher remains stored');
 PERFORM public.save_iva_annex(jsonb_set(payload,'{data,partyName}','"Fixture corregido"'));
 PERFORM pg_temp.iva_check((SELECT NOT voided AND data->>'partyName'='Fixture corregido' FROM public.iva_annex_records WHERE id=rid),'correction and restore persist');
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',TRUE);
SELECT pg_temp.iva_check((SELECT count(*)=0 FROM public.iva_annex_records),'other company cannot read vouchers');
DO $$
DECLARE failed BOOLEAN:=FALSE;
BEGIN
  BEGIN PERFORM public.save_iva_annex(pg_temp.voucher('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','a2000000-0000-4000-8000-000000000001')); EXCEPTION WHEN insufficient_privilege THEN failed:=TRUE; END;
  PERFORM pg_temp.iva_check(failed,'cannot overwrite an id from another company');
END $$;
RESET ROLE;
INSERT INTO public.company_members(company_id,user_id,role)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','billing');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',TRUE);
SELECT pg_temp.iva_check((SELECT count(*)=1 FROM public.iva_annex_records),'billing can read own company');
DO $$
DECLARE failed BOOLEAN:=FALSE;
BEGIN
  BEGIN PERFORM public.save_iva_annex(pg_temp.voucher('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2000000-0000-4000-8000-000000000009')); EXCEPTION WHEN insufficient_privilege THEN failed:=TRUE; END;
  PERFORM pg_temp.iva_check(failed,'billing cannot write vouchers');
END $$;
RESET ROLE;
SELECT pg_temp.iva_check(NOT has_table_privilege('anon','public.iva_annex_records','SELECT'),'anonymous cannot read');
SELECT pg_temp.iva_check(NOT has_function_privilege('anon','public.save_iva_annex(jsonb)','EXECUTE'),'anonymous cannot execute writes');
DO $$ BEGIN IF (SELECT count(*) FROM pg_temp.iva_checks)<>19 THEN RAISE EXCEPTION 'IVA check count mismatch'; END IF; END $$;
ROLLBACK;
SELECT '19 pruebas de IVA aprobadas y revertidas' AS resultado,
  (SELECT count(*) FROM auth.users WHERE email IN('iva-a@example.invalid','iva-b@example.invalid','iva-c@example.invalid')) AS usuarios_fixture_restantes;
