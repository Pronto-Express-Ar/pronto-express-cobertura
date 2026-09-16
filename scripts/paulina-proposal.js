(function () {
  "use strict";

  const TARGET_PARTIAL_POINTS = 15;
  const TARGET_FULL_POINTS = 25;
  const MONTH_KEYS = [...new Set(VENTAS.map(row => String(row[2] || "").slice(0, 7)).filter(Boolean))].sort();
  const CURRENT_MONTH = MONTH_KEYS.at(-1);
  const BASE_MONTH = MONTH_KEYS.at(-2);
  const monthLabels = new Map(MESES.map(month => [month.key, month.label]));
  const GROUPS = [
    {
      id: "cremoso",
      label: "Cremoso",
      reason: "Producto tractor y de reposición constante.",
      match: (article, name) => isPaulina(article) && (name.includes("CREMOSO") || name.includes("PORT SALUT"))
    },
    {
      id: "danbo",
      label: "Barra Danbo",
      reason: "Caballito de batalla con margen real para ampliar distribución.",
      match: (article, name) => isPaulina(article) && name.includes("BARRA") && name.includes("DANBO")
    },
    {
      id: "ralladito",
      label: "Ralladitos",
      reason: "La línea La Paulina de mayor alcance en el mes base.",
      match: (article, name, line) => isPaulina(article) && line === "RALLADITOS"
    }
  ];
  const articleIdsByGroup = new Map(GROUPS.map(group => [group.id, new Set(ARTICULOS
    .filter(article => group.match(article, normalize(article.n), normalize(article.l)))
    .map(article => String(article.id)))]));
  let lastResults = [];

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  }

  function isPaulina(article) {
    return proveedorDe(article.m) === "LA PAULINA";
  }

  function safe(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function sellerUniverse(seller) {
    return CLIENTES.filter(client => String(client.v || "") === String(seller) && client.z === "Zona Paulina");
  }

  function buyersFor(seller, universeIds, groupId, month) {
    const articleIds = articleIdsByGroup.get(groupId);
    const perClient = new Map();
    VENTAS.forEach(row => {
      const clientId = String(row[0]);
      if (String(row[2] || "").slice(0, 7) !== month || String(row[5] || "") !== String(seller) ||
          !universeIds.has(clientId) || !articleIds.has(String(row[1]))) return;
      const current = perClient.get(clientId) || { amount: 0, kg: 0 };
      current.amount += Number(row[3]) || 0;
      current.kg += Number(row[4]) || 0;
      perClient.set(clientId, current);
    });
    return new Set([...perClient].filter(([, value]) => value.amount > 0 || value.kg > 0).map(([clientId]) => clientId));
  }

  function productResult(seller, universeIds, group) {
    const baseSet = buyersFor(seller, universeIds, group.id, BASE_MONTH);
    const currentSet = buyersFor(seller, universeIds, group.id, CURRENT_MONTH);
    const universe = universeIds.size;
    const partialIncrement = Math.ceil(universe * TARGET_PARTIAL_POINTS / 100);
    const fullIncrement = Math.ceil(universe * TARGET_FULL_POINTS / 100);
    const partialTarget = Math.min(universe, baseSet.size + partialIncrement);
    const fullTarget = Math.min(universe, baseSet.size + fullIncrement);
    const goalSpan = Math.max(fullTarget - baseSet.size, 1);
    const progress = clamp((currentSet.size - baseSet.size) * 100 / goalSpan, 0, 100);
    return {
      group, baseSet, currentSet, universe, partialTarget, fullTarget, progress,
      difference: currentSet.size - baseSet.size,
      missingPartial: Math.max(0, partialTarget - currentSet.size),
      missingFull: Math.max(0, fullTarget - currentSet.size),
      status: currentSet.size >= fullTarget ? "done" : currentSet.size >= partialTarget ? "partial" : "pending"
    };
  }

  function sellerResult(seller) {
    const clients = sellerUniverse(seller);
    const universeIds = new Set(clients.map(client => String(client.id)));
    const products = GROUPS.map(group => productResult(seller, universeIds, group));
    const trident = clients.filter(client => products.every(product => product.currentSet.has(String(client.id)))).length;
    return {
      seller: String(seller),
      name: clients[0]?.vn || "",
      universe: clients.length,
      products,
      trident,
      score: products.length ? products.reduce((sum, product) => sum + product.progress, 0) / products.length : 0
    };
  }

  function marker(value, universe) {
    return universe ? clamp(value * 100 / universe, 0, 100) : 0;
  }

  function productHtml(product) {
    const currentPct = marker(product.currentSet.size, product.universe);
    const basePct = marker(product.baseSet.size, product.universe);
    const partialPct = marker(product.partialTarget, product.universe);
    const fullPct = marker(product.fullTarget, product.universe);
    const differenceClass = product.difference >= 0 ? "good" : "bad";
    const statusText = product.status === "done" ? "Objetivo completo" : product.status === "partial" ? "Objetivo parcial alcanzado" : `Faltan ${product.missingPartial} para el parcial`;
    return `<div class="proposal-product-row">
      <div class="proposal-product-name"><strong>${safe(product.group.label)}</strong><span>${safe(product.group.reason)}</span></div>
      <div class="proposal-track" title="Cobertura actual ${currentPct.toFixed(1)}%">
        <div class="proposal-fill ${product.status}" style="width:${currentPct.toFixed(1)}%"></div>
        <span class="proposal-track-marker base" style="left:${basePct.toFixed(1)}%" title="Base ${product.baseSet.size}"></span>
        <span class="proposal-track-marker partial" style="left:${partialPct.toFixed(1)}%" title="Meta parcial ${product.partialTarget}"></span>
        <span class="proposal-track-marker full" style="left:${fullPct.toFixed(1)}%" title="Meta total ${product.fullTarget}"></span>
      </div>
      <div class="proposal-product-stats">Base <b>${product.baseSet.size}</b> &middot; Actual <b>${product.currentSet.size}</b> &middot; <span class="${differenceClass}">${product.difference >= 0 ? "+" : ""}${product.difference}</span><br>Parcial <b>${product.partialTarget}</b> &middot; Total <b>${product.fullTarget}</b> &middot; <span class="${product.status === "done" ? "good" : product.status === "partial" ? "warn" : "bad"}">${statusText}</span></div>
    </div>`;
  }

  function renderSeller(result) {
    return `<section class="proposal-seller">
      <div class="proposal-seller-head"><div><h3>V${safe(result.seller)} &middot; ${safe(result.name)}</h3><p>${result.universe} clientes activos en Zona Paulina &middot; ${result.trident} compran los tres productos este mes</p></div><div class="proposal-score"><strong>${result.score.toFixed(0)}%</strong><span>avance promedio</span></div></div>
      ${result.products.map(productHtml).join("")}
    </section>`;
  }

  function baseRalladitoReach(results) {
    const clients = new Set();
    results.forEach(result => result.products.find(product => product.group.id === "ralladito")?.baseSet.forEach(client => clients.add(client)));
    return clients.size;
  }

  function renderPaulinaProposal() {
    if (!BASE_MONTH || !CURRENT_MONTH) return;
    const availableSellers = [...new Set(CLIENTES.filter(client => client.v && client.z === "Zona Paulina").map(client => String(client.v)))].sort();
    const selectedSeller = String(vSel.value || "");
    const sellers = selectedSeller ? availableSellers.filter(seller => seller === selectedSeller) : availableSellers;
    const results = sellers.map(sellerResult);
    lastResults = results;
    const products = results.flatMap(result => result.products);
    const baseContacts = products.reduce((sum, product) => sum + product.baseSet.size, 0);
    const currentContacts = products.reduce((sum, product) => sum + product.currentSet.size, 0);
    const fullTarget = products.reduce((sum, product) => sum + product.fullTarget, 0);
    const trident = results.reduce((sum, result) => sum + result.trident, 0);
    const completed = products.filter(product => product.status === "done").length;
    const baseLabel = monthLabels.get(BASE_MONTH) || BASE_MONTH;
    const currentLabel = monthLabels.get(CURRENT_MONTH) || CURRENT_MONTH;

    document.getElementById("paulina-proposal-rationale").innerHTML = [
      ["Por qué estos tres", "Cremoso y Barra Danbo son productos tractores. Ralladitos completa el foco con alta aceptación y formato de entrada."],
      ["Dato que respalda Ralladitos", `${baseRalladitoReach(results)} clientes lo compraron en ${baseLabel}${selectedSeller ? " para el vendedor seleccionado" : " dentro de Zona Paulina"}.`],
      ["Exigencia propuesta", `Cada vendedor debe sumar 15 puntos para el parcial y 25 puntos para el total, siempre contra su propia cobertura de ${baseLabel}.`]
    ].map(([title, body]) => `<div class="proposal-reason"><strong>${safe(title)}</strong><p>${safe(body)}</p></div>`).join("");

    document.getElementById("paulina-proposal-tiles").innerHTML = [
      ["Contactos producto-cliente base", baseContacts.toLocaleString("es-AR"), baseLabel],
      ["Contactos actuales", currentContacts.toLocaleString("es-AR"), currentLabel + " en curso"],
      ["Meta total propuesta", fullTarget.toLocaleString("es-AR"), `${completed} de ${products.length} objetivos completos`],
      ["Clientes tridente", trident.toLocaleString("es-AR"), "compran Cremoso + Danbo + Ralladitos"]
    ].map(([label, value, sub]) => `<div class="tile"><div class="label">${safe(label)}</div><div class="value">${safe(value)}</div><div class="sub">${safe(sub)}</div></div>`).join("");

    document.getElementById("paulina-proposal-sellers").innerHTML = results.length
      ? results.map(renderSeller).join("")
      : '<div class="empty-chart">El vendedor seleccionado no tiene clientes activos dentro de Zona Paulina.</div>';
  }

  function exportProposal() {
    if (!lastResults.length) return;
    const baseLabel = monthLabels.get(BASE_MONTH) || BASE_MONTH;
    const currentLabel = monthLabels.get(CURRENT_MONTH) || CURRENT_MONTH;
    const meta = [
      "Propuesta de objetivos tractores - La Paulina",
      `Base: ${baseLabel} | Seguimiento: ${currentLabel}`,
      `Vendedor: ${vSel.selectedOptions[0]?.textContent || "Todos"}`,
      "Criterio: 50% con +15 puntos de cobertura y 100% con +25 puntos, sobre clientes activos de Zona Paulina.",
      "Esta es una simulacion y no modifica los premios vigentes."
    ];
    const headers = ["Vendedor", "Producto", "Cartera activa", "Compradores base", "Cobertura base %", "Compradores actuales", "Cobertura actual %", "Meta parcial", "Faltan parcial", "Meta total", "Faltan total", "Avance %"];
    const rows = lastResults.flatMap(result => result.products.map(product => [
      { t: "s", v: `V${result.seller} - ${result.name}` },
      { t: "s", v: product.group.label },
      { t: "n", v: result.universe },
      { t: "n", v: product.baseSet.size },
      { t: "n", v: result.universe ? product.baseSet.size * 100 / result.universe : 0 },
      { t: "n", v: product.currentSet.size },
      { t: "n", v: result.universe ? product.currentSet.size * 100 / result.universe : 0 },
      { t: "n", v: product.partialTarget },
      { t: "n", v: product.missingPartial },
      { t: "n", v: product.fullTarget },
      { t: "n", v: product.missingFull },
      { t: "n", v: product.progress }
    ]));
    descargarXlsx(xlsxSheetXml(meta, headers, rows), `propuesta_objetivos_paulina_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  document.getElementById("export-paulina-proposal").addEventListener("click", exportProposal);
  window.renderPaulinaProposal = renderPaulinaProposal;
})();
