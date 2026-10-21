# SIVARCONTA - Manual Completo de Arquitectura, Despliegue y Mantenimiento

Sistema SaaS Web y Móvil (PWA) de **Facturación Electrónica (DTE)** y **Libros de IVA (F07)** para El Salvador, diseñado y desarrollado bajo las normativas técnicas oficiales de la **Dirección General de Impuestos Internos (DGII)** del **Ministerio de Hacienda de El Salvador**.

---

## 🌐 1. Enlaces y Recursos del Proyecto en Producción

* **URL en Producción (Vercel):** [https://sivarconta.vercel.app](https://sivarconta.vercel.app)
* **URL Alternativa de Vercel:** [https://sivarconta-diegoumaas-projects.vercel.app](https://sivarconta-diegoumaas-projects.vercel.app)
* **Repositorio en GitHub:** [https://github.com/Diegoumaa/sivarconta](https://github.com/Diegoumaa/sivarconta)
* **Rama Principal:** `main` (despliegue continuo automático a Vercel con cada commit)
* **Base de Datos en la Nube:** Supabase PostgreSQL (`cpbithyqxmirayubqtsk.supabase.co`)

---

## ⚡ 2. Stack Tecnológico

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18 + TypeScript** | Componentes modulares, tipado estricto para esquemas fiscales. |
| **Empaquetador & Build** | **Vite 5** | Compilación ultrarrápida, HMR y generación de bundle optimizado. |
| **Diseño & UI/UX** | **Tailwind CSS 3.4** | Estilo inspirado en `satnaing/shadcn-admin`, Linear y Tremor. |
| **Iconografía** | **Lucide React** | Iconos vectoriales de 18px consistentes. |
| **Notificaciones** | **Sonner** | Toasts elásticos con micro-interacciones hápticas. |
| **Testing** | **Vitest + Testing Library** | 18 suites de prueba automatizadas (109 pruebas unitarias, 100% pass). |
| **Backend & Base de Datos** | **Supabase (PostgreSQL 15)** | Tablas relacionales con Row Level Security (RLS) y API REST instantánea. |
| **Hosting & Edge Network** | **Vercel** | CDN global, certificado SSL automático y pipelines CI/CD integrados con Git. |
| **Exportación Documental** | **jsPDF + html2canvas** | Generación descargable de representaciones gráficas de DTE e impresión nativa. |

---

## 🚀 3. Guía de Instalación y Ejecución Local

Para cualquier desarrollador que clone el repositorio:

### Prerrequisitos
* **Node.js** v18.0.0 o superior (recomendado v20 LTS).
* **npm** v9 o superior (o `pnpm` / `yarn`).
* **Git**.

### Paso a Paso

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/Diegoumaa/sivarconta.git
   cd sivarconta
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Crea un archivo `.env` en la raíz (puedes basarte en `.env.example`):
   ```env
   VITE_SUPABASE_URL=https://cpbithyqxmirayubqtsk.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_Bh4MIAt7r9AbbYORo-HBpg_-eQ2Ah2J
   ```

4. **Ejecutar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

5. **Ejecutar la suite completa de pruebas unitarias (109 tests):**
   ```bash
   npm test
   ```

6. **Compilar para producción:**
   ```bash
   npm run build
   ```
   Los archivos estáticos listos para producción se generan en la carpeta `/dist`.

---

## 📁 4. Arquitectura de Archivos y Carpetas

```
sivarconta/
├── .env.example                 # Plantilla de variables de entorno públicas
├── index.html                   # Entrada HTML principal con viewport y metatags PWA
├── package.json                 # Dependencias y scripts de ejecución
├── tailwind.config.js           # Configuración de colores (brand, slate, zinc) y fuentes
├── tsconfig.json                # Configuración de TypeScript
├── vercel.json                  # Reglas de enrutamiento SPA (reescritura a index.html)
├── vite.config.ts               # Plugins de Vite
├── vitest.config.ts             # Configuración de Vitest para entorno JSDOM
├── supabase/
│   └── schema.sql               # Esquema DDL de tablas y políticas en PostgreSQL
└── src/
    ├── App.tsx                  # Enrutador SPA principal y proveedores de estado
    ├── index.css                # Directivas de Tailwind y estilos globales
    ├── main.tsx                 # Montaje de React DOM
    ├── __tests__/               # 18 suites de pruebas unitarias exhaustivas
    │   ├── svTaxValidators.test.ts  # Algoritmos NIT, DUI, NRC, Art. 119-B
    │   ├── dteUtils.test.ts         # Cálculos IVA 13%, retenciones 1%, 10%
    │   ├── CommandMenuAndUi.test.tsx# Pruebas de Paleta Ctrl+K y UI
    │   └── ...                      # Pruebas de componentes y vistas
    ├── components/
    │   ├── billing/
    │   │   ├── InvoiceBuilder.tsx   # Asistente de emisión en 4 pasos (Wizard)
    │   │   ├── InvoiceList.tsx      # Tabla de DTEs emitidos con filtros y búsqueda
    │   │   └── InvoicePreview.tsx   # Representación gráfica oficial DGII, visor JSON y QR
    │   ├── books/
    │   │   └── IvaBooksView.tsx     # Libros de IVA oficiales F07 (Ventas y Compras)
    │   ├── catalog/
    │   │   └── CatalogView.tsx      # Catálogo de productos y servicios con precios con/sin IVA
    │   ├── clients/
    │   │   └── ClientsView.tsx      # Directorio de clientes/empresas receptoras
    │   ├── companies/
    │   │   └── NewCompanyModal.tsx  # Modal de creación multi-empresa con máscaras NIT/NRC
    │   ├── dashboard/
    │   │   └── DashboardView.tsx    # Dashboard ejecutivo (KPIs Tremor, liquidación, onboarding)
    │   ├── layout/
    │   │   ├── CommandMenu.tsx      # Paleta de comandos global (Ctrl+K / ⌘K)
    │   │   ├── Header.tsx           # Encabezado con selector multi-empresa y buscador
    │   │   ├── Sidebar.tsx          # Menú lateral con iconos de 18px y estado activo
    │   │   └── MobileNav.tsx        # Barra de navegación inferior para pantallas móviles
    │   ├── purchases/
    │   │   └── PurchasesView.tsx    # Registro de compras de proveedores y Crédito Fiscal
    │   └── settings/
    │       └── SettingsView.tsx     # Configuración fiscal y parámetros de conexión MH
    ├── context/
    │   └── AppContext.tsx           # Estado global multi-tenant (LocalStorage + Supabase)
    ├── lib/
    │   └── supabase.ts              # Cliente Singleton de conexión a Supabase
    ├── types/
    │   ├── index.ts                 # Tipos TypeScript de DTEs, ítems, clientes, impuestos
    │   └── database.types.ts        # Tipos autogenerados de tablas de Supabase
    └── utils/
        ├── clipboard.ts             # Copia resiliente al portapapeles con fallback
        ├── dteUtils.ts              # Motor fiscal oficial: cálculos, números de control, UUIDs
        ├── pdfExport.ts             # Exportador de PDF e impresión
        └── svTaxValidators.ts       # Validadores salvadoreños (NIT Módulo 11, DUI, NRC)
```

---

## 🗄️ 5. Base de Datos en Supabase (PostgreSQL)

La plataforma utiliza Supabase como backend relacional. El esquema completo se encuentra en `supabase/schema.sql`.

### Tablas Principales:
1. **`companies`**: Datos fiscales de los emisores (Razón social, NIT, NRC, giro, dirección, sucursal `M001`, punto de venta `P001`, credenciales MH).
2. **`invoices`**: Comprobantes tributarios emitidos con su código de generación UUID v4, número de control, sello de recepción y desglose de impuestos.
3. **`purchases`**: Documentos de compra a proveedores que alimentan el Crédito Fiscal del Libro de Compras.
4. **`clients`**: Directorio de receptores con su clasificación tributaria (Contribuyente, Consumidor Final, Gran Contribuyente).
5. **`products`**: Catálogo de bienes y servicios con su tipo impositivo (Gravado, Exento, No Sujeto).

### Política de Seguridad RLS para Sincronización:
Para permitir que la aplicación web inserte y consulte registros mediante la clave anónima (`sb_publishable_...`), se ejecutan las siguientes directivas en el **SQL Editor de Supabase**:

```sql
-- Habilitar RLS en tablas principales
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para la aplicación (Piloto / Producción)
CREATE POLICY "Permitir acceso publico controlado companies" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso publico controlado invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso publico controlado purchases" ON purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso publico controlado clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso publico controlado products" ON products FOR ALL USING (true) WITH CHECK (true);
```

---

## ☁️ 6. Despliegue en Vercel (Configuración de Producción)

El proyecto está vinculado al repositorio GitHub `Diegoumaa/sivarconta`. Cada `git push origin main` dispara automáticamente una compilación y despliegue sin tiempo de inactividad (Zero-Downtime Deployment).

### Variables de Entorno en Vercel:
En el panel de **Vercel -> Settings -> Environment Variables**, deben estar configuradas para **Production** y **Preview**:

* `VITE_SUPABASE_URL` = `https://cpbithyqxmirayubqtsk.supabase.co`
* `VITE_SUPABASE_ANON_KEY` = `sb_publishable_Bh4MIAt7r9AbbYORo-HBpg_-eQ2Ah2J`

### Configuración del Proyecto en Vercel:
* **Framework Preset:** Vite
* **Build Command:** `npm run build` (o `tsc && vite build`)
* **Output Directory:** `dist`
* **Install Command:** `npm install`
* **Enrutamiento SPA (`vercel.json`):**
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```
  *(Esto garantiza que si el usuario recarga la página en cualquier ruta, Vercel no devuelva error 404).*

---

## ⚖️ 7. Motor Tributario de El Salvador (Reglas del Ministerio de Hacienda)

Todo el cálculo matemático está encapsulado en `src/utils/dteUtils.ts` y auditado con pruebas unitarias:

### A. Tipos de DTE Soportados:
1. **DTE-01 (Factura Consumidor Final):** IVA 13% incluido en el precio.
2. **DTE-03 (Comprobante de Crédito Fiscal):** IVA 13% desglosado explícitamente. Permite deducir Crédito Fiscal.
3. **DTE-14 (Factura Sujeto Excluido):** Compra a personas no inscritas en IVA. Retiene automáticamente el 10% de Impuesto sobre la Renta (Art. 156 Código Tributario).
4. **DTE-05 (Nota de Crédito):** Anulaciones, rebajas y devoluciones sobre ventas previas.
5. **DTE-06 (Nota de Débito):** Cargos adicionales de intereses o ajustes posteriores.

### B. Reglas de Retención y Percepción del 1% (Art. 162 y 163 del Código Tributario):
* **Umbral:** Aplica únicamente en operaciones gravadas iguales o superiores a **$100.00 USD**.
* **Retención 1%:** Si el comprador es clasificado como *Gran Contribuyente* y el emisor no lo es, se descuenta el 1% de IVA del total a pagar.
* **Percepción 1%:** Si el emisor es *Gran Contribuyente* y el comprador no lo es, se cobra un 1% adicional de IVA.

### C. Regla del Artículo 119-B del Código Tributario:
* Si una Factura de Consumidor Final (DTE-01) tiene un monto total igual o superior a **$200.00 USD**, es obligatorio por ley registrar el número de DUI o NIT del cliente.

### D. Identificadores Oficiales de Hacienda:
* **Código de Generación:** Identificador universal `UUID v4` en formato mayúsculas de 36 caracteres (ej: `A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D`).
* **Número de Control:** Formato normativo de 31 caracteres:  
  `DTE-XX-M001P001-XXXXXXXXXXXXXXX` (Tipo DTE + Sucursal + Punto de Venta + Correlativo de 15 dígitos con ceros a la izquierda).
* **Código QR de Consulta Pública:** Enlace oficial:  
  `https://admin.factura.gob.sv/consultaPublica?ambiente=00&codGen=...&fechaEmi=...`

---

## 🔌 8. Guía para Conectar con la API Real del Ministerio de Hacienda (Paso a Producción)

Actualmente el sistema opera en **Modo Demostración / Sandbox**, generando el JSON v3 exacto y simulando el timbrado para permitir pruebas ilimitadas sin consecuencias fiscales.

Para activar el timbrado real con el servidor de la DGII de un cliente:

### 1. Documentos y Credenciales Requeridos del Cliente:
1. **Archivo de Certificado Digital (`.crt` o `.p12`)** descargado del portal de Hacienda.
2. **Contraseña de la Llave Privada** del certificado.
3. **Usuario de API de Hacienda** (ej: `DTE_06141203901015`).
4. **Clave de Acceso API DTE** generada en `admin.factura.gob.sv`.

### 2. Flujo de Transmisión Real:
Por seguridad, la firma digital y el envío se deben ejecutar a través de un backend seguro (como una **Supabase Edge Function** o un servicio Node.js) para nunca exponer la llave privada en el navegador del usuario:

```
[Cliente Web SIVARCONTA]
        │ 1. Envía el JSON v3 del DTE
        ▼
[Supabase Edge Function / Backend Seguro]
        │ 2. Autentica con MH: POST https://api.dtes.mh.gob.sv/seguridad/auth
        │    (Obtiene Bearer Token)
        │ 3. Firma el JSON con el .crt del cliente usando JWS RS512
        │ 4. Transmite a MH: POST https://api.dtes.mh.gob.sv/fesv/recepciondte
        ▼
[Servidores Ministerio de Hacienda (DGII)]
        │ 5. Valida y devuelve sello de recepción
        ▼
[SIVARCONTA]
        │ 6. Guarda el Sello Oficial y genera el PDF con validez tributaria
```

---

## 🛠️ 9. Solución de Problemas Frecuentes (Troubleshooting)

1. **La base de datos de Supabase no carga datos o muestra error de conexión:**
   * Verifica que las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` estén configuradas en tu `.env` local o en el panel de Vercel.
   * Si el proyecto de Supabase estuvo inactivo por más de 7 días en el plan gratuito, entra al panel de Supabase y haz clic en *"Restore Project"*.

2. **Error al insertar nuevas empresas o compras desde la web:**
   * Verifica que las políticas RLS (`CREATE POLICY ...`) descritas en la sección 5 hayan sido ejecutadas en el SQL Editor de Supabase.

3. **No se ven los cambios de diseño recientes en el navegador:**
   * Los navegadores guardan en caché los archivos CSS/JS compilados. Ejecuta un refresco forzado con `Ctrl + Shift + R` (Windows) o `Cmd + Shift + R` (Mac).

---

## 📜 10. Licencia y Derechos

Desarrollado para **SIVARCONTA** - Derechos reservados para el equipo fundador y despachos contables asociados.
