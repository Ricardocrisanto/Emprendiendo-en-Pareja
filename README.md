# Emprendiendo en Pareja — PWA con Firebase

Primera versión funcional para administrar un pequeño negocio de ropa desde computadora o teléfono. Diseño tipo boutique: rosa quemado `#9B5268`, marfil `#F8F5F1`, carbón `#27242B`, arena `#B79E8C` y salvia `#638477`.

## Qué incluye

- Pantalla de inicio con efectivo, utilidad, existencias, ventas y gráfica simple.
- Catálogo de prendas por **SKU / modelo / talla / color**.
- Compras de **varios modelos en un mismo pedido**, con descuento configurable por número total de piezas.
- Registro de ventas entregadas, cobros parciales iniciales, gastos, inventario automático y precio editable.
- Simulador de inversión y tres escenarios (40%, 70% y 100% de venta).
- Respaldo descargable en JSON y exportaciones CSV.
- PWA instalable en navegadores compatibles (HTTPS y manifest de instalación).
- Acceso privado con Firebase Authentication (correo/contraseña) y Firestore, **una cuenta por negocio**, protegido con reglas por UID.

**Al abrirla sin Firebase**, la aplicación muestra un modo demostración que conserva los ejemplos solo en el navegador mediante localStorage. No uses ese modo para datos reales de clientes.

## Cómo probarla localmente (no requiere instalar dependencias)

1. Descomprime esta carpeta.
2. Desde la carpeta principal ejecuta `python3 -m http.server 8080 -d public` (o utiliza un servidor estático).
3. Abre `http://localhost:8080` en tu navegador.
4. Puedes navegar, registrar prendas, simular precios, compras, ventas y gastos con datos de prueba.

## Firebase y publicación

El proyecto independiente es **emprendiendo-en-pareja**. Está en el plan gratuito Spark. La app web y el sitio Hosting están registrados, el proveedor de correo y contraseña está habilitado y las reglas de Firestore se publicaron en la base predeterminada (Standard, nam5). La PWA todavía requiere su primer despliegue. Hosting proporciona la configuración web automáticamente al servir el sitio.

