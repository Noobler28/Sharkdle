(() => {
  'use strict';
  const data = window.SHARKDLE_WIKI || { categories: [], entries: [] };
  const categories = data.categories || [];
  const entries = data.entries || [];
  const entriesById = new Map(entries.map(entry => [entry.id, entry]));
  const pageSize = 24;
  const page = document.getElementById('page-content');
  // The home page stays in wiki.html so its author can edit ordinary HTML.
  const homeHtml = page.innerHTML;
  const search = document.getElementById('wiki-search');
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('menu-toggle');
  const backdrop = document.getElementById('menu-backdrop');
  const nav = document.getElementById('wiki-nav');
  const status = document.getElementById('wiki-status');
  const mobile = matchMedia('(max-width: 760px)');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const categoryUrl = name => '#/category/' + encodeURIComponent(name);
  const articleUrl = id => '#/article/' + encodeURIComponent(id);
  const articleLabels = { 'all-cosmetics': 'All cosmetics', cosmetics: 'Cosmetics overview', 'cosmetic-portraits': 'Portraits', 'cosmetic-badges': 'Badges', 'cosmetic-themes': 'Theme previews', crates: 'Crate guide' };
  const termArticles = { 'shark rescue command': 'rescue-command', 'lost treasures': 'lost-treasures', sharkrng: 'rng-overview', 'shark pass 2': 'shark-pass', 'shark pass': 'shark-pass', sharchive: 'sharchive', 'dr. finn': 'dr-finn', 'practice mode': 'practice-mode', 'infinite mode': 'infinite-mode', 'daily challenge': 'daily-mode', 'streak shield': 'streak-shields', 'streak shields': 'streak-shields', 'legendary guarantee': 'crates' };
  const termPattern = new RegExp('\\b(' + Object.keys(termArticles).sort((a, b) => b.length - a.length).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');
  let linkedTerms = new Set(), activeArticleId = '';
  function formatText(value) {
    const text = String(value ?? '');
    let result = '', start = 0, match;
    termPattern.lastIndex = 0;
    while ((match = termPattern.exec(text))) {
      const id = termArticles[match[0].toLowerCase()];
      result += esc(text.slice(start, match.index));
      if (entriesById.has(id) && id !== activeArticleId && !linkedTerms.has(id)) {
        result += `<a href="${articleUrl(id)}">${esc(match[0])}</a>`;
        linkedTerms.add(id);
      } else result += esc(match[0]);
      start = match.index + match[0].length;
    }
    return result + esc(text.slice(start));
  }
  const cosmetics = new Map((data.cosmetics || []).map(item => [item.id, item]));
  const resolveCosmetic = reference => {
    const id = typeof reference === 'string' ? reference : reference.id;
    const item = cosmetics.get(id);
    return item ? { ...item, ...(typeof reference === 'object' ? reference : {}) } : null;
  };
  const searchIndex = new Map(entries.map(entry => [entry.id, JSON.stringify([
    entry, ...(entry.sections || []).flatMap(section => (section.catalog || []).map(resolveCosmetic))
  ]).toLowerCase()]));
  const rarityLabels = { core: 'Starter', code: 'Code', special: 'Special', common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
  const icons = ['◉', '▷', '♧', '⌖', '⚄', '✧', '♜', '⚑', '☼', '⚓', '↗', '☷', '♔', '❖', '⌘', '♧', '≡'];

  nav.innerHTML = '<a href="#/" class="nav-item" data-nav="home"><span class="nav-icon">⌂</span><span>Wiki home</span></a>'
    + '<a href="#/guides" class="nav-item" data-nav="guides"><span class="nav-icon">▤</span><span>Guides & walkthroughs</span></a>'
    + '<a href="#/directory" class="nav-item" data-nav="directory"><span class="nav-icon">☷</span><span>All pages A–Z</span></a>'
    + categories.map((name, i) => `<a href="${categoryUrl(name)}" class="nav-item" data-nav="${esc(name)}"><span class="nav-icon" aria-hidden="true">${icons[i] || '○'}</span><span>${esc(name)}</span><span class="nav-count">${entries.filter(entry => entry.category === name).length}</span></a>`).join('');

  function setMenu(open) {
    sidebar.classList.toggle('open', open);
    sidebar.inert = mobile.matches && !open;
    backdrop.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close wiki navigation' : 'Open wiki navigation');
  }
  toggle.addEventListener('click', () => setMenu(!sidebar.classList.contains('open')));
  backdrop.addEventListener('click', () => setMenu(false));
  sidebar.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  mobile.addEventListener('change', () => setMenu(false));
  setMenu(false);
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault(); document.getElementById('main-content').focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setMenu(false);
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      event.preventDefault(); search.focus();
    }
  });

  function showList(title, list) {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const kind = params.get('kind') || '';
    const filtered = kind === 'guide' ? list.filter(entry => entry.kind !== 'reference') : kind === 'reference' ? list.filter(entry => entry.kind === 'reference') : list;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const requested = Number.parseInt(params.get('page'), 10) || 1;
    const number = Math.min(totalPages, Math.max(1, requested));
    const start = (number - 1) * pageSize;
    const visible = filtered.slice(start, start + pageSize);
    page.innerHTML = `<div class="crumb"><a href="#/">Sharkdle Wiki</a><span>/</span><span>${esc(title)}</span></div><h1>${esc(title)}</h1><div class="list-toolbar"><label>Show<select id="wiki-list-kind"><option value=""${!kind ? ' selected' : ''}>All pages</option><option value="guide"${kind === 'guide' ? ' selected' : ''}>Guides & topic pages</option><option value="reference"${kind === 'reference' ? ' selected' : ''}>Reference entries</option></select></label><span>${filtered.length ? `${start + 1}–${start + visible.length} of ${filtered.length.toLocaleString('en-GB')}` : '0'} pages</span></div>`
      + (visible.length ? `<div class="results">${visible.map(entry => `<a class="result-card" href="${articleUrl(entry.id)}"><div><span class="result-meta">${esc(entry.category)} · ${entry.kind === 'reference' ? 'Reference' : entry.guide ? 'Guide' : 'Topic'}</span><h2>${esc(entry.title)}</h2>${entry.summary ? `<p>${esc(entry.summary)}</p>` : ''}</div></a>`).join('')}</div>`
        : '<div class="empty-state"><p>No pages match this selection. Try a different filter or search term.</p></div>')
      + (totalPages > 1 ? `<nav class="pagination" aria-label="Result pages"><button type="button" data-wiki-page="${number - 1}"${number === 1 ? ' disabled' : ''}>← Previous</button><span>Page ${number} of ${totalPages}</span><button type="button" data-wiki-page="${number + 1}"${number === totalPages ? ' disabled' : ''}>Next →</button></nav>` : '');
    document.getElementById('wiki-list-kind').addEventListener('change', event => {
      params.set('kind', event.target.value); params.delete('page');
      location.hash = location.hash.split('?')[0] + '?' + params;
    });
    status.textContent = `${filtered.length} pages. Page ${number} of ${totalPages}.`;
  }
  page.addEventListener('click', event => {
    const button = event.target.closest('[data-wiki-page]');
    if (!button || button.disabled) return;
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    params.set('page', button.dataset.wikiPage);
    location.hash = location.hash.split('?')[0] + '?' + params;
  });
  function renderHome() {
    page.innerHTML = homeHtml;
    const stats = { species: (data.species || []).length, guides: entries.filter(entry => entry.guide).length };
    page.querySelectorAll('[data-home-stat]').forEach(element => { element.textContent = (stats[element.dataset.homeStat] || 0).toLocaleString('en-GB'); });
    page.querySelectorAll('[data-category-count]').forEach(element => {
      const group = entries.filter(entry => entry.category === element.dataset.categoryCount);
      element.textContent = group.length.toLocaleString('en-GB') + (group.length === 1 ? ' page' : ' pages');
    });
    status.textContent = '';
  }
  function renderCosmetic(reference) {
    const item = resolveCosmetic(reference);
    if (!item) return '';
    const searchable = [item.name, item.kind, item.group, item.obtainment, item.notes].join(' ').toLowerCase();
    const art = item.image
      ? `<div class="cosmetic-art cosmetic-art--portrait"><img src="${esc(item.image)}" alt="${esc(item.name)} portrait artwork" loading="lazy" decoding="async" width="160" height="160"></div>`
      : item.preview
        ? `<div class="cosmetic-art cosmetic-art--theme" role="img" aria-label="${esc(item.name)} profile theme preview" style="background:${esc(item.preview)}"><span>SHARKDLE<span>Profile theme</span></span></div>`
        : `<div class="cosmetic-art cosmetic-art--badge" aria-label="${esc(item.name)} badge symbol"><span aria-hidden="true">${esc(item.emoji || '🦈')}</span></div>`;
    const detailId = 'cosmetic-' + item.id;
    const name = entriesById.has(detailId) ? `<a href="${articleUrl(detailId)}">${esc(item.name)}</a>` : esc(item.name);
    return `<article class="cosmetic-card" data-catalog-text="${esc(searchable)}" data-rarity="${esc(item.rarity)}" data-availability="${esc(item.availability)}" data-kind="${esc(item.kind)}" data-collection="${esc(item.group)}">${art}<div class="cosmetic-card-body"><p class="cosmetic-kind">${esc(item.kind)} · ${esc(item.group)}</p><h3>${name}</h3><div class="cosmetic-labels"><span class="cosmetic-rarity" data-tier="${esc(item.rarity)}">${esc(rarityLabels[item.rarity] || item.rarity)}</span><span class="cosmetic-availability">${esc(item.availability)}</span></div><dl><dt>How to obtain</dt><dd>${formatText(item.obtainment)}</dd>${item.chance ? `<dt>Drop chance</dt><dd>${esc(item.chance)}</dd>` : ''}</dl>${item.notes ? `<p class="cosmetic-note">${formatText(item.notes)}</p>` : ''}${entriesById.has(detailId) ? `<a class="cosmetic-details-link" href="${articleUrl(detailId)}">Full article →</a>` : ''}</div></article>`;
  }
  function renderCell(cell) {
    if (!cell || typeof cell !== 'object') return esc(cell);
    const image = cell.image ? `<img class="wiki-reference-thumbnail" src="${esc(cell.image.src)}" alt="${esc(cell.image.alt || cell.text || '')}" loading="lazy" decoding="async" width="46" height="46">` : '';
    const text = esc(cell.text || '');
    if (cell.article) return image + `<a href="${articleUrl(cell.article)}">${text}</a>`;
    if (cell.href) return image + `<a href="${esc(cell.href)}">${text}</a>`;
    return image + text;
  }
  function renderTable(table, index) {
    const searchable = table.searchable || table.rows.length > 20;
    return `<div class="wiki-table-block" data-table-container>${searchable ? `<div class="table-tools"><label>Filter this table<input class="wiki-table-filter" type="search" aria-controls="wiki-table-${index}" placeholder="Name, value or requirement…" autocomplete="off"></label><span class="table-match-count" role="status" aria-live="polite">${table.rows.length} of ${table.rows.length} entries</span></div>` : ''}<div class="table-scroll"><table id="wiki-table-${index}"><caption>${esc(table.caption)}</caption><thead><tr>${table.columns.map(column => `<th scope="col">${esc(column)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(row => `<tr data-table-text="${esc(row.map(cell => cell && typeof cell === 'object' ? cell.text || '' : cell).join(' ').toLowerCase())}">${row.map(cell => `<td>${renderCell(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }
  function renderInfobox(entry) {
    if (!entry.facts?.length && !entry.image && !entry.icon && !entry.preview) return '';
    let media = '';
    if (entry.image) media = `<img src="${esc(entry.image.src)}" alt="${esc(entry.image.alt || entry.title)}" decoding="async">${entry.image.caption ? `<p>${esc(entry.image.caption)}</p>` : ''}`;
    else if (entry.preview) media = `<div class="wiki-infobox-preview" role="img" aria-label="${esc(entry.title)} preview" style="background:${esc(entry.preview)}"><span>SHARKDLE</span></div>`;
    else if (entry.icon) media = `<div class="wiki-infobox-icon" role="img" aria-label="${esc(entry.title)} symbol">${esc(entry.icon)}</div>`;
    return `<aside class="wiki-infobox" aria-labelledby="wiki-infobox-title"><h2 id="wiki-infobox-title">${esc(entry.infoboxTitle || entry.title)}</h2>${media ? `<div class="wiki-infobox-media">${media}</div>` : ''}${entry.facts?.length ? `<dl>${entry.facts.map(row => `<dt>${esc(row[0])}</dt><dd>${renderCell(row[1])}</dd>`).join('')}</dl>` : ''}</aside>`;
  }
  function renderSection(section, index) {
    const figure = section.image ? `<figure class="wiki-reference-figure"><img src="${esc(section.image.src)}" alt="${esc(section.image.alt || section.title)}" loading="lazy" decoding="async">${section.image.caption ? `<figcaption>${esc(section.image.caption)}</figcaption>` : ''}</figure>` : '';
    const links = section.links?.length ? `<ul class="article-link-list">${section.links.map(link => `<li><a href="${link.article ? articleUrl(link.article) : esc(link.href)}">${esc(link.label || link.text)}</a></li>`).join('')}</ul>` : '';
    return `<section class="article-section${section.catalog ? ' catalog-section' : ''}" id="wiki-section-${index}"><h2>${esc(section.title)}${section.catalog ? `<span class="catalog-section-count">${section.catalog.length} items</span>` : ''}</h2>${(Array.isArray(section.text) ? section.text : [section.text]).filter(Boolean).map(text => `<p>${formatText(text)}</p>`).join('')}${section.bullets?.length ? `<ul>${section.bullets.map(text => `<li>${formatText(text)}</li>`).join('')}</ul>` : ''}${figure}${section.table ? renderTable(section.table, index) : ''}${links}${section.catalog ? `<div class="cosmetic-grid">${section.catalog.map(renderCosmetic).join('')}</div>` : ''}</section>`;
  }
  function renderArticle(entry) {
    linkedTerms = new Set(); activeArticleId = entry.id;
    const relatedIds = entry.category === 'Cosmetics' ? ['all-cosmetics', ...(entry.related || [])] : (entry.related || []);
    const related = [...new Set(relatedIds)].filter(id => id !== entry.id).map(id => entriesById.get(id)).filter(Boolean);
    const sections = entry.sections || [];
    const hasCatalog = sections.some(section => section.catalog?.length);
    const collection = sections.flatMap(section => (section.catalog || []).map(resolveCosmetic)).filter(Boolean);
    const kinds = [...new Set(collection.map(item => item.kind))];
    const groups = [...new Set(collection.map(item => item.group))];
    const filters = hasCatalog ? `<form class="catalog-controls" id="catalog-filters" role="search" aria-label="Filter this catalogue"><label class="catalog-query">Find in this page<input id="catalog-query" type="search" placeholder="Name, collection or obtainment…" autocomplete="off"></label>${kinds.length > 1 ? `<label>Type<select id="catalog-kind"><option value="">All types</option>${kinds.map(kind => `<option>${esc(kind)}</option>`).join('')}</select></label>` : ''}<label>Collection<select id="catalog-collection"><option value="">All collections</option>${groups.map(group => `<option>${esc(group)}</option>`).join('')}</select></label><label>Rarity<select id="catalog-rarity"><option value="">All rarities</option>${Object.entries(rarityLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><label>Availability<select id="catalog-availability"><option value="">All availability</option>${['Available', 'Seasonal', 'Retired', 'Restricted', 'Unavailable'].map(value => `<option>${value}</option>`).join('')}</select></label><button type="button" id="catalog-reset">Show all</button><p id="catalog-count" role="status" aria-live="polite"></p></form><p id="catalog-empty" class="empty-state" hidden>No items match these filters. Use Show all to restore the full page.</p>` : '';
    page.innerHTML = `<div class="crumb"><a href="${categoryUrl(entry.category)}">${esc(entry.category)}</a></div><article class="wiki-article"><h1>${esc(entry.title)}</h1>${renderInfobox(entry)}${entry.summary ? `<p class="page-lead">${formatText(entry.summary)}</p>` : ''}${entry.playUrl ? `<div class="article-header-actions"><a class="primary-link" href="${esc(entry.playUrl)}">${esc(entry.playLabel || 'Open in Sharkdle')} ↗</a></div>` : ''}${related.length ? `<nav class="related-links" aria-label="Related pages">${related.map(item => `<a href="${articleUrl(item.id)}">${esc(articleLabels[item.id] || item.shortTitle || item.title)}</a>`).join('')}</nav>` : ''}${sections.length > 4 ? `<nav class="article-contents" aria-label="On this page"><strong>On this page</strong><div>${sections.map((section, index) => `<a href="${articleUrl(entry.id)}?section=${index}">${esc(section.title)}${section.catalog ? ` (${section.catalog.length})` : ''}</a>`).join('')}</div></nav>` : ''}${filters}${sections.map(renderSection).join('')}</article>`;
    if (hasCatalog) {
      document.getElementById('catalog-filters').addEventListener('submit', event => event.preventDefault());
      document.getElementById('catalog-reset').addEventListener('click', resetCatalog);
      resetCatalog();
    }
    document.title = entry.title + ' — Sharkdle Wiki';
  }
  function resetCatalog() {
    for (const id of ['catalog-query', 'catalog-rarity', 'catalog-availability', 'catalog-kind', 'catalog-collection']) {
      const control = document.getElementById(id);
      if (control) control.value = '';
    }
    filterCatalog();
  }
  function filterCatalog() {
    const input = document.getElementById('catalog-query');
    if (!input) return;
    const tokens = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const rarity = document.getElementById('catalog-rarity').value;
    const availability = document.getElementById('catalog-availability').value;
    const kind = document.getElementById('catalog-kind')?.value || '';
    const group = document.getElementById('catalog-collection').value;
    const cards = [...page.querySelectorAll('.cosmetic-card')];
    let visible = 0;
    cards.forEach(card => {
      card.hidden = !tokens.every(token => card.dataset.catalogText.includes(token)) || Boolean(rarity && card.dataset.rarity !== rarity) || Boolean(availability && card.dataset.availability !== availability) || Boolean(kind && card.dataset.kind !== kind) || Boolean(group && card.dataset.collection !== group);
      if (!card.hidden) visible++;
    });
    page.querySelectorAll('.catalog-section').forEach(section => {
      section.hidden = ![...section.querySelectorAll('.cosmetic-card')].some(card => !card.hidden);
    });
    document.getElementById('catalog-count').textContent = `${visible} of ${cards.length} items shown`;
    document.getElementById('catalog-empty').hidden = visible > 0;
  }
  for (const type of ['input', 'change']) page.addEventListener(type, event => {
    if (event.target.closest('#catalog-filters')) filterCatalog();
    if (event.target.classList.contains('wiki-table-filter')) {
      const container = event.target.closest('[data-table-container]');
      const tokens = event.target.value.toLowerCase().split(/\s+/).filter(Boolean);
      const rows = [...container.querySelectorAll('tbody tr')];
      let count = 0;
      rows.forEach(row => { row.hidden = !tokens.every(token => row.dataset.tableText.includes(token)); if (!row.hidden) count++; });
      container.querySelector('.table-match-count').textContent = `${count} of ${rows.length} entries`;
    }
  });
  function render() {
    let route, params;
    try {
      const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
      route = path.split('/').map(decodeURIComponent); params = new URLSearchParams(query);
    } catch { showList('Page not found', []); return; }
    let active = route[1] || 'home';
    document.title = 'Sharkdle Wiki';
    if (!route[1]) renderHome();
    else if (route[1] === 'category' && categories.includes(route[2])) {
      active = route[2]; showList(route[2], entries.filter(entry => entry.category === route[2]).sort((a, b) => Number(a.kind === 'reference') - Number(b.kind === 'reference')));
    } else if (route[1] === 'guides') showList('Guides & walkthroughs', entries.filter(entry => entry.guide));
    else if (route[1] === 'directory') showList('All pages A–Z', [...entries].sort((a, b) => a.title.localeCompare(b.title)));
    else if (route[1] === 'search') {
      const query = (params.get('q') || '').slice(0, 160);
      search.value = query;
      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      const relevance = entry => tokens.reduce((score, token) => score + (entry.title.toLowerCase() === query.toLowerCase() ? 100 : entry.title.toLowerCase().includes(token) ? 20 : (entry.summary || '').toLowerCase().includes(token) ? 5 : 0), 0);
      showList(query ? `Search: ${query}` : 'Search', entries.filter(entry => tokens.every(token => searchIndex.get(entry.id).includes(token))).sort((a, b) => relevance(b) - relevance(a)));
    } else if (route[1] === 'article') {
      const entry = entriesById.get(route[2]);
      if (entry) {
        active = entry.category;
        renderArticle(entry);
      } else showList('Page not written yet', []);
    } else showList('Page not found', []);
    if (route[1] !== 'search') search.value = '';
    nav.querySelectorAll('[data-nav]').forEach(link => {
      const selected = link.dataset.nav === active;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    const sectionIndex = params.get('section');
    const targetSection = route[1] === 'article' && /^\d+$/.test(sectionIndex || '') ? document.getElementById('wiki-section-' + sectionIndex) : null;
    if (targetSection) targetSection.scrollIntoView({ block: 'start', behavior: 'instant' });
    else if (document.activeElement !== search) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  document.getElementById('search-form').addEventListener('submit', event => {
    event.preventDefault();
    location.hash = '/search?q=' + encodeURIComponent(search.value.trim().slice(0, 160));
  });
  window.addEventListener('hashchange', render);
  render();
})();
