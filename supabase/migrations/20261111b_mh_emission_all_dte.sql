-- Ambiente de pruebas 00 únicamente. Extiende la emisión desde la aplicación a CCF 03, NC 05, ND 06 y FSE 14,
-- agrega el distrito del cliente (CAT-008) y el Evento de Invalidación. No guarda certificados, claves ni JWS.
BEGIN;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS district_code TEXT;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_district_code_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_district_code_check CHECK (district_code IS NULL OR district_code ~ '^[0-9]{2}$');

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
  IF inv.dte_type NOT IN('01','03','05','06','14') THEN RAISE EXCEPTION 'mh_type_unsupported' USING ERRCODE='22023'; END IF;
  SELECT * INTO emission FROM public.mh_test_emissions WHERE invoice_id=p_invoice FOR UPDATE;
  IF NOT FOUND THEN
    IF inv.status<>'BORRADOR' OR inv.mh_reception_stamp IS NOT NULL THEN RAISE EXCEPTION 'mh_not_draft' USING ERRCODE='22023'; END IF;
    IF co.establishment_code !~ '^[MBSP][0-9]{3}$' OR co.pos_code !~ '^P[0-9]{3}$' THEN RAISE EXCEPTION 'mh_control_invalid' USING ERRCODE='22023'; END IF;
    prefix:='DTE-'||inv.dte_type||'-'||co.establishment_code||co.pos_code||'-';
    -- Factura 01 M001P001: 1 y 2 fueron usados por pilotos externos; nunca se reasignan.
    SELECT greatest(CASE WHEN inv.dte_type='01' THEN 2 ELSE 0 END,coalesce(max(right(control_number,15)::BIGINT),0)) INTO last_used
      FROM public.invoices WHERE company_id=p_company AND control_number ~ ('^'||prefix||'[0-9]{15}$');
    -- Mismo contador atómico que save_invoice_draft: la creación concurrente de borradores no colisiona.
    INSERT INTO public.invoice_counters AS counters(company_id,dte_type,establishment_code,pos_code,last_value)
      VALUES(p_company,inv.dte_type,co.establishment_code,co.pos_code,last_used+1)
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
DECLARE e public.mh_test_emissions%ROWTYPE; sv_date DATE; sv_time TIME; kind TEXT;
BEGIN
  SELECT * INTO e FROM public.mh_test_emissions WHERE invoice_id=p_invoice FOR UPDATE;
  IF NOT FOUND OR e.lease IS DISTINCT FROM p_lease OR e.lease_until<=statement_timestamp() THEN RAISE EXCEPTION 'mh_lease_invalid' USING ERRCODE='55P03'; END IF;
  IF e.state<>'PREPARADO' OR e.attempted_at IS NOT NULL THEN RAISE EXCEPTION 'mh_payload_frozen' USING ERRCODE='22023'; END IF;
  SELECT dte_type INTO kind FROM public.invoices WHERE id=p_invoice;
  IF p_document#>>'{identificacion,ambiente}' IS DISTINCT FROM '00'
    OR p_document#>>'{identificacion,tipoDte}' IS DISTINCT FROM kind
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

