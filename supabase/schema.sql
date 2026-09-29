-- ==============================================================================
-- SIVARCONTA: Base de Datos Relacional para Facturación Electrónica (DTE)
-- El Salvador · Ministerio de Hacienda (DGII) · Normativa JSON Schema v3
-- Compatible con Supabase (PostgreSQL 15+) y Row Level Security (RLS)
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLA DE PERFILES DE USUARIO (Vinculada a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Trigger para crear perfil automáticamente al registrarse en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. TABLA DE EMPRESAS (Tenants / Emisores)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    trade_name TEXT,
    nit VARCHAR(17) NOT NULL,
    nrc VARCHAR(10) NOT NULL,
    economic_activity_code VARCHAR(10) NOT NULL,
    economic_activity_desc TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email TEXT NOT NULL,
    address TEXT NOT NULL,
    department_code VARCHAR(2) NOT NULL DEFAULT '06',   -- 06: San Salvador
    municipality_code VARCHAR(2) NOT NULL DEFAULT '14', -- 14: San Salvador Centro
    establishment_code VARCHAR(4) NOT NULL DEFAULT 'M001',
    pos_code VARCHAR(4) NOT NULL DEFAULT 'P001',
    is_gran_contribuyente BOOLEAN DEFAULT FALSE NOT NULL,
    mh_environment TEXT CHECK (mh_environment IN ('PRUEBAS', 'PRODUCCION')) DEFAULT 'PRUEBAS' NOT NULL,
    mh_api_key TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. MIEMBROS DE LA EMPRESA (Roles y permisos multi-tenant)
CREATE TABLE IF NOT EXISTS public.company_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('owner', 'admin', 'accountant', 'billing')) DEFAULT 'owner' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (company_id, user_id)
);

-- Función de seguridad para comprobar si el usuario actual tiene acceso a la empresa
CREATE OR REPLACE FUNCTION public.has_company_access(cid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.company_members
        WHERE company_id = cid AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. DIRECTORIO DE CLIENTES / RECEPTORES
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    doc_type TEXT CHECK (doc_type IN ('DUI', 'NIT', 'PASAPORTE', 'OTRO')) DEFAULT 'DUI' NOT NULL,
    doc_number VARCHAR(25) NOT NULL,
    nrc VARCHAR(10),
    economic_activity TEXT,
    is_gran_contribuyente BOOLEAN DEFAULT FALSE NOT NULL,
    email TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'San Salvador',
    municipality TEXT NOT NULL DEFAULT 'San Salvador Centro',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. CATÁLOGO DE PRODUCTOS Y SERVICIOS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 4) NOT NULL,
    cost NUMERIC(12, 4) DEFAULT 0 NOT NULL,
    tax_type TEXT CHECK (tax_type IN ('GRAVADO', 'EXENTO', 'NO_SUJETO')) DEFAULT 'GRAVADO' NOT NULL,
    unit_of_measure VARCHAR(4) DEFAULT '59' NOT NULL, -- 59: Unidad estándar MH
    stock NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    is_service BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 7. DOCUMENTOS TRIBUTARIOS ELECTRÓNICOS (INVOICES / DTE)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    dte_type TEXT CHECK (dte_type IN ('01', '03', '05', '06', '14')) NOT NULL,
    control_number VARCHAR(35) NOT NULL UNIQUE,
    generation_code UUID NOT NULL UNIQUE, -- Código de Generación (UUID v4)
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_doc_type TEXT NOT NULL,
    client_doc_number VARCHAR(25) NOT NULL,
    client_nrc VARCHAR(10),
    client_email TEXT,
    client_phone VARCHAR(20),
    client_address TEXT,
    client_municipality TEXT,
    client_department TEXT,
    emission_date DATE DEFAULT CURRENT_DATE NOT NULL,
    emission_time TIME DEFAULT CURRENT_TIME NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
    condition TEXT CHECK (condition IN ('CONTADO', 'CREDITO')) DEFAULT 'CONTADO' NOT NULL,
    credit_term_days INTEGER DEFAULT 0,
    payment_method VARCHAR(2) DEFAULT '01' NOT NULL, -- 01: Efectivo, 04: Transferencia, etc.
    subtotal_gravado NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    subtotal_exento NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    subtotal_no_sujeto NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    descuento_total NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    iva13 NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    retencion1 NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    percepcion1 NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    retencion_renta10 NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    total_pagar NUMERIC(12, 2) NOT NULL,
    total_letras TEXT NOT NULL,
    establishment_code VARCHAR(4) DEFAULT 'M001' NOT NULL,
    pos_code VARCHAR(4) DEFAULT 'P001' NOT NULL,
    status TEXT CHECK (status IN ('BORRADOR', 'TRANSMITIDO', 'PROCESADO', 'RECHAZADO', 'ANULADO')) DEFAULT 'PROCESADO' NOT NULL,
    mh_reception_stamp VARCHAR(50),
    mh_response_json JSONB,
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. DETALLE DE ÍTEMS DEL DTE
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    num_item INTEGER NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    code VARCHAR(50),
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(12, 4) NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    tax_type TEXT DEFAULT 'GRAVADO' NOT NULL,
    unit_of_measure VARCHAR(4) DEFAULT '59' NOT NULL,
    total NUMERIC(12, 2) NOT NULL
);

