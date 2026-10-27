# SIVAR SUITE · SIVAR FACT

Suite web para negocios de El Salvador, construida con React, TypeScript y Vite. El home presenta cuatro módulos: **SIVAR FACT** está disponible; **SIVAR CONTA**, **SIVAR STOCK** y **SIVAR ADMIN** están deshabilitados y marcados como próximos. Facturación incluye las vistas existentes de ventas, clientes, productos, compras y libros de IVA.

El selector de módulos es público y no monta los datos empresariales. Al entrar a FACT se carga de forma diferida el módulo actual, que mantiene Supabase Auth y los permisos por empresa. Las rutas anteriores (`#/inicio`, `#/facturas`, etc.) siguen funcionando; `#/suite`, `#/modulos` y `#/ayuda` pertenecen al home. Los callbacks de confirmación y recuperación de cuenta llegan al acceso de FACT. El tema principal de facturación es azul, según la referencia del cliente.

**El estado actual es de evaluación. Los documentos nuevos son borradores sin validez fiscal. Incluye registro, acceso y recuperación con Supabase Auth, navegación con URL, permisos por empresa y guardado transaccional de facturas con correlativos del servidor. La firma y emisión fiscal siguen pendientes antes de operar en producción fiscal.**

## Ejecución local

Utiliza Node.js 22.12 o posterior de la rama 22 y npm. Desde la raíz del repositorio:

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
npm run audit:production
npm run audit:critical
npx playwright install chromium
npm run test:e2e
```

`npm test` ejecuta Vitest y React Testing Library. La salida del comando determina el número de pruebas y su resultado; el proyecto no mantiene una cifra fija de pruebas aprobadas en esta documentación.

`npm run build` comprueba TypeScript y genera el sitio estático en `dist/`. Una compilación correcta o una suite aprobada no certifican seguridad, cumplimiento fiscal ni comportamiento contra servicios externos.

El workflow `.github/workflows/ci.yml` instala dependencias, audita producción, rechaza avisos críticos de desarrollo, ejecuta pruebas unitarias y de componentes, compila y ejecuta Playwright en escritorio y móvil para cada push y pull request. Guarda informes y trazas de fallos durante siete días. Ese workflow no publica ni despliega el sitio.

Las versiones de Vite, Vitest, Playwright y el plugin de React están fijadas en el lockfile. El analizador de selectores CSS usa una versión corregida mediante `overrides`. El resultado de `npm audit` debe consultarse en cada revisión; pasar su umbral de críticos no equivale a una auditoría sin avisos.

### Alcance de las pruebas end to end

Playwright compila con variables de Supabase vacías y utiliza datos ficticios en contextos de navegador aislados. Cubre el home, módulos bloqueados, búsqueda, navegación, cinco tipos de borrador, altas de cliente/producto/compra/empresa, persistencia local tras recargar, aislamiento visual por empresa, filtros, libros, descarga CSV y un PDF real con firma de archivo `%PDF-`. Se ejecuta en Chromium de escritorio y con una pantalla móvil de 390 píxeles; también comprueba desbordes en 320, 390, 768 y 1440 píxeles.

La configuración `playwright.config.ts` inicia su servidor en el puerto 4173 y requiere ese puerto libre. La revisión visual manual usa el navegador de la aplicación. Estos recorridos no envían documentos a Hacienda, no acreditan correo real, no sustituyen los controles RLS ni una prueba de carga con usuarios simultáneos, y no validan una APP iOS/Android nativa.

El paisaje de `public/images/suite-landscape.webp` fue generado para este proyecto y optimizado a WebP. Las ilustraciones de módulos son SVG editables en `ModuleArtwork.tsx`; los textos y controles son componentes HTML accesibles.

## Supabase opcional para desarrollo

Para evaluar la persistencia remota, copia `.env.example` a `.env` y completa exclusivamente los datos de un proyecto de pruebas propio:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-publica
```

Reinicia Vite después de cambiar el archivo. Las variables con prefijo `VITE_` forman parte del JavaScript público entregado al navegador: utiliza únicamente la clave pública del proyecto. Las claves `service_role`, credenciales de Hacienda y llaves privadas deben permanecer en un backend seguro.

