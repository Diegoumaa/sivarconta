-- Apply after schema.sql. Tightens API access without deleting business records.
BEGIN;

CREATE OR REPLACE FUNCTION public.has_company_access(cid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.company_members AS member
    WHERE member.company_id = cid AND member.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(cid UUID, allowed_roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.company_members AS member
    WHERE member.company_id = cid AND member.user_id = auth.uid() AND member.role = ANY(allowed_roles)
  );
$$;
ALTER FUNCTION public.handle_new_user() SET search_path = '';
REVOKE ALL ON FUNCTION public.has_company_access(UUID), public.has_company_role(UUID,TEXT[]), public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_company_access(UUID), public.has_company_role(UUID,TEXT[]) TO authenticated;

-- Replace permissive pilot rules as well as recursive or ambiguous old rules.
DO $$
DECLARE policy RECORD; table_name TEXT;
BEGIN
  FOR policy IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND tablename = ANY(ARRAY['profiles','companies','company_members','clients','products','invoices','invoice_items','purchases'])
  LOOP EXECUTE format('DROP POLICY %I ON public.%I', policy.policyname, policy.tablename); END LOOP;
  FOREACH table_name IN ARRAY ARRAY['profiles','companies','company_members','clients','products','invoices','invoice_items','purchases']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, PUBLIC', table_name);
  END LOOP;
END;
$$;

CREATE POLICY profile_read ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
CREATE POLICY profile_update ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid()) WITH CHECK (id=auth.uid());
CREATE POLICY company_read ON public.companies FOR SELECT TO authenticated USING (public.has_company_access(id));
CREATE POLICY company_update ON public.companies FOR UPDATE TO authenticated
  USING (public.has_company_role(id,ARRAY['owner','admin'])) WITH CHECK (public.has_company_role(id,ARRAY['owner','admin']));
CREATE POLICY membership_read ON public.company_members FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY membership_manage ON public.company_members FOR ALL TO authenticated
  USING (public.has_company_role(company_id,ARRAY['owner'])) WITH CHECK (public.has_company_role(company_id,ARRAY['owner']));

CREATE POLICY client_read ON public.clients FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY client_insert ON public.clients FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY client_update ON public.clients FOR UPDATE TO authenticated USING (public.has_company_access(company_id)) WITH CHECK (public.has_company_access(company_id));
CREATE POLICY client_delete ON public.clients FOR DELETE TO authenticated USING (public.has_company_role(company_id,ARRAY['owner','admin']));
CREATE POLICY product_read ON public.products FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY product_insert ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY product_update ON public.products FOR UPDATE TO authenticated USING (public.has_company_access(company_id)) WITH CHECK (public.has_company_access(company_id));
CREATE POLICY product_delete ON public.products FOR DELETE TO authenticated USING (public.has_company_role(company_id,ARRAY['owner','admin']));
CREATE POLICY purchase_read ON public.purchases FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY purchase_write ON public.purchases FOR ALL TO authenticated
  USING (public.has_company_role(company_id,ARRAY['owner','admin','accountant'])) WITH CHECK (public.has_company_role(company_id,ARRAY['owner','admin','accountant']));
CREATE POLICY invoice_read ON public.invoices FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY invoice_insert ON public.invoices FOR INSERT TO authenticated WITH CHECK (
  public.has_company_access(company_id) AND status='BORRADOR' AND mh_reception_stamp IS NULL
  AND (client_id IS NULL OR EXISTS(SELECT 1 FROM public.clients AS client WHERE client.id=invoices.client_id AND client.company_id=invoices.company_id))
);
CREATE POLICY invoice_update ON public.invoices FOR UPDATE TO authenticated
  USING (public.has_company_access(company_id) AND status='BORRADOR') WITH CHECK (
    public.has_company_access(company_id) AND status='BORRADOR' AND mh_reception_stamp IS NULL
    AND (client_id IS NULL OR EXISTS(SELECT 1 FROM public.clients AS client WHERE client.id=invoices.client_id AND client.company_id=invoices.company_id))
  );
CREATE POLICY item_read ON public.invoice_items FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.invoices AS invoice WHERE invoice.id=invoice_items.invoice_id AND public.has_company_access(invoice.company_id))
);
CREATE POLICY item_insert ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS(SELECT 1 FROM public.invoices AS invoice WHERE invoice.id=invoice_items.invoice_id AND invoice.status='BORRADOR' AND public.has_company_access(invoice.company_id)
    AND (product_id IS NULL OR EXISTS(SELECT 1 FROM public.products AS product WHERE product.id=invoice_items.product_id AND product.company_id=invoice.company_id)))
);

-- No direct insertion of orphan companies. This RPC creates the company and its
-- authenticated owner in one transaction; callers cannot assign an existing company.
CREATE OR REPLACE FUNCTION public.create_company(company_data JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE company_id UUID := COALESCE((company_data->>'id')::UUID, gen_random_uuid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.companies(id,name,trade_name,nit,nrc,economic_activity_code,economic_activity_desc,phone,email,address,department_code,municipality_code,establishment_code,pos_code,is_gran_contribuyente,mh_environment)
  VALUES(company_id,company_data->>'name',company_data->>'trade_name',company_data->>'nit',company_data->>'nrc',company_data->>'economic_activity_code',company_data->>'economic_activity_desc',company_data->>'phone',company_data->>'email',company_data->>'address',COALESCE(company_data->>'department_code','06'),COALESCE(company_data->>'municipality_code','14'),COALESCE(company_data->>'establishment_code','M001'),COALESCE(company_data->>'pos_code','P001'),COALESCE((company_data->>'is_gran_contribuyente')::BOOLEAN,FALSE),COALESCE(company_data->>'mh_environment','PRUEBAS'));
  INSERT INTO public.company_members(company_id,user_id,role) VALUES(company_id,auth.uid(),'owner');
  RETURN company_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_company(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_company(JSONB) TO authenticated;
REVOKE INSERT ON public.companies FROM authenticated;

-- mh_api_key is backend-only. REST readers explicitly select the safe columns.
REVOKE SELECT ON public.companies FROM authenticated;
GRANT SELECT(id,name,trade_name,nit,nrc,economic_activity_code,economic_activity_desc,phone,email,address,department_code,municipality_code,establishment_code,pos_code,is_gran_contribuyente,mh_environment,created_at,updated_at) ON public.companies TO authenticated;
REVOKE UPDATE ON public.companies FROM authenticated;
GRANT UPDATE(name,trade_name,nit,nrc,economic_activity_code,economic_activity_desc,phone,email,address,department_code,municipality_code,establishment_code,pos_code,is_gran_contribuyente,mh_environment) ON public.companies TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND (qual='true' OR with_check='true')) THEN
    RAISE EXCEPTION 'Unexpected unconditional public policy remains';
  END IF;
  IF has_table_privilege('anon','public.companies','SELECT') OR has_table_privilege('anon','public.clients','INSERT') THEN
    RAISE EXCEPTION 'Anonymous table grants remain';
  END IF;
END;
$$;
SET LOCAL ROLE authenticated;
SELECT count(*) AS membresias_visibles_sin_identidad FROM public.company_members;
RESET ROLE;
COMMIT;
SELECT 'Permisos actualizados: acceso anónimo cerrado; RLS por empresa y roles activo.' AS resultado;
