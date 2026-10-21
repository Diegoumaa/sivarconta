# Requerimientos Iniciales - Sistema de Facturación y Gestión Contable (SIVARCONTA)
*Documento original entregado por Emanuel Garcia / Despacho Contable*  
*Ruta original en disco:* `C:\Users\55554\Downloads\Requerimientos_Sistema_Facturacion_SIVARCONTA.docx`

---

## 1. Objetivo General
Desarrollar un sistema de facturación y gestión empresarial accesible mediante:
* **Plataforma Web**
* **Aplicación Móvil (APP / PWA)**

Ambas plataformas deberán estar conectadas a la misma base de datos, de manera que toda la información registrada o modificada desde la APP esté disponible también desde la plataforma Web, y viceversa.
*Ejemplo:* Si un usuario registra una factura desde la APP, esta deberá aparecer inmediatamente en la plataforma Web al iniciar sesión y viceversa.

---

## 2. Estructura Inicial del Sistema
El sistema contará inicialmente con los siguientes módulos:
1. **Dashboard**
2. **Facturación (DTE)**
3. **Clientes**
4. **Libros de IVA**
5. **Compras**

Estos módulos podrán ampliarse posteriormente de acuerdo con las necesidades del sistema y de los usuarios.

---

## 3. Dashboard
El Dashboard será la pantalla principal después de iniciar sesión.
Deberá mostrar información resumida y de fácil lectura:
* Ventas del período.
* Compras del período.
* IVA generado (Débito Fiscal).
* IVA crédito fiscal.
* Total de facturas emitidas.
* Total de clientes.
* Facturas pendientes / anuladas, si aplica.
* Resumen de ingresos y gastos.
* Gráficas de ventas y compras.
* Selector de período: **Hoy**, **Esta semana**, **Este mes**, **Mes anterior**, **Rango personalizado**.

---

## 4. Módulo de Facturación
Módulo central del sistema para emisión de documentos tributarios electrónicos oficiales.

### Emisión de documentos:
* Selección de cliente (o creación rápida).
* Agregar productos o servicios (cantidad, precio unitario, descuentos, IVA, total).
* Forma de pago (Contado, Crédito, plazos).
* Observaciones.

### Gestión de facturas:
* Crear factura.
* Visualizar factura en pantalla.
* Descargar / imprimir factura en PDF.
* Consultar facturas anteriores con filtros por número, cliente o fecha.
* Ver estado del documento ante Hacienda.
* Anulación / cancelación cuando corresponda.
* Reenvío al cliente.

---

## 5. Módulo de Clientes
Administración del directorio de receptores y clientes:
* Nombre / Razón Social.
* DUI o NIT según corresponda.
* NRC, si aplica.
* Tipo de contribuyente (Gran Contribuyente, Mediano, Pequeño, Consumidor Final).
* Dirección, Departamento y Municipio.
* Teléfono, Correo electrónico y Contacto.
* Condiciones de pago.
* Historial de facturación y documentos asociados al cliente.
* Sincronización instantánea entre Web y Móvil.

---

## 6. Módulo de Libros de IVA (F07 Oficial)
Control de las operaciones relacionadas con el IVA:
* **Libro de Ventas a Contribuyentes (Crédito Fiscal DTE-03):** Fecha, número de control, cliente, ventas gravadas, débito fiscal, retenciones/percepciones.
* **Libro de Ventas a Consumidor Final (DTE-01):** Ventas diarias gravadas y exentas.
* **Libro de Compras:** Proveedor, documento, compras gravadas, crédito fiscal (13%), retenciones.
* **Funciones:** Consulta por período, totales automáticos, liquidación fiscal y exportación a Excel (CSV) y PDF.

---

## 7. Módulo de Compras
Registro y control de las compras realizadas a proveedores:
* Proveedor, NIT y NRC.
* Fecha, tipo de documento y número.
* Subtotal, IVA Crédito Fiscal (13%), retenciones (1%) y total a pagar.
* Integración directa con el Libro de Compras de IVA.

---

## 8. Usuarios y Seguridad
* Control de acceso y sesiones.
* Estructura multi-empresa con aislamiento total:
  * Empresa → Administrador → Usuarios/empleados.
* Cada usuario visualiza únicamente la información correspondiente a la empresa a la que pertenece.

---

## 9. Sincronización Web + APP Móvil
* Plataforma unificada bajo una misma base de datos en tiempo real (Supabase PostgreSQL).
* Interfaz responsiva y Progressive Web App (PWA) instalable en teléfonos celulares (Android e iOS) y computadoras.

---

## 10. Arquitectura Multi-Empresa (Multi-Tenant)
* Capacidad de operar múltiples empresas de forma simultánea e independiente en la misma plataforma.
* La información de la Empresa A (clientes, facturas, compras, libros) está completamente aislada de la Empresa B.

---

## 11. Primera Versión (MVP) y Visión del Negocio
* **Web & Móvil:** Dashboard, Facturación DTE, Clientes, Compras, Libros de IVA, Configuración de Empresa.
* **Objetivo Comercial:** Plataforma de facturación y gestión empresarial para uso interno de los clientes del despacho contable y posterior comercialización bajo modelo SaaS mensual.
