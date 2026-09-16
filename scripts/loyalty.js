(function () {
  "use strict";

  const MONTHS = [
    { key: "2026-07", label: "Julio 2026" },
    { key: "2026-08", label: "Agosto 2026" },
    { key: "2026-09", label: "Septiembre 2026" }
  ];
  const invoiceSets = new Map();
  let lastExportRows = [];

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  }

  function html(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function clientMonthKey(clientId, month) { return `${clientId}|${month}`; }

  VENTAS.forEach(row => {
    const month = String(row[2] || "").slice(0, 7);
    if (!MONTHS.some(item => item.key === month)) return;
    const documentType = normalize(row[7]);
    if (!documentType.includes("FACTURA") || documentType.includes("NOTA")) return;
    const invoiceKey = String(row[6] || "").trim();
    if (!invoiceKey) return;
    const key = clientMonthKey(row[0], month);
    if (!invoiceSets.has(key)) invoiceSets.set(key, new Set());
    invoiceSets.get(key).add(invoiceKey);
  });

  function invoiceCount(clientId, month) {
    return invoiceSets.get(clientMonthKey(clientId, month))?.size || 0;
  }

  function matchesSidebar(client) {
    const seller = vSel.value;
    const day = dSel.value;
    const zone = zSel.value;
    const query = buscarInput.value.trim().toLowerCase();
    if (seller && String(client.v || "") !== String(seller)) return false;
    if (day && client.d !== day) return false;
    if (state.subcanales.size && !state.subcanales.has(client.sc)) return false;
    if (zone === "fuera" && client.z) return false;
    if (zone === "Zona Paulina" && client.z !== "Zona Paulina") return false;
    if (query && !String(client.n || "").toLowerCase().includes(query) && !String(client.id).includes(query)) return false;
    return true;
  }

  function statusInfo(qualifyingMonths) {
    if (qualifyingMonths === 3) return { label: "Fiel 3/3", cls: "loyal" };
    if (qualifyingMonths === 2) return { label: "Frecuente 2/3", cls: "frequent" };
    return { label: "Recurrente 1/3", cls: "recurrent" };
  }

  function allRows() {
    return CLIENTES.filter(matchesSidebar).map(client => {
      const counts = MONTHS.map(month => invoiceCount(client.id, month.key));
      const qualifyingMonths = counts.filter(count => count >= 2).length;
      const total = counts.reduce((sum, count) => sum + count, 0);
      const status = statusInfo(qualifyingMonths);
      return { client, counts, qualifyingMonths, total, status };
    });
  }

  function renderSellerBars(rows) {
    const target = document.getElementById("loyalty-by-seller");
    const bySeller = new Map();
    rows.forEach(row => {
      if (row.qualifyingMonths !== 3 || !row.client.v) return;
      const key = String(row.client.v);
      const entry = bySeller.get(key) || { seller: key, name: row.client.vn || "", count: 0 };
      entry.count += 1;
      bySeller.set(key, entry);
    });
    const values = Array.from(bySeller.values()).sort((a, b) => b.count - a.count || a.seller.localeCompare(b.seller));
    if (!values.length) {
      target.innerHTML = '<div class="empty-chart">No hay clientes Fieles 3/3 con los filtros actuales.</div>';
      return;
    }
    const maximum = Math.max(...values.map(value => value.count), 1);
    target.innerHTML = values.map(value => `<div class="loyalty-bar-row">
      <div><b>V${html(value.seller)}</b> · ${html(value.name)}</div>
      <div class="loyalty-bar-track"><div class="loyalty-bar-fill" style="width:${(value.count * 100 / maximum).toFixed(1)}%"></div></div>
      <strong>${value.count} clientes</strong>
    </div>`).join("");
  }

  function renderLoyalty() {
    const rows = allRows();
    const loyal = rows.filter(row => row.qualifyingMonths === 3);
    const frequent = rows.filter(row => row.qualifyingMonths === 2);
    const intensive = loyal.filter(row => row.counts.every(count => count >= 3));
    const average = loyal.length ? loyal.reduce((sum, row) => sum + row.total, 0) / loyal.length / 3 : 0;
    const share = rows.length ? loyal.length * 100 / rows.length : 0;

    document.getElementById("loyalty-tiles").innerHTML = [
      { label: "Clientes Fieles 3/3", value: loyal.length.toLocaleString("es-AR"), sub: "2 o más facturas en cada mes" },
      { label: "Frecuentes 2/3", value: frequent.length.toLocaleString("es-AR"), sub: "cumplen recurrencia en dos meses" },
      { label: "Muy intensivos", value: intensive.length.toLocaleString("es-AR"), sub: "3 o más facturas en cada mes" },
      { label: "Peso sobre la cartera", value: `${share.toFixed(1).replace(".", ",")}%`, sub: `${average.toFixed(1).replace(".", ",")} compras mensuales promedio por cliente fiel` }
    ].map(item => `<div class="tile"><div class="label">${item.label}</div><div class="value">${item.value}</div><div class="sub">${item.sub}</div></div>`).join("");

    renderSellerBars(rows);

    const level = document.getElementById("loyalty-level").value;
    const filtered = rows.filter(row => {
      if (level === "all") return row.qualifyingMonths >= 1;
      return row.qualifyingMonths === Number(level);
    }).sort((a, b) => b.qualifyingMonths - a.qualifyingMonths || b.total - a.total || String(a.client.n).localeCompare(String(b.client.n)));
    lastExportRows = filtered;

    document.getElementById("loyalty-summary").innerHTML = `<span class="chip"><b>${filtered.length.toLocaleString("es-AR")}</b> clientes mostrados</span><span class="chip">Criterio: facturas distintas por mes</span><span class="chip">Septiembre en curso</span>`;
    document.getElementById("loyalty-table-body").innerHTML = filtered.length ? filtered.map(row => {
      const client = row.client;
      return `<tr>
        <td>${html(client.id)}</td>
        <td class="name-cell">${html(client.n)}</td>
        <td>${client.v ? `V${html(client.v)} - ${html(client.vn || "")}` : "-"}</td>
        <td>${html(client.d || "-")}</td>
        <td>${html(client.sc || "-")}</td>
        <td>${row.counts[0]}</td><td>${row.counts[1]}</td><td>${row.counts[2]}</td><td><b>${row.total}</b></td>
        <td><span class="loyalty-status ${row.status.cls}">${row.status.label}</span></td>
      </tr>`;
    }).join("") : '<tr><td colspan="10" class="name-cell">No hay clientes para este nivel y los filtros seleccionados.</td></tr>';
  }

  function exportLoyalty() {
    if (!lastExportRows.length) return;
    const levelLabel = document.getElementById("loyalty-level").selectedOptions[0]?.textContent || "Todos";
    const metaLines = [
      "Fidelizacion de clientes - Pronto Express",
      "Periodo: Julio, Agosto y Septiembre 2026 (Septiembre en curso)",
      `Nivel exportado: ${levelLabel}`,
      `Filtros: Vendedor ${vSel.selectedOptions[0]?.textContent || "Todos"} | Dia ${dSel.selectedOptions[0]?.textContent || "Todos"} | Zona ${zSel.selectedOptions[0]?.textContent || "Todas"}`,
      "Criterio: cada compra es una factura distinta; recurrencia = 2 o mas facturas en el mes."
    ];
    const headers = ["Codigo", "Cliente", "Vendedor", "Dia ruta", "Subcanal", "Facturas Julio", "Facturas Agosto", "Facturas Septiembre", "Facturas total", "Nivel"];
    const dataRows = lastExportRows.map(row => [
      { t: "n", v: Number(row.client.id) || 0 },
      { t: "s", v: row.client.n || "" },
      { t: "s", v: row.client.v ? `V${row.client.v} - ${row.client.vn || ""}` : "-" },
      { t: "s", v: row.client.d || "-" },
      { t: "s", v: row.client.sc || "-" },
      { t: "n", v: row.counts[0] }, { t: "n", v: row.counts[1] }, { t: "n", v: row.counts[2] },
      { t: "n", v: row.total },
      { t: "s", v: row.status.label }
    ]);
    descargarXlsx(xlsxSheetXml(metaLines, headers, dataRows), `clientes_fidelizados_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  document.getElementById("loyalty-level").addEventListener("change", renderLoyalty);
  document.getElementById("export-loyalty-btn").addEventListener("click", exportLoyalty);
  window.renderLoyalty = renderLoyalty;
})();
