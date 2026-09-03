(function () {
  "use strict";

  const BASE_MONTH = "2026-08";
  const CURRENT_MONTH = "2026-09";
  const KG_GROWTH_TARGET = 10;
  const KG_PARTIAL_FROM = 5;
  const PROVIDERS = [
    { name: "LA PAULINA", kgPrize: 50000, coverageTarget: 85, coveragePartial: 70, zoneOnly: true },
    { name: "SODECAR", kgPrize: 0, coverageTarget: 50, coveragePartial: 30, zoneOnly: false },
    { name: "ORALI", kgPrize: 0, coverageTarget: 50, coveragePartial: 30, zoneOnly: false }
  ];
  const COVERAGE_PRIZE = 25000;
  let selectedSeller = null;
  const clientFilters = { days: new Set(), zone: "all" };
  const DAY_ORDER = ["Lunes", "Martes", "Miercoles", "Miércoles", "Jueves", "Viernes", "Telefónica", "Mostrador / Personales", "Online / Mostrador", "Online", "Mostrador", "Sin ruta"];

  function norm(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  }

  function isOffer(article) { return norm(article.n).includes("OFERTA"); }
  function articleProvider(article) { return proveedorDe(article.m); }

  const GROUPS = [
    {
      provider: "LA PAULINA", id: "lp-barras", label: "Barras",
      match: (a, n) => articleProvider(a) === "LA PAULINA" && n.includes("BARRA") &&
        (n.includes("DANBO") || n.includes("REGIO") || (n.includes("SANDW") && n.includes("PAT")) || n.includes("TYBO"))
    },
    {
      provider: "LA PAULINA", id: "lp-cremosos", label: "Cremosos",
      match: (a, n) => articleProvider(a) === "LA PAULINA" && (n.includes("CREMOSO") || n.includes("PORT SALUT"))
    },
    {
      provider: "LA PAULINA", id: "lp-mantecas", label: "Mantecas",
      match: (a, n) => articleProvider(a) === "LA PAULINA" && n.includes("MANTECA") &&
        (n.includes("X100GR") || n.includes("X200GR") || n.includes("X500GR") || n.includes("PILON"))
    },
    {
      provider: "LA PAULINA", id: "lp-otros", label: "Otros: Pategrás, Fontina y Mozzarella",
      match: (a, n) => articleProvider(a) === "LA PAULINA" &&
        (n.includes("PATEGRAS") || n.includes("FONTINA") || n.includes("MOZZARELLA"))
    },
    {
      provider: "SODECAR", id: "so-milan", label: "Milán La Residencia",
      match: (a, n) => articleProvider(a) === "SODECAR" && n.includes("MILAN") && n.includes("RESIDENCIA")
    },
    {
      provider: "SODECAR", id: "so-paleta", label: "Paleta La Casona",
      match: (a, n) => articleProvider(a) === "SODECAR" && n.includes("PALETA") && n.includes("CASONA")
    },
    {
      provider: "SODECAR", id: "so-mortadelas", label: "Mortadelas La Casona (bocha y cañón)",
      match: (a, n) => articleProvider(a) === "SODECAR" && n.includes("MORTAD") && n.includes("CASONA") &&
        (n.includes("BOCHA") || n.includes("CANON"))
    },
    {
      provider: "SODECAR", id: "so-jamon", label: "Jamón cocido rectangular chico La Casona",
      match: (a, n) => articleProvider(a) === "SODECAR" && n.includes("JAMON COC") && n.includes("CHICO") &&
        n.includes("RECT") && n.includes("CASONA")
    },
    {
      provider: "ORALI", id: "or-pastas", label: "Pastas rellenas y fideos",
      match: (a, n, l) => articleProvider(a) === "ORALI" && (l === "PASTAS RELLENAS" || n.includes("FIDEOS"))
    },
    {
      provider: "ORALI", id: "or-tapas", label: "Tapas y pascualinas",
      match: (a, n, l) => articleProvider(a) === "ORALI" && (l === "TAPAS DE EMPANADAS" || l === "PASCUALINAS")
    },
    {
      provider: "ORALI", id: "or-otros", label: "Otros productos Orali",
      match: (a, n, l) => articleProvider(a) === "ORALI" &&
        !(l === "PASTAS RELLENAS" || n.includes("FIDEOS") || l === "TAPAS DE EMPANADAS" || l === "PASCUALINAS")
    }
  ];

  const articlesByGroup = new Map();
  GROUPS.forEach(group => {
    articlesByGroup.set(group.id, ARTICULOS.filter(article => group.match(article, norm(article.n), norm(article.l))));
  });

  const providerArticleIds = new Map(PROVIDERS.map(provider => [
    provider.name,
    new Set(ARTICULOS.filter(article => articleProvider(article) === provider.name).map(article => String(article.id)))
  ]));

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function monthOf(row) { return String(row[2] || "").slice(0, 7); }
  function rowSeller(row) { return String(row[5] == null ? "" : row[5]); }
  function rowKg(row) { return Number(row[4]) || 0; }
  function rowAmount(row) { return Number(row[3]) || 0; }

  function clientZoneLabel(client) {
    return client.z === "Zona Paulina" ? "Zona Paulina" : "Fuera de Zona Paulina";
  }

  function clientMatchesListFilters(client) {
    if (clientFilters.days.size && !clientFilters.days.has(client.d || "Sin ruta")) return false;
    if (clientFilters.zone === "in" && client.z !== "Zona Paulina") return false;
    if (clientFilters.zone === "out" && client.z === "Zona Paulina") return false;
    return true;
  }

  function listFilterText() {
    const days = clientFilters.days.size ? Array.from(clientFilters.days).join(", ") : "Todos los días";
    const zone = clientFilters.zone === "in" ? "Zona Paulina" : clientFilters.zone === "out" ? "Fuera de Zona Paulina" : "Todas las zonas";
    return `${days} · ${zone}`;
  }

  function payoutRatio(value, partialFrom, fullAt) {
    if (!Number.isFinite(value) || value < partialFrom) return 0;
    if (value >= fullAt) return 1;
    return 0.5 + 0.5 * ((value - partialFrom) / (fullAt - partialFrom));
  }

  function statusFor(ratio) {
    if (ratio >= 1) return { key: "done", label: "✓ Cumplido" };
    if (ratio >= 0.5) return { key: "partial", label: "Premio parcial" };
    return { key: "pending", label: "Pendiente" };
  }

  function sellerUniverse(seller, provider) {
    return CLIENTES.filter(client => String(client.v) === String(seller) && (!provider.zoneOnly || client.z === "Zona Paulina"));
  }

  function sumProviderKg(seller, providerName, month) {
    const ids = providerArticleIds.get(providerName);
    return VENTAS.reduce((total, row) => {
      if (monthOf(row) !== month || rowSeller(row) !== String(seller) || !ids.has(String(row[1]))) return total;
      return total + rowKg(row);
    }, 0);
  }

  function groupCoverage(seller, provider, group) {
    const universe = sellerUniverse(seller, provider);
    const universeIds = new Set(universe.map(client => String(client.id)));
    const articleIds = new Set((articlesByGroup.get(group.id) || []).map(article => String(article.id)));
    const perClient = new Map();
    VENTAS.forEach(row => {
      const clientId = String(row[0]);
      if (monthOf(row) !== CURRENT_MONTH || rowSeller(row) !== String(seller) || !universeIds.has(clientId) || !articleIds.has(String(row[1]))) return;
      const current = perClient.get(clientId) || { kg: 0, amount: 0 };
      current.kg += rowKg(row);
      current.amount += rowAmount(row);
      perClient.set(clientId, current);
    });
    const clients = universe.map(client => {
      const value = perClient.get(String(client.id)) || { kg: 0, amount: 0 };
      return { client, bought: value.kg > 0 || value.amount > 0, kg: value.kg, amount: value.amount };
    });
    const buyers = clients.filter(value => value.bought).length;
    const percentage = universe.length ? buyers * 100 / universe.length : 0;
    const ratio = payoutRatio(percentage, provider.coveragePartial, provider.coverageTarget);
    return {
      universe: universe.length,
      buyers,
      percentage,
      targetClients: Math.ceil(universe.length * provider.coverageTarget / 100),
      missingClients: Math.max(0, Math.ceil(universe.length * provider.coverageTarget / 100) - buyers),
      ratio,
      payout: COVERAGE_PRIZE * ratio,
      clients
    };
  }

  function sellerResults(seller) {
    let payout = 0;
    let maximum = 0;
    let completed = 0;
    let goalCount = 0;
    const providers = PROVIDERS.map(provider => {
      const baseKg = sumProviderKg(seller, provider.name, BASE_MONTH);
      const currentKg = sumProviderKg(seller, provider.name, CURRENT_MONTH);
      const targetKg = baseKg * 1.10;
      const growth = baseKg > 0 ? (currentKg / baseKg - 1) * 100 : null;
      const kgRatio = baseKg > 0 ? payoutRatio(growth, KG_PARTIAL_FROM, KG_GROWTH_TARGET) : 0;
      const kgPayout = provider.kgPrize * kgRatio;
      if (provider.kgPrize > 0) {
        payout += kgPayout;
        maximum += provider.kgPrize;
        goalCount += 1;
        if (kgRatio >= 1) completed += 1;
      }
      const groups = GROUPS.filter(group => group.provider === provider.name).map(group => {
        const result = groupCoverage(seller, provider, group);
        payout += result.payout;
        maximum += COVERAGE_PRIZE;
        goalCount += 1;
        if (result.ratio >= 1) completed += 1;
        return { group, ...result };
      });
      return { provider, baseKg, currentKg, targetKg, growth, kgRatio, kgPayout, groups };
    });
    return { seller: String(seller), payout, maximum, completed, goalCount, providers };
  }

  function productList(group) {
    const articles = (articlesByGroup.get(group.id) || []).slice().sort((a, b) => String(a.n).localeCompare(String(b.n), "es"));
    const offers = articles.filter(isOffer).length;
    const items = articles.map(article => `<li><code>${esc(String(article.id))}</code> ${esc(article.n)}${isOffer(article) ? '<span class="incentive-offer">OFERTA</span>' : ""}</li>`).join("");
    return `<details class="incentive-products"><summary>Ver ${articles.length} SKU incluidos${offers ? ` (${offers} de oferta)` : ""}</summary><ul>${items || "<li>Sin SKU coincidentes</li>"}</ul></details>`;
  }

  function filteredClientRows(result) {
    return result.clients.filter(item => clientMatchesListFilters(item.client)).slice().sort((a, b) => {
      if (a.bought !== b.bought) return a.bought ? 1 : -1;
      const dayA = DAY_ORDER.indexOf(a.client.d), dayB = DAY_ORDER.indexOf(b.client.d);
      const orderA = dayA < 0 ? 999 : dayA, orderB = dayB < 0 ? 999 : dayB;
      return orderA - orderB || String(a.client.n).localeCompare(String(b.client.n), "es");
    });
  }

  function clientList(result, seller, provider) {
    const rows = filteredClientRows(result);
    const buyers = rows.filter(item => item.bought).length;
    const missing = rows.length - buyers;
    const sellerName = vendedoresSet.get(Number(seller)) || "Vendedor";
    const rowHtml = rows.map(({ client, bought }) => `<tr class="${bought ? "client-bought" : "client-missing"}">
      <td>${esc(String(client.id))}</td><td>${esc(client.n)}</td><td>${esc(client.loc || "-")}</td><td>${esc(client.d || "Sin ruta")}</td><td>${esc(client.sc || "-")}</td><td>${esc(clientZoneLabel(client))}</td><td class="client-status">${bought ? "✓ Compró" : "✕ No compró"}</td>
    </tr>`).join("");
    const emptyText = provider.zoneOnly && clientFilters.zone === "out"
      ? "Este objetivo de La Paulina solamente aplica a clientes dentro de Zona Paulina."
      : "No hay clientes para los filtros elegidos.";
    return `<details class="incentive-clients">
      <summary>Ver clientes: ${rows.length} filtrados · ${buyers} compraron · ${missing} no compraron</summary>
      <div class="incentive-client-panel">
        <div class="incentive-client-toolbar"><span>V${esc(String(seller))} · ${esc(sellerName)} · ${esc(listFilterText())}</span><button type="button" class="incentive-export-button" data-export-incentive-clients="${esc(result.group.id)}" data-seller="${esc(String(seller))}">📊 Exportar estos clientes a Excel</button></div>
        ${rows.length ? `<div class="incentive-client-table-wrap"><table class="incentive-client-table"><thead><tr><th>Código</th><th>Cliente</th><th>Localidad</th><th>Día ruta</th><th>Subcanal</th><th>Zona</th><th>Estado</th></tr></thead><tbody>${rowHtml}</tbody></table></div>` : `<div class="incentive-client-empty">${esc(emptyText)}</div>`}
      </div>
    </details>`;
  }

  function kgMetric(result) {
    const ratio = result.kgRatio;
    const status = statusFor(ratio);
    const progress = result.targetKg > 0 ? clamp(result.currentKg / result.targetKg * 100, 0, 100) : 0;
    const partialMarker = result.targetKg > 0 ? (result.baseKg * 1.05 / result.targetKg * 100) : 0;
    const missing = Math.max(0, result.targetKg - result.currentKg);
    const growthText = result.growth == null ? "Sin base de agosto" : `${result.growth >= 0 ? "+" : ""}${pct(result.growth)}`;
    return `<div class="incentive-metric">
      <div class="incentive-metric-head"><div class="incentive-metric-title"><b>Crecimiento en kilos · meta +10%</b><small>Premio máximo ${money(result.provider.kgPrize)} · parcial desde +5%</small></div><span class="incentive-status ${status.key}">${status.label}</span></div>
      <div class="incentive-track"><div class="incentive-fill ${status.key}" style="--progress:${progress}"></div><span class="incentive-marker" style="--marker:${partialMarker}" title="Desde aquí comienza el premio parcial (+5%)"></span></div>
      <div class="incentive-metric-foot"><span>Agosto <strong>${kilos(result.baseKg)}</strong> · Septiembre <strong>${kilos(result.currentKg)}</strong> · Variación <strong>${growthText}</strong></span><span>Objetivo <strong>${kilos(result.targetKg)}</strong> · ${missing > 0 ? `Faltan <strong>${kilos(missing)}</strong>` : "Objetivo alcanzado"} · Premio estimado <strong>${money(result.kgPayout)}</strong></span></div>
    </div>`;
  }

  function coverageMetric(result, provider, seller) {
    const status = statusFor(result.ratio);
    const progress = provider.coverageTarget ? clamp(result.percentage / provider.coverageTarget * 100, 0, 100) : 0;
    const partialMarker = provider.coveragePartial / provider.coverageTarget * 100;
    return `<div class="incentive-metric">
      <div class="incentive-metric-head"><div class="incentive-metric-title"><b>${esc(result.group.label)}</b><small>Premio máximo ${money(COVERAGE_PRIZE)} · parcial desde ${pct(provider.coveragePartial)}</small></div><span class="incentive-status ${status.key}">${status.label}</span></div>
      <div class="incentive-track"><div class="incentive-fill ${status.key}" style="--progress:${progress}"></div><span class="incentive-marker" style="--marker:${partialMarker}" title="Desde aquí comienza el premio parcial"></span></div>
      <div class="incentive-metric-foot"><span>Cobertura <strong>${pct(result.percentage)}</strong> · ${result.buyers} de ${result.universe} clientes</span><span>Meta ${pct(provider.coverageTarget)} = <strong>${result.targetClients} clientes</strong> · ${result.missingClients ? `Faltan <strong>${result.missingClients}</strong>` : "Objetivo alcanzado"} · Premio estimado <strong>${money(result.payout)}</strong></span></div>
      ${productList(result.group)}
      ${clientList(result, seller, provider)}
    </div>`;
  }

  function detailHtml(result) {
    const sellerName = vendedoresSet.get(Number(result.seller)) || "Vendedor";
    const providerHtml = result.providers.map(providerResult => {
      const scope = providerResult.provider.zoneOnly ? "clientes activos de sus rutas dentro de Zona Paulina" : "todos los clientes activos de sus rutas";
      return `<section class="incentive-provider">
        <div class="incentive-provider-head"><h3>${esc(providerResult.provider.name)}</h3><span>Universo de cobertura: ${scope}</span></div>
        ${providerResult.provider.kgPrize > 0 ? kgMetric(providerResult) : ""}
        ${providerResult.groups.map(group => coverageMetric(group, providerResult.provider, result.seller)).join("")}
      </section>`;
    }).join("");
    return `<div class="incentive-detail-card">
      <div class="incentive-detail-head"><div><h2>V${esc(result.seller)} · ${esc(sellerName)}</h2><p>${result.completed} de ${result.goalCount} objetivos completos al día de hoy</p></div><div class="incentive-award"><small>Premio estimado</small><strong>${money(result.payout)}</strong><small>de ${money(result.maximum)} posibles</small></div></div>
      ${providerHtml}
      <div class="incentive-note"><b>Criterio del incentivo:</b> las ventas se asignan por vendedor del comprobante en Chess. La cobertura usa los clientes activos que ese vendedor tiene hoy en sus rutas. Las variantes normales y <b>*OFERTA*</b> se consolidan en la misma familia. Los importes son una estimación según la escala acordada. La comisión de cobranza del 0,5% neto sin IVA no se calcula aquí porque requiere datos de cobranzas, no de ventas.</div>
    </div>`;
  }

  function renderClientFilters() {
    const container = document.getElementById("incentive-client-filters");
    if (!container) return;
    const days = Array.from(new Set(CLIENTES.filter(client => client.v != null).map(client => client.d || "Sin ruta"))).sort((a, b) => {
      const ia = DAY_ORDER.indexOf(a), ib = DAY_ORDER.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b, "es");
    });
    const dayButtons = [`<button type="button" class="incentive-filter-button${clientFilters.days.size ? "" : " active"}" data-incentive-day="all">Todos</button>`, ...days.map(day => `<button type="button" class="incentive-filter-button${clientFilters.days.has(day) ? " active" : ""}" data-incentive-day="${esc(day)}">${esc(day)}</button>`)].join("");
    const zoneButtons = [
      ["all", "Todas"], ["in", "Zona Paulina"], ["out", "Fuera de Zona Paulina"]
    ].map(([value, label]) => `<button type="button" class="incentive-filter-button${clientFilters.zone === value ? " active" : ""}" data-incentive-zone="${value}">${label}</button>`).join("");
    container.innerHTML = `<div class="incentive-filter-group"><b>Días de ruta (podés elegir varios)</b><div class="incentive-filter-buttons">${dayButtons}</div></div><div class="incentive-filter-group"><b>Zona de clientes</b><div class="incentive-filter-buttons">${zoneButtons}</div></div><p class="incentive-filter-note">Estos filtros modifican los listados y sus exportaciones. El cálculo oficial del premio mantiene el universo completo definido para cada proveedor.</p>`;
  }

  function incentiveSheetXml(metaLines, headers, rows) {
    const xmlRows = [];
    let rowNumber = 1;
    metaLines.forEach((line, index) => {
      xmlRows.push(`<row r="${rowNumber}" ht="22" customHeight="1"><c r="A${rowNumber}" s="${index === 0 ? 4 : 5}" t="inlineStr"><is><t>${escXml(line)}</t></is></c></row>`);
      rowNumber += 1;
    });
    rowNumber += 1;
    const headerRow = rowNumber;
    xmlRows.push(`<row r="${rowNumber}" ht="30" customHeight="1">${headers.map((header, index) => `<c r="${colLetter(index)}${rowNumber}" s="1" t="inlineStr"><is><t>${escXml(header)}</t></is></c>`).join("")}</row>`);
    rowNumber += 1;
    rows.forEach(item => {
      const style = item.bought ? 2 : 3;
      const cells = item.cells.map((cell, index) => {
        const ref = `${colLetter(index)}${rowNumber}`;
        return cell.t === "n" ? `<c r="${ref}" s="${style}"><v>${cell.v}</v></c>` : `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${escXml(cell.v)}</t></is></c>`;
      }).join("");
      xmlRows.push(`<row r="${rowNumber}">${cells}</row>`);
      rowNumber += 1;
    });
    const endRow = Math.max(headerRow, rowNumber - 1);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="38" customWidth="1"/><col min="3" max="3" width="18" customWidth="1"/><col min="4" max="4" width="17" customWidth="1"/><col min="5" max="5" width="23" customWidth="1"/><col min="6" max="6" width="23" customWidth="1"/><col min="7" max="7" width="16" customWidth="1"/></cols><sheetData>${xmlRows.join("")}</sheetData><autoFilter ref="A${headerRow}:G${endRow}"/><mergeCells count="${metaLines.length}">${metaLines.map((_, index) => `<mergeCell ref="A${index + 1}:G${index + 1}"/>`).join("")}</mergeCells><pageMargins left="0.25" right="0.25" top="0.45" bottom="0.45" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  }

  function buildIncentiveXlsx(sheetXml) {
    const encoder = new TextEncoder();
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clientes objetivo" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Calibri"/><color rgb="FF0F172A"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font></fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF172554"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0"/><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="6" borderId="0" xfId="0"/></cellXfs></styleSheet>`;
    return buildZip([
      { name: "[Content_Types].xml", data: encoder.encode(contentTypes) }, { name: "_rels/.rels", data: encoder.encode(rootRels) }, { name: "xl/workbook.xml", data: encoder.encode(workbook) }, { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) }, { name: "xl/styles.xml", data: encoder.encode(styles) }, { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheetXml) }
    ]);
  }

  function exportIncentiveClients(seller, groupId) {
    const result = sellerResults(seller);
    let groupResult = null;
    let provider = null;
    result.providers.some(providerResult => {
      const found = providerResult.groups.find(item => item.group.id === groupId);
      if (!found) return false;
      groupResult = found;
      provider = providerResult.provider;
      return true;
    });
    if (!groupResult || !provider) return;
    const rows = filteredClientRows(groupResult);
    const buyers = rows.filter(item => item.bought).length;
    const sellerName = vendedoresSet.get(Number(seller)) || "Vendedor";
    const metaLines = [
      `${provider.name} · ${groupResult.group.label} · Clientes del objetivo`,
      `V${seller} - ${sellerName} · Septiembre 2026`,
      `Filtros del listado: ${listFilterText()}`,
      `${rows.length} clientes · ${buyers} compraron · ${rows.length - buyers} no compraron · Pronto Express`
    ];
    const headers = ["Código", "Cliente", "Localidad", "Día de ruta", "Subcanal MKT", "Zona", "Estado"];
    const exportRows = rows.map(({ client, bought }) => ({ bought, cells: [
      { t: "n", v: Number(client.id) }, { t: "s", v: client.n || "" }, { t: "s", v: client.loc || "" }, { t: "s", v: client.d || "Sin ruta" }, { t: "s", v: client.sc || "" }, { t: "s", v: clientZoneLabel(client) }, { t: "s", v: bought ? "COMPRÓ" : "NO COMPRÓ" }
    ] }));
    const blob = buildIncentiveXlsx(incentiveSheetXml(metaLines, headers, exportRows));
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const clean = value => norm(value).replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
    link.href = url;
    link.download = `clientes_objetivo_v${seller}_${clean(provider.name)}_${clean(groupResult.group.label)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function renderIncentives() {
    const summary = document.getElementById("incentive-company-summary");
    const cards = document.getElementById("incentive-seller-cards");
    const detail = document.getElementById("incentive-detail");
    if (!summary || !cards || !detail) return;

    const requestedSeller = vSel && vSel.value ? String(vSel.value) : "";
    const sellerIds = requestedSeller ? [requestedSeller] : Array.from(vendedoresSet.keys()).map(String).sort((a, b) => Number(a) - Number(b));
    if (!sellerIds.length) {
      summary.innerHTML = ""; cards.innerHTML = ""; detail.innerHTML = '<div class="incentive-empty">No hay vendedores disponibles.</div>'; return;
    }
    renderClientFilters();
    if (!sellerIds.includes(String(selectedSeller))) selectedSeller = sellerIds[0];
    const results = sellerIds.map(sellerResults);
    const projected = results.reduce((sum, result) => sum + result.payout, 0);
    const maximum = results.reduce((sum, result) => sum + result.maximum, 0);
    const completed = results.reduce((sum, result) => sum + result.completed, 0);
    const goals = results.reduce((sum, result) => sum + result.goalCount, 0);

    summary.innerHTML = `
      <div class="incentive-stat"><span class="incentive-stat-label">Premio proyectado a hoy</span><strong class="incentive-stat-value">${money(projected)}</strong><span class="incentive-stat-note">Según kilos y cobertura alcanzados</span></div>
      <div class="incentive-stat"><span class="incentive-stat-label">Premio máximo posible</span><strong class="incentive-stat-value">${money(maximum)}</strong><span class="incentive-stat-note">${sellerIds.length} vendedor${sellerIds.length === 1 ? "" : "es"} en esta vista</span></div>
      <div class="incentive-stat"><span class="incentive-stat-label">Objetivos completos</span><strong class="incentive-stat-value">${completed} / ${goals}</strong><span class="incentive-stat-note">El premio parcial no se cuenta como completo</span></div>`;

    cards.innerHTML = results.map(result => {
      const percentage = result.maximum ? clamp(result.payout / result.maximum * 100, 0, 100) : 0;
      const ringColor = percentage >= 100 ? "var(--yes)" : percentage >= 50 ? "#f59e0b" : "var(--series1)";
      const sellerName = vendedoresSet.get(Number(result.seller)) || "Vendedor";
      return `<button type="button" class="incentive-seller-card${String(selectedSeller) === result.seller ? " selected" : ""}" data-seller="${esc(result.seller)}" aria-pressed="${String(selectedSeller) === result.seller}">
        <span class="incentive-ring" style="--p:${percentage};--ring-color:${ringColor}"><span>${pct(percentage)}</span></span>
        <span class="incentive-seller-copy"><b>V${esc(result.seller)} · ${esc(sellerName)}</b><strong>${money(result.payout)}</strong><small>${result.completed}/${result.goalCount} cumplidos · máximo ${money(result.maximum)}</small></span>
      </button>`;
    }).join("");

    const selected = results.find(result => result.seller === String(selectedSeller)) || results[0];
    detail.innerHTML = detailHtml(selected);
  }

  document.getElementById("incentive-seller-cards")?.addEventListener("click", event => {
    const button = event.target.closest("[data-seller]");
    if (!button) return;
    selectedSeller = button.dataset.seller;
    renderIncentives();
    document.getElementById("incentive-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("incentive-client-filters")?.addEventListener("click", event => {
    const dayButton = event.target.closest("[data-incentive-day]");
    const zoneButton = event.target.closest("[data-incentive-zone]");
    if (dayButton) {
      const day = dayButton.dataset.incentiveDay;
      if (day === "all") clientFilters.days.clear();
      else if (clientFilters.days.has(day)) clientFilters.days.delete(day);
      else clientFilters.days.add(day);
      renderIncentives();
    }
    if (zoneButton) {
      clientFilters.zone = zoneButton.dataset.incentiveZone;
      renderIncentives();
    }
  });

  document.getElementById("incentive-detail")?.addEventListener("click", event => {
    const button = event.target.closest("[data-export-incentive-clients]");
    if (!button) return;
    exportIncentiveClients(button.dataset.seller, button.dataset.exportIncentiveClients);
  });

  if (vSel) vSel.addEventListener("change", () => {
    selectedSeller = vSel.value || null;
    const section = document.getElementById("incentive-results");
    if (section && section.style.display !== "none") renderIncentives();
  });

  window.renderIncentives = renderIncentives;
})();
