(() => {
  const state = { cfg: null, items: [], city: 'all', cat: '', sort: 'default' };
  const $ = (s, r = document) => r.querySelector(s);
  const brl = v => v == null || v === '' ? 'Preço em breve' :
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const fmtDate = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}`; };
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Analytics (GoatCounter, if configured)
  // Microsoft Clarity: visitas, mapa de calor, gravações de sessão, cliques repetidos
  function track(name) {
    try { window.clarity && window.clarity('event', name); } catch (e) {}
  }
  function tag(k, v) { try { window.clarity && window.clarity('set', k, v); } catch (e) {} }
  function loadAnalytics(id) {
    if (!id) return;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', id);
  }

  async function load() {
    const bust = '?v=' + Date.now();
    const [cfg, items] = await Promise.all([
      fetch('data/config.json' + bust).then(r => r.json()),
      fetch('data/items.json' + bust).then(r => r.json())
    ]);
    state.cfg = cfg;
    state.items = items.filter(i => i.status !== 'vendido');
    $('#title').textContent = cfg.siteTitle;
    $('#tagline').textContent = cfg.tagline;
    const dl = Object.values(cfg.cities).map(c => c.deadline).sort().pop();
    $('#deadline').textContent = fmtDate(dl);
    const cats = [...new Set(state.items.map(i => i.category))];
    $('#cat').innerHTML += cats.map(c => `<option>${esc(c)}</option>`).join('');
    loadAnalytics(cfg.clarity);
    readHash();
    render();
    openFromHash();
  }

  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('cidade')) state.city = p.get('cidade');
  }

  function filtered(city) {
    let list = state.items.filter(i => i.city === city && (!state.cat || i.category === state.cat));
    if (state.sort !== 'default') {
      const k = state.sort === 'asc' ? 1 : -1;
      list.sort((a, b) => ((a.price ?? 1e9) - (b.price ?? 1e9)) * k);
    }
    return list;
  }

  function card(i) {
    const img = i.photos[0]
      ? `<img src="${esc(i.photos[0])}" alt="${esc(i.title)}" loading="lazy">`
      : `<div class="ph">Fotos em breve</div>`;
    const badge = i.status === 'reservado' ? `<span class="badge">Reservado</span>` : '';
    const orig = i.originalPrice ? `<s>${brl(i.originalPrice)}</s>` : '';
    return `<button class="card" data-id="${esc(i.id)}">
      <div class="thumb">${img}${badge}</div>
      <div class="body">
        <h3>${esc(i.title)}</h3>
        <div class="price">${brl(i.price)}${orig}</div>
        <div class="meta">${esc(i.category)}${i.condition ? ' · ' + esc(i.condition) : ''}</div>
      </div></button>`;
  }

  function render() {
    document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.city === state.city)));
    const cities = state.city === 'all' ? Object.keys(state.cfg.cities) : [state.city];
    $('#list').innerHTML = cities.map(key => {
      const c = state.cfg.cities[key];
      const list = filtered(key);
      return `<section class="city" id="${key}">
        <h2>${esc(c.label)}</h2>
        <p class="sub">Retirada em ${esc(c.area)} até ${fmtDate(c.deadline)}</p>
        ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : `<p class="empty">Nada nesta categoria por aqui.</p>`}
      </section>`;
    }).join('');
  }

  // Modal
  let current = null;
  function openItem(id) {
    const i = state.items.find(x => x.id === id);
    if (!i) return;
    current = i;
    const c = state.cfg.cities[i.city];
    $('#m-gallery').innerHTML = i.photos.length
      ? i.photos.map((p, n) => `<img src="${esc(p)}" alt="${esc(i.title)} — foto ${n + 1}">`).join('')
      : `<div class="ph">Fotos em breve</div>`;
    $('#m-city').textContent = `${c.label} · ${i.category}`;
    $('#m-title').textContent = i.title;
    $('#m-price').innerHTML = brl(i.price) + (i.originalPrice ? ` <s>${brl(i.originalPrice)}</s>` : '');
    $('#m-desc').textContent = i.description || '';
    $('#m-extra').textContent = [i.condition && `Estado: ${i.condition}`, i.dimensions && `Medidas: ${i.dimensions}`].filter(Boolean).join(' · ');
    const d = $('#m-date');
    d.min = todayISO(); d.max = c.deadline; d.value = '';
    $('#m-date-hint').textContent = `Só uma preferência — o dia e horário a gente combina no WhatsApp. Retirada até ${fmtDate(c.deadline)}, por conta do comprador.`;
    renderActions();
    $('#modal').showModal();
    history.replaceState(null, '', '#item=' + i.id);
    track('ver_item'); tag('item', i.id); tag('cidade', i.city);
  }

  function waLink(paid) {
    const i = current, c = state.cfg.cities[i.city];
    const date = $('#m-date').value, name = $('#m-name').value.trim();
    const lines = [
      `Olá${c.seller ? ', ' + c.seller : ''}! ${paid ? 'Acabei de pagar' : 'Tenho interesse em'}: *${i.title}* (${brl(i.price)}) — ${c.label}.`,
      date ? `Preferência de retirada: por volta de ${fmtDate(date)} (a combinar).` : 'Vamos combinar o dia da retirada?',
      name ? `Meu nome: ${name}.` : '',
      location.origin + location.pathname + '#item=' + i.id
    ].filter(Boolean);
    return `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
  }

  function renderActions() {
    const i = current, c = state.cfg.cities[i.city];
    const dis = '';
    const parts = [];
    if (i.status === 'reservado') {
      parts.push(`<p class="hint">Este item está reservado. Mande mensagem para entrar na fila caso a venda não se concretize.</p>`);
    }
    if (!c.whatsapp) {
      parts.push(`<p class="hint">Contato desta cidade ainda não configurado.</p>`);
    } else if (i.paymentLink && i.status !== 'reservado') {
      parts.push(`<div class="step-n">1. Pague</div>
        <a class="btn primary" ${dis} href="${esc(i.paymentLink)}" target="_blank" rel="noopener" data-act="pay">Pagar com cartão ou Pix</a>
        <div class="step-n">2. Avise e combine a retirada</div>
        <a class="btn wa" ${dis} href="${waLink(true)}" target="_blank" rel="noopener" data-act="wa-paid">Já paguei — avisar</a>
        <a class="btn ghost" href="${waLink(false)}" target="_blank" rel="noopener" data-act="wa-ask">Tirar dúvida antes</a>`);
    } else {
      parts.push(`<a class="btn wa" ${dis} href="${waLink(false)}" target="_blank" rel="noopener" data-act="wa-buy">Quero comprar no WhatsApp</a>`);
    }
    $('#m-actions').innerHTML = parts.join('');
  }

  // Events
  document.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) { track('filtro_' + chip.dataset.city); state.city = chip.dataset.city; history.replaceState(null, '', state.city === 'all' ? '#' : '#cidade=' + state.city); render(); return; }
    const cardEl = e.target.closest('.card');
    if (cardEl) { openItem(cardEl.dataset.id); return; }
    const act = e.target.closest('[data-act]');
    if (act && current) { track('clique_' + act.dataset.act.replace('-', '_')); tag('item', current.id); }
  });
  $('#cat').addEventListener('change', e => { state.cat = e.target.value; render(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
  $('#m-date').addEventListener('input', renderActions);
  $('#m-name').addEventListener('input', renderActions);
  $('#m-close').addEventListener('click', () => $('#modal').close());
  $('#modal').addEventListener('close', () => { current = null; history.replaceState(null, '', location.pathname + location.search); });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').close(); });

  function openFromHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('item')) openItem(p.get('item'));
  }

  load().catch(err => { $('#list').innerHTML = `<p class="empty">Não foi possível carregar os itens. Recarregue a página.</p>`; console.error(err); });
})();
