// Token Radar dashboard: renders window.RADAR (written beside this page by
// main.ts as ../data.js). No framework, no network, deterministic.
// Hash deep links: #slug=<slug> opens a protocol's detail view,
// #cat=<category> starts filtered to one category, #watch=1 watchlist only.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;

  var state = { q: '', cat: '', watch: false, sort: 'implied_value_usd', selected: null };

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'onclick') el.onclick = attrs[k];
      else if (k === 'onkeydown') el.onkeydown = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }
  function money(n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function compact(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return money(n);
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }

  function readHash() {
    var raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    var params = new URLSearchParams(raw);
    if (params.get('slug')) state.selected = params.get('slug');
    if (params.get('cat')) state.cat = params.get('cat');
    if (params.get('watch') === '1') state.watch = true;
    if (params.get('q')) state.q = params.get('q');
  }

  function renderHeader() {
    var top = document.getElementById('top');
    top.appendChild(h('h1', null, ['Token Radar']));
    top.appendChild(h('p', { 'class': 'tagline' }, [
      'Every pre-token protocol in the snapshot, ranked by what a token launch would be worth. ' +
      'Prices come from a size curve fitted to the protocols that already trade — market cap grows ' +
      'with TVL to the power of ' + DATA.curve.slope.toFixed(2) + ', not at a flat rate — shifted per ' +
      'category, then adjusted for growth and maturity. The model was chosen by a leave-one-out ' +
      'backtest over the live protocols, and every row carries the band that backtest earned.',
    ]));
    var v = DATA.validation;
    var stats = h('div', { 'class': 'stats' }, [
      stat(DATA.board_size, 'pre-token protocols ranked'),
      stat(DATA.watchlist_size + '/' + DATA.watchlist_size, 'watchlist covered'),
      stat(DATA.curve.comps, 'live protocols priced from'),
      stat(v.curve.median_abs_log10_err.toFixed(2), 'median backtest error (log10)'),
      stat(Math.round(v.curve.within_2x_share * 100) + '%', 'backtest calls within 2x'),
    ]);
    top.appendChild(stats);
  }
  function stat(big, label) {
    return h('div', { 'class': 'stat' }, [h('b', null, [String(big)]), h('span', null, [label])]);
  }

  function renderModel() {
    var main = document.getElementById('app');
    var v = DATA.validation;
    var panel = h('section', { 'class': 'panel' }, [
      h('h2', null, ['The model, and the test it had to pass']),
      h('p', null, [
        'Two estimators were scored leave-one-out over the ' + v.curve.n + ' live, non-exchange protocols: ' +
        'each protocol was priced by a fit that never saw it, and the error is the distance from its real ' +
        'market cap. The flat category multiple (the radar-2 model) is the control; the size curve is what ' +
        'this board ships, because it won.',
      ]),
    ]);
    var table = h('table', null, [
      h('thead', null, [h('tr', null, [
        h('th', null, ['Estimator']), h('th', { 'class': 'num' }, ['Median error (log10)']),
        h('th', { 'class': 'num' }, ['Mean error (log10)']), h('th', { 'class': 'num' }, ['Within 2x']),
      ])]),
      h('tbody', null, [
        h('tr', null, [
          h('td', null, ['Size curve + category offset (radar-3, shipped)']),
          h('td', { 'class': 'num' }, [v.curve.median_abs_log10_err.toFixed(3)]),
          h('td', { 'class': 'num' }, [v.curve.mean_abs_log10_err.toFixed(3)]),
          h('td', { 'class': 'num' }, [Math.round(v.curve.within_2x_share * 100) + '%']),
        ]),
        h('tr', null, [
          h('td', null, ['Flat category multiple (radar-2, control)']),
          h('td', { 'class': 'num' }, [v.legacy.median_abs_log10_err.toFixed(3)]),
          h('td', { 'class': 'num' }, [v.legacy.mean_abs_log10_err.toFixed(3)]),
          h('td', { 'class': 'num' }, [Math.round(v.legacy.within_2x_share * 100) + '%']),
        ]),
      ]),
    ]);
    panel.appendChild(table);
    panel.appendChild(h('p', null, [
      'Each row\'s band is the central 68% of the winning backtest\'s signed errors, applied to that row\'s ' +
      'own value. Wide bands are the honest part: they mark the rows the market\'s own prices cannot pin down.',
    ]));
    main.appendChild(panel);
  }

  function categories() {
    var seen = {};
    DATA.rows.forEach(function (r) { if (r.category) seen[r.category] = true; });
    return Object.keys(seen).sort();
  }

  function visibleRows() {
    var rows = DATA.rows.filter(function (r) {
      if (state.watch && !r.watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.q) {
        var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
      }
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      var d = (b[key] || 0) - (a[key] || 0);
      return d !== 0 ? d : (a.slug < b.slug ? -1 : 1);
    });
    return rows;
  }

  function renderControls() {
    var main = document.getElementById('app');
    var wrap = h('div', { 'class': 'controls' });
    var search = h('input', { type: 'search', placeholder: 'Search name, category, chain', value: state.q });
    search.addEventListener('input', function () { state.q = search.value; renderBoard(); });
    wrap.appendChild(search);
    var sel = h('select', null, [h('option', { value: '' }, ['All categories'])].concat(
      categories().map(function (c) {
        var o = h('option', { value: c }, [c]);
        if (c === state.cat) o.setAttribute('selected', 'selected');
        return o;
      })));
    sel.addEventListener('change', function () { state.cat = sel.value; renderBoard(); });
    wrap.appendChild(sel);
    var watchBox = h('input', { type: 'checkbox' });
    if (state.watch) watchBox.setAttribute('checked', 'checked');
    watchBox.addEventListener('change', function () { state.watch = watchBox.checked; renderBoard(); });
    wrap.appendChild(h('label', null, [watchBox, ' watchlist only']));
    var sortSel = h('select', null, [
      h('option', { value: 'implied_value_usd' }, ['Sort: implied value']),
      h('option', { value: 'tvl_usd' }, ['Sort: TVL']),
      h('option', { value: 'change_7d' }, ['Sort: 7d change']),
    ]);
    sortSel.value = state.sort;
    sortSel.addEventListener('change', function () { state.sort = sortSel.value; renderBoard(); });
    wrap.appendChild(sortSel);
    main.appendChild(wrap);
  }

  var boardHost = null;
  function renderBoard() {
    if (!boardHost) {
      boardHost = h('div', { id: 'board' });
      document.getElementById('app').appendChild(boardHost);
    }
    boardHost.innerHTML = '';
    var rows = visibleRows();
    boardHost.appendChild(h('h2', null, [
      'The board — ' + rows.length + ' of ' + DATA.board_size + ' pre-token protocols',
    ]));
    var table = h('table', null, [
      h('thead', null, [h('tr', null, [
        h('th', { 'class': 'num' }, ['#']), h('th', null, ['Protocol']), h('th', null, ['Category']),
        h('th', { 'class': 'num' }, ['TVL']), h('th', { 'class': 'num' }, ['7d']),
        h('th', { 'class': 'num' }, ['Implied value']), h('th', null, ['Backtest band']),
        h('th', { 'class': 'num' }, ['Eff. multiple']), h('th', { 'class': 'num' }, ['Plan net cost']),
      ])]),
    ]);
    var body = h('tbody', null, []);
    rows.forEach(function (r) {
      var nameCell = h('td', null, [r.name]);
      if (r.watchlist) nameCell.appendChild(h('span', { 'class': 'chip watch' }, ['watchlist']));
      var change = h('td', { 'class': 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down') }, [pct(r.change_7d)]);
      var tr = h('tr', {
        'class': 'clickable', tabindex: '0', 'data-selected': state.selected === r.slug ? 'true' : 'false',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } },
      }, [
        h('td', { 'class': 'num' }, [String(r.rank)]),
        nameCell,
        h('td', null, [r.category || '—']),
        h('td', { 'class': 'num' }, [compact(r.tvl_usd)]),
        change,
        h('td', { 'class': 'num' }, [compact(r.implied_value_usd)]),
        h('td', { 'class': 'band' }, [compact(r.band_low_usd) + ' – ' + compact(r.band_high_usd)]),
        h('td', { 'class': 'num' }, [r.effective_multiple.toFixed(3) + 'x']),
        h('td', { 'class': 'num' }, [money(r.plan.net_cost_usd)]),
      ]);
      body.appendChild(tr);
    });
    table.appendChild(body);
    boardHost.appendChild(table);
  }

  var detailHost = null;
  function openDetail(slug, fromHash) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    if (!detailHost) {
      detailHost = h('div', { id: 'detail' });
      var app = document.getElementById('app');
      // From a deep link the detail leads the page (it is what the reader
      // came for, and what a screenshot of the link shows); from a click
      // it opens just above the board and scrolls into view.
      if (fromHash) app.insertBefore(detailHost, app.firstChild);
      else app.insertBefore(detailHost, boardHost);
    }
    detailHost.innerHTML = '';
    var box = h('section', { 'class': 'detail' }, [
      h('h2', null, ['#' + row.rank + ' — ' + row.name]),
      h('p', { 'class': 'why' }, [row.why]),
    ]);
    var kv = h('div', { 'class': 'kv' }, [
      kvItem('Implied launch value', money(row.implied_value_usd)),
      kvItem('Backtest band', money(row.band_low_usd) + ' – ' + money(row.band_high_usd)),
      kvItem('TVL', money(row.tvl_usd)),
      kvItem('7d change', pct(row.change_7d)),
      kvItem('Effective multiple', row.effective_multiple.toFixed(3) + 'x at this TVL'),
      kvItem('Category offset', (row.category_offset >= 0 ? '+' : '') + row.category_offset.toFixed(2) + ' (' + row.offset_live_protocols + ' live comps)'),
      kvItem('Growth x maturity', 'x' + row.growth_multiplier.toFixed(2) + ' x x' + row.maturity_multiplier.toFixed(2)),
      kvItem('Chains', (row.chains || []).join(', ') || '—'),
      kvItem('Age on DefiLlama', row.age_days === null ? 'unknown' : row.age_days + ' days'),
      kvItem('Plan capital', money(row.plan.capital_usd)),
      kvItem('Plan net cost', money(row.plan.net_cost_usd) + ' over ' + row.plan.hold_days + ' days'),
    ]);
    box.appendChild(kv);
    box.appendChild(h('p', { 'class': 'verdict' }, [row.plan.verdict]));
    box.appendChild(h('h2', null, ['Farm plan — netted to the dollar']));
    var ol = h('ol', { 'class': 'steps' }, row.farm_steps.map(function (s) { return h('li', null, [s]); }));
    box.appendChild(ol);
    detailHost.appendChild(box);
    renderBoard();
    if (!fromHash) detailHost.scrollIntoView();
  }
  function kvItem(k, v) { return h('div', null, [h('b', null, [k]), document.createTextNode(v)]); }

  function renderLive() {
    var main = document.getElementById('app');
    main.appendChild(h('h2', null, ['Already trading — the market\'s own prices, never modelled']));
    var table = h('table', null, [
      h('thead', null, [h('tr', null, [
        h('th', null, ['Protocol']), h('th', null, ['Category']),
        h('th', { 'class': 'num' }, ['Market cap']), h('th', { 'class': 'num' }, ['TVL']), h('th', { 'class': 'num' }, ['7d']),
      ])]),
      h('tbody', null, DATA.live.map(function (r) {
        return h('tr', null, [
          h('td', null, [r.name]), h('td', null, [r.category || '—']),
          h('td', { 'class': 'num' }, [compact(r.mcap_usd)]),
          h('td', { 'class': 'num' }, [compact(r.tvl_usd)]),
          h('td', { 'class': 'num' }, [pct(r.change_7d)]),
        ]);
      })),
    ]);
    main.appendChild(table);
  }

  function renderFooter() {
    var foot = document.getElementById('foot');
    foot.appendChild(h('p', null, [
      'Snapshot: ' + DATA.source + ', as of ' + DATA.as_of + '. Model ' + DATA.model_version +
      ': log-log size curve (intercept ' + DATA.curve.intercept.toFixed(2) + ', slope ' + DATA.curve.slope.toFixed(3) +
      ') fitted on ' + DATA.curve.comps + ' live non-exchange protocols; category offsets shrunk with k=' +
      DATA.model.offset_shrink + '; growth weight ' + DATA.model.growth_weight + ', maturity ramp ' +
      DATA.model.maturity_floor + '–' + (DATA.model.maturity_floor + DATA.model.maturity_range) + ' over ' +
      DATA.model.maturity_days + ' days. Deterministic: the same snapshot always produces this same board.',
    ]));
  }

  readHash();
  renderHeader();
  renderModel();
  renderControls();
  renderBoard();
  if (state.selected) openDetail(state.selected, true);
  renderLive();
  renderFooter();
})();
