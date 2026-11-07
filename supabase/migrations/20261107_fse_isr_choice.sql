-- Store the explicit per-line choice. Existing rows keep their original totals.
BEGIN;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS apply_isr_retention boolean;
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
  vat NUMERIC:=0; retained NUMERIC:=0; perceived NUMERIC:=0; renta NUMERIC:=0; service_base NUMERIC:=0; goods_base NUMERIC:=0; payable NUMERIC;
  client_gran BOOLEAN:=FALSE; net NUMERIC; gross_net NUMERIC; gross_gravado NUMERIC:=0; factor NUMERIC; inclusive BOOLEAN:=COALESCE((draft->>'prices_include_iva')::BOOLEAN,FALSE) AND kind IN('03','05','06'); sv_now TIMESTAMP := timezone('America/El_Salvador',statement_timestamp());
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
    IF kind='14' AND NULLIF(btrim(draft->>'client_nrc'),'') IS NOT NULL THEN RAISE EXCEPTION 'FSE requiere un receptor no inscrito en IVA' USING ERRCODE='22023'; END IF;
    IF kind IN('05','06') AND NULLIF(btrim(draft->>'referenced_dte'),'') IS NULL THEN RAISE EXCEPTION 'La nota requiere el comprobante original' USING ERRCODE='22023'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(draft->'items') item
      WHERE item ? 'apply_isr_retention' AND (kind <> '14'
        OR jsonb_typeof(item->'apply_isr_retention') IS DISTINCT FROM 'boolean'
        OR (item->'apply_isr_retention' = 'true'::jsonb AND item->>'unit_of_measure' IS DISTINCT FROM '99'))) THEN
      RAISE EXCEPTION 'La retención de ISR solo se marca en partidas de servicio de una FSE' USING ERRCODE='22023';
    END IF;
    FOR line IN SELECT * FROM jsonb_to_recordset(draft->'items') AS x(product_id UUID,description TEXT,quantity NUMERIC,unit_price NUMERIC,discount NUMERIC,tax_type TEXT,total NUMERIC,unit_of_measure TEXT,apply_isr_retention BOOLEAN)
    LOOP
      IF line.quantity IS NULL OR line.quantity<=0 OR line.quantity::TEXT IN('NaN','Infinity','-Infinity') OR line.quantity<>round(line.quantity,2)
        OR line.unit_price IS NULL OR line.unit_price<0 OR line.unit_price::TEXT IN('NaN','Infinity','-Infinity') OR line.unit_price<>round(line.unit_price,4)
        OR line.discount IS NULL OR line.discount<0 OR line.discount::TEXT IN('NaN','Infinity','-Infinity') OR line.discount>line.quantity*line.unit_price
        OR NULLIF(btrim(line.description),'') IS NULL OR line.tax_type IS NULL OR line.tax_type NOT IN('GRAVADO','EXENTO','NO_SUJETO') THEN
        RAISE EXCEPTION 'Partida inválida: revisa cantidad, precio, descuento y descripción' USING ERRCODE='22023';
      END IF;
      IF line.product_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.products p WHERE p.id=line.product_id AND p.company_id=cid) THEN RAISE EXCEPTION 'Producto de otra empresa o inexistente' USING ERRCODE='42501'; END IF;
      gross_net:=line.quantity*line.unit_price-line.discount; net:=gross_net;
      IF round(net,2) IS DISTINCT FROM line.total THEN RAISE EXCEPTION 'El importe de una partida no coincide' USING ERRCODE='22023'; END IF;
      factor:=CASE WHEN inclusive AND line.tax_type='GRAVADO' THEN 1.13 ELSE 1 END; net:=net/factor;
      IF line.tax_type='GRAVADO' THEN gross_gravado:=gross_gravado+gross_net; gravado:=gravado+net; ELSIF line.tax_type='EXENTO' THEN exento:=exento+net; ELSE no_sujeto:=no_sujeto+net; END IF;
      discounts:=discounts+line.discount/factor;
      IF line.unit_of_measure='99' THEN
        -- Requests from earlier versions omitted the field and retained all services.
        IF coalesce(line.apply_isr_retention,true) THEN service_base:=service_base+net; END IF;
      ELSIF line.tax_type='GRAVADO' THEN goods_base:=goods_base+net; END IF;
    END LOOP;
    IF inclusive THEN vat:=round(gross_gravado-gravado,2); END IF;
    gravado:=round(gravado,2); exento:=round(exento,2); no_sujeto:=round(no_sujeto,2); discounts:=round(discounts,2);
    IF kind IN('03','05','06') THEN
      IF NOT inclusive THEN vat:=round(gravado*0.13,2); END IF;
      IF gravado>=100 THEN
        IF client_gran AND NOT company.is_gran_contribuyente THEN retained:=round(gravado*0.01,2);
        ELSIF company.is_gran_contribuyente AND NOT client_gran AND COALESCE((draft->>'apply_iva_perception')::BOOLEAN,FALSE) AND goods_base>=100 THEN perceived:=round(goods_base*0.01,2); END IF;
      END IF;
    ELSIF kind='14' THEN renta:=round(service_base*0.10,2);
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
    INSERT INTO public.invoices(id,company_id,dte_type,control_number,generation_code,client_id,client_name,client_doc_type,client_doc_number,client_nrc,client_email,client_phone,client_address,client_municipality,client_department,emission_date,emission_time,condition,credit_term_days,payment_method,subtotal_gravado,subtotal_exento,subtotal_no_sujeto,descuento_total,iva13,retencion1,percepcion1,retencion_renta10,total_pagar,total_letras,establishment_code,pos_code,status,mh_reception_stamp,observations,referenced_dte,prices_include_iva,draft_request)
    VALUES(iid,cid,kind,control,(draft->>'generation_code')::UUID,clientid,draft->>'client_name',draft->>'client_doc_type',draft->>'client_doc_number',draft->>'client_nrc',draft->>'client_email',draft->>'client_phone',draft->>'client_address',draft->>'client_municipality',draft->>'client_department',sv_now::DATE,sv_now::TIME,draft->>'condition',COALESCE((draft->>'credit_term_days')::INTEGER,0),draft->>'payment_method',gravado,exento,no_sujeto,discounts,vat,retained,perceived,renta,payable,draft->>'total_letras',company.establishment_code,company.pos_code,'BORRADOR',NULL,draft->>'observations',draft->>'referenced_dte',inclusive,draft);
    INSERT INTO public.invoice_items(invoice_id,num_item,product_id,description,code,quantity,unit_price,discount,tax_type,unit_of_measure,total,tax_amount,apply_isr_retention)
    SELECT iid,ordinality::INTEGER,(value->>'product_id')::UUID,value->>'description',value->>'code',(value->>'quantity')::NUMERIC,(value->>'unit_price')::NUMERIC,(value->>'discount')::NUMERIC,value->>'tax_type',value->>'unit_of_measure',(value->>'total')::NUMERIC,
      CASE WHEN value->>'tax_type'<>'GRAVADO' OR kind='14' THEN 0 ELSE round((value->>'total')::NUMERIC*CASE WHEN kind='01' OR inclusive THEN 13.0/113 ELSE 0.13 END,2) END,
      (value->>'apply_isr_retention')::BOOLEAN
      FROM jsonb_array_elements(draft->'items') WITH ORDINALITY;
  END IF;
  SELECT (to_jsonb(inv)-'draft_request')||jsonb_build_object('invoice_items',(SELECT jsonb_agg(to_jsonb(item) ORDER BY item.num_item) FROM public.invoice_items item WHERE item.invoice_id=iid)) INTO result FROM public.invoices inv WHERE inv.id=iid AND inv.company_id=cid;
  RETURN result;
END;
$$;
NOTIFY pgrst,'reload schema';
COMMIT;
