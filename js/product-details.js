/* ====================================================================
   Product details POC - behaviour.

   Everything the live detail.asp does through server round-trips is
   mocked here in a single `state` object + a `render()` pass, so adding
   a feature means: add to state, add markup, extend render().

   Mocked server rules (search for "MOCK" to find them):
     - ring oversize fee by size
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

  /* ---------------- state ---------------- */
  const state = {
    baseSku: win.dataset.baseSku,          // B001-01YM-100A
    basePrice: parseFloat(win.dataset.basePrice),
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
    customizations: { ids: [], notes: '' },// ids from customizationCatalogue
    spiff: '',
    instructions: '',
    internalNotes: ['', '', '', '', ''],
    dateNeeded: '2026-11-18',
    images: [
      'assets/images/products/B001-01YA.jpg'
    ]
  };

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
  // Center stone size/shape changes are not listed here: that fee is
  // already applied from the carat weight of the center stone provided.
  const customizationCatalogue = [
    { group: 'Head / Prongs', items: [
      { id: 'prong-count',     name: 'Change number of prongs', fee: 0 },
      { id: 'prong-type',      name: 'Change prong type', fee: 0 },
      { id: 'prong-placement', name: 'Change prong placement', fee: 0 },
      { id: 'support-bar',     name: 'Add or remove support bar', fee: 0 },
      { id: 'orientation',     name: 'Change center orientation (NS / EW or kite)', fee: 0 },
      { id: 'platinum-head',   name: 'Upgrade to platinum head on gold style', fee: 80 },
      { id: 'hidden-halo-add', name: 'Add standard hidden halo', fee: 130 },
      { id: 'hidden-halo-rem', name: 'Remove standard hidden halo', fee: 0 }
    ]},
    { group: 'Shank / Band', items: [
      { id: 'milgrain',   name: 'Add or remove milgrain', fee: 0 },
      { id: 'knife-edge', name: 'Add or remove knife edge', fee: 0 },
      { id: 'euroshank',  name: 'Add or remove euroshank', fee: 0 },
      { id: 'cathedral',  name: 'Add or remove cathedral', fee: 80 },
      { id: 'atelier',    name: 'Full conversion to Atelier', hint: 'signature euroshank, VS melee & Atelier spiff', fee: 'quote' }
    ]},
    { group: 'Interior', items: [
      { id: 'luna-add',     name: 'Add Luna pillowed interior', fee: 160 },
      { id: 'luna-rem',     name: 'Remove Luna pillowed interior', fee: 0 },
      { id: 'luna-full',    name: 'Full conversion to Luna', hint: 'pillows & spiff', fee: 'quote' },
      { id: 'mens-pattern', name: "Add or remove NC Men's pattern", fee: 0 },
      { id: 'love-diamond', name: 'Add 1mm RD SI-GH natural diamond (love diamond)', fee: 25 },
      { id: 'sizing-beads', name: 'Add sizing beads', fee: 80 }
    ]},
    { group: 'Engraving', items: [
      { id: 'hand-engraving-add', name: 'Add hand engraving', fee: 220 },
      { id: 'hand-engraving-rem', name: 'Remove hand engraving', fee: 0 },
      { id: 'laser-engraving',    name: 'Custom laser engraving', fee: 50 }
    ]},
    { group: 'Diamonds', items: [
      { id: 'lab-melee',        name: 'Change to lab grown melee', hint: 'see B2B for the LAB SKU (Variations above)', fee: 0 },
      { id: 'gemstone-melee',   name: 'Change to coloured gemstone melee', fee: 'quote' },
      { id: 'add-rem-diamonds', name: 'Add or remove diamonds', fee: 'quote' },
      { id: 'diamond-sizes',    name: 'Change diamond sizes', fee: 'quote' },
      { id: 'diamond-quality',  name: 'Change diamond quality (other than lab)', fee: 'quote' }
    ]},
    { group: 'Design', items: [
      { id: 'combine-styles', name: 'Combining two styles', fee: 'quote' },
      { id: 'full-custom',    name: 'Complete custom (not based on any of our styles)', fee: 'quote' }
    ]},
    { group: 'Services', items: [
      { id: 'nickel-free',  name: 'Nickel-free white gold', fee: 150 },
      { id: 'soldering',    name: 'Soldering', hint: 'per ring', fee: 50 },
      { id: 'retip-prongs', name: 'Retipping prongs', fee: 100, reference: true }
    ]},
    { group: 'Add-ons', items: [
      { id: 'travel-ring', name: 'Silver/CZ travel ring', hint: 'complimentary with an Atelier ER purchase', fee: 200 }
    ]}
  ];
  const customizationById = {};
  customizationCatalogue.forEach(g => g.items.forEach(i => { customizationById[i.id] = i; }));

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
    ringOversizeFee(size) {
      const s = parseFloat(size);
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
    // B001-01 + metal code + [-Lab] + -NNNA  (NNN = carat * 100)
    const parts = state.baseSku.split('-');          // ["B001","01YM","100A"]
    const styleNo = parts[0] + '-' + parts[1].slice(0, 2) + state.metalCode;
    let ct = state.diamondSize.value > 0 ? Math.round(state.diamondSize.value * 100) : 100;
    const last = String(ct).padStart(3, '0') + 'A';
    return [styleNo, state.variation, last].filter(Boolean).join('-');
  }

  function skuSuffix() {
    if (state.mounted === 'Fully Mounted') return '';
    return '-C'; // customer-supplied center stone
  }

  /* ---------------- price ---------------- */
  // Every amount that goes into the total, each with its display line.
  function priceBreakdown() {
    const b = {
      base: state.basePrice,
      ringOversize: mock.ringOversizeFee(state.size),
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
    return (state.engraving.outside ? 25 : 0) + (state.engraving.inside ? 15 : 0);
  }

  /* ---------------- render ---------------- */
  function render() {
    bind('sku', currentSku());
    bind('skuSuffix', skuSuffix());
    bind('price', money(state.basePrice));

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
        const fee = it.fee === 'quote' ? '<span class="pd-summary-quote">Quote required</span>' : (it.fee > 0 ? '$' + money(it.fee) : 'Complimentary');
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
      bind('engravingFee', '$' + money(engravingFee()));
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

  /* ---------------- populate selects ---------------- */
  function fillSelects() {
    const size = $('#pdSize');
    for (let s = 1.5; s <= 12; s += 0.25) {
      const v = String(s);
      size.add(new Option(v, v, false, v === state.size));
    }
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
  function closeDropdowns() { $$('.pd-dd-list').forEach(l => { l.hidden = true; }); }
  document.addEventListener('click', closeDropdowns);

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
  backdrop.addEventListener('click', e => {
    const btn = e.target.closest('[data-dialog]');
    if (btn) {
      const act = btn.dataset.dialog;
      if (act === 'close') return closeDialog();
      if (dialogHandlers && dialogHandlers[act]) dialogHandlers[act](btn);
      return;
    }
    if (e.target === backdrop) closeDialog();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !backdrop.hidden) closeDialog(); });

  /* ---- lightbox ---- */
  function openLightbox(startSrc) {
    const imgs = state.images;
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
      const list = $('.pd-cz-list', d);
      list.innerHTML = customizationCatalogue.map(g => `
        <div class="pd-cz-group">
          <h4>${esc(g.group)}</h4>
          ${g.items.map(it => {
            const feeTxt = it.fee === 'quote' ? 'Quote required' : (it.fee > 0 ? '$' + money(it.fee) : 'Complimentary');
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
        </div>`).join('');
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
    if (state.mounted === 'Unmounted' && state.shape.value > 0 && state.diamondSize.value == 0 && !state.customStone) {
      return alert('Please select a Diamond Size.');
    }
    const cart = $('#cartCount');
    cart.textContent = parseInt(cart.textContent, 10) + state.qty;
    toast(`${currentSku()}${skuSuffix()} x${state.qty} added to cart`);
  }

  /* ---------------- events ---------------- */
  // thumbnails
  $$('.pd-thumb[data-image]').forEach(t => t.addEventListener('click', () => {
    const src = t.dataset.image;
    if (!src) return toast(`${t.dataset.label}: image not available in this POC`);
    $('#pdMainImage').src = src;
    $$('.pd-thumb').forEach(x => x.classList.toggle('is-active', x === t));
  }));
  $('.pd-thumb--link').addEventListener('click', e => {
    e.preventDefault();
    toast(`Would open ${e.currentTarget.dataset.sku}`);
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
    switch (el.dataset.action) {
      case 'close':
        $('#pdOverlay').hidden = true;
        $('#btnReopen').hidden = false;
        break;
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
  $('#btnReopen').addEventListener('click', () => {
    $('#pdOverlay').hidden = false;
    $('#btnReopen').hidden = true;
  });

  /* ---------------- boot ---------------- */
  fillSelects();
  fillStoneSizes();
  render();

  // expose for console poking during the POC
  window.pdState = state;
  window.pdRender = render;
})();
