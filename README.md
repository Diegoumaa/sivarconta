# SIVARCONTA

Prototipo web de facturación y gestión contable para El Salvador, construido con React, TypeScript y Vite. Incluye vistas de ventas, clientes, productos, compras y libros de IVA.

**El estado actual es de demostración y evaluación. Los documentos nuevos se guardan como borradores sin validez fiscal. La interfaz incluye acceso con Supabase Auth y recuperación de cuenta, pero todavía requiere verificar el proyecto real, la autorización por empresa y el backend fiscal antes de utilizarse con datos reales o comercializarse como SaaS.**

## Ejecución local

Utiliza Node.js 22 y npm. Desde la raíz del repositorio:

```sh
npm ci
npm run dev
```

Vite usa el puerto 3000. Abre la URL que indique la terminal, normalmente [http://localhost:3000](http://localhost:3000).

Sin variables de Supabase, la aplicación funciona como demo local con datos de ejemplo y almacenamiento del navegador. Un checkout limpio no se conecta automáticamente a una base compartida. Los datos locales dependen de ese navegador y pueden perderse al borrar su almacenamiento.

## Pruebas y compilación

```sh
npm test
npm run build
```

`npm test` ejecuta Vitest y React Testing Library. La salida del comando determina el número de pruebas y su resultado; el proyecto no mantiene una cifra fija de pruebas aprobadas en esta documentación.

`npm run build` comprueba TypeScript y genera el sitio estático en `dist/`. Una compilación correcta o una suite aprobada no certifican seguridad, cumplimiento fiscal ni comportamiento contra servicios externos.

El workflow `.github/workflows/ci.yml` instala dependencias, ejecuta pruebas y compila en Node.js 22 para cada push y pull request. Ese workflow no publica ni despliega el sitio.

## Supabase opcional para desarrollo

Para evaluar la persistencia remota, copia `.env.example` a `.env` y completa exclusivamente los datos de un proyecto de pruebas propio:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-publica
```

Reinicia Vite después de cambiar el archivo. Las variables con prefijo `VITE_` forman parte del JavaScript público entregado al navegador: utiliza únicamente la clave pública del proyecto. Las claves `service_role`, credenciales de Hacienda y llaves privadas deben permanecer en un backend seguro.

El esquema de referencia está en `supabase/schema.sql`. Contiene tablas y políticas RLS, pero requiere revisión y pruebas de integración antes de su uso real. Con variables configuradas, la aplicación solicita inicio de sesión antes de montar el proveedor de datos remotos. Incluye recuperación de acceso y cierre de sesión; su funcionamiento real depende de que el proyecto Supabase esté disponible y configurado. La gestión de miembros y sus permisos sigue pendiente de validación integral.

La opción **Explorar demostración** carga únicamente datos de ejemplo del navegador, incluso si el despliegue tiene variables de Supabase. No realiza consultas a las tablas de empresas. Esta separación está cubierta por pruebas de componentes. La interfaz de acceso no sustituye las políticas RLS: una API expuesta debe protegerse también en el servidor.

La demostración explícita utiliza el espacio de almacenamiento `sivarconta_demo_v2_`. No lee ni elimina la caché `sivarconta_` que pudieran haber dejado versiones anteriores conectadas a la nube. Sus datos se conservan para evitar una pérdida silenciosa, pero no se muestran como ejemplos sin autenticación.

`supabase/audits/readiness.sql` contiene comprobaciones administrativas de solo lectura sobre tablas, RLS, políticas, privilegios, funciones y restricciones. Preparar este archivo no significa que ya se haya ejecutado sobre la base real.

El aislamiento entre empresas debe aplicarse con usuarios autenticados, membresías verificadas y políticas RLS probadas en PostgreSQL. Las políticas de acceso universal y la desactivación de RLS exponen los registros; no deben utilizarse para resolver errores de permisos. La selección de empresa y los filtros del frontend por sí solos no son una barrera de autorización.

Antes de conectar datos reales se debe verificar con dos usuarios de empresas diferentes que cada operación de lectura, inserción, edición y eliminación rechace el acceso cruzado, incluida la consulta directa a la API.

## Persistencia y alcance de la demostración

- El modo local conserva datos demo en `localStorage`; el modo remoto no mezcla esa caché con las tablas de Supabase.
- Las confirmaciones de guardado se muestran después de una respuesta remota sin error o de un guardado local correcto. Un error conserva el formulario para reintentar.
- Los identificadores de nuevos clientes, productos, compras y documentos son UUID coherentes entre el estado local y la escritura remota.
- Las facturas recuperan sus partidas y el estado almacenado. Los nuevos documentos quedan como `BORRADOR`, sin sello de recepción, respuesta ni QR de aceptación MH simulados.
- El indicador de conexión confirma la carga inicial correcta. Todavía no existe sincronización realtime ni resolución de conflictos entre dispositivos.
- Los datos de ejemplo y documentos históricos de versiones previas pueden contener sellos o estados simulados. No constituyen evidencia de aceptación fiscal.

## Trabajo pendiente antes de producción

1. Verificar los flujos de autenticación y recuperación con el proyecto Supabase real, y completar roles/permisos. Definir alta de empresas y asignación del miembro propietario de forma transaccional.
2. Revisar las políticas SQL y probar el aislamiento por empresa en una base de pruebas. Las subconsultas de las políticas de empresas y miembros requieren especial atención a sus referencias y posibles recursiones.
3. Guardar encabezado y partidas de una factura mediante una RPC transaccional con reintentos idempotentes. Actualmente son dos peticiones: un fallo del detalle se reporta, pero puede dejar un borrador parcial en la base.
4. Reservar correlativos mediante una secuencia o función transaccional del backend, con restricciones por empresa, tipo de documento y establecimiento. La reserva del navegador solo evita colisiones dentro de esa instancia.
5. Completar el esquema y los mapeos para conservar entre dispositivos el concepto, forma de pago y retención de renta de compras, la categoría de productos y el nombre comercial de clientes.
6. Implementar refresco/suscripciones, estados pendientes y manejo de conflictos para la sincronización entre web y móvil. La interfaz adaptable no equivale a una APP independiente ni confirma capacidades offline.
7. Integrar firma y transmisión fiscal en un backend. Validar cada tipo de documento y las reglas de negocio contra las especificaciones vigentes de Hacienda, con respuestas reales del entorno de pruebas, antes de habilitar producción.
8. Completar los flujos funcionales pendientes de los requisitos, incluidos edición/historial de clientes y compras, anulación/reenvío y administración de usuarios.

## Estructura principal

```text
src/
  components/       Vistas, formularios y navegación
  context/          Estado y coordinación de persistencia
  data/             Datos de demostración
  lib/              Configuración de Supabase y almacenamiento local
  types/            Tipos de documentos y entidades
  utils/            Cálculos, validación y exportaciones
  __tests__/        Pruebas unitarias y de componentes
supabase/schema.sql Esquema de referencia pendiente de validación integral
.github/workflows/ci.yml
```

## Enlaces del proyecto

- [Repositorio](https://github.com/Diegoumaa/sivarconta)
- [Sitio de demostración](https://sivarconta.vercel.app)

Los cambios locales solo afectan esta copia. La publicación en GitHub o Vercel se realiza mediante un proceso de despliegue separado.
