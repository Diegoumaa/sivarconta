BEGIN;

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS f07_renta jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS f07_renta jsonb;

CREATE OR REPLACE FUNCTION public.valid_f07_renta(kind text, codes jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(
    jsonb_typeof(codes) = 'object' AND jsonb_typeof(codes->'operation') = 'string'
    AND CASE kind
      WHEN 'sale' THEN codes->>'operation' IN ('1','2','3','4','12','13')
        AND jsonb_typeof(codes->'income') = 'string'
        AND codes->>'income' IN ('1','2','3','4','5','6','7','8','9','10','12','13')
        AND codes - ARRAY['operation','income'] = '{}'::jsonb
      WHEN 'purchase' THEN
        jsonb_typeof(codes->'classification') = 'string'
        AND jsonb_typeof(codes->'sector') = 'string'
        AND jsonb_typeof(codes->'cost') = 'string'
        AND codes - ARRAY['operation','classification','sector','cost'] = '{}'::jsonb
        AND (
          (codes->>'operation' = '9' AND codes->>'classification' = '9' AND codes->>'sector' = '9' AND codes->>'cost' = '9')
          OR (codes->>'operation' IN ('1','2','3','4') AND codes->>'sector' IN ('1','2','3','4') AND (
            (codes->>'classification' = '2' AND codes->>'cost' IN ('1','2','3','8'))
            OR (codes->>'classification' = '1' AND (
              codes->>'cost' IN ('4','5','8') OR (codes->>'sector' = '1' AND codes->>'cost' IN ('6','7'))
            ))
          ))
        )
      ELSE false
    END, false);
$$;

REVOKE ALL ON FUNCTION public.valid_f07_renta(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valid_f07_renta(text, jsonb) TO authenticated, service_role;

ALTER TABLE public.purchases ADD CONSTRAINT purchases_f07_renta_valid CHECK (
  f07_renta IS NULL OR (dte_type IN ('03','05') AND public.valid_f07_renta('purchase', f07_renta))
);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_f07_renta_valid CHECK (
  f07_renta IS NULL OR (dte_type IN ('01','03','05','06') AND public.valid_f07_renta('sale', f07_renta))
);

-- The draft RPC already stores its original request atomically with the invoice.
-- Copy the new metadata at insert time without changing the retry payload.
CREATE OR REPLACE FUNCTION public.copy_invoice_draft_f07_renta()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.draft_request ? 'f07_renta' THEN
    NEW.f07_renta := nullif(NEW.draft_request->'f07_renta', 'null'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_invoice_draft_f07_renta() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER invoice_draft_f07_renta BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.copy_invoice_draft_f07_renta();

-- Report classification can be corrected even after acceptance. The DTE,
-- amounts, and fiscal receipt are never updated by this function.
CREATE OR REPLACE FUNCTION public.set_f07_renta(p_kind text, p_company uuid, p_document uuid, p_codes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_role(p_company, ARRAY['owner','admin','accountant']) THEN
    RAISE EXCEPTION 'Empresa o rol no autorizado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.valid_f07_renta(p_kind, p_codes) THEN
    RAISE EXCEPTION 'Clasificación de renta inválida' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'purchase' THEN
    UPDATE public.purchases SET f07_renta = p_codes
      WHERE id = p_document AND company_id = p_company AND dte_type IN ('03','05');
  ELSE
    UPDATE public.invoices SET f07_renta = p_codes
      WHERE id = p_document AND company_id = p_company AND dte_type IN ('01','03','05','06');
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comprobante no disponible para esta empresa' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_f07_renta(text, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_f07_renta(text, uuid, uuid, jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
