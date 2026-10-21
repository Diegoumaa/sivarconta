-- No fixture users, no table writes. Verifies a nonmember identity and column isolation.
BEGIN TRANSACTION READ ONLY;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',TRUE);
DO $$ DECLARE tab TEXT; visible BIGINT; BEGIN
  FOREACH tab IN ARRAY ARRAY['profiles','companies','company_members','clients','products','invoices','invoice_items','purchases'] LOOP
    EXECUTE format('SELECT count(id) FROM public.%I',tab) INTO visible;
    IF visible <> 0 THEN RAISE EXCEPTION 'Unexpected nonmember access: %',tab; END IF;
  END LOOP;
  IF has_column_privilege('authenticated','public.companies','mh_api_key','SELECT') THEN
    RAISE EXCEPTION 'Fiscal credential exposed to authenticated browser';
  END IF;
END; $$;
ROLLBACK;
SELECT '9 comprobaciones de solo lectura aprobadas: ocho tablas invisibles sin membresia y credencial fiscal protegida.' AS resultado;
