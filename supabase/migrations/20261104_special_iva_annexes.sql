-- Additive migration: supporting vouchers and missing purchase IVA fields.
BEGIN;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS percepcion1 NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(percepcion1>=0);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS retencion_iva13 NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(retencion_iva13>=0);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS perception_base NUMERIC(12,2) CHECK(perception_base IS NULL OR perception_base>=100);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS document_series TEXT CHECK(length(document_series)<=100);
CREATE TABLE IF NOT EXISTS public.iva_annex_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  annex_code TEXT NOT NULL CHECK(annex_code IN('108','66','161','162','163','169','170','171','172','documentos')),
  emission_date DATE NOT NULL,
  data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
  related_invoice_ids UUID[] NOT NULL DEFAULT '{}',
  related_purchase_ids UUID[] NOT NULL DEFAULT '{}',
  voided BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS iva_annex_company_period ON public.iva_annex_records(company_id,emission_date);
CREATE UNIQUE INDEX IF NOT EXISTS iva_annex_voucher_unique ON public.iva_annex_records(
  company_id,annex_code,(data->>'partyDocType'),(upper(regexp_replace(data->>'partyDoc','[-/]','','g'))),
  (data->>'docType'),(data->>'documentClass'),
  (upper(CASE WHEN data->>'documentClass'='4' THEN regexp_replace(data->>'generationCode','[-/]','','g') ELSE (data->>'series')||':'||(data->>'documentNumber') END))
) WHERE NOT voided;
ALTER TABLE public.iva_annex_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.iva_annex_records FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.iva_annex_records TO authenticated;
DROP POLICY IF EXISTS iva_annex_read ON public.iva_annex_records;
CREATE POLICY iva_annex_read ON public.iva_annex_records FOR SELECT TO authenticated USING(public.has_company_access(company_id));

