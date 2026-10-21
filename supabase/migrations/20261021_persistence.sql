-- Additive persistence fixes. Existing invoices and memberships are preserved.
BEGIN;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS municipality TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS taxpayer_type TEXT CHECK(taxpayer_type IN('GRAN_CONTRIBUYENTE','MEDIANO','PEQUENO','OTRO'));
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS mh_user TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS commercial_name TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS taxpayer_type TEXT CHECK(taxpayer_type IN('GRAN_CONTRIBUYENTE','MEDIANO','PEQUENO','OTRO'));
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS concept TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_method VARCHAR(2) NOT NULL DEFAULT '01';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS retencion_renta10 NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS referenced_dte TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS draft_request JSONB;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2);
GRANT SELECT(department,municipality,taxpayer_type,mh_user), UPDATE(department,municipality,taxpayer_type,mh_user) ON public.companies TO authenticated;

-- A control number identifies a document within its issuing company.
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_control_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_control_unique ON public.invoices(company_id,control_number);
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  dte_type TEXT NOT NULL,
  establishment_code TEXT NOT NULL,
  pos_code TEXT NOT NULL,
  last_value BIGINT NOT NULL CHECK(last_value BETWEEN 1 AND 999999999999999),
  PRIMARY KEY(company_id,dte_type,establishment_code,pos_code)
);
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_counters FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_company(company_data JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid UUID := COALESCE((company_data->>'id')::UUID,gen_random_uuid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.companies(id,name,trade_name,nit,nrc,economic_activity_code,economic_activity_desc,phone,email,address,department_code,municipality_code,establishment_code,pos_code,is_gran_contribuyente,mh_environment,department,municipality,taxpayer_type,mh_user)
  VALUES(cid,company_data->>'name',company_data->>'trade_name',company_data->>'nit',company_data->>'nrc',company_data->>'economic_activity_code',company_data->>'economic_activity_desc',company_data->>'phone',company_data->>'email',company_data->>'address',COALESCE(company_data->>'department_code','06'),COALESCE(company_data->>'municipality_code','14'),COALESCE(company_data->>'establishment_code','M001'),COALESCE(company_data->>'pos_code','P001'),COALESCE((company_data->>'is_gran_contribuyente')::BOOLEAN,FALSE),COALESCE(company_data->>'mh_environment','PRUEBAS'),company_data->>'department',company_data->>'municipality',company_data->>'taxpayer_type',company_data->>'mh_user');
  INSERT INTO public.company_members(company_id,user_id,role) VALUES(cid,auth.uid(),'owner');
  RETURN cid;
END;
$$;
REVOKE ALL ON FUNCTION public.create_company(JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_company(JSONB) TO authenticated;

-- Header, items, sequence and retry key commit together or all roll back.
CREATE OR REPLACE FUNCTION public.save_invoice_draft(draft JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  cid UUID := (draft->>'company_id')::UUID;
  iid UUID := (draft->>'id')::UUID;
  clientid UUID := NULLIF(draft->>'client_id','')::UUID;
  kind TEXT := draft->>'dte_type';
  company public.companies%ROWTYPE;
  previous public.invoices%ROWTYPE;
  line RECORD;
  prefix TEXT; number BIGINT; previous_max BIGINT; control TEXT; result JSONB;
  gravado NUMERIC:=0; exento NUMERIC:=0; no_sujeto NUMERIC:=0; discounts NUMERIC:=0;
  vat NUMERIC:=0; retained NUMERIC:=0; perceived NUMERIC:=0; renta NUMERIC:=0; payable NUMERIC;
  client_gran BOOLEAN:=FALSE; net NUMERIC; sv_now TIMESTAMP := timezone('America/El_Salvador',statement_timestamp());
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_access(cid) THEN RAISE EXCEPTION 'Empresa no autorizada' USING ERRCODE='42501'; END IF;
  IF iid IS NULL OR kind IS NULL OR kind NOT IN('01','03','05','06','14') THEN RAISE EXCEPTION 'Identificador o tipo de documento inválido' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(draft->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Se requieren partidas' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(draft->'items') NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Incluye entre 1 y 1000 partidas' USING ERRCODE='22023'; END IF;
  -- Serialize retries of the same ID, including requests arriving concurrently.
  PERFORM pg_advisory_xact_lock(hashtextextended(iid::TEXT,0));
  SELECT * INTO previous FROM public.invoices WHERE id=iid;
  IF FOUND THEN
    IF previous.company_id<>cid THEN RAISE EXCEPTION 'Documento no autorizado' USING ERRCODE='42501'; END IF;
    IF previous.draft_request IS DISTINCT FROM draft THEN RAISE EXCEPTION 'La solicitud ya existe con otros datos' USING ERRCODE='22023'; END IF;
  ELSE
    SELECT * INTO STRICT company FROM public.companies WHERE id=cid;
    IF company.establishment_code !~ '^[A-Z0-9]{4}$' OR company.pos_code !~ '^[A-Z0-9]{4}$' THEN RAISE EXCEPTION 'Revisa los códigos de establecimiento y punto de venta' USING ERRCODE='22023'; END IF;
    IF clientid IS NOT NULL THEN
      SELECT is_gran_contribuyente INTO client_gran FROM public.clients WHERE id=clientid AND company_id=cid;
      IF NOT FOUND THEN RAISE EXCEPTION 'Cliente de otra empresa o inexistente' USING ERRCODE='42501'; END IF;
    END IF;
    FOR line IN SELECT * FROM jsonb_to_recordset(draft->'items') AS x(product_id UUID,description TEXT,quantity NUMERIC,unit_price NUMERIC,discount NUMERIC,tax_type TEXT,total NUMERIC)
    LOOP
      IF line.quantity IS NULL OR line.quantity<=0 OR line.quantity::TEXT IN('NaN','Infinity','-Infinity') OR line.quantity<>round(line.quantity,2)
        OR line.unit_price IS NULL OR line.unit_price<0 OR line.unit_price::TEXT IN('NaN','Infinity','-Infinity') OR line.unit_price<>round(line.unit_price,4)
        OR line.discount IS NULL OR line.discount<0 OR line.discount::TEXT IN('NaN','Infinity','-Infinity') OR line.discount>line.quantity*line.unit_price
        OR NULLIF(btrim(line.description),'') IS NULL OR line.tax_type IS NULL OR line.tax_type NOT IN('GRAVADO','EXENTO','NO_SUJETO') THEN
        RAISE EXCEPTION 'Partida inválida: revisa cantidad, precio, descuento y descripción' USING ERRCODE='22023';
      END IF;
      IF line.product_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.products p WHERE p.id=line.product_id AND p.company_id=cid) THEN RAISE EXCEPTION 'Producto de otra empresa o inexistente' USING ERRCODE='42501'; END IF;
      net:=line.quantity*line.unit_price-line.discount;
      IF round(net,2) IS DISTINCT FROM line.total THEN RAISE EXCEPTION 'El importe de una partida no coincide' USING ERRCODE='22023'; END IF;
      IF line.tax_type='GRAVADO' THEN gravado:=gravado+net; ELSIF line.tax_type='EXENTO' THEN exento:=exento+net; ELSE no_sujeto:=no_sujeto+net; END IF;
      discounts:=discounts+line.discount;
    END LOOP;
    gravado:=round(gravado,2); exento:=round(exento,2); no_sujeto:=round(no_sujeto,2); discounts:=round(discounts,2);
    IF kind IN('03','05','06') THEN
      vat:=round(gravado*0.13,2);
      IF gravado>=100 THEN
        IF client_gran AND NOT company.is_gran_contribuyente THEN retained:=round(gravado*0.01,2);
        ELSIF company.is_gran_contribuyente AND NOT client_gran THEN perceived:=round(gravado*0.01,2); END IF;
      END IF;
    ELSIF kind='14' THEN renta:=round(gravado*0.10,2);
    ELSE vat:=round(gravado*13/113,2); END IF;
    payable:=gravado+exento+no_sujeto+CASE WHEN kind IN('03','05','06') THEN vat ELSE 0 END-retained+perceived-renta;
    IF (draft->>'subtotal_gravado')::NUMERIC IS DISTINCT FROM gravado OR (draft->>'subtotal_exento')::NUMERIC IS DISTINCT FROM exento
      OR (draft->>'subtotal_no_sujeto')::NUMERIC IS DISTINCT FROM no_sujeto OR (draft->>'descuento_total')::NUMERIC IS DISTINCT FROM discounts
      OR (draft->>'iva13')::NUMERIC IS DISTINCT FROM vat OR (draft->>'retencion1')::NUMERIC IS DISTINCT FROM retained
      OR (draft->>'percepcion1')::NUMERIC IS DISTINCT FROM perceived OR (draft->>'retencion_renta10')::NUMERIC IS DISTINCT FROM renta
      OR (draft->>'total_pagar')::NUMERIC IS DISTINCT FROM payable THEN RAISE EXCEPTION 'Los totales no coinciden con las partidas' USING ERRCODE='22023'; END IF;
    IF draft->>'condition' NOT IN('CONTADO','CREDITO') OR (draft->>'condition'='CREDITO' AND COALESCE((draft->>'credit_term_days')::INTEGER,0)<=0) THEN RAISE EXCEPTION 'Condiciones de pago inválidas' USING ERRCODE='22023'; END IF;
    prefix:='DTE-'||kind||'-'||company.establishment_code||company.pos_code||'-';
    SELECT COALESCE(max(right(control_number,15)::BIGINT),0) INTO previous_max FROM public.invoices
      WHERE company_id=cid AND control_number ~ ('^'||prefix||'[0-9]{15}$');
    INSERT INTO public.invoice_counters AS counters(company_id,dte_type,establishment_code,pos_code,last_value)
      VALUES(cid,kind,company.establishment_code,company.pos_code,previous_max+1)
      ON CONFLICT(company_id,dte_type,establishment_code,pos_code) DO UPDATE
      SET last_value=greatest(counters.last_value,EXCLUDED.last_value-1)+1 RETURNING last_value INTO number;
    control:=prefix||lpad(number::TEXT,15,'0');
    INSERT INTO public.invoices(id,company_id,dte_type,control_number,generation_code,client_id,client_name,client_doc_type,client_doc_number,client_nrc,client_email,client_phone,client_address,client_municipality,client_department,emission_date,emission_time,condition,credit_term_days,payment_method,subtotal_gravado,subtotal_exento,subtotal_no_sujeto,descuento_total,iva13,retencion1,percepcion1,retencion_renta10,total_pagar,total_letras,establishment_code,pos_code,status,mh_reception_stamp,observations,referenced_dte,draft_request)
    VALUES(iid,cid,kind,control,(draft->>'generation_code')::UUID,clientid,draft->>'client_name',draft->>'client_doc_type',draft->>'client_doc_number',draft->>'client_nrc',draft->>'client_email',draft->>'client_phone',draft->>'client_address',draft->>'client_municipality',draft->>'client_department',sv_now::DATE,sv_now::TIME,draft->>'condition',COALESCE((draft->>'credit_term_days')::INTEGER,0),draft->>'payment_method',gravado,exento,no_sujeto,discounts,vat,retained,perceived,renta,payable,draft->>'total_letras',company.establishment_code,company.pos_code,'BORRADOR',NULL,draft->>'observations',draft->>'referenced_dte',draft);
    INSERT INTO public.invoice_items(invoice_id,num_item,product_id,description,code,quantity,unit_price,discount,tax_type,unit_of_measure,total,tax_amount)
    SELECT iid,ordinality::INTEGER,(value->>'product_id')::UUID,value->>'description',value->>'code',(value->>'quantity')::NUMERIC,(value->>'unit_price')::NUMERIC,(value->>'discount')::NUMERIC,value->>'tax_type',value->>'unit_of_measure',(value->>'total')::NUMERIC,
      CASE WHEN value->>'tax_type'<>'GRAVADO' OR kind='14' THEN 0 ELSE round((value->>'total')::NUMERIC*CASE WHEN kind='01' THEN 13.0/113 ELSE 0.13 END,2) END
      FROM jsonb_array_elements(draft->'items') WITH ORDINALITY;
  END IF;
  SELECT (to_jsonb(inv)-'draft_request')||jsonb_build_object('invoice_items',(SELECT jsonb_agg(to_jsonb(item) ORDER BY item.num_item) FROM public.invoice_items item WHERE item.invoice_id=iid)) INTO result FROM public.invoices inv WHERE inv.id=iid AND inv.company_id=cid;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.save_invoice_draft(JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_invoice_draft(JSONB) TO authenticated;
-- Browser writes must use the transactional RPC; existing SELECT/RLS stays active.
REVOKE INSERT,UPDATE,DELETE ON public.invoices,public.invoice_items FROM authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'Persistencia actualizada: campos completos, facturas atómicas y correlativos por empresa.' AS resultado;
