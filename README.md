# Panel de Cobertura de Producto — Pronto Express

`index.html` es un panel interactivo (sin backend) que muestra, para el/los
producto(s) que elijas, qué clientes compran y cuáles no — filtrable por
vendedor, día de ruta, subcanal MKT, zona geográfica ("Zona Paulina") y mes,
y con la opción de medir en dinero o en kilos.

Se actualiza solo todos los días vía GitHub Actions
(`.github/workflows/daily-update.yml`): baja los datos frescos de Chess ERP,
recalcula todo y commitea el `index.html` actualizado.

## Configuración necesaria (una sola vez)

En **Settings → Secrets and variables → Actions** de este repositorio:

- **Secrets** (nunca se muestran en los logs):
  - `CHESS_USER`: usuario de Chess ERP
  - `CHESS_PASSWORD`: contraseña de Chess ERP
- **Variables** (no sensible, es solo una URL):
  - `CHESS_BASE_URL`: `http://appserver24.dyndns.org:8095`

Después de cargarlos, andá a la pestaña **Actions** → "Actualizar panel
diariamente" → **Run workflow** para probarlo una vez a mano y confirmar que
funciona antes de esperar al cron automático.

## Ver el panel

- Sin GitHub Pages: descargá `index.html` y abrilo en el navegador.
- Con GitHub Pages activado (Settings → Pages → branch `main`, carpeta `/`):
  queda en una URL fija tipo
  `https://pronto-express-ar.github.io/pronto-express-cobertura/`.

## Estructura

```
scripts/
  chess_client.py     # cliente HTTP para la API de Chess ERP
  fetch_data.py        # baja rutas/clientes/articulos/ventas (ventana movil)
  prepare_multi.py     # cruza todo, calcula zona geografica y agrupa por mes
  build_html.py        # arma el index.html final a partir de template.html
  template.html        # plantilla del panel (HTML/CSS/JS)
.github/workflows/
  daily-update.yml      # cron diario
data/                   # (no versionado) datos intermedios de cada corrida
```

## Alcance de los datos

Se excluyen del universo los vendedores Eduardo Ruiz Moreno, Maria Julia
Bussi, Alejandra Gonzalez, Superv. Federico Yunes y Damian Fernandez (y sus
clientes), a pedido explícito — no corresponden a esta línea de producto.

La ventana de ventas es móvil: mes actual (parcial) + 3 meses completos
anteriores, recalculada cada vez que corre el workflow.
