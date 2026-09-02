(function () {
  "use strict";

  const BASE_MONTH = "2026-08";
  const CURRENT_MONTH = "2026-09";
  const KG_GROWTH_TARGET = 10;
  const KG_PARTIAL_FROM = 5;
  const PROVIDERS = [
    { name: "LA PAULINA", kgPrize: 50000, coverageTarget: 85, coveragePartial: 70, zoneOnly: true },
    { name: "SODECAR", kgPrize: 40000, coverageTarget: 50, coveragePartial: 30, zoneOnly: false },
    { name: "ORALI", kgPrize: 40000, coverageTarget: 50, coveragePartial: 30, zoneOnly: false }
  ];
  const COVERAGE_PRIZE = 25000;
  let selectedSeller = null;

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
    const buyers = Array.from(perClient.values()).filter(value => value.kg > 0 || value.amount > 0).length;
    const percentage = universe.length ? buyers * 100 / universe.length : 0;
    const ratio = payoutRatio(percentage, provider.coveragePartial, provider.coverageTarget);
    return {
      universe: universe.length,
      buyers,
      percentage,
      targetClients: Math.ceil(universe.length * provider.coverageTarget / 100),
      missingClients: Math.max(0, Math.ceil(universe.length * provider.coverageTarget / 100) - buyers),
      ratio,
      payout: COVERAGE_PRIZE * ratio
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
      payout += kgPayout;
      maximum += provider.kgPrize;
      goalCount += 1;
      if (kgRatio >= 1) completed += 1;
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

  function coverageMetric(result, provider) {
    const status = statusFor(result.ratio);
    const progress = provider.coverageTarget ? clamp(result.percentage / provider.coverageTarget * 100, 0, 100) : 0;
    const partialMarker = provider.coveragePartial / provider.coverageTarget * 100;
    return `<div class="incentive-metric">
      <div class="incentive-metric-head"><div class="incentive-metric-title"><b>${esc(result.group.label)}</b><small>Premio máximo ${money(COVERAGE_PRIZE)} · parcial desde ${pct(provider.coveragePartial)}</small></div><span class="incentive-status ${status.key}">${status.label}</span></div>
      <div class="incentive-track"><div class="incentive-fill ${status.key}" style="--progress:${progress}"></div><span class="incentive-marker" style="--marker:${partialMarker}" title="Desde aquí comienza el premio parcial"></span></div>
      <div class="incentive-metric-foot"><span>Cobertura <strong>${pct(result.percentage)}</strong> · ${result.buyers} de ${result.universe} clientes</span><span>Meta ${pct(provider.coverageTarget)} = <strong>${result.targetClients} clientes</strong> · ${result.missingClients ? `Faltan <strong>${result.missingClients}</strong>` : "Objetivo alcanzado"} · Premio estimado <strong>${money(result.payout)}</strong></span></div>
      ${productList(result.group)}
    </div>`;
  }

  function detailHtml(result) {
    const sellerName = vendedoresSet.get(Number(result.seller)) || "Vendedor";
    const providerHtml = result.providers.map(providerResult => {
      const scope = providerResult.provider.zoneOnly ? "clientes activos de sus rutas dentro de Zona Paulina" : "todos los clientes activos de sus rutas";
      return `<section class="incentive-provider">
        <div class="incentive-provider-head"><h3>${esc(providerResult.provider.name)}</h3><span>Universo de cobertura: ${scope}</span></div>
        ${kgMetric(providerResult)}
        ${providerResult.groups.map(group => coverageMetric(group, providerResult.provider)).join("")}
      </section>`;
    }).join("");
    return `<div class="incentive-detail-card">
      <div class="incentive-detail-head"><div><h2>V${esc(result.seller)} · ${esc(sellerName)}</h2><p>${result.completed} de ${result.goalCount} objetivos completos al día de hoy</p></div><div class="incentive-award"><small>Premio estimado</small><strong>${money(result.payout)}</strong><small>de ${money(result.maximum)} posibles</small></div></div>
      ${providerHtml}
      <div class="incentive-note"><b>Criterio del incentivo:</b> las ventas se asignan por vendedor del comprobante en Chess. La cobertura usa los clientes activos que ese vendedor tiene hoy en sus rutas. Las variantes normales y <b>*OFERTA*</b> se consolidan en la misma familia. Los importes son una estimación según la escala acordada. La comisión de cobranza del 0,5% neto sin IVA no se calcula aquí porque requiere datos de cobranzas, no de ventas.</div>
    </div>`;
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

  if (vSel) vSel.addEventListener("change", () => {
    selectedSeller = vSel.value || null;
    const section = document.getElementById("incentive-results");
    if (section && section.style.display !== "none") renderIncentives();
  });

  window.renderIncentives = renderIncentives;
})();