1. En la [consola del proyecto](https://console.firebase.google.com/project/emprendiendo-en-pareja/overview), ve a **Authentication → Usuarios → Agregar usuario**. Para las pruebas usa una cuenta ficticia. Crea la contraseña directamente en Firebase.
2. Copia el **UID** generado. En **Firestore → Datos**, crea la colección `authorizedUsers` con un documento cuyo ID sea ese UID y un campo booleano `active` con valor `true`. Las reglas comprueban que exista el documento. Repite el paso con tu cuenta de operación para que empiece con inventario vacío.
3. Desde esta carpeta, con la [CLI oficial de Firebase](https://firebase.google.com/docs/cli), ejecuta `npx firebase-tools login --reauth` con la cuenta personal propietaria del proyecto. Comprueba que la cuenta tenga acceso a `emprendiendo-en-pareja`.
4. Para probar desde computadora y teléfono, ejecuta `npx firebase-tools hosting:channel:deploy prueba --project emprendiendo-en-pareja --expires 1d`. Abre la URL temporal que entregue el comando. Inicia sesión con el usuario ficticio, verifica que otro usuario y una sesión cerrada carezcan de acceso a sus datos, y registra la compra, venta y gasto del ejemplo de abajo. Comprueba en el teléfono que se reflejen los mismos movimientos y que puedas instalar la PWA.
5. Cuando se completen esas pruebas, ejecuta `npx firebase-tools deploy --only hosting --project emprendiendo-en-pareja`. Usa la URL HTTPS que confirme la CLI. En Android, abre la URL en Chrome y elige **⋮ → Agregar a pantalla principal → Instalar**. En iPhone, abre Safari y elige **Compartir → Agregar a pantalla de inicio → Abrir como app web → Agregar**, según la versión de iOS.

### Caso de prueba con datos ficticios

En una cuenta vacía con el capital inicial de $4,000, crea dos SKU con precios de compra de $270 y $319. Compra cinco piezas de cada uno con $0.03 de envío. Deben aparecer $500 de ahorro, diez piezas y un total de $2,445.03. Si solo capturas nueve piezas, no debe aplicarse el descuento.

Vende dos piezas del segundo SKU a $390 cada una. Captura $40 de descuento, $20 de envío cobrado, $500 cobrados, $15 de entrega y $5 de empaque. Registra por separado un gasto de $25. Deben quedar ocho piezas, $260 por cobrar, $177 de utilidad y $2,009.97 en caja. Prueba que la venta se rechace si supera la existencia.

## Seguridad

- Las reglas incluidas (`firestore.rules`) autorizan lectura, alta y actualización en las colecciones del negocio cuando el UID autenticado coincide y está autorizado desde la consola. La lista de acceso solo se administra desde la consola.
- La configuración web de Firebase es pública por diseño: la protección real es **Authentication + Security Rules**.
- No publiques contraseñas, tokens de administrador ni credenciales de servicio en el repositorio.
- El HTML servido en el sitio es público, pero los datos de Firestore exigen autenticación y las reglas del usuario.
- No sincronices este proyecto con otra empresa o aplicación.

## Límites reales de esta primera versión

- No importa automáticamente el Excel de Claude. Usa ejemplos inspirados en los dos productos compartidos y necesita que captures tus productos reales.
- Una venta contiene un SKU; los pedidos con múltiples prendas quedan para una próxima versión.
- Acepta un **cobro parcial inicial**, pero aún no permite añadir abonos posteriores.
- No implementa apartados, devoluciones, cancelaciones ni ventas a crédito; tampoco libros contables ni cálculos fiscales.
- Compras registradas se consideran **recibidas y pagadas**. No se registran compras a crédito.
- Los gastos de entrega/empaque anotados al vender se descuentan del efectivo y utilidad. **No los captures de nuevo en Gastos.**
- No guarda fotografías de prendas. Podrá agregarse después según la opción de almacenamiento que se elija.
- En Firebase requiere internet para operar con seguridad. El service worker permite cargar archivos base en algunas condiciones, **pero no garantiza ventas sin conexión ni sincronización offline**.
- No se ha desplegado en una cuenta Firebase real en este paquete. El flujo de captura se probó en Chromium en escritorio y con emulación de Pixel 7. El inicio de sesión y las reglas se comprobaron con dos cuentas ficticias en Firebase Emulator Suite. Quedan pendientes la comprobación en el sitio alojado y la instalación en un teléfono físico.
- Los costos promedio y movimientos son una simplificación apta para un MVP, no sustituyen contabilidad fiscal profesional.

## Cálculos del simulador

Ejemplo con descuento supuesto de $50 por pieza a partir de 10 unidades:

| Producto | Cantidad | Precio normal | Costo supuesto | Venta sugerida |
|---|---:|---:|---:|---:|
| Chaleco Humana | 5 | $270 | $220 | $320 |
| Chamarra Laura | 5 | $319 | $269 | $390 |

Costo del pedido: $2,445. Se calcula automáticamente si se cumple el mínimo. Los escenarios (40%, 70%, 100%) usan las cantidades enteras de prendas vendidas; los gastos fijos y por venta son editables. **No son ventas reales ni ganancias garantizadas.**

## Pruebas incluidas

Ejecuta `npm test` (Node.js 18 o superior) desde la carpeta principal. Las pruebas unitarias comprueban descuento, inversión, escenarios, inventario, separación de utilidad/efectivo y dinero pendiente de cobro.

## Próximas mejoras recomendadas

Empezar por cobros posteriores, devoluciones y pedidos con varias prendas. Después considerar fotos, ficha de clientes, alertas de stock y reportes fiscales según necesidad real.

---
Documentación oficial: [Firebase Authentication](https://firebase.google.com/docs/auth) · [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started) · [Firebase Hosting](https://firebase.google.com/docs/hosting) · [PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Actualizaciones automáticas con GitHub

El archivo `.github/workflows/firebase-hosting.yml` ejecuta las pruebas y publica cada cambio de la rama `main` en Firebase Hosting. También se puede iniciar desde **Actions → Publicar en Firebase Hosting → Run workflow**. El flujo actualiza el sitio web y las PWA instaladas seguirán usando la misma dirección.

1. Sube esta carpeta como raíz de un repositorio privado de GitHub. Incluye la carpeta `.github`.
2. Vincula ese repositorio al proyecto **emprendiendo-en-pareja** con el asistente oficial `npx firebase-tools init hosting:github --project emprendiendo-en-pareja`. El asistente autoriza Firebase y GitHub y guarda la credencial como secreto `FIREBASE_SERVICE_ACCOUNT_EMPRENDIENDO_EN_PAREJA`. Conserva el flujo incluido en este paquete. Si el asistente genera flujos adicionales, revísalos antes de subirlos para evitar despliegues duplicados.
3. Ejecuta el flujo en GitHub. Abre el enlace temporal que devuelve la ejecución y prueba la app con un usuario de prueba autorizado.
4. Después de verificarla, en GitHub abre **Settings → Secrets and variables → Actions → Variables**, crea `PUBLICACION_ACTIVA` con el valor `true` y ejecuta nuevamente el flujo. Los siguientes cambios en `main` se publicarán en la URL definitiva de Hosting.