-- 9. REGISTRO DE COMPRAS (Para Libro de Compras y Formulario F-07)
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    dte_type VARCHAR(4) DEFAULT '03' NOT NULL,
    control_number VARCHAR(35) NOT NULL,
    generation_code VARCHAR(50) NOT NULL,
    supplier_name TEXT NOT NULL,
    supplier_nit VARCHAR(17) NOT NULL,
    supplier_nrc VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    subtotal_gravado NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    subtotal_exento NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    iva13 NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    retencion1 NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    total NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: Cada usuario ve y edita su propio perfil
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Companies: Usuarios ven empresas a las que pertenecen
CREATE POLICY "Users can view companies they belong to"
    ON public.companies FOR SELECT USING (public.has_company_access(id));
CREATE POLICY "Owners can update their company"
    ON public.companies FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.company_members WHERE company_id = id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
    );
CREATE POLICY "Authenticated users can create companies"
    ON public.companies FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. Company Members
CREATE POLICY "Users can view members of their companies"
    ON public.company_members FOR SELECT USING (public.has_company_access(company_id));
CREATE POLICY "Owners can manage members"
    ON public.company_members FOR ALL USING (
        EXISTS (SELECT 1 FROM public.company_members WHERE company_id = company_members.company_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
    );

-- 4. Clients: Acceso aislado por empresa
CREATE POLICY "Company users can view clients"
    ON public.clients FOR SELECT USING (public.has_company_access(company_id));
CREATE POLICY "Company users can insert clients"
    ON public.clients FOR INSERT WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "Company users can update clients"
    ON public.clients FOR UPDATE USING (public.has_company_access(company_id));
CREATE POLICY "Company users can delete clients"
    ON public.clients FOR DELETE USING (public.has_company_access(company_id));

-- 5. Products: Acceso aislado por empresa
CREATE POLICY "Company users can view products"
    ON public.products FOR SELECT USING (public.has_company_access(company_id));
CREATE POLICY "Company users can manage products"
    ON public.products FOR ALL USING (public.has_company_access(company_id));

-- 6. Invoices: Acceso aislado por empresa
CREATE POLICY "Company users can view invoices"
    ON public.invoices FOR SELECT USING (public.has_company_access(company_id));
CREATE POLICY "Company users can insert invoices"
    ON public.invoices FOR INSERT WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "Company users can update invoices"
    ON public.invoices FOR UPDATE USING (public.has_company_access(company_id));

-- 7. Invoice Items: Acceso en cascada según la factura
CREATE POLICY "Company users can view invoice items"
    ON public.invoice_items FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_items.invoice_id AND public.has_company_access(company_id))
    );
CREATE POLICY "Company users can insert invoice items"
    ON public.invoice_items FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_items.invoice_id AND public.has_company_access(company_id))
    );