`supabase/schema.sql` es el esquema inicial histórico. En una base nueva aplica después `supabase/migrations/20261021_security.sql` y `supabase/migrations/20261021_table_privileges.sql`; no vuelvas a ejecutar las semillas ni el esquema inicial sobre una base existente. Las migraciones sustituyen las reglas piloto abiertas, exigen autenticación y membresía, eliminan la recursión de miembros y protegen la columna `mh_api_key` del acceso desde el navegador. También retiran privilegios de destrucción de tablas y DDL al rol del navegador. Fueron aplicadas al proyecto restaurado el 21 de octubre de 2026; la sustitución de políticas contó con autorización explícita del propietario. Después se verificó HTTP 401 para las ocho tablas usando solo la clave pública sin sesión.

El registro requiere confirmar el correo cuando Supabase tenga activada esa opción. Configura **Authentication → URL Configuration → Site URL** con la URL de tu despliegue; en el proyecto publicado es `https://sivarconta.vercel.app`. Una cuenta nueva empieza sin empresas. La RPC `create_company` crea la empresa y su propietario en una sola transacción y no permite apropiarse de empresas existentes. Las empresas históricas sin miembros requieren una asignación administrativa explícita.

Después aplica `supabase/migrations/20261021_persistence.sql`. Añade los campos que faltaban de empresas, clientes, productos y compras. La RPC `save_invoice_draft` valida pertenencia y relaciones, comprueba las partidas y los totales, asigna fecha y correlativo en el servidor y guarda encabezado, partidas y secuencia en la misma transacción. Las escrituras directas de facturas y partidas desde el navegador quedan retiradas. Un mismo ID y contenido permiten recuperar un resultado confirmado sin duplicarlo; un ID reutilizado con otros datos se rechaza. El frontend conserva el ID de un reintento mientras permanece montado el proveedor; no garantiza conservar una solicitud pendiente tras recargar o cerrar el navegador.

`supabase/tests/persistence-roundtrip.sql` ejecutó 31 comprobaciones reales con ROLLBACK, incluido un fallo del detalle después de insertar el encabezado. Además, se verificaron mediante la API pública y dos sesiones autenticadas los campos recuperados por el repositorio, cierre y nuevo acceso, seis guardados concurrentes, reintentos simultáneos y rechazo de escrituras directas y relaciones entre empresas. Los datos de la prueba API pertenecen exclusivamente a empresas QA nuevas y no acreditan aceptación fiscal.

La opción **Explorar demostración** carga únicamente datos de ejemplo del navegador, incluso si el despliegue tiene variables de Supabase. No realiza consultas a las tablas de empresas. Esta separación está cubierta por pruebas de componentes. La interfaz de acceso no sustituye las políticas RLS: una API expuesta debe protegerse también en el servidor.

La demostración explícita utiliza el espacio de almacenamiento `sivarconta_demo_v2_`. No lee ni elimina la caché `sivarconta_` que pudieran haber dejado versiones anteriores conectadas a la nube. Sus datos se conservan para evitar una pérdida silenciosa, pero no se muestran como ejemplos sin autenticación.

`supabase/audits/readiness.sql` contiene comprobaciones administrativas de solo lectura sobre tablas, RLS, políticas, privilegios, funciones y restricciones. Preparar este archivo no significa que ya se haya ejecutado sobre la base real.

El aislamiento entre empresas debe aplicarse con usuarios autenticados, membresías verificadas y políticas RLS probadas en PostgreSQL. Las políticas de acceso universal y la desactivación de RLS exponen los registros; no deben utilizarse para resolver errores de permisos. La selección de empresa y los filtros del frontend por sí solos no son una barrera de autorización.

`supabase/tests/tenant-isolation.sql` contiene 27 comprobaciones de RLS con tres usuarios ficticios, dos empresas y registros sintéticos, y termina con `ROLLBACK`. El 21 de octubre de 2026 se ejecutó sobre el proyecto restaurado con autorización explícita del propietario: las 27 comprobaciones aprobaron y el resultado final confirmó cero usuarios ficticios restantes. Cubre alta de empresa con propietario, lectura y edición propias, aislamiento entre empresas, rechazo de relaciones cruzadas, restricciones del rol facturador y protección de credenciales y estados fiscales. Para nuevas ejecuciones úsalo primero en una base de pruebas. No confirma el envío de correos ni la recuperación completa de una cuenta real.

