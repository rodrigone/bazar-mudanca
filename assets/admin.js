(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const raw = p => /^https?:/.test(p) ? p : `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${repo.branch}/${p}`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TOKEN_KEY = 'bazar_admin_token';
  let token = '', repo = null, items = [], itemsSha = null, cfg = null, cfgSha = null, dirty = false;
  const pendingUploads = new Set();

  const toast = (msg, ms = 3000) => { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = 'none', ms); };
  const setDirty = v => { dirty = v; $('#dirty').hidden = !v; };
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // UTF-8 safe base64
  const b64encode = str => { const bytes = new TextEncoder().encode(str); let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b)); return btoa(bin); };
  const b64decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), c => c.charCodeAt(0)));

  async function gh(path, opts = {}) {
    const r = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...(opts.headers || {}) }
    });
    if (!r.ok) { const t = await r.text(); throw new Error(`${r.status}: ${t.slice(0, 200)}`); }
    return r.status === 204 ? null : r.json();
  }
  const getFile = async p => { const j = await gh(`contents/${p}?ref=${repo.branch}&t=${Date.now()}`); return { sha: j.sha, text: b64decode(j.content) }; };
  const putFile = (p, contentB64, message, sha) => gh(`contents/${p}`, { method: 'PUT', body: JSON.stringify({ message, content: contentB64, branch: repo.branch, ...(sha ? { sha } : {}) }) });

  // --- boot
  async function boot() {
    const localCfg = await fetch('data/config.json?v=' + Date.now()).then(r => r.json());
    repo = localCfg.repo;
    try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
    if (token) await enter().catch(err => { toast('Token inválido: ' + err.message, 5000); showLogin(); });
    else showLogin();
  }
  function showLogin() { $('#login').hidden = false; $('#app').hidden = true; }

  async function enter() {
    const [i, c] = await Promise.all([getFile('data/items.json'), getFile('data/config.json')]);
    items = JSON.parse(i.text); itemsSha = i.sha;
    cfg = JSON.parse(c.text); cfgSha = c.sha;
    $('#login').hidden = true; $('#app').hidden = false;
    fillCfg(); renderItems(); setDirty(false);
  }

  $('#btn-login').addEventListener('click', async () => {
    token = $('#tok').value.trim();
    if (!token) return;
    try { await enter(); try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {} toast('Conectado'); }
    catch (err) { toast('Não consegui entrar: ' + err.message, 6000); }
  });
  $('#btn-logout').addEventListener('click', () => { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} location.reload(); });

  // --- items UI
  const statusLabel = { disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido' };
  function renderItems() {
    const fc = $('#flt-city').value, fs = $('#flt-st').value;
    const cats = cfg.categories || [];
    const openIds = new Set([...document.querySelectorAll('details.item[open]')].map(d => d.dataset.id));
    $('#items').innerHTML = items.map((it, idx) => {
      if ((fc && it.city !== fc) || (fs && it.status !== fs)) return '';
      const thumb = it.photos[0] ? `<img src="${esc(raw(it.photos[0]))}" alt="">` : `<span class="noimg"></span>`;
      return `<details class="item" data-id="${esc(it.id)}" data-idx="${idx}" ${openIds.has(it.id) ? 'open' : ''}>
        <summary>${thumb}<div style="flex:1;min-width:0"><b>${esc(it.title || '(sem título)')}</b><div class="meta">${cfg.cities[it.city]?.label || it.city} · ${it.price != null ? 'R$ ' + it.price : 'sem preço'}</div></div>
          <span class="st ${it.status}">${statusLabel[it.status]}</span></summary>
        <div class="grid2" style="margin-top:12px">
          <div class="f"><label>Título</label><input data-k="title" value="${esc(it.title)}"></div>
          <div class="f"><label>Status</label><select data-k="status">${Object.entries(statusLabel).map(([k, v]) => `<option value="${k}" ${it.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="f"><label>Cidade</label><select data-k="city"><option value="sp" ${it.city === 'sp' ? 'selected' : ''}>São Paulo</option><option value="campinas" ${it.city === 'campinas' ? 'selected' : ''}>Campinas</option></select></div>
          <div class="f"><label>Categoria</label><select data-k="category">${cats.map(c => `<option ${it.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
          <div class="f"><label>Preço (R$)</label><input data-k="price" type="number" inputmode="numeric" value="${it.price ?? ''}"></div>
          <div class="f"><label>Preço original / novo (R$, opcional)</label><input data-k="originalPrice" type="number" inputmode="numeric" value="${it.originalPrice ?? ''}"></div>
          <div class="f"><label>Estado</label><input data-k="condition" value="${esc(it.condition)}" placeholder="ex.: ótimo, 2 anos de uso"></div>
          <div class="f"><label>Medidas</label><input data-k="dimensions" value="${esc(it.dimensions)}" placeholder="ex.: 2,10 x 0,90 m"></div>
        </div>
        <div class="f" style="margin-top:10px"><label>Descrição</label><textarea data-k="description" rows="3">${esc(it.description)}</textarea></div>
        <div class="f" style="margin-top:10px"><label>Link de pagamento (Mercado Pago / InfinitePay — cartão e Pix)</label><input data-k="paymentLink" value="${esc(it.paymentLink)}" placeholder="https://..."></div>
        <div class="photos">${it.photos.map((p, n) => `<figure><img src="${esc(raw(p))}" alt=""><button data-photo-del="${n}" aria-label="Remover foto">×</button>${n ? `<button class="mv" data-photo-first="${n}" aria-label="Usar como capa">★</button>` : ''}</figure>`).join('')}</div>
        <div class="bar">
          <label class="btn ghost" style="cursor:pointer">+ Fotos<input type="file" accept="image/*" multiple hidden data-upload></label>
          <button class="btn ghost" data-del>Excluir item</button>
        </div>
      </details>`;
    }).join('') || '<p class="empty">Nenhum item com esses filtros.</p>';
  }
  $('#flt-city').addEventListener('change', renderItems);
  $('#flt-st').addEventListener('change', renderItems);

  const itemOf = el => items[+el.closest('details.item').dataset.idx];

  $('#items').addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return;
    const it = itemOf(e.target);
    let v = e.target.value;
    if (k === 'price' || k === 'originalPrice') v = v === '' ? null : Number(v);
    it[k] = v; setDirty(true);
  });
  $('#items').addEventListener('change', e => { if (['status', 'city'].includes(e.target.dataset.k)) renderItems(); });

  $('#items').addEventListener('click', e => {
    const t = e.target;
    if (t.dataset.photoDel != null) { const it = itemOf(t); it.photos.splice(+t.dataset.photoDel, 1); setDirty(true); renderItems(); }
    else if (t.dataset.photoFirst != null) { const it = itemOf(t); const [p] = it.photos.splice(+t.dataset.photoFirst, 1); it.photos.unshift(p); setDirty(true); renderItems(); }
    else if (t.hasAttribute('data-del')) { const it = itemOf(t); if (confirmDel(it)) { items.splice(items.indexOf(it), 1); setDirty(true); renderItems(); } }
  });
  // inline two-tap confirm (no browser dialogs)
  const armed = new WeakMap();
  function confirmDel(it) {
    if (armed.get(it)) return true;
    armed.set(it, true); toast('Toque de novo em "Excluir item" para confirmar'); setTimeout(() => armed.delete(it), 4000); return false;
  }

  $('#items').addEventListener('change', async e => {
    if (!e.target.hasAttribute('data-upload')) return;
    const it = itemOf(e.target);
    const files = [...e.target.files];
    for (const f of files) {
      const job = uploadPhoto(it, f); pendingUploads.add(job);
      try { await job; } catch (err) { toast('Falha no upload: ' + err.message, 6000); }
      pendingUploads.delete(job);
    }
    renderItems();
  });

  async function resize(file, max = 1600, q = 0.82) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
    const src = bmp || await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
    const w = src.width, h = src.height, s = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q).split(',')[1];
  }
  async function uploadPhoto(it, file) {
    toast(`Enviando ${file.name}…`, 10000);
    const b64 = await resize(file);
    const path = `img/${it.id}-${Date.now()}.jpg`;
    await putFile(path, b64, `Foto: ${it.title}`);
    it.photos.push(path); setDirty(true);
    toast('Foto enviada. Lembre de salvar.');
  }

  $('#btn-add').addEventListener('click', () => {
    const city = $('#flt-city').value || 'sp';
    const id = (city === 'sp' ? 'sp' : 'cps') + '-item-' + Date.now().toString(36);
    items.unshift({ id, city, category: cfg.categories[0], title: 'Novo item', price: null, originalPrice: null, condition: '', description: '', dimensions: '', photos: [], paymentLink: '', status: 'disponivel', createdAt: new Date().toISOString().slice(0, 10) });
    setDirty(true); renderItems();
    const d = document.querySelector(`details[data-id="${id}"]`); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth' }); }
  });

  $('#btn-save').addEventListener('click', async () => {
    if (pendingUploads.size) return toast('Aguarde o fim dos uploads');
    try {
      // re-read sha to avoid conflicts with edits made elsewhere
      const cur = await getFile('data/items.json');
      if (cur.sha !== itemsSha) { toast('O arquivo mudou em outro lugar. Recarregue a página antes de salvar.', 7000); return; }
      const r = await putFile('data/items.json', b64encode(JSON.stringify(items, null, 2) + '\n'), 'Atualiza itens do bazar', itemsSha);
      itemsSha = r.content.sha; setDirty(false); toast('Salvo! O site atualiza em ~1 minuto.');
    } catch (err) { toast('Erro ao salvar: ' + err.message, 7000); }
  });

  // --- config
  function fillCfg() {
    $('#c-wa-sp').value = cfg.cities.sp.whatsapp; $('#c-wa-cps').value = cfg.cities.campinas.whatsapp;
    $('#c-dl-sp').value = cfg.cities.sp.deadline; $('#c-dl-cps').value = cfg.cities.campinas.deadline;
    $('#c-gc').value = cfg.clarity || ''; $('#c-tag').value = cfg.tagline || '';
    const s = $('#lnk-stats');
    if (cfg.clarity) { s.href = `https://clarity.microsoft.com/projects/view/${cfg.clarity}/dashboard`; s.hidden = false; } else s.hidden = true;
  }
  $('#btn-save-cfg').addEventListener('click', async () => {
    const digits = v => v.replace(/\D/g, '');
    cfg.cities.sp.whatsapp = digits($('#c-wa-sp').value); cfg.cities.campinas.whatsapp = digits($('#c-wa-cps').value);
    cfg.cities.sp.deadline = $('#c-dl-sp').value; cfg.cities.campinas.deadline = $('#c-dl-cps').value;
    cfg.clarity = $('#c-gc').value.trim(); cfg.tagline = $('#c-tag').value.trim();
    try {
      const r = await putFile('data/config.json', b64encode(JSON.stringify(cfg, null, 2) + '\n'), 'Atualiza configurações do bazar', cfgSha);
      cfgSha = r.content.sha; fillCfg(); toast('Configurações salvas.');
    } catch (err) { toast('Erro: ' + err.message, 7000); }
  });

  boot();
})();
