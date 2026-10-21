-- SOLO LECTURA. Ejecutar con acceso administrativo al proyecto correcto.
-- No modifica políticas, usuarios, documentos ni credenciales.
begin transaction read only;

-- Las ocho tablas deben existir y tener RLS habilitado.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('profiles', 'companies', 'company_members', 'clients',
                   'products', 'invoices', 'invoice_items', 'purchases')
order by c.relname;

-- Revisar políticas permisivas, anónimas y referencias ambiguas.
select tablename, policyname, roles, cmd, permissive, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'companies', 'company_members', 'clients',
                   'products', 'invoices', 'invoice_items', 'purchases')
order by tablename, policyname;

-- Los privilegios y RLS se revisan juntos; tener RLS no basta por sí solo.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
  and table_name in ('profiles', 'companies', 'company_members', 'clients',
                    'products', 'invoices', 'invoice_items', 'purchases')
order by table_name, grantee, privilege_type;

-- SECURITY DEFINER necesita propietario/privilegios/search_path apropiados.
select p.oid::regprocedure as function_name, p.prosecdef as security_definer,
       p.proconfig as function_settings, pg_get_userbyid(p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('has_company_access', 'handle_new_user');

-- Estructura, unicidad y vínculos: sin consultar contenidos de los registros.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('companies', 'company_members', 'clients', 'products',
                    'invoices', 'invoice_items', 'purchases')
order by table_name, ordinal_position;

select c.relname as table_name, con.conname as constraint_name,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('companies', 'company_members', 'clients', 'products',
                   'invoices', 'invoice_items', 'purchases')
order by c.relname, con.conname;

rollback;
