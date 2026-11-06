-- Record outbound attempts and reserve the free-plan quota before contacting Brevo.
BEGIN;

CREATE TABLE IF NOT EXISTS public.invoice_email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'sending' CHECK (state IN ('sending','accepted','rejected','uncertain')),
  provider_message_id TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CHECK ((state = 'accepted') = (provider_message_id IS NOT NULL)),
  CHECK ((state = 'sending') = (completed_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_email_active_attempt
  ON public.invoice_email_jobs(invoice_id) WHERE state IN ('sending','accepted','uncertain');
CREATE INDEX IF NOT EXISTS invoice_email_attempted_at ON public.invoice_email_jobs(attempted_at);
ALTER TABLE public.invoice_email_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_email_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoice_email_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.claim_invoice_email_jobs(company UUID, actor UUID, documents JSONB)
RETURNS TABLE(invoice_id UUID, job_id UUID, previous_state TEXT)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  requested RECORD;
  needed INTEGER;
  used INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.company_id = company AND m.user_id = actor
      AND m.role IN ('owner','admin','accountant','billing')
      AND c.mh_environment = 'PRODUCCION'
  ) THEN
    RAISE EXCEPTION 'Empresa, rol o ambiente no autorizado' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(documents) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Se necesita una lista de documentos' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(documents) NOT BETWEEN 1 AND 20 OR
    (SELECT count(DISTINCT x."invoiceId") FROM jsonb_to_recordset(documents) AS x("invoiceId" UUID, email TEXT))
      <> jsonb_array_length(documents) THEN
    RAISE EXCEPTION 'Selección vacía, duplicada o fuera de límite' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(documents) AS x("invoiceId" UUID, email TEXT)
    WHERE x.email IS NULL OR length(x.email) > 254 OR x.email !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'
      OR NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = x."invoiceId" AND i.company_id = company AND i.status = 'PROCESADO'
          AND i.mh_reception_stamp ~* '^[A-Z0-9]{40}$' AND btrim(i.client_email) = x.email
          AND i.mh_response_json->>'ambiente' = '01' AND i.mh_response_json->>'estado' = 'PROCESADO'
          AND lower(i.mh_response_json->>'codigoGeneracion') = i.generation_code::TEXT
          AND i.mh_response_json->>'selloRecibido' = i.mh_reception_stamp
          AND EXISTS (SELECT 1 FROM public.invoice_items item WHERE item.invoice_id = i.id)
      )
  ) THEN
    RAISE EXCEPTION 'Documento o destinatario no elegible' USING ERRCODE = '22023';
  END IF;

  -- Shared across companies because a single Brevo sender supplies this installation.
  PERFORM pg_advisory_xact_lock(1951410931);
  SELECT count(*) INTO used FROM public.invoice_email_jobs j WHERE j.attempted_at >= now() - interval '24 hours';
  SELECT count(*) INTO needed
    FROM jsonb_to_recordset(documents) AS x("invoiceId" UUID, email TEXT)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.invoice_email_jobs j
      WHERE j.invoice_id = x."invoiceId" AND j.state IN ('sending','accepted','uncertain')
    );
  IF needed > 0 AND used + needed > 300 THEN
    RAISE EXCEPTION 'invoice_email_daily_limit';
  END IF;

  FOR requested IN SELECT * FROM jsonb_to_recordset(documents) AS x("invoiceId" UUID, email TEXT)
  LOOP
    invoice_id := requested."invoiceId";
    job_id := NULL;
    SELECT j.state INTO previous_state FROM public.invoice_email_jobs j
      WHERE j.invoice_id = requested."invoiceId" AND j.state IN ('sending','accepted','uncertain');
    IF NOT FOUND THEN
      INSERT INTO public.invoice_email_jobs AS j (company_id, invoice_id, requested_by, recipient_email)
      VALUES (company, requested."invoiceId", actor, requested.email) RETURNING j.id INTO job_id;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_invoice_email_jobs(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_invoice_email_jobs(UUID, UUID, JSONB) TO service_role;
COMMIT;