-- Si al preparar faltan datos (distrito, actividad, NRC, CCF relacionado...), el documento NUNCA llegó a Hacienda:
-- se libera la reserva y vuelve a BORRADOR para que el usuario lo corrija. Solo antes de congelar el JSON.
CREATE OR REPLACE FUNCTION public.release_mh_test_emission(p_invoice UUID,p_lease UUID,p_reason JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.mh_test_emissions%ROWTYPE; result JSONB;
BEGIN
  SELECT * INTO e FROM public.mh_test_emissions WHERE invoice_id=p_invoice FOR UPDATE;
  IF NOT FOUND OR p_lease IS NULL OR e.lease IS DISTINCT FROM p_lease OR e.lease_until<=statement_timestamp() THEN RAISE EXCEPTION 'mh_lease_invalid' USING ERRCODE='55P03'; END IF;
  IF e.state<>'PREPARADO' OR e.attempted_at IS NOT NULL OR e.document IS NOT NULL THEN RAISE EXCEPTION 'mh_payload_frozen' USING ERRCODE='22023'; END IF;
  DELETE FROM public.mh_test_emissions WHERE invoice_id=p_invoice;
  UPDATE public.invoices SET status='BORRADOR',mh_emission_state=NULL,mh_reception_stamp=NULL,
    mh_response_json=jsonb_build_object('estado','SIN_ENVIAR','descripcionMsg',left(coalesce(p_reason->>'descripcionMsg',''),500))
    WHERE id=p_invoice;
  SELECT (to_jsonb(inv)-'draft_request')||jsonb_build_object('invoice_items',(SELECT jsonb_agg(to_jsonb(item) ORDER BY item.num_item)
    FROM public.invoice_items item WHERE item.invoice_id=p_invoice)) INTO result FROM public.invoices inv WHERE inv.id=p_invoice;
  RETURN result;
END;
$$;

-- Evento de Invalidación (v3). Un evento por documento; mismo patrón de lease y registro previo al envío.
CREATE TABLE IF NOT EXISTS public.mh_test_invalidations (
  invoice_id UUID PRIMARY KEY REFERENCES public.invoices(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  event_code UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  state TEXT NOT NULL DEFAULT 'PREPARADO' CHECK(state IN('PREPARADO','ENVIO_INCIERTO','PROCESADO','RECHAZADO')),
  document JSONB,
  response JSONB,
  lease UUID,
  lease_until TIMESTAMPTZ,
  attempted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mh_test_invalidations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mh_test_invalidations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.mh_test_invalidations TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_mh_test_invalidation(p_company UUID,p_invoice UUID,p_actor UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inv public.invoices%ROWTYPE; co public.companies%ROWTYPE; ev public.mh_test_invalidations%ROWTYPE;
  role_name TEXT; ticket UUID:=gen_random_uuid(); result JSONB; source JSONB;
BEGIN
  SELECT role INTO role_name FROM public.company_members WHERE company_id=p_company AND user_id=p_actor FOR SHARE;
  IF role_name IS NULL OR role_name NOT IN('owner','admin','billing') THEN RAISE EXCEPTION 'mh_forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO co FROM public.companies WHERE id=p_company FOR SHARE;
  IF co.mh_environment IS DISTINCT FROM 'PRUEBAS' THEN RAISE EXCEPTION 'mh_test_only' USING ERRCODE='22023'; END IF;
  SELECT * INTO inv FROM public.invoices WHERE id=p_invoice AND company_id=p_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mh_forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO ev FROM public.mh_test_invalidations WHERE invoice_id=p_invoice FOR UPDATE;
  IF NOT FOUND THEN
    IF inv.status<>'PROCESADO' OR inv.mh_environment IS DISTINCT FROM '00' OR inv.mh_reception_stamp IS NULL THEN
      RAISE EXCEPTION 'mh_not_accepted' USING ERRCODE='22023'; END IF;
    INSERT INTO public.mh_test_invalidations(invoice_id,company_id,created_by) VALUES(p_invoice,p_company,p_actor) RETURNING * INTO ev;
  END IF;
  IF ev.lease_until>statement_timestamp() THEN RAISE EXCEPTION 'mh_busy' USING ERRCODE='55P03'; END IF;
  UPDATE public.mh_test_invalidations SET lease=ticket,lease_until=statement_timestamp()+interval '3 minutes'
    WHERE invoice_id=p_invoice RETURNING * INTO ev;
  SELECT document INTO source FROM public.mh_test_emissions WHERE invoice_id=p_invoice;
  SELECT (to_jsonb(inv)-'draft_request')||jsonb_build_object('invoice_items',coalesce((SELECT jsonb_agg(to_jsonb(item) ORDER BY item.num_item)
    FROM public.invoice_items item WHERE item.invoice_id=p_invoice),'[]'::jsonb)) INTO result;
  RETURN jsonb_build_object('invoice',result,'nit',co.nit,'lease',ticket,'eventCode',ev.event_code,'state',ev.state,
    'dteDocument',coalesce(source,inv.mh_response_json->'documento'),'event',ev.document,'response',ev.response);
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_mh_test_invalidation(p_invoice UUID,p_lease UUID,p_document JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ev public.mh_test_invalidations%ROWTYPE; inv public.invoices%ROWTYPE;
BEGIN
  SELECT * INTO ev FROM public.mh_test_invalidations WHERE invoice_id=p_invoice FOR UPDATE;
  IF NOT FOUND OR ev.lease IS DISTINCT FROM p_lease OR ev.lease_until<=statement_timestamp() THEN RAISE EXCEPTION 'mh_lease_invalid' USING ERRCODE='55P03'; END IF;
  IF ev.state<>'PREPARADO' OR ev.attempted_at IS NOT NULL THEN RAISE EXCEPTION 'mh_payload_frozen' USING ERRCODE='22023'; END IF;
  SELECT * INTO inv FROM public.invoices WHERE id=p_invoice;
  IF p_document#>>'{identificacion,ambiente}' IS DISTINCT FROM '00'
    OR upper(p_document#>>'{identificacion,codigoGeneracion}') IS DISTINCT FROM upper(ev.event_code::TEXT)
    OR upper(p_document#>>'{documento,codigoGeneracion}') IS DISTINCT FROM upper(inv.generation_code::TEXT)
    OR p_document#>>'{documento,selloRecibido}' IS DISTINCT FROM inv.mh_reception_stamp
    OR p_document#>>'{documento,tipoDte}' IS DISTINCT FROM inv.dte_type
    OR p_document#>>'{emisor,nit}' IS DISTINCT FROM (SELECT replace(nit,'-','') FROM public.companies WHERE id=ev.company_id)
    THEN RAISE EXCEPTION 'mh_identity_mismatch' USING ERRCODE='22023'; END IF;
  UPDATE public.mh_test_invalidations SET document=p_document WHERE invoice_id=p_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_mh_test_invalidation(p_invoice UUID,p_lease UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- Un envío incierto puede repetirse con el MISMO evento (mismo código de generación): Hacienda lo identifica por ese código.
  UPDATE public.mh_test_invalidations SET state='ENVIO_INCIERTO',attempted_at=coalesce(attempted_at,statement_timestamp())
    WHERE invoice_id=p_invoice AND lease=p_lease AND lease_until>statement_timestamp()
      AND state IN('PREPARADO','ENVIO_INCIERTO') AND document IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'mh_send_already_started' USING ERRCODE='55P03'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_mh_test_invalidation(p_invoice UUID,p_lease UUID,p_result JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ev public.mh_test_invalidations%ROWTYPE; accepted BOOLEAN; rejected BOOLEAN; result JSONB;
BEGIN
  SELECT * INTO ev FROM public.mh_test_invalidations WHERE invoice_id=p_invoice FOR UPDATE;
  IF NOT FOUND OR p_lease IS NULL OR ev.lease IS DISTINCT FROM p_lease THEN RAISE EXCEPTION 'mh_lease_invalid' USING ERRCODE='55P03'; END IF;
  accepted:=coalesce(ev.document IS NOT NULL AND p_result->>'estado'='PROCESADO' AND p_result->>'selloRecibido' ~ '^[A-Z0-9]{40}$'
    AND (p_result->>'http')::INTEGER BETWEEN 200 AND 299,FALSE);
  IF p_result->>'estado'='PROCESADO' AND NOT accepted THEN RAISE EXCEPTION 'mh_unconfirmed_seal' USING ERRCODE='22023'; END IF;
  rejected:=coalesce(p_result->>'estado'='RECHAZADO',FALSE);
  IF ev.state<>'PROCESADO' THEN
    IF accepted THEN
      UPDATE public.mh_test_invalidations SET state='PROCESADO',response=p_result,confirmed_at=statement_timestamp() WHERE invoice_id=p_invoice;
      UPDATE public.invoices SET status='ANULADO',
        mh_response_json=coalesce(mh_response_json,'{}'::jsonb)||jsonb_build_object('invalidacion',p_result||jsonb_build_object('evento',ev.document))
        WHERE id=p_invoice;
    ELSIF rejected THEN
      -- Un evento rechazado no queda registrado en Hacienda: se libera para un nuevo intento con otro código.
      UPDATE public.mh_test_invalidations SET state='PREPARADO',document=NULL,attempted_at=NULL,event_code=gen_random_uuid(),response=p_result
        WHERE invoice_id=p_invoice;
    ELSE
      UPDATE public.mh_test_invalidations SET response=p_result WHERE invoice_id=p_invoice;
    END IF;
  END IF;
  UPDATE public.mh_test_invalidations SET lease=NULL,lease_until=NULL WHERE invoice_id=p_invoice;
  SELECT (to_jsonb(inv)-'draft_request')||jsonb_build_object('invoice_items',(SELECT jsonb_agg(to_jsonb(item) ORDER BY item.num_item)
    FROM public.invoice_items item WHERE item.invoice_id=p_invoice)) INTO result FROM public.invoices inv WHERE inv.id=p_invoice;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_mh_test_invalidation(UUID,UUID,UUID),public.prepare_mh_test_invalidation(UUID,UUID,JSONB),
  public.start_mh_test_invalidation(UUID,UUID),public.finish_mh_test_invalidation(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_mh_test_invalidation(UUID,UUID,UUID),public.prepare_mh_test_invalidation(UUID,UUID,JSONB),
  public.start_mh_test_invalidation(UUID,UUID),public.finish_mh_test_invalidation(UUID,UUID,JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.reserve_mh_test_emission(UUID,UUID,UUID),public.prepare_mh_test_emission(UUID,UUID,JSONB),
  public.release_mh_test_emission(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_mh_test_emission(UUID,UUID,UUID),public.prepare_mh_test_emission(UUID,UUID,JSONB),
  public.release_mh_test_emission(UUID,UUID,JSONB) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
