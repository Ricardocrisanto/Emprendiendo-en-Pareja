# Emprendiendo en Pareja — PWA local

Primera versión funcional para administrar un pequeño negocio de ropa desde computadora o teléfono. Diseño tipo boutique: rosa quemado `#9B5268`, marfil `#F8F5F1`, carbón `#27242B`, arena `#B79E8C` y salvia `#638477`.

## Qué incluye

- Pantalla de inicio con efectivo, utilidad, existencias, ventas y gráfica simple.
- Catálogo de prendas por **SKU / modelo / talla / color**.
- Compras de **varios modelos en un mismo pedido**, con descuento configurable por número total de piezas.
- Registro de ventas entregadas, cobros parciales iniciales, gastos, inventario automático y precio editable.
- Simulador de inversión y tres escenarios (40%, 70% y 100% de venta).
- Respaldo descargable en JSON y exportaciones CSV.
- PWA instalable en navegadores compatibles (HTTPS y manifest de instalación).
- Abre directamente y permite agregar perfiles en **Ajustes → Perfiles y respaldo**.

Cada navegador guarda un inventario propio. Sus perfiles comparten ese inventario y el perfil activo identifica quién registró cada compra, venta o gasto. La app inicia con los registros vacíos y permite descargarlos como respaldo. Usa un navegador normal, ya que el modo privado puede descartar el almacenamiento al cerrarse.

## Cómo probarla localmente (no requiere instalar dependencias)

1. Descomprime esta carpeta.
2. Desde la carpeta principal ejecuta `python3 -m http.server 8080 -d public` (o utiliza un servidor estático).
3. Abre `http://localhost:8080` en tu navegador.
4. Puedes navegar, registrar prendas, simular precios, compras, ventas y gastos con datos de prueba.

## Publicación en Firebase Hosting

Desde la carpeta clonada en Cloud Shell, actualiza la rama y despliega únicamente Hosting:

```sh
git pull --ff-only
npx --yes firebase-tools deploy --only hosting --project emprendiendo-en-pareja
```

Abre https://emprendiendo-en-pareja.web.app/. Los registros se guardan en el navegador donde se capturan. Los registros de la versión con acceso a Firebase permanecen en Firestore y esta versión abre un inventario local nuevo.

### Caso de prueba con datos ficticios

En una cuenta vacía con el capital inicial de $4,000, crea dos SKU con precios de compra de $270 y $319. Compra cinco piezas de cada uno con $0.03 de envío. Deben aparecer $500 de ahorro, diez piezas y un total de $2,445.03. Si solo capturas nueve piezas, no debe aplicarse el descuento.

Vende dos piezas del segundo SKU a $390 cada una. Captura $40 de descuento, $20 de envío cobrado, $500 cobrados, $15 de entrega y $5 de empaque. Registra por separado un gasto de $25. Deben quedar ocho piezas, $260 por cobrar, $177 de utilidad y $2,009.97 en caja. Prueba que la venta se rechace si supera la existencia.

## Límites reales de esta primera versión

- No importa automáticamente el Excel de Claude. Usa ejemplos inspirados en los dos productos compartidos y necesita que captures tus productos reales.
- Una venta contiene un SKU; los pedidos con múltiples prendas quedan para una próxima versión.
- Acepta un **cobro parcial inicial**, pero aún no permite añadir abonos posteriores.
- No implementa apartados, devoluciones, cancelaciones ni ventas a crédito; tampoco libros contables ni cálculos fiscales.
- Compras registradas se consideran **recibidas y pagadas**. No se registran compras a crédito.
- Los gastos de entrega/empaque anotados al vender se descuentan del efectivo y utilidad. **No los captures de nuevo en Gastos.**
- No guarda fotografías de prendas. Podrá agregarse después según la opción de almacenamiento que se elija.
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

## Actualizaciones automáticas con GitHub

El flujo de GitHub Actions ejecuta las pruebas y publica la rama `main` en Firebase Hosting. Para vincular las cuentas por primera vez, ejecuta esto en Cloud Shell con la cuenta propietaria del proyecto:

```sh
cd ~/Emprendiendo-en-Pareja
git pull --ff-only
npx --yes firebase-tools init hosting:github --project emprendiendo-en-pareja
```

Autoriza GitHub y elige `Ricardocrisanto/Emprendiendo-en-Pareja`. Responde **No** si el asistente pregunta por un script de compilación o por generar otro flujo de publicación en producción. El flujo de este repositorio ya contiene las pruebas y el despliegue. El asistente guarda la credencial de Firebase como un secreto en GitHub. Los archivos que genere en Cloud Shell pueden quedarse allí.

En GitHub, abre **Actions → Publicar en Firebase Hosting → Run workflow**, selecciona `main` e inicia la primera ejecución. Una vez confirmada la publicación, los cambios posteriores en `main` se desplegarán en https://emprendiendo-en-pareja.web.app/ cuando pasen las pruebas.