-- 8. Purchases: Acceso aislado por empresa
CREATE POLICY "Company users can view purchases"
    ON public.purchases FOR SELECT USING (public.has_company_access(company_id));
CREATE POLICY "Company users can manage purchases"
    ON public.purchases FOR ALL USING (public.has_company_access(company_id));

-- ==============================================================================
-- DATOS INICIALES DEMO (Semilla para Distribuidora Cuscatlán y SIVAR Consultores)
-- ==============================================================================

INSERT INTO public.companies (
    id, name, trade_name, nit, nrc, economic_activity_code, economic_activity_desc,
    phone, email, address, department_code, municipality_code, establishment_code, pos_code,
    is_gran_contribuyente, mh_environment
) VALUES 
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Distribuidora Cuscatlán, S.A. de C.V.',
    'Distribuidora Cuscatlán',
    '0614-120518-102-1',
    '289410-4',
    '46510',
    'Venta al por mayor y menor de equipo tecnológico y suministros',
    '+503 2298-4400',
    'facturacion@distribuidoracuscatlan.sv',
    'Alameda Roosevelt y 45 Av. Sur, Edificio Cuscatlán, Nivel 3, San Salvador',
    '06', '14', 'M001', 'P001',
    FALSE, 'PRUEBAS'
),
(
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'SIVAR Consultores Legales y Contables, S.A. de C.V.',
    'SIVAR Consultores',
    '0614-010119-103-2',
    '315620-8',
    '69200',
    'Servicios de asesoría fiscal, contabilidad y auditoría',
    '+503 2510-9000',
    'admin@sivarconsultores.com',
    'Colonia Escalón, Paseo General Escalón #3840, San Salvador',
    '06', '14', 'M001', 'P001',
    TRUE, 'PRUEBAS'
)
ON CONFLICT (id) DO NOTHING;

-- Clientes demo
INSERT INTO public.clients (
    company_id, name, doc_type, doc_number, nrc, economic_activity, is_gran_contribuyente, email, phone, address, department, municipality
) VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Ferretería & Construcciones El Progreso, S.A. de C.V.',
    'NIT', '0501-180410-101-5', '249102-1', 'Venta de materiales de construcción y ferretería', FALSE,
    'compras@ferreteriaelprogreso.sv', '+503 2440-1234',
    'Av. Independencia Sur #45, Santa Ana', 'Santa Ana', 'Santa Ana Centro'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Supermercados Selectos de El Salvador, S.A.',
    'NIT', '0614-100295-001-9', '102938-4', 'Comercio al por menor en almacenes no especializados', TRUE,
    'proveedores@selectos.sv', '+503 2267-0000',
    'Boulevard Los Próceres, San Salvador', 'San Salvador', 'San Salvador'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Juan Carlos Pérez Rodríguez',
    'DUI', '02345678-9', NULL, 'Servicios profesionales independientes', FALSE,
    'jperez@gmail.com', '+503 7890-1234',
    'Colonia Miramonte, Calle Los Sisimiles #120, San Salvador', 'San Salvador', 'San Salvador'
)
ON CONFLICT DO NOTHING;

-- Productos demo
INSERT INTO public.products (
    company_id, code, name, description, price, cost, tax_type, unit_of_measure, stock, is_service
) VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'TEC-001', 'Laptop Dell Vostro 3520 15.6" Core i5',
    'Laptop corporativa Intel Core i5 12va Gen, 16GB RAM, 512GB SSD PCIe NVMe',
    650.00, 480.00, 'GRAVADO', '59', 15, FALSE
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'TEC-002', 'Disco Sólido SSD Kingston 1TB NVMe',
    'Unidad de estado sólido M.2 PCIe 4.0 alta velocidad',
    85.00, 55.00, 'GRAVADO', '59', 42, FALSE
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'SRV-001', 'Mantenimiento Preventivo de Servidores',
    'Servicio técnico mensual de infraestructura y copias de respaldo',
    250.00, 50.00, 'GRAVADO', '59', 999, TRUE
)
ON CONFLICT DO NOTHING;
