/* ====================================================================
   Product details POC - behaviour.

   Everything the live detail.asp does through server round-trips is
   mocked here in a single `state` object + a `render()` pass, so adding
   a feature means: add to state, add markup, extend render().

   Products: the `products` table holds the items the POC can show; the
   title-bar Item # switch moves between them. Each product has a type
   (engagement ring, wedding band, ...) and customizations apply per type.

   Mocked server rules (search for "MOCK" to find them):
     - ring oversize fee by size (per product rule)
     - stone oversize fee by carat weight
     - fully-mounted stone price per size option
     - estimated ship date from date needed
     - SKU rewrite on metal / diamond size / variation change
   ==================================================================== */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const win = $('#pdWindow');
  const form = $('#pdForm');

  /* ---------------- product types ---------------- */
  // Editable in the settings editor; each customization lists the types it
  // applies to. Ids are stable, names are display only.
  const defaultProductTypes = [
    { id: 'engagement', name: 'Engagement Ring' },
    { id: 'band',       name: 'Wedding Band' },
    { id: 'stackable',  name: 'Stackable' },
    { id: 'earrings',   name: 'Earrings' },
    { id: 'necklace',   name: 'Necklace' }
  ];

  /* ---------------- products ---------------- */
  // Data lifted from the live detail.asp pages for each item. Images that
  // are not publicly served are null and render as placeholder tiles.
  const products = {
    'B001-01YM-100A': {
      sku: 'B001-01YM-100A',
      type: 'engagement',
      subtitle: '',
      collection: 'Noam Carver Bridal - Bridal',
      images: ['assets/images/products/B001-01YA.jpg', null, null, null],
      matchingBand: { sku: 'B001-01YM-100B', img: 'assets/images/products/B001-01YB.jpg' },
      finish: 'All High Polish',
      price: 1104.96,
      metal: { options: true, selected: '2_2', code: 'YM' },
      width: null,
      sizes: { from: 1.5, to: 12, selected: '6.5' },
      variations: true,
      centerStone: true,
      diamondInfo: { type: 'Diamond', qty: 20, shape: 'RD', tcw: '0.24 Ct', colour: 'GH', quality: 'SI' },
      dateNeeded: '2026-11-18',
      oversize: { kind: 'engagement' },
      oversizeNote: '',
      engravingFees: { outside: 25, inside: 15 }
    },
    'RYL-008RD6-M10': {
      sku: 'RYL-008RD6-M10',
      type: 'band',
      subtitle: '2.2MM Thickness',
      collection: 'Bleu Royale - Diamond',
      images: ['assets/images/products/RYL-008RD6.jpg', 'assets/images/products/RYL-008RD6-alt1.jpg', 'assets/images/products/RYL-008RD6-alt2.jpg'],
      matchingBand: null,
      finish: 'Sandpaper Top',
      price: 2396.52,
      metal: { options: false, fixed: '14K' },
      width: '6',
      sizes: { from: 3, to: 16, selected: '10' },
      variations: false,
      centerStone: false,
      diamondInfo: { type: 'Diamond', qty: 18, shape: 'RD', tcw: '0.16 Ct', colour: 'GH', quality: 'SI' },
      dateNeeded: '2026-11-02',
      oversize: { kind: 'perFullSize', fee: 30, above: 12.75 },
      oversizeNote: 'An oversize fee of $30.00 per full size will apply if above 12.75',
      engravingFees: { outside: 0, inside: 0 }   // live band page: engraving complimentary
    }
  };
  const productTypeName = id => (productTypes.find(t => t.id === id) || { name: id }).name;

  /* ---------------- state ---------------- */
  const state = {
    productSku: 'B001-01YM-100A',
    metalCode: 'YM',
    variation: '',                         // '' | 'Lab'
    size: '6.5',
    qty: 1,
    mounted: 'Unmounted',                  // 'Unmounted' | 'Fully Mounted'
    shape: { value: '1', label: 'Round', img: 'assets/images/diamond-shapes/round.jpg' },
    diamondSize: { value: '1', label: '1.00', range: 'Range in mm 6.3 to 6.5' },
    customStone: null,                     // {shape, weight, L, W, D, type, note}
    sendingStoneForSetting: 'No',          // Unmounted only; 'Yes' adds the setting fee
    fullyMounted: { shapeID: '1', weight: 1, price: 220.22 },
    engraving: null,                       // {outside:{text,font}, inside:{text,font}, notes}
    customizations: { ids: [], notes: '' },// ids from the live catalogue
    spiff: '',
    instructions: '',
    internalNotes: ['', '', '', '', ''],
    dateNeeded: '2026-11-18'
  };
  const product = () => products[state.productSku];

  /* ---------------- fully-mounted lab center catalogue ---------------- */
  // Live site: stoneSizeID options come from productEdit_act.asp per shape.
  // Label format: "IGI Certified - 1.00ct DE (R: 1.40-1.47)", R = length to
  // width ratio range for the shape. Every shape goes 1.00 to 5.00 ct.
  // Prices are MOCK except 1.00 ct Round.
  const labCenter = {
    sizes: [
      { ct: 1,   price: 220.22 },
      { ct: 1.5, price: 410.00 },
      { ct: 2,   price: 690.00 },
      { ct: 2.5, price: 980.00 },
      { ct: 3,   price: 1350.00 },
      { ct: 3.5, price: 1780.00 },
      { ct: 4,   price: 2250.00 },
      { ct: 5,   price: 3400.00 }
    ],
    shapes: {
      '1':  { name: 'Round',             ratio: '1.00-1.01' },
      '16': { name: 'Oval',              ratio: '1.42-1.52' },
      '70': { name: 'Elongated Cushion', ratio: '1.30-1.45' },
      '5':  { name: 'Emerald',           ratio: '1.38-1.52' },
      '21': { name: 'Marquise',          ratio: '1.90-2.05' },
      '23': { name: 'Pear',              ratio: '1.55-1.72' },
      '2':  { name: 'Princess',          ratio: '1.00-1.03' },
      '18': { name: 'Radiant',           ratio: '1.40-1.47' }
    },
    label(shapeID, ct) {
      return `IGI Certified - ${ct.toFixed(2)}ct DE (R: ${this.shapes[shapeID].ratio})`;
    }
  };

  /* ---------------- customization catalogue ---------------- */
  // Internal wholesale fee guide (CAD). fee: number = flat fee, 0 =
  // complimentary, 'quote' = quote required (not included in the total).
  // reference: true lists the item with its fee but it cannot be selected.
  // types: the product types the item applies to (ids from product types).
  // Center stone size/shape changes are not listed here: that fee is
  // already applied from the carat weight of the center stone provided.
  const ER = 'engagement', WB = 'band', ST = 'stackable', EA = 'earrings', NE = 'necklace';
  const ALL = [ER, WB, ST, EA, NE];
  const defaultCatalogue = [
    { group: 'Head / Prongs', items: [
      { id: 'prong-count',     name: 'Change number of prongs', fee: 0, types: [ER] },
      { id: 'prong-type',      name: 'Change prong type', fee: 0, types: [ER] },
      { id: 'prong-placement', name: 'Change prong placement', fee: 0, types: [ER] },
      { id: 'support-bar',     name: 'Add or remove support bar', fee: 0, types: [ER] },
      { id: 'orientation',     name: 'Change center orientation (NS / EW or kite)', fee: 0, types: [ER] },
      { id: 'platinum-head',   name: 'Upgrade to platinum head on gold style', fee: 80, types: [ER] },
      { id: 'hidden-halo-add', name: 'Add standard hidden halo', fee: 130, types: [ER] },
      { id: 'hidden-halo-rem', name: 'Remove standard hidden halo', fee: 0, types: [ER] }
    ]},
    { group: 'Shank / Band', items: [
      { id: 'milgrain',   name: 'Add or remove milgrain', fee: 0, types: [ER, WB, ST] },
      { id: 'knife-edge', name: 'Add or remove knife edge', fee: 0, types: [ER, WB, ST] },
      { id: 'euroshank',  name: 'Add or remove euroshank', fee: 0, types: [ER] },
      { id: 'cathedral',  name: 'Add or remove cathedral', fee: 80, types: [ER] },
      { id: 'atelier',    name: 'Full conversion to Atelier', hint: 'signature euroshank, VS melee & Atelier spiff', fee: 'quote', types: [ER] }
    ]},
    { group: 'Interior', items: [
      { id: 'luna-add',     name: 'Add Luna pillowed interior', fee: 160, types: [ER, WB] },
      { id: 'luna-rem',     name: 'Remove Luna pillowed interior', fee: 0, types: [ER, WB] },
      { id: 'luna-full',    name: 'Full conversion to Luna', hint: 'pillows & spiff', fee: 'quote', types: [ER, WB] },
      { id: 'mens-pattern', name: "Add or remove NC Men's pattern", fee: 0, types: [WB] },
      { id: 'love-diamond', name: 'Add 1mm RD SI-GH natural diamond (love diamond)', fee: 25, types: [ER, WB, ST] },
      { id: 'sizing-beads', name: 'Add sizing beads', fee: 80, types: [ER, WB, ST] }
    ]},
    { group: 'Engraving', items: [
      { id: 'hand-engraving-add', name: 'Add hand engraving', fee: 220, types: [ER, WB, ST] },
      { id: 'hand-engraving-rem', name: 'Remove hand engraving', fee: 0, types: [ER, WB, ST] },
      { id: 'laser-engraving',    name: 'Custom laser engraving', fee: 50, types: ALL }
    ]},
    { group: 'Diamonds', items: [
      { id: 'lab-melee',        name: 'Change to lab grown melee', hint: 'see B2B for the LAB SKU (Variations above)', fee: 0, types: ALL },
      { id: 'gemstone-melee',   name: 'Change to coloured gemstone melee', fee: 'quote', types: ALL },
      { id: 'add-rem-diamonds', name: 'Add or remove diamonds', fee: 'quote', types: ALL },
      { id: 'diamond-sizes',    name: 'Change diamond sizes', fee: 'quote', types: ALL },
      { id: 'diamond-quality',  name: 'Change diamond quality (other than lab)', fee: 'quote', types: ALL }
    ]},
    { group: 'Design', items: [
      { id: 'combine-styles', name: 'Combining two styles', fee: 'quote', types: [ER, WB, ST] },
      { id: 'full-custom',    name: 'Complete custom (not based on any of our styles)', fee: 'quote', types: ALL }
    ]},
    { group: 'Services', items: [
      { id: 'nickel-free',  name: 'Nickel-free white gold', fee: 150, types: [ER, WB, ST] },
      { id: 'soldering',    name: 'Soldering', hint: 'per ring', fee: 50, types: [WB, ST] },
      { id: 'retip-prongs', name: 'Retipping prongs', fee: 100, reference: true, types: [ER] }
    ]},
    { group: 'Add-ons', items: [
      { id: 'travel-ring', name: 'Silver/CZ travel ring', hint: 'complimentary with an Atelier ER purchase', fee: 200, types: [ER] }
    ]}
  ];

  // Live catalogue: the fee guide by default, or the version saved from the
  // title-bar "Customization settings" editor (this browser only).
  const CATALOGUE_KEY = 'pd.customizationCatalogue';
  let productTypes = [];
  let customizationCatalogue = [];
  let customizationById = {};

  const itemAppliesTo = (it, typeId) => Array.isArray(it.types) ? it.types.includes(typeId) : true;

  function setCatalogue(data) {
    productTypes = data.types;
    customizationCatalogue = data.groups;
    customizationById = {};
    data.groups.forEach(g => g.items.forEach(i => { customizationById[i.id] = i; }));
    pruneSelections();
  }
  // drop selections that no longer exist, are reference-only or do not
  // apply to the current product type
  function pruneSelections() {
    state.customizations.ids = state.customizations.ids.filter(id => {
      const it = customizationById[id];
      return it && !it.reference && itemAppliesTo(it, product().type);
    });
  }
  function cloneCatalogue() {
    return {
      types: defaultProductTypes.map(t => Object.assign({}, t)),
      groups: defaultCatalogue.map(g => ({ group: g.group, items: g.items.map(i => Object.assign({}, i, { types: i.types.slice() })) }))
    };
  }
  function loadCatalogue() {
    try {
      const raw = localStorage.getItem(CATALOGUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // older saves were a bare group array without product types
        if (Array.isArray(parsed)) return { types: defaultProductTypes.map(t => Object.assign({}, t)), groups: parsed };
        if (parsed && Array.isArray(parsed.groups) && Array.isArray(parsed.types)) return parsed;
      }
    } catch (e) { /* storage unavailable: fall back to the fee guide */ }
    return cloneCatalogue();
  }
  function saveCatalogue(data) {
    try { localStorage.setItem(CATALOGUE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function customizationTotals(ids) {
    let fees = 0, quotes = 0;
    ids.forEach(id => {
      const item = customizationById[id];
      if (!item || item.reference) return;
      if (item.fee === 'quote') quotes++; else fees += item.fee;
    });
    return { fees, quotes, count: ids.length };
  }

  /* ---------------- MOCK server rules ---------------- */
  const mock = {
    // Fee guide, Services: "Setting your center stone $80".
    centerStoneSettingFee: 80,
    ringOversizeFee(size, rule) {
      const s = parseFloat(size);
      if (rule.kind === 'perFullSize') {
        // Live band page: "$30.00 per full size will apply if above 12.75"
        return s > rule.above ? rule.fee * Math.ceil(s - rule.above) : 0;
      }
      if (s >= 11) return 50;
      if (s >= 9.75) return 25;
      if (s <= 3.5) return -15; // "undersize" (shown as negative like the live site)
      return 0;
    },
    // Internal wholesale fee guide, "Center stone size / shape changes".
    // Based on the carat weight of the center stone provided.
    stoneOversizeFee(weight) {
      const w = parseFloat(weight) || 0;
      if (w >= 7) return 350;
      if (w >= 5) return 250;
      if (w >= 3.5) return 180;
      return 0;
    },
    estShipDate(dateNeeded) {
      // Live site: ship date comes back from details_act.asp and, for a
      // standard lead time, equals the date needed. Here: the date needed,
      // pushed off weekends and never earlier than today + 10 days.
      const d = new Date(dateNeeded + 'T00:00:00');
      const floor = new Date();
      floor.setHours(0, 0, 0, 0);
      floor.setDate(floor.getDate() + 10);
      const out = d < floor ? floor : d;
      while (out.getDay() === 0 || out.getDay() === 6) out.setDate(out.getDate() + 1);
      return out;
    }
  };

  /* ---------------- helpers ---------------- */
  const money = n => Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const longDate = d => d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const feeText = it => it.fee === 'quote' ? 'Quote required' : (it.fee > 0 ? '$' + money(it.fee) : 'Complimentary');

  function bind(name, html) {
    $$(`[data-bind="${name}"]`).forEach(el => { el.innerHTML = html; });
  }

  function toast(msg) {
    const t = $('#pdToast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 2500);
  }

  /* ---------------- SKU ---------------- */
  function currentSku() {
    const p = product();
    if (!p.metal.options) return p.sku;
    // B001-01 + metal code + [-Lab] + -NNNA  (NNN = carat * 100)
    const parts = p.sku.split('-');          // ["B001","01YM","100A"]
    const styleNo = parts[0] + '-' + parts[1].slice(0, 2) + state.metalCode;
    let ct = state.diamondSize.value > 0 ? Math.round(state.diamondSize.value * 100) : 100;
    const last = String(ct).padStart(3, '0') + 'A';
    return [styleNo, state.variation, last].filter(Boolean).join('-');
  }

  function skuSuffix() {
    if (!product().centerStone || state.mounted === 'Fully Mounted') return '';
    return '-C'; // customer-supplied center stone
  }

  /* ---------------- price ---------------- */
  // Every amount that goes into the total, each with its display line.
  function priceBreakdown() {
    const p = product();
    const b = {
      base: p.price,
      ringOversize: mock.ringOversizeFee(state.size, p.oversize),
      centerStone: 0,          // fully-mounted lab center: stone + setting
      stoneOversize: 0,
      setting: 0,              // we set the customer's center stone
      engraving: engravingFee(),
      customizations: 0,
      quotes: 0,
      lines: { oversize: '', centerStone: '', stoneOversize: '', setting: '', engraving: '', customizations: '' }
    };
    if (b.ringOversize > 0) b.lines.oversize = `Ring Oversize Fee: $${money(b.ringOversize)}`;
    if (b.ringOversize < 0) b.lines.oversize = `Ring Undersize Fee: $${money(b.ringOversize)}`;

    if (p.centerStone) {
      if (state.mounted === 'Fully Mounted') {
        b.centerStone = state.fullyMounted.price + 0; // setting price: complimentary
        b.lines.centerStone = `Lab Center Stone: $${money(b.centerStone)} (setting complimentary)`;
        b.stoneOversize = mock.stoneOversizeFee(state.fullyMounted.weight);
      } else {
        if (state.customStone) b.stoneOversize = mock.stoneOversizeFee(state.customStone.weight);
        if (state.sendingStoneForSetting === 'Yes') {
          b.setting = mock.centerStoneSettingFee;
          b.lines.setting = `Center Stone Setting Fee: $${money(b.setting)}`;
        }
      }
    }
    if (b.stoneOversize > 0) b.lines.stoneOversize = `Stone Oversize Fee: $${money(b.stoneOversize)}`;
    if (b.engraving > 0) b.lines.engraving = `Engraving Fee: $${money(b.engraving)}`;

    const cz = customizationTotals(state.customizations.ids);
    b.customizations = cz.fees;
    b.quotes = cz.quotes;
    if (cz.fees > 0) b.lines.customizations = `Customization Fees: $${money(cz.fees)}`;

    b.total = b.base + b.ringOversize + b.centerStone + b.stoneOversize + b.setting + b.engraving + b.customizations;
    return b;
  }

  function engravingFee() {
    if (!state.engraving) return 0;
    const f = product().engravingFees;
    return (state.engraving.outside ? f.outside : 0) + (state.engraving.inside ? f.inside : 0);
  }

  /* ---------------- render ---------------- */
  function renderProductChrome() {
    const p = product();

    // title bar switch
    const sw = $('#pdSkuSwitch');
    sw.innerHTML = Object.values(products).map(x =>
      `<option value="${x.sku}"${x.sku === p.sku ? ' selected' : ''}>${x.sku}</option>`).join('');
    bind('productType', productTypeName(p.type));

    // thumbnails
    const thumbs = p.images.map((src, i) => src
      ? `<div class="pd-thumb${i === 0 ? ' is-active' : ''}" data-image="${src}"><img src="${src}" alt="${esc(p.sku)} view ${i + 1}"></div>`
      : `<div class="pd-thumb pd-thumb--placeholder" data-image="" data-label="Alt view ${i}"><span>Alt view ${i}</span></div>`);
    let html = thumbs.join('');
    if (p.matchingBand) {
      html += `<div class="pd-thumbs-heading">Matching band</div>
        <a class="pd-thumb pd-thumb--link" href="#" data-sku="${p.matchingBand.sku}" title="Open ${p.matchingBand.sku}">
          <img src="${p.matchingBand.img}" alt="Matching band ${p.matchingBand.sku}"></a>`;
    }
    $('#pdThumbs').innerHTML = html;
    $('#pdMainImage').src = p.images[0];
    $('#pdMainImage').alt = p.sku;

    bind('finish', esc(p.finish));
    bind('subtitle', esc(p.subtitle));
    $('[data-bind="subtitle"]').hidden = !p.subtitle;
    bind('collection', esc(p.collection));
    $('#pdEmailLink').href = `mailto:service@crownring.com?subject=Custom%20Request%20for%20ring%20nbr%20${encodeURIComponent(p.sku)}`;

    // ring info
    form.karatColour.hidden = !p.metal.options;
    const metalFixed = $('[data-bind="metalFixed"]');
    metalFixed.hidden = !!p.metal.options;
    metalFixed.textContent = p.metal.fixed || '';
    if (p.metal.options) form.karatColour.value = p.metal.selected;
    $('#rowWidth').hidden = !p.width;
    bind('width', esc(p.width || ''));
    $('#rowVariations').hidden = !p.variations;

    // sizes
    const size = $('#pdSize');
    size.innerHTML = '';
    for (let s = p.sizes.from; s <= p.sizes.to; s += 0.25) {
      const v = String(s);
      size.add(new Option(v, v, false, v === state.size));
    }

    // center stone
    $('#pdCenterStone').hidden = !p.centerStone;

    // diamond info
    const di = p.diamondInfo;
    bind('diType', esc(di.type)); bind('diQty', di.qty); bind('diShape', esc(di.shape));
    bind('diTcw', esc(di.tcw)); bind('diColour', esc(di.colour)); bind('diQuality', esc(di.quality));

    // price notes
    bind('oversizeNote', esc(p.oversizeNote));
    $('[data-bind="oversizeNote"]').hidden = !p.oversizeNote;
  }

  function render() {
    const p = product();
    bind('sku', currentSku());
    bind('skuSuffix', skuSuffix());
    bind('price', money(p.price));

    const pb = priceBreakdown();
    bind('oversizeFee', pb.lines.oversize);
    bind('centerStoneLine', pb.lines.centerStone);
    bind('stoneOversizeFeeLine', pb.lines.stoneOversize);
    bind('settingFeeLine', pb.lines.setting);
    bind('engravingFeeLine', pb.lines.engraving);
    bind('customizationFeeLine', pb.lines.customizations);
    bind('total', money(pb.total));
    const totalNote = $('[data-bind="totalNote"]');
    totalNote.hidden = pb.quotes === 0;
    totalNote.textContent = pb.quotes ? `+ ${pb.quotes} customization${pb.quotes > 1 ? 's' : ''} requiring a quote` : '';

    // customizations summary
    const czs = $('#pdCustomizeSummary');
    const ids = state.customizations.ids;
    czs.hidden = ids.length === 0 && !state.customizations.notes;
    if (!czs.hidden) {
      bind('customizationList', ids.map(id => {
        const it = customizationById[id];
        const fee = it.fee === 'quote' ? '<span class="pd-summary-quote">Quote required</span>' : feeText(it);
        return `<li><span>${esc(it.name)}</span><span>${fee}</span></li>`;
      }).join(''));
      const notes = $('[data-bind="customizationNotes"]');
      notes.hidden = !state.customizations.notes;
      notes.textContent = state.customizations.notes;
      bind('customizationFees', pb.customizations > 0 ? '$' + money(pb.customizations) : 'Complimentary');
      const q = $('[data-bind="customizationQuote"]');
      q.hidden = pb.quotes === 0;
      q.textContent = pb.quotes ? 'Head Office will quote the item(s) marked above before the order is confirmed.' : '';
    }

    if (p.centerStone) {
      // mounted toggle
      const fm = state.mounted === 'Fully Mounted';
      $('#pdFullyMounted').hidden = !fm;
      $('#pdUnmounted').hidden = fm;
      bind('stonePrice', '$' + money(state.fullyMounted.price));
      const sof = mock.stoneOversizeFee(state.fullyMounted.weight);
      $('[data-bind="stoneOversizeRow"]').hidden = !(fm && sof > 0);
      bind('stoneOversizeFee', '$' + money(sof));

      // shape / size dropdown labels
      $('#ddShape .pd-dd-value').innerHTML = state.shape.value > 0
        ? `<img src="${state.shape.img}" alt=""> ${esc(state.shape.label)}`
        : 'Custom Shape';
      $('#ddSize .pd-dd-value').innerHTML = state.diamondSize.value > 0
        ? `${esc(state.diamondSize.label)} <em>${esc(state.diamondSize.range)}</em>`
        : 'Custom Size <em>Out of Range</em>';
      $('#rowDiamondSize').hidden = state.shape.value == 0;

      // custom stone summary
      const ci = $('#pdCustomInfo');
      if (state.customStone && !fm) {
        const c = state.customStone;
        let html = '';
        if (state.shape.value == 0) html += `<div>Diamond Shape: ${esc(c.shapeLabel)}</div>`;
        html += `<div>Center Diamond Weight: ${c.weight} ct</div>`;
        html += `<div>Dimensions: ${c.L} mm X ${c.W} mm X ${c.D} mm</div>`;
        html += `<div>Stone Type: <span class="cap">${esc(c.type)}</span></div>`;
        if (c.note) html += `<div>Stone Note: ${esc(c.note.length > 33 ? c.note.slice(0, 30) + '...' : c.note)}</div>`;
        bind('customInfo', html);
        ci.hidden = false;
      } else {
        ci.hidden = true;
      }
    }

    // engraving
    const hasEngraving = !!state.engraving && (state.engraving.outside || state.engraving.inside);
    $('[data-bind="engravingButton"]').textContent = hasEngraving ? 'Edit Engraving' : 'Add Engraving';
    $('#pdEngravingSummary').hidden = !hasEngraving;
    if (hasEngraving) {
      const e = state.engraving;
      let html = '';
      if (e.outside) html += `<div>Outside - <strong>Font:</strong> ${esc(e.outside.font)} - <strong>Text:</strong> ${esc(e.outside.text)}</div>`;
      if (e.inside) html += `<div>Inside - <strong>Font:</strong> ${esc(e.inside.font)} - <strong>Text:</strong> ${esc(e.inside.text)}</div>`;
      bind('engravingDetails', html);
      const fee = engravingFee();
      bind('engravingFee', fee > 0 ? '$' + money(fee) : 'Complimentary');
    }

    // spiff
    const spiffBtn = $('[data-bind="spiffButton"]');
    spiffBtn.textContent = state.spiff ? `SPIFF: ${state.spiff}` : 'Enter SPIFF salesperson';
    spiffBtn.classList.toggle('is-set', !!state.spiff);
    form.SPIFF_salesperson.value = state.spiff;

    // instructions
    const prev = $('[data-bind="instructionsPreview"]');
    prev.hidden = !state.instructions;
    prev.textContent = state.instructions;
    form.instruction.value = state.instructions;

    // shipping
    bind('shipDate', longDate(mock.estShipDate(state.dateNeeded)));
    $('[name=dateNeeded]', win).value = state.dateNeeded;
  }

  /* ---------------- product switch ---------------- */
  // Everything tied to the item resets; SPIFF, internal notes and qty stay.
  function switchProduct(sku) {
    if (!products[sku]) return;
    state.productSku = sku;
    const p = products[sku];
    state.metalCode = p.metal.code || '';
    state.variation = '';
    state.size = p.sizes.selected;
    state.mounted = 'Unmounted';
    state.shape = { value: '1', label: 'Round', img: 'assets/images/diamond-shapes/round.jpg' };
    state.diamondSize = { value: '1', label: '1.00', range: 'Range in mm 6.3 to 6.5' };
    state.customStone = null;
    state.sendingStoneForSetting = 'No';
    state.engraving = null;
    state.customizations = { ids: [], notes: '' };
    state.instructions = '';
    state.dateNeeded = p.dateNeeded;
    if (p.centerStone) {
      $$('[name=diamondMounted]', form).forEach(r => { r.checked = r.value === 'Unmounted'; });
      form.sendingStoneForSetting.value = 'No';
      form.diamondShape3.value = '1';
      form.diamondSize3.value = '1';
      form.stoneShapeID.value = '1';
      state.fullyMounted = { shapeID: '1', weight: 1, price: 220.22 };
      fillStoneSizes();
    }
    if (p.variations) form.variation.selectedIndex = 0;
    renderProductChrome();
    render();
  }

  /* ---------------- populate selects ---------------- */
  function fillSelects() {
    const qty = $('#pdQty');
    for (let q = 1; q <= 30; q++) qty.add(new Option(q, q));
  }

  // Rebuild the fully-mounted size list for the selected shape, keeping the
  // current carat weight when that shape offers it.
  function fillStoneSizes() {
    const shapeID = form.stoneShapeID.value;
    const sel = form.stoneSizeID;
    const keep = state.fullyMounted.weight;
    sel.innerHTML = '';
    labCenter.sizes.forEach(x => {
      const o = new Option(labCenter.label(shapeID, x.ct), String(x.ct), false, x.ct === keep);
      o.dataset.weight = x.ct;
      o.dataset.price = x.price;
      sel.add(o);
    });
    if (sel.selectedIndex < 0) sel.selectedIndex = 0;
    const o = sel.selectedOptions[0];
    state.fullyMounted = { shapeID, weight: parseFloat(o.dataset.weight), price: parseFloat(o.dataset.price) };
  }

  /* ---------------- custom dropdowns ---------------- */
  function initDropdown(root, onPick) {
    const toggle = $('.pd-dd-toggle', root);
    const list = $('.pd-dd-list', root);
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      const open = !list.hidden;
      closeDropdowns();
      list.hidden = open;
    });
    list.addEventListener('click', e => {
      const li = e.target.closest('li');
      if (!li) return;
      list.hidden = true;
      onPick(li);
    });
  }
  function closeDropdowns() {
    $$('.pd-dd-list').forEach(l => { l.hidden = true; });
    closeMenu();
  }
  document.addEventListener('click', closeDropdowns);

  function closeMenu() {
    const list = $('.pd-menu-list');
    if (!list) return;
    list.hidden = true;
    $('.pd-menu-toggle').setAttribute('aria-expanded', 'false');
  }
  function toggleMenu() {
    const list = $('.pd-menu-list');
    const open = list.hidden;
    closeDropdowns();
    list.hidden = !open;
    $('.pd-menu-toggle').setAttribute('aria-expanded', String(open));
  }

  /* ---------------- dialogs ---------------- */
  const backdrop = $('#pdDialogBackdrop');
  const dialog = $('#pdDialog');
  let dialogHandlers = null;

  function openDialog(templateId, setup) {
    const tpl = document.getElementById(templateId);
    dialog.innerHTML = '';
    dialog.appendChild(tpl.content.cloneNode(true));
    dialogHandlers = setup(dialog) || {};
    backdrop.hidden = false;
    const first = $('input, select, textarea, button', dialog);
    if (first) first.focus();
  }
  function closeDialog() {
    backdrop.hidden = true;
    dialog.innerHTML = '';
    dialogHandlers = null;
  }
  // Clicking the dim area closes the dialog, but only when the press started
  // there too: a drag that ends outside the dialog must not close it.
  let pressedOnBackdrop = false;
  backdrop.addEventListener('pointerdown', e => { pressedOnBackdrop = e.target === backdrop; });
  backdrop.addEventListener('click', e => {
    const btn = e.target.closest('[data-dialog]');
    if (btn) {
      const act = btn.dataset.dialog;
      if (act === 'close') return closeDialog();
      if (dialogHandlers && dialogHandlers[act]) dialogHandlers[act](btn);
      return;
    }
    if (e.target === backdrop && pressedOnBackdrop) closeDialog();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !backdrop.hidden) closeDialog(); });

  /* ---- lightbox ---- */
  function openLightbox(startSrc) {
    const imgs = product().images.filter(Boolean);
    let idx = Math.max(0, imgs.indexOf(startSrc));
    openDialog('tplLightbox', d => {
      const main = $('.pd-lightbox-image', d);
      const thumbs = $('.pd-lightbox-thumbs', d);
      const show = i => {
        idx = (i + imgs.length) % imgs.length;
        main.src = imgs[idx];
        $$('img', thumbs).forEach((t, k) => t.classList.toggle('is-active', k === idx));
      };
      thumbs.innerHTML = imgs.map(s => `<img src="${s}" alt="">`).join('');
      $$('img', thumbs).forEach((t, k) => t.addEventListener('click', () => show(k)));
      if (imgs.length < 2) { thumbs.hidden = true; $$('.pd-lightbox-arrow', d).forEach(a => { a.hidden = true; }); }
      show(idx);
      return { prev: () => show(idx - 1), next: () => show(idx + 1) };
    });
  }

  /* ---- shipping date ---- */
  function openShippingDate() {
    openDialog('tplShippingDate', d => {
      const input = $('[name=dateNeeded]', d);
      input.value = state.dateNeeded;
      input.min = new Date().toISOString().slice(0, 10);
      const upd = () => bind('estShipDate', input.value ? longDate(mock.estShipDate(input.value)) : '-');
      input.addEventListener('change', upd);
      upd();
      return {
        save() {
          if (!input.value) return alert('Please pick a date.');
          state.dateNeeded = input.value;
          closeDialog();
          render();
        }
      };
    });
  }

  /* ---- custom stone ---- */
  function openCustomStone() {
    openDialog('tplCustomStone', d => {
      const f = c => $(`[name=centerStone_${c}]`, d);
      if (state.customStone) {
        const c = state.customStone;
        f('customShape').value = c.shape;
        f('customWeight').value = c.weight;
        f('customDimensionsL').value = c.L;
        f('customDimensionsW').value = c.W;
        f('customDimensionsD').value = c.D;
        $(`[name=centerStone_stoneType][value="${c.type}"]`, d).checked = true;
        f('stoneType_descr').value = c.note;
      }
      return {
        save() {
          if (!$('[name=confirmBox]', d).checked) return alert('Please confirm you reviewed instructions');
          const w = parseFloat(f('customWeight').value);
          const L = parseFloat(f('customDimensionsL').value);
          const W = parseFloat(f('customDimensionsW').value);
          const D = parseFloat(f('customDimensionsD').value);
          const missing = [];
          if (!(w > 0)) missing.push('- Carat Weight');
          if (!(L > 0 && W > 0 && D > 0)) missing.push('- Stone Dimensions');
          if (missing.length) return alert('Please enter:\n' + missing.join('\n'));
          const shapeSel = f('customShape');
          state.customStone = {
            shape: shapeSel.value,
            shapeLabel: shapeSel.options[shapeSel.selectedIndex].text,
            weight: w, L, W, D,
            type: $('[name=centerStone_stoneType]:checked', d).value,
            note: f('stoneType_descr').value.trim()
          };
          closeDialog();
          render();
        }
      };
    });
  }

  /* ---- engraving ---- */
  function openEngraving() {
    openDialog('tplEngraving', d => {
      const fees = product().engravingFees;
      const feeLabel = n => n > 0 ? `($${money(n)})` : '(Complimentary)';
      bind('ngrvOutsideFee', feeLabel(fees.outside));
      bind('ngrvInsideFee', feeLabel(fees.inside));
      const boxes = $$('[name=ngrv_pos]', d);
      const blocks = $$('.pd-engrave-block', d);
      const sync = () => blocks.forEach(b => {
        b.hidden = !boxes.find(x => x.value === b.dataset.pos).checked;
      });
      boxes.forEach(b => b.addEventListener('change', sync));
      if (state.engraving) {
        const e = state.engraving;
        if (e.outside) { boxes[0].checked = true; $('[name=ngrv_Txt1]', d).value = e.outside.text; $(`[name=ngrv_Font1][value="${e.outside.font}"]`, d).checked = true; }
        if (e.inside) { boxes[1].checked = true; $('[name=ngrv_Txt2]', d).value = e.inside.text; $(`[name=ngrv_Font2][value="${e.inside.font}"]`, d).checked = true; }
        $('[name=ngrv_SpecialInstructions]', d).value = e.notes || '';
      }
      sync();
      return {
        save() {
          if (!$('[name=ngrvYesCorrect]', d).checked) return alert('Please, check off "YES The engraving I entered is correct"');
          const t1 = $('[name=ngrv_Txt1]', d).value.trim();
          const t2 = $('[name=ngrv_Txt2]', d).value.trim();
          state.engraving = {
            outside: boxes[0].checked && t1 ? { text: t1, font: $('[name=ngrv_Font1]:checked', d).value } : null,
            inside: boxes[1].checked && t2 ? { text: t2, font: $('[name=ngrv_Font2]:checked', d).value } : null,
            notes: $('[name=ngrv_SpecialInstructions]', d).value.trim()
          };
          if (!state.engraving.outside && !state.engraving.inside) state.engraving = null;
          closeDialog();
          render();
        },
        remove() {
          if (confirm('Are you sure you want to Remove this Engraving?')) {
            state.engraving = null;
            closeDialog();
            render();
          }
        }
      };
    });
  }

  /* ---- customize ---- */
  function openCustomize() {
    openDialog('tplCustomize', d => {
      const typeId = product().type;
      bind('czProductType', esc(productTypeName(typeId)));
      const list = $('.pd-cz-list', d);
      const groups = customizationCatalogue
        .map(g => ({ group: g.group, items: g.items.filter(it => itemAppliesTo(it, typeId)) }))
        .filter(g => g.items.length);
      list.innerHTML = groups.map(g => `
        <div class="pd-cz-group">
          <h4>${esc(g.group)}</h4>
          ${g.items.map(it => {
            const feeTxt = feeText(it);
            const feeCls = it.fee === 'quote' ? 'is-quote' : (it.fee > 0 ? '' : 'is-free');
            const hint = it.hint ? ` <span class="pd-cz-hint">(${esc(it.hint)})</span>` : '';
            if (it.reference) {
              return `<div class="pd-cz-row pd-cz-row--reference" title="For reference only">
                <span class="pd-cz-ref-mark" aria-hidden="true"></span>
                <span class="pd-cz-name">${esc(it.name)}${hint} <span class="pd-cz-hint">(reference only)</span></span>
                <span class="pd-cz-fee ${feeCls}">${feeTxt}</span>
              </div>`;
            }
            const checked = state.customizations.ids.includes(it.id);
            return `<label class="pd-cz-row${checked ? ' is-checked' : ''}">
              <input type="checkbox" name="cz" value="${it.id}"${checked ? ' checked' : ''}>
              <span class="pd-cz-name">${esc(it.name)}${hint}</span>
              <span class="pd-cz-fee ${feeCls}">${feeTxt}</span>
            </label>`;
          }).join('')}
        </div>`).join('') || `<div class="pd-cz-empty">No customizations are set up for ${esc(productTypeName(typeId))} yet. Add some under menu &rsaquo; Customization settings.</div>`;
      const notes = $('[name=customizationNotes]', d);
      notes.value = state.customizations.notes;

      const selectedIds = () => $$('[name=cz]:checked', d).map(c => c.value);
      const tally = () => {
        const t = customizationTotals(selectedIds());
        bind('czCount', t.count);
        bind('czFees', money(t.fees));
        bind('czQuote', t.quotes ? `+ ${t.quotes} quote required` : '');
        $$('label.pd-cz-row', d).forEach(r => r.classList.toggle('is-checked', $('input', r).checked));
      };
      list.addEventListener('change', tally);
      tally();

      return {
        save() {
          state.customizations = { ids: selectedIds(), notes: notes.value.trim() };
          closeDialog();
          render();
        },
        clear() {
          $$('[name=cz]', d).forEach(c => { c.checked = false; });
          notes.value = '';
          tally();
        }
      };
    });
  }

  /* ---- customization settings editor ---- */
  function openCatalogueEditor() {
    openDialog('tplCatalogueEditor', d => {
      const typesEl = $('.pd-ce-types', d);
      const groupsEl = $('.pd-ce-groups', d);
      const abbr = name => {
        const w = name.trim().split(/\s+/).filter(Boolean);
        return (w.length > 1 ? w.map(x => x[0]).join('') : (w[0] || '??').slice(0, 2)).toUpperCase();
      };

      // --- product types block ---
      const typeRowHtml = t => `
        <div class="pd-ce-type" data-id="${esc(t.id)}">
          <input type="text" name="typeName" value="${esc(t.name)}" placeholder="Product type">
          <button type="button" class="pd-ce-btn pd-ce-btn--danger" data-ce="del-type" title="Remove product type">&times;</button>
        </div>`;

      // --- category / item block ---
      // new rows start as "Flat fee" with an empty amount so a price can be typed straight away
      const feeType = it => it.isNew ? 'fee' : (it.fee === 'quote' ? 'quote' : (it.fee > 0 ? 'fee' : 'free'));
      const typeChecks = (types, selected) => types.map(t => `
        <label class="pd-ce-chip${selected.includes(t.id) ? ' is-on' : ''}" title="${esc(t.name)}">
          <input type="checkbox" name="types" value="${esc(t.id)}"${selected.includes(t.id) ? ' checked' : ''}>${esc(abbr(t.name))}
        </label>`).join('');
      const rowHtml = (it, types) => `
        <tr data-id="${esc(it.id || '')}"${it.reference ? ' class="is-reference"' : ''}>
          <td class="pd-ce-col-grip"><span class="pd-ce-grip" title="Drag to reorder">&#8942;&#8942;</span></td>
          <td class="pd-ce-col-name"><input type="text" name="name" value="${esc(it.name || '')}" placeholder="Customization"></td>
          <td class="pd-ce-col-hint"><input type="text" name="hint" value="${esc(it.hint || '')}" placeholder="Hint (optional)"></td>
          <td class="pd-ce-col-type">
            <select name="feeType">
              <option value="fee"${feeType(it) === 'fee' ? ' selected' : ''}>Flat fee</option>
              <option value="free"${feeType(it) === 'free' ? ' selected' : ''}>Complimentary</option>
              <option value="quote"${feeType(it) === 'quote' ? ' selected' : ''}>Quote required</option>
            </select>
          </td>
          <td class="pd-ce-col-amt"><input type="number" name="amount" min="0" step="1" value="${feeType(it) === 'fee' && !it.isNew ? it.fee : ''}"${feeType(it) === 'fee' ? '' : ' disabled'}></td>
          <td class="pd-ce-col-ref"><input type="checkbox" name="reference" title="Reference only"${it.reference ? ' checked' : ''}></td>
          <td class="pd-ce-col-types">${typeChecks(types, Array.isArray(it.types) ? it.types : types.map(t => t.id))}</td>
          <td class="pd-ce-col-del"><button type="button" class="pd-ce-btn pd-ce-btn--danger" data-ce="del-item" title="Remove">&times;</button></td>
        </tr>`;
      const groupHtml = (g, types) => `
        <div class="pd-ce-group">
          <div class="pd-ce-group-head">
            <input type="text" name="group" value="${esc(g.group)}" placeholder="Category name">
            <span class="pd-ce-group-types" title="Toggle a product type for every customization in this category">Applies to:
              ${types.map(t => `<button type="button" class="pd-ce-chip pd-ce-chip--btn" data-ce="toggle-type" data-type="${esc(t.id)}" title="${esc(t.name)}">${esc(abbr(t.name))}</button>`).join('')}
            </span>
            <button type="button" class="pd-ce-btn" data-ce="up" title="Move up">&#9650;</button>
            <button type="button" class="pd-ce-btn" data-ce="down" title="Move down">&#9660;</button>
            <button type="button" class="pd-ce-btn pd-ce-btn--danger" data-ce="del-group">Remove category</button>
          </div>
          <table class="pd-ce-items">
            <thead><tr><th></th><th>Customization</th><th>Hint</th><th>Fee</th><th>Amount ($)</th><th title="Reference only">Ref.</th><th>Applies to</th><th></th></tr></thead>
            <tbody>${g.items.map(it => rowHtml(it, types)).join('')}</tbody>
          </table>
          <button type="button" class="pd-ce-btn pd-ce-add-item" data-ce="add-item">+ Add customization</button>
        </div>`;
      const draw = data => {
        typesEl.innerHTML = data.types.map(typeRowHtml).join('') || '<div class="pd-ce-empty">No product types yet.</div>';
        groupsEl.innerHTML = data.groups.map(g => groupHtml(g, data.types)).join('') || '<div class="pd-ce-empty">No categories yet.</div>';
      };
      draw({ types: productTypes, groups: customizationCatalogue });

      // read the DOM back into catalogue data
      const slug = str => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
      const collect = () => {
        const used = new Set();
        const types = [];
        $$('.pd-ce-type', typesEl).forEach(row => {
          const name = $('[name=typeName]', row).value.trim();
          if (!name) return;
          let id = row.dataset.id || slug(name);
          while (used.has(id)) id += '-2';
          used.add(id);
          types.push({ id, name });
        });
        const typeIds = types.map(t => t.id);
        used.clear();
        const groups = [];
        $$('.pd-ce-group', groupsEl).forEach(g => {
          const name = $('[name=group]', g).value.trim();
          const items = [];
          $$('tbody tr', g).forEach(tr => {
            const itName = $('[name=name]', tr).value.trim();
            if (!itName) return;
            let id = tr.dataset.id || slug(itName);
            while (used.has(id)) id += '-2';
            used.add(id);
            const type = $('[name=feeType]', tr).value;
            const it = { id, name: itName };
            const hint = $('[name=hint]', tr).value.trim();
            if (hint) it.hint = hint;
            it.fee = type === 'quote' ? 'quote' : (type === 'fee' ? (parseFloat($('[name=amount]', tr).value) || 0) : 0);
            if ($('[name=reference]', tr).checked) it.reference = true;
            it.types = $$('[name=types]:checked', tr).map(c => c.value).filter(v => typeIds.includes(v));
            items.push(it);
          });
          if (name || items.length) groups.push({ group: name || 'Untitled', items });
        });
        return { types, groups };
      };
      // product type changes affect every row, so redraw from the current edits
      const redraw = mutate => { const data = collect(); mutate(data); draw(data); };

      // editing actions
      d.addEventListener('click', e => {
        const btn = e.target.closest('[data-ce]');
        if (!btn) return;
        const group = btn.closest('.pd-ce-group');
        switch (btn.dataset.ce) {
          case 'add-type': {
            const name = prompt('New product type name (e.g. Bracelet):');
            if (name && name.trim()) redraw(data => data.types.push({ id: '', name: name.trim() }));
            break;
          }
          case 'del-type': {
            const row = btn.closest('.pd-ce-type');
            const name = $('[name=typeName]', row).value || 'this product type';
            if (confirm(`Remove ${name}? Customizations will no longer apply to it.`)) { row.remove(); redraw(() => {}); }
            break;
          }
          case 'add-group':
            if ($('.pd-ce-empty', groupsEl)) groupsEl.innerHTML = '';
            groupsEl.insertAdjacentHTML('beforeend', groupHtml({ group: '', items: [] }, collect().types));
            $('.pd-ce-group:last-child input[name=group]', groupsEl).focus();
            break;
          case 'del-group':
            if (group.querySelectorAll('tbody tr').length === 0 || confirm('Remove this category and its customizations?')) group.remove();
            break;
          case 'up': if (group.previousElementSibling) group.parentNode.insertBefore(group, group.previousElementSibling); break;
          case 'down': if (group.nextElementSibling) group.parentNode.insertBefore(group.nextElementSibling, group); break;
          case 'add-item': {
            const tb = $('tbody', group);
            tb.insertAdjacentHTML('beforeend', rowHtml({ id: '', name: '', fee: 0, isNew: true, types: [product().type] }, collect().types));
            $('tr:last-child input[name=name]', tb).focus();
            break;
          }
          case 'del-item': btn.closest('tr').remove(); break;
          case 'toggle-type': {
            // all on -> all off, otherwise all on
            const boxes = $$(`tbody [name=types][value="${btn.dataset.type}"]`, group);
            const allOn = boxes.length && boxes.every(b => b.checked);
            boxes.forEach(b => { b.checked = !allOn; b.closest('.pd-ce-chip').classList.toggle('is-on', !allOn); });
            break;
          }
        }
      });
      // drag a row by its handle to reorder it within its category
      // (pointer events: works with mouse and touch, no native drag-and-drop)
      let drag = null;
      d.addEventListener('pointerdown', e => {
        const grip = e.target.closest('.pd-ce-grip');
        if (!grip) return;
        const row = grip.closest('tr');
        drag = { row, tbody: row.parentNode };
        row.classList.add('is-dragging');
        d.classList.add('is-reordering');
        grip.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      d.addEventListener('pointermove', e => {
        if (!drag) return;
        const others = Array.from(drag.tbody.children).filter(r => r !== drag.row);
        for (const r of others) {
          const b = r.getBoundingClientRect();
          if (e.clientY < b.top + b.height / 2) {
            if (r.previousElementSibling !== drag.row) drag.tbody.insertBefore(drag.row, r);
            return;
          }
        }
        if (drag.tbody.lastElementChild !== drag.row) drag.tbody.appendChild(drag.row);
      });
      const endDrag = () => {
        if (!drag) return;
        drag.row.classList.remove('is-dragging');
        d.classList.remove('is-reordering');
        drag = null;
      };
      d.addEventListener('pointerup', endDrag);
      d.addEventListener('pointercancel', endDrag);

      d.addEventListener('change', e => {
        const t = e.target;
        if (t.name === 'feeType') {
          const amt = $('[name=amount]', t.closest('tr'));
          amt.disabled = t.value !== 'fee';
          if (t.value !== 'fee') amt.value = ''; else if (!amt.value) amt.value = '0';
        }
        if (t.name === 'reference') t.closest('tr').classList.toggle('is-reference', t.checked);
        if (t.name === 'types') t.closest('.pd-ce-chip').classList.toggle('is-on', t.checked);
        if (t.name === 'typeName') redraw(() => {});   // chips show the type's initials
      });

      return {
        save() {
          const data = collect();
          saveCatalogue(data);
          setCatalogue(data);
          closeDialog();
          render();
          toast('Customization settings saved');
        }
      };
    });
  }

  /* ---- SPIFF ---- */
  function openSpiff(thenAddToCart) {
    openDialog('tplSpiff', d => {
      if (thenAddToCart) bind('spiffTitle', 'Looks like you forgot to select a SPIFF person');
      const sel = $('[name=SPIFF_salespersonID]', d);
      sel.value = state.spiff;
      return {
        save() {
          if (!sel.value) return alert('Please select a salesperson.');
          state.spiff = sel.value;
          closeDialog();
          render();
          if (thenAddToCart) addToCart();
        },
        skip() {
          closeDialog();
          if (thenAddToCart) addToCart();
        }
      };
    });
  }

  /* ---- add to list ---- */
  function openAddToList() {
    openDialog('tplAddToList', d => {
      const type = $('[name=listType]', d);
      const upd = () => {
        const t = type.value;
        bind('existingLabel', `Existing ${t}`);
        bind('newLabel', `New ${t}`);
        bind('noteLabel', t === 'Proposal' ? 'Private Notes' : 'Notes');
      };
      type.addEventListener('change', upd);
      upd();
      return {
        save() {
          const name = $('[name=newListName]', d).value.trim() || $('[name=listID]', d).value;
          closeDialog();
          toast(`${currentSku()} added to ${type.value.toLowerCase()} "${name}"`);
        }
      };
    });
  }

  /* ---- special instructions ---- */
  function openInstructions() {
    openDialog('tplInstructions', d => {
      const ta = $('textarea', d);
      ta.value = state.instructions;
      return {
        save() {
          state.instructions = ta.value.trim();
          closeDialog();
          render();
        }
      };
    });
  }

  /* ---- internal notes ---- */
  function openInternalNotes() {
    openDialog('tplInternalNotes', d => {
      const inputs = $$('input[type=text]', d);
      inputs.forEach((i, k) => { i.value = state.internalNotes[k]; });
      return {
        save() {
          state.internalNotes = inputs.map(i => i.value);
          closeDialog();
          toast('Internal notes saved');
        }
      };
    });
  }

  /* ---------------- cart ---------------- */
  function addToCart() {
    if (product().centerStone && state.mounted === 'Unmounted' && state.shape.value > 0 && state.diamondSize.value == 0 && !state.customStone) {
      return alert('Please select a Diamond Size.');
    }
    const cart = $('#cartCount');
    cart.textContent = parseInt(cart.textContent, 10) + state.qty;
    toast(`${currentSku()}${skuSuffix()} x${state.qty} added to cart`);
  }

  /* ---------------- events ---------------- */
  // product switch
  $('#pdSkuSwitch').addEventListener('change', e => switchProduct(e.target.value));
  $('#pdSkuSwitch').addEventListener('click', e => e.stopPropagation());

  // thumbnails (rendered per product, so delegate)
  $('#pdThumbs').addEventListener('click', e => {
    const link = e.target.closest('.pd-thumb--link');
    if (link) { e.preventDefault(); toast(`Would open ${link.dataset.sku}`); return; }
    const t = e.target.closest('.pd-thumb[data-image]');
    if (!t) return;
    const src = t.dataset.image;
    if (!src) return toast(`${t.dataset.label}: image not available in this POC`);
    $('#pdMainImage').src = src;
    $$('.pd-thumb', $('#pdThumbs')).forEach(x => x.classList.toggle('is-active', x === t));
  });

  // form fields
  form.karatColour.addEventListener('change', e => {
    state.metalCode = e.target.selectedOptions[0].dataset.code;
    render();
  });
  form.size.addEventListener('change', e => { state.size = e.target.value; render(); });
  form.qty.addEventListener('change', e => { state.qty = parseInt(e.target.value, 10); });
  form.sendingStoneForSetting.addEventListener('change', e => {
    state.sendingStoneForSetting = e.target.value;
    render();
  });
  form.variation.addEventListener('change', e => {
    state.variation = e.target.value.includes('-Lab-') ? 'Lab' : '';
    render();
  });
  $$('[name=diamondMounted]', form).forEach(r => r.addEventListener('change', e => {
    state.mounted = e.target.value;
    render();
  }));
  form.stoneShapeID.addEventListener('change', () => { fillStoneSizes(); render(); });
  form.stoneSizeID.addEventListener('change', e => {
    const o = e.target.selectedOptions[0];
    state.fullyMounted = { shapeID: form.stoneShapeID.value, weight: parseFloat(o.dataset.weight), price: parseFloat(o.dataset.price) };
    render();
  });

  initDropdown($('#ddShape'), li => {
    state.shape = { value: li.dataset.value, label: li.textContent.trim(), img: li.dataset.img || '' };
    form.diamondShape3.value = li.dataset.value;
    render();
    if (li.dataset.value == 0) openCustomStone();
  });
  initDropdown($('#ddSize'), li => {
    const em = $('em', li);
    state.diamondSize = {
      value: li.dataset.value,
      label: li.firstChild.textContent.trim(),
      range: em ? em.textContent : ''
    };
    form.diamondSize3.value = li.dataset.value;
    if (li.dataset.value > 0) state.customStone = null;
    render();
    if (li.dataset.value == 0) openCustomStone();
  });

  // action buttons
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    e.preventDefault();
    if (el.dataset.action === 'menu') { e.stopPropagation(); toggleMenu(); return; }
    closeMenu();
    switch (el.dataset.action) {
      case 'catalogue-editor': openCatalogueEditor(); break;
      case 'enlarge': openLightbox($('#pdMainImage').getAttribute('src')); break;
      case 'shipping-date': openShippingDate(); break;
      case 'custom-stone': openCustomStone(); break;
      case 'engraving': openEngraving(); break;
      case 'customize': openCustomize(); break;
      case 'spiff': openSpiff(false); break;
      case 'add-to-list': openAddToList(); break;
      case 'instructions': openInstructions(); break;
      case 'internal-notes': openInternalNotes(); break;
      case 'print': window.print(); break;
      case 'print-retail': toast('Retail print view not part of this POC'); window.print(); break;
      case 'add-to-cart':
        if (!state.spiff) openSpiff(true); else addToCart();
        break;
    }
  });

  /* ---------------- boot ---------------- */
  setCatalogue(loadCatalogue());
  fillSelects();
  fillStoneSizes();
  renderProductChrome();
  render();

  // expose for console poking during the POC
  window.pdState = state;
  window.pdProducts = products;
  window.pdCatalogue = () => ({ types: productTypes, groups: customizationCatalogue });
  window.pdSwitchProduct = switchProduct;
  window.pdRender = render;
})();