CREATE OR REPLACE FUNCTION public.save_iva_annex(record_data JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  cid UUID := (record_data->>'company_id')::UUID;
  rid UUID := (record_data->>'id')::UUID;
  annex TEXT := record_data->>'annex_code';
  doc JSONB := record_data->'data';
  emission DATE := (record_data->>'emission_date')::DATE;
  invoice_ids UUID[]; purchase_ids UUID[]; existing public.iva_annex_records%ROWTYPE;
  amount NUMERIC; tax NUMERIC; rate NUMERIC; k TEXT; val TEXT;
  is_void BOOLEAN := COALESCE((record_data->>'voided')::BOOLEAN,FALSE);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_role(cid,ARRAY['owner','admin','accountant']) THEN RAISE EXCEPTION 'Empresa o rol no autorizado' USING ERRCODE='42501'; END IF;
  IF rid IS NULL OR emission IS NULL OR annex IS NULL OR annex NOT IN('108','66','161','162','163','169','170','171','172','documentos') OR jsonb_typeof(doc) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Comprobante inválido' USING ERRCODE='22023'; END IF;
  -- Serialize all edits for one company, including conflicting links and concurrent retries.
  PERFORM pg_advisory_xact_lock(hashtextextended(cid::TEXT,901));
  SELECT * INTO existing FROM public.iva_annex_records WHERE id=rid;
  IF FOUND AND (existing.company_id<>cid OR existing.annex_code<>annex) THEN RAISE EXCEPTION 'Registro de otra empresa o casilla' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(record_data->'related_invoice_ids') IS DISTINCT FROM 'array' OR jsonb_typeof(record_data->'related_purchase_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Vínculos inválidos'; END IF;
  SELECT COALESCE(array_agg(DISTINCT value::UUID),'{}') INTO invoice_ids FROM jsonb_array_elements_text(record_data->'related_invoice_ids');
  SELECT COALESCE(array_agg(DISTINCT value::UUID),'{}') INTO purchase_ids FROM jsonb_array_elements_text(record_data->'related_purchase_ids');
  IF cardinality(invoice_ids)>500 OR cardinality(purchase_ids)>500 OR EXISTS(SELECT 1 FROM unnest(invoice_ids) AS x(id) WHERE NOT EXISTS(SELECT 1 FROM public.invoices i WHERE i.id=x.id AND i.company_id=cid AND i.status='PROCESADO')) OR EXISTS(SELECT 1 FROM unnest(purchase_ids) AS x(id) WHERE NOT EXISTS(SELECT 1 FROM public.purchases p WHERE p.id=x.id AND p.company_id=cid)) THEN RAISE EXCEPTION 'Vínculos de otra empresa, borrador o inexistentes' USING ERRCODE='42501'; END IF;
  IF NOT is_void AND EXISTS(SELECT 1 FROM public.iva_annex_records r WHERE r.company_id=cid AND r.annex_code=annex AND r.id<>rid AND NOT r.voided AND (r.related_invoice_ids && invoice_ids OR r.related_purchase_ids && purchase_ids)) THEN RAISE EXCEPTION 'El documento ya fue informado en esta casilla' USING ERRCODE='23505'; END IF;
  FOR k,val IN SELECT key,value FROM jsonb_each_text(doc) LOOP
    IF length(val)>(CASE WHEN k='partyName' THEN 500 ELSE 100 END) OR val ~ '[;"\n\r\t]' OR val ~ '^\s*[=+@-]' THEN RAISE EXCEPTION 'Texto incompatible con anexo'; END IF;
  END LOOP;
  IF doc->>'documentClass' IS NULL OR doc->>'documentClass' NOT IN('1','2','4') OR NULLIF(btrim(doc->>'series'),'') IS NULL OR NULLIF(btrim(doc->>'documentNumber'),'') IS NULL THEN RAISE EXCEPTION 'Falta clase, serie o número'; END IF;
  IF doc->>'documentClass'='4' AND ((doc->>'series') !~ '^[A-Za-z0-9]{40}$' OR COALESCE(doc->>'generationCode','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR (doc->>'documentNumber') !~ '^DTE-[0-9]{2}-[A-Z0-9]{8}-[0-9]{15}$') THEN RAISE EXCEPTION 'Identificación DTE inválida'; END IF;
  IF annex<>'documentos' THEN
    IF COALESCE(doc->>'partyDoc','')='' OR doc->>'partyDocType' IS NULL OR doc->>'partyDocType' NOT IN('NIT','DUI','NRC','OTRO') THEN RAISE EXCEPTION 'Falta identificación contraparte'; END IF;
    val:=regexp_replace(doc->>'partyDoc','[-/]','','g');
    IF (doc->>'partyDocType'='NIT' AND val !~ '^[0-9]{14}$') OR (doc->>'partyDocType'='DUI' AND (val !~ '^[0-9]{9}$' OR emission<'2022-01-01')) OR (doc->>'partyDocType'='NRC' AND (annex<>'108' OR val !~ '^[0-9]{1,8}$')) OR (doc->>'partyDocType'='OTRO' AND (annex<>'66' OR val !~ '^[A-Za-z0-9]{1,14}$')) THEN RAISE EXCEPTION 'Identificación contraparte inválida'; END IF;
    IF COALESCE(doc->>'amount','') !~ '^[0-9]+(\.[0-9]{1,2})?$' OR COALESCE(doc->>'taxAmount','') !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Montos inválidos'; END IF;
    amount:=(doc->>'amount')::NUMERIC; tax:=(doc->>'taxAmount')::NUMERIC;
    IF amount<=0 OR amount>9999999.99 OR tax>9999999.99 THEN RAISE EXCEPTION 'Montos fuera de rango'; END IF;
    rate:=CASE WHEN annex IN('161','171') THEN 2 WHEN annex IN('162','163','169','170') THEN 1 WHEN annex IN('66','172') THEN 13 END;
    IF rate IS NOT NULL AND NOT(annex='66' AND tax=0) AND abs(round(amount*rate/100,2)-tax)>0.01 THEN RAISE EXCEPTION 'El impuesto no corresponde a la tasa de la casilla'; END IF;
    IF annex IN('66','108') AND NULLIF(btrim(doc->>'partyName'),'') IS NULL THEN RAISE EXCEPTION 'Falta nombre de contraparte'; END IF;
    IF annex='66' AND emission>='2024-02-01' AND (COALESCE(doc->>'operation','') NOT IN('1','2','3','4','8','9') OR COALESCE(doc->>'classification','') NOT IN('1','2','9') OR COALESCE(doc->>'sector','') NOT IN('1','2','3','4','9') OR COALESCE(doc->>'cost','') NOT IN('1','2','3','4','5','6','7','8','9')) THEN RAISE EXCEPTION 'Faltan códigos de renta'; END IF;
    IF annex IN('162','170','172') AND COALESCE(doc->>'docType','') NOT IN('05','06','07') OR annex='163' AND COALESCE(doc->>'docType','') NOT IN('03','05','06','12') OR annex='169' AND COALESCE(doc->>'docType','') NOT IN('03','05','06') OR annex='108' AND COALESCE(doc->>'docType','') NOT IN('01','03','05','06','11') THEN RAISE EXCEPTION 'Tipo de documento incompatible'; END IF;
    IF annex IN('108','169','170','171','172') AND doc->>'documentClass'<>'4' AND NULLIF(btrim(doc->>'resolution'),'') IS NULL THEN RAISE EXCEPTION 'Falta resolución'; END IF;
    IF annex='108' AND (COALESCE(doc->>'settlementSeries','')='' OR COALESCE(doc->>'settlementNumber','')='' OR COALESCE(doc->>'settlementDate','')='') THEN RAISE EXCEPTION 'Falta comprobante de liquidación'; END IF;
  ELSE
    IF doc->>'documentClass'='4' AND COALESCE(doc->>'detailType','')<>'D' OR doc->>'documentClass'<>'4' AND COALESCE(doc->>'detailType','') NOT IN('A','X') THEN RAISE EXCEPTION 'Estado legal incompatible'; END IF;
  END IF;
  INSERT INTO public.iva_annex_records(id,company_id,annex_code,emission_date,data,related_invoice_ids,related_purchase_ids,voided)
  VALUES(rid,cid,annex,emission,doc,invoice_ids,purchase_ids,is_void)
  ON CONFLICT(id) DO UPDATE SET emission_date=EXCLUDED.emission_date,data=EXCLUDED.data,related_invoice_ids=EXCLUDED.related_invoice_ids,related_purchase_ids=EXCLUDED.related_purchase_ids,voided=EXCLUDED.voided,updated_at=now()
  WHERE iva_annex_records.company_id=cid AND iva_annex_records.annex_code=annex;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro de otra empresa o casilla' USING ERRCODE='42501'; END IF;
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.save_iva_annex(JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_iva_annex(JSONB) TO authenticated;
COMMIT;
