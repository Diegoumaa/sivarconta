-- Additive, test environment only. No certificates, passwords or signed JWS are stored.
BEGIN;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS mh_environment TEXT CHECK(mh_environment IN('00','01'));
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS mh_processed_at TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS mh_message_code TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS mh_emission_state TEXT CHECK(mh_emission_state IN('PREPARADO','ENVIO_INCIERTO','PROCESADO','RECHAZADO'));

CREATE TABLE IF NOT EXISTS public.mh_test_emissions (
  invoice_id UUID PRIMARY KEY REFERENCES public.invoices(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  generation_code UUID NOT NULL UNIQUE,
  control_number TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PREPARADO' CHECK(state IN('PREPARADO','ENVIO_INCIERTO','PROCESADO','RECHAZADO')),
  document JSONB,
  response JSONB,
  lease UUID,
  lease_until TIMESTAMPTZ,
  attempted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id,control_number)
);
ALTER TABLE public.mh_test_emissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mh_test_emissions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.mh_test_emissions TO service_role;
-- Unsigned payloads are returned only by the authenticated backend after a membership check.

CREATE OR REPLACE FUNCTION public.reserve_mh_test_emission(p_company UUID,p_invoice UUID,p_actor UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  inv public.invoices%ROWTYPE; co public.companies%ROWTYPE; emission public.mh_test_emissions%ROWTYPE;
  role_name TEXT; counter BIGINT; last_used BIGINT; prefix TEXT; ticket UUID:=gen_random_uuid(); result JSONB;
  sv_now TIMESTAMP:=timezone('America/El_Salvador',statement_timestamp());
BEGIN
  SELECT role INTO role_name FROM public.company_members WHERE company_id=p_company AND user_id=p_actor FOR SHARE;
  IF role_name IS NULL OR role_name NOT IN('owner','admin','billing') THEN RAISE EXCEPTION 'mh_forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO co FROM public.companies WHERE id=p_company FOR SHARE;
  IF co.mh_environment IS DISTINCT FROM 'PRUEBAS' THEN RAISE EXCEPTION 'mh_test_only' USING ERRCODE='22023'; END IF;
  SELECT * INTO inv FROM public.invoices WHERE id=p_invoice AND company_id=p_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mh_forbidden' USING ERRCODE='42501'; END IF;
  IF inv.dte_type<>'01' THEN RAISE EXCEPTION 'mh_only_01' USING ERRCODE='22023'; END IF;
  SELECT * INTO emission FROM public.mh_test_emissions WHERE invoice_id=p_invoice FOR UPDATE;
  IF NOT FOUND THEN
    IF inv.status<>'BORRADOR' OR inv.mh_reception_stamp IS NOT NULL THEN RAISE EXCEPTION 'mh_not_draft' USING ERRCODE='22023'; END IF;
    IF co.establishment_code !~ '^[MBSP][0-9]{3}$' OR co.pos_code !~ '^P[0-9]{3}$' THEN RAISE EXCEPTION 'mh_control_invalid' USING ERRCODE='22023'; END IF;
    prefix:='DTE-01-'||co.establishment_code||co.pos_code||'-';
    SELECT greatest(2,coalesce(max(right(control_number,15)::BIGINT),0)) INTO last_used
      FROM public.invoices WHERE company_id=p_company AND control_number ~ ('^'||prefix||'[0-9]{15}$');
    -- Same atomic counter as save_invoice_draft: concurrent draft creation cannot collide.
    -- 1 and 2 were already used by the external pilots; never allocate them again.
    INSERT INTO public.invoice_counters AS counters(company_id,dte_type,establishment_code,pos_code,last_value)
      VALUES(p_company,'01',co.establishment_code,co.pos_code,last_used+1)
      ON CONFLICT(company_id,dte_type,establishment_code,pos_code) DO UPDATE
      SET last_value=greatest(counters.last_value,EXCLUDED.last_value-1)+1 RETURNING last_value INTO counter;
    UPDATE public.invoices SET generation_code=gen_random_uuid(),control_number=prefix||lpad(counter::TEXT,15,'0'),
      establishment_code=co.establishment_code,pos_code=co.pos_code,mh_environment='00',
      emission_date=sv_now::DATE,emission_time=sv_now::TIME,status='TRANSMITIDO',mh_emission_state='PREPARADO'
      WHERE id=p_invoice RETURNING * INTO inv;
    INSERT INTO public.mh_test_emissions(invoice_id,company_id,generation_code,control_number)
      VALUES(p_invoice,p_company,inv.generation_code,inv.control_number) RETURNING * INTO emission;
  END IF;
  IF emission.lease_until>statement_timestamp() THEN RAISE EXCEPTION 'mh_busy' USING ERRCODE='55P03'; END IF;
  UPDATE public.mh_test_emissions SET lease=ticket,lease_until=statement_timestamp()+interval '3 minutes'
    WHERE invoice_id=p_invoice RETURNING * INTO emission;
  SELECT (to_jsonb(inv)-'draft_request')||jsonb_build_object('invoice_items',coalesce((SELECT jsonb_agg(to_jsonb(item) ORDER BY item.num_item)
    FROM public.invoice_items item WHERE item.invoice_id=p_invoice),'[]'::jsonb)) INTO result;
  RETURN jsonb_build_object('invoice',result,'nit',co.nit,'lease',ticket,'state',emission.state,'document',emission.document,'response',emission.response);
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_mh_test_emission(p_invoice UUID,p_lease UUID,p_document JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.mh_test_emissions%ROWTYPE; sv_date DATE; sv_time TIME;
BEGIN
  SELECT * INTO e FROM public.mh_test_emissions WHERE invoice_id=p_invoice FOR UPDATE;
  IF NOT FOUND OR e.lease IS DISTINCT FROM p_lease OR e.lease_until<=statement_timestamp() THEN RAISE EXCEPTION 'mh_lease_invalid' USING ERRCODE='55P03'; END IF;
  IF e.state<>'PREPARADO' OR e.attempted_at IS NOT NULL THEN RAISE EXCEPTION 'mh_payload_frozen' USING ERRCODE='22023'; END IF;
  IF p_document#>>'{identificacion,ambiente}' IS DISTINCT FROM '00'
    OR p_document#>>'{identificacion,tipoDte}' IS DISTINCT FROM '01'
    OR upper(p_document#>>'{identificacion,codigoGeneracion}') IS DISTINCT FROM upper(e.generation_code::TEXT)
    OR p_document#>>'{identificacion,numeroControl}' IS DISTINCT FROM e.control_number
    OR p_document#>>'{emisor,nit}' IS DISTINCT FROM (SELECT replace(nit,'-','') FROM public.companies WHERE id=e.company_id)
    THEN RAISE EXCEPTION 'mh_identity_mismatch' USING ERRCODE='22023'; END IF;
  sv_date:=(p_document#>>'{identificacion,fecEmi}')::DATE; sv_time:=(p_document#>>'{identificacion,horEmi}')::TIME;
  IF abs(extract(epoch FROM (statement_timestamp()-((sv_date+sv_time) AT TIME ZONE 'America/El_Salvador'))))>1500 THEN
    RAISE EXCEPTION 'mh_stale_document' USING ERRCODE='22023'; END IF;
  UPDATE public.mh_test_emissions SET document=p_document WHERE invoice_id=p_invoice;
  UPDATE public.invoices SET emission_date=sv_date,emission_time=sv_time WHERE id=p_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_mh_test_emission(p_invoice UUID,p_lease UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.mh_test_emissions SET state='ENVIO_INCIERTO',attempted_at=statement_timestamp()
    WHERE invoice_id=p_invoice AND lease=p_lease AND lease_until>statement_timestamp()
      AND state='PREPARADO' AND attempted_at IS NULL AND document IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'mh_send_already_started' USING ERRCODE='55P03'; END IF;
  UPDATE public.invoices SET mh_emission_state='ENVIO_INCIERTO' WHERE id=p_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_mh_test_emission(p_invoice UUID,p_lease UUID,p_result JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.mh_test_emissions%ROWTYPE; accepted BOOLEAN; rejected BOOLEAN; result JSONB;
BEGIN
  SELECT * INTO e FROM public.mh_test_emissions WHERE invoice_id=p_invoice FOR UPDATE;
  IF NOT FOUND OR p_lease IS NULL OR e.lease IS DISTINCT FROM p_lease THEN RAISE EXCEPTION 'mh_lease_invalid' USING ERRCODE='55P03'; END IF;
  accepted:=coalesce(e.document IS NOT NULL AND p_result->>'estado'='PROCESADO' AND p_result->>'ambiente'='00' AND p_result->>'ambienteReportado'='00'
    AND upper(p_result->>'codigoGeneracion')=upper(e.generation_code::TEXT)
    AND upper(p_result->>'codigoGeneracionReportado')=upper(e.generation_code::TEXT)
    AND p_result->>'estadoReportado'='PROCESADO' AND p_result->>'selloRecibido' ~ '^[A-Z0-9]{40}$'
    AND (p_result->>'http')::INTEGER BETWEEN 200 AND 299,FALSE);
  IF p_result->>'estado'='PROCESADO' AND NOT accepted THEN RAISE EXCEPTION 'mh_unconfirmed_seal' USING ERRCODE='22023'; END IF;
  rejected:=coalesce(p_result->>'estado'='RECHAZADO' AND p_result->>'ambienteReportado'='00'
    AND upper(p_result->>'codigoGeneracionReportado')=upper(e.generation_code::TEXT),FALSE);
  -- Never erase a seal already independently confirmed, even when the latest query fails.
  IF e.state<>'PROCESADO' THEN
    UPDATE public.mh_test_emissions SET state=CASE WHEN accepted THEN 'PROCESADO' WHEN rejected THEN 'RECHAZADO' ELSE state END,
      response=p_result,confirmed_at=CASE WHEN accepted THEN statement_timestamp() ELSE confirmed_at END WHERE invoice_id=p_invoice;
    UPDATE public.invoices SET status=CASE WHEN accepted THEN 'PROCESADO' WHEN rejected THEN 'RECHAZADO' ELSE 'TRANSMITIDO' END,
      mh_environment='00',mh_emission_state=CASE WHEN accepted THEN 'PROCESADO' WHEN rejected THEN 'RECHAZADO' ELSE e.state END,
      mh_reception_stamp=CASE WHEN accepted THEN p_result->>'selloRecibido' ELSE NULL END,
      mh_response_json=p_result||jsonb_build_object('documento',e.document),mh_processed_at=nullif(p_result->>'fhProcesamiento',''),mh_message_code=p_result->>'codigoMsg'
      WHERE id=p_invoice;
  ELSIF accepted AND p_result->>'selloRecibido' IS DISTINCT FROM e.response->>'selloRecibido' THEN
    RAISE EXCEPTION 'mh_seal_mismatch' USING ERRCODE='22023';
  END IF;
  UPDATE public.mh_test_emissions SET lease=NULL,lease_until=NULL WHERE invoice_id=p_invoice;
  SELECT (to_jsonb(inv)-'draft_request')||jsonb_build_object('invoice_items',(SELECT jsonb_agg(to_jsonb(item) ORDER BY item.num_item)
    FROM public.invoice_items item WHERE item.invoice_id=p_invoice)) INTO result FROM public.invoices inv WHERE inv.id=p_invoice;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_mh_test_emission(UUID,UUID,UUID),public.prepare_mh_test_emission(UUID,UUID,JSONB),
  public.start_mh_test_emission(UUID,UUID),public.finish_mh_test_emission(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_mh_test_emission(UUID,UUID,UUID),public.prepare_mh_test_emission(UUID,UUID,JSONB),
  public.start_mh_test_emission(UUID,UUID),public.finish_mh_test_emission(UUID,UUID,JSONB) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
