-- Browsers need CRUD privileges governed by RLS, never table destruction or DDL privileges.
BEGIN;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON
  public.profiles, public.companies, public.company_members, public.clients,
  public.products, public.invoices, public.invoice_items, public.purchases
FROM authenticated;
COMMIT;
SELECT 'Privilegios SQL innecesarios retirados; no se han eliminado registros.' AS resultado;