`supabase/tests/read-only-guards.sql` sí se ejecutó sobre el proyecto restaurado: aprobó nueve comprobaciones de solo lectura sobre visibilidad de las ocho tablas para una identidad sin membresía y protección de la credencial fiscal. Estas pruebas no sustituyen los casos positivos y de escritura de usuarios miembros.

## Arquitectura del frontend

- `NavigationContext` separa las rutas y vistas previas del estado de los datos. Las URL, por ejemplo `#/clientes` o `#/facturas/nueva`, admiten acceso directo, recarga y Atrás/Adelante en un alojamiento estático. Los enlaces laterales conservan el comportamiento nativo de abrir en otra pestaña.
- Cada sección y la vista previa se cargan con `React.lazy`. Una espera visible y un límite de errores permiten recuperarse de fallos de red o de un módulo sin dejar la pantalla vacía.
- `services/companyRepository.ts` concentra las consultas y los mapeos de la API. Selecciona solo columnas públicas de empresas y limita los demás registros a la empresa activa en el servidor. RLS sigue siendo la barrera de autorización.
- La lectura usa páginas de hasta 500 filas y comprueba el conteo total para evitar truncar los cálculos por el límite de REST. Todavía recupera el conjunto completo de la empresa activa; no es paginación de listas a demanda ni un motor de informes del servidor.
- Hay una caché de 30 segundos por empresa y por instancia autenticada, invalidada al escribir y al pulsar **Actualizar datos**. No se comparte entre sesiones ni con la demostración. Las respuestas tardías de una empresa anterior se descartan.
- La empresa activa se recuerda en la sesión del navegador mediante una clave por usuario. Al recargar solo se restaura si sigue entre sus empresas autorizadas; otra cuenta no hereda esa selección. No se guardan documentos ni contraseñas en esa preferencia.
- Mientras se consulta la nube o hay un error, no se muestran ceros como si fueran cifras confirmadas. Las mutaciones y los respaldos locales permanecen en `AppContext`; su separación por dominio puede seguir evolucionando.

## Persistencia y alcance de la demostración

- El modo local conserva datos demo en `localStorage`; el modo remoto no mezcla esa caché con las tablas de Supabase.
- Las confirmaciones de guardado se muestran después de una respuesta remota sin error o de un guardado local correcto. Un error conserva el formulario para reintentar.
- Los identificadores de nuevos clientes, productos, compras y documentos son UUID coherentes entre el estado local y la escritura remota.
- Las facturas recuperan sus partidas y el estado almacenado. Los nuevos documentos quedan como `BORRADOR`, sin sello de recepción, respuesta ni QR de aceptación MH simulados.
- La actualización explícita vuelve a consultar la nube. Todavía no existe sincronización realtime ni resolución de conflictos entre dispositivos.
- Los datos de ejemplo y documentos históricos de versiones previas pueden contener sellos o estados simulados. No constituyen evidencia de aceptación fiscal.

## Trabajo pendiente antes de producción

1. Completar la prueba de registro, correo y recuperación con cuentas reales, y la interfaz de administración de miembros. El acceso al panel de Supabase no crea una cuenta de usuario de la aplicación.
2. Revisar las empresas históricas sin propietario y las facturas históricas sin partidas; no inventar ni borrar información para hacer pasar la revisión. Las pruebas API de la cuenta QA no sustituyen la asignación de esos propietarios reales.
3. Conservar una solicitud pendiente de forma segura a través de recargas y cierres, además de los reintentos idempotentes ya implementados en el servidor.
4. Implementar refresco/suscripciones, estados pendientes y manejo de conflictos para la sincronización entre web y móvil. La interfaz adaptable no equivale a una APP independiente ni confirma capacidades offline.
5. Integrar firma y transmisión fiscal en un backend. Validar cada tipo de documento y las reglas de negocio contra las especificaciones vigentes de Hacienda, con respuestas reales del entorno de pruebas, antes de habilitar producción.
6. Completar los flujos funcionales pendientes de los requisitos, incluidos edición/historial de clientes y compras, anulación/reenvío y administración de usuarios.

## Estructura principal

```text
src/
  components/       Vistas, formularios y navegación
  context/          Estado de datos y navegación en proveedores separados
  services/         Consultas por empresa, paginación y mapeos de Supabase
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
