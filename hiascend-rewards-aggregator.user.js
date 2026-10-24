// ==UserScript==
// @name         HiAscend 积分明细聚合
// @namespace    https://www.hiascend.com/
// @version      1.0.0
// @description  在昇腾社区“积分明细”弹窗中自动加载全部分页，并按日期和同类项目合并、折叠展示。
// @match        https://www.hiascend.com/developer/rewards*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const API_PATH = '/ascendgateway/ascendservice/exchange/center/points/details';
  const PAGE_SIZE = 100;
  const PANEL_ID = 'hiascend-rewards-aggregator-panel';
  const MODAL_SELECTOR = '.detail-dialogStone';
  const TAB_SELECTOR = '.o-tab-nav-list:not(.width-measurement) .o-tab-nav';
  const MODES = ['all', 'add', 'spend'];
  const MODE_LABELS = { all: '全部', add: '获得', spend: '支出' };

  const css = `
    #${PANEL_ID} {
      --hrg-border: rgba(25, 42, 66, .14);
      --hrg-muted: #6b778c;
      --hrg-surface: #f7f9fc;
      box-sizing: border-box;
      width: 100%;
      color: #1d2738;
      font-size: 14px;
      line-height: 1.5;
    }
    #${PANEL_ID}, #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} .hrg-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 0 0 12px;
    }
    #${PANEL_ID} .hrg-title {
      display: flex;
      align-items: baseline;
      gap: 10px;
      min-width: 0;
    }
    #${PANEL_ID} .hrg-title strong { font-size: 16px; }
    #${PANEL_ID} .hrg-status { color: var(--hrg-muted); font-size: 12px; }
    #${PANEL_ID} .hrg-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    #${PANEL_ID} .hrg-button {
      appearance: none;
      border: 1px solid var(--hrg-border);
      border-radius: 999px;
      background: #fff;
      color: #30425d;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      line-height: 28px;
      min-height: 30px;
      padding: 0 12px;
    }
    #${PANEL_ID} .hrg-button:hover { border-color: #4679c8; color: #1e5bb0; }
    #${PANEL_ID} .hrg-button:focus-visible {
      outline: 2px solid #4679c8;
      outline-offset: 2px;
    }
    #${PANEL_ID} .hrg-rule {
      border: 1px solid var(--hrg-border);
      border-radius: 8px;
      background: var(--hrg-surface);
      color: var(--hrg-muted);
      font-size: 12px;
      margin-bottom: 10px;
      padding: 8px 10px;
    }
    #${PANEL_ID} .hrg-groups {
      max-height: max(180px, calc(min(55vh, 560px) - 72px));
      overflow: auto;
      padding-right: 2px;
    }
    #${PANEL_ID} .hrg-date-group {
      border: 1px solid var(--hrg-border);
      border-radius: 9px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    #${PANEL_ID} .hrg-date-summary {
      align-items: center;
      background: var(--hrg-surface);
      cursor: pointer;
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr) auto;
      list-style: none;
      padding: 10px 12px;
      position: relative;
      user-select: none;
    }
    #${PANEL_ID} .hrg-date-summary::-webkit-details-marker { display: none; }
    #${PANEL_ID} .hrg-date-summary::before {
      border-bottom: 1.5px solid currentColor;
      border-right: 1.5px solid currentColor;
      content: '';
      height: 7px;
      margin-right: 2px;
      position: absolute;
      transform: rotate(-45deg);
      transition: transform .15s ease;
      width: 7px;
    }
    #${PANEL_ID} .hrg-date-group[open] .hrg-date-summary::before { transform: rotate(45deg); }
    #${PANEL_ID} .hrg-date-label { padding-left: 18px; font-weight: 600; }
    #${PANEL_ID} .hrg-date-meta { color: var(--hrg-muted); font-size: 12px; white-space: nowrap; }
    #${PANEL_ID} .hrg-rows { border-top: 1px solid var(--hrg-border); }
    #${PANEL_ID} .hrg-row {
      align-items: center;
      border-bottom: 1px solid var(--hrg-border);
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr) minmax(90px, auto) 54px;
      padding: 9px 12px;
    }
    #${PANEL_ID} .hrg-row:last-child { border-bottom: 0; }
    #${PANEL_ID} .hrg-description { min-width: 0; overflow-wrap: anywhere; }
    #${PANEL_ID} .hrg-points { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
    #${PANEL_ID} .hrg-points.is-add { color: #16835b; }
    #${PANEL_ID} .hrg-points.is-spend { color: #bb4c4c; }
    #${PANEL_ID} .hrg-count { color: var(--hrg-muted); font-size: 12px; text-align: right; white-space: nowrap; }
    #${PANEL_ID} .hrg-empty,
    #${PANEL_ID} .hrg-loading,
    #${PANEL_ID} .hrg-error {
      border: 1px solid var(--hrg-border);
      border-radius: 8px;
      color: var(--hrg-muted);
      padding: 22px 12px;
      text-align: center;
    }
    #${PANEL_ID} .hrg-error { color: #a34343; }
    @media (max-width: 640px) {
      #${PANEL_ID} .hrg-toolbar { align-items: flex-start; }
      #${PANEL_ID} .hrg-actions { width: 100%; }
      #${PANEL_ID} .hrg-button { flex: 1 1 auto; }
      #${PANEL_ID} .hrg-row { grid-template-columns: minmax(0, 1fr) auto; }
      #${PANEL_ID} .hrg-count { grid-column: 2; grid-row: 1; }
      #${PANEL_ID} .hrg-points { grid-column: 2; grid-row: 2; }
    }
  `;

  const style = document.createElement('style');
  style.dataset.hrg = 'true';
  style.textContent = css;
  document.head.appendChild(style);

  let state = null;
  let scheduled = false;

  function getDialog() {
    return document.querySelector(MODAL_SELECTOR);
  }

  function getActiveMode(dialog) {
    const tabs = [...dialog.querySelectorAll(TAB_SELECTOR)].filter((tab) => {
      const text = tab.textContent.trim();
      return text === '全部' || text === '获得' || text === '支出';
    });
    const active = tabs.find((tab) => tab.classList.contains('o-tab-nav-active'));
    const index = active ? tabs.indexOf(active) : 0;
    return MODES[index] || 'all';
  }

  function ensureState(dialog) {
    if (!state || state.dialog !== dialog) {
      state = {
        dialog,
        cache: new Map(),
        inFlight: new Map(),
        requestId: 0,
      };
    }
    return state;
  }

  function getPanel(dialog) {
    return dialog.querySelector(`#${PANEL_ID}`);
  }

  function getTabContent(dialog) {
    return dialog.querySelector('.tab-content');
  }

  function hideOriginalTable(dialog) {
    dialog.querySelectorAll('.stone-dlg-container').forEach((element) => {
      if (!element.closest(`#${PANEL_ID}`)) {
        element.style.setProperty('display', 'none', 'important');
      }
    });
  }

  function createButton(label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hrg-button';
    button.textContent = label;
    button.dataset.hrgAction = action;
    return button;
  }

  function ensurePanel(dialog) {
    const tabContent = getTabContent(dialog);
    if (!tabContent) return null;

    let panel = getPanel(dialog);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.setAttribute('aria-label', '积分明细聚合');
      panel.dataset.hrgOwned = 'true';
      tabContent.appendChild(panel);
    }
    hideOriginalTable(dialog);
    return panel;
  }

  function text(value) {
    return String(value ?? '').trim();
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function requestPage(mode, pageNo, pageSize) {
    const params = new URLSearchParams({
      pageNo: String(pageNo),
      pageSize: String(pageSize),
    });
    if (mode === 'add') params.set('isAdd', 'true');
    if (mode === 'spend') params.set('isAdd', 'false');

    const response = await fetch(`${location.origin}${API_PATH}?${params}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`接口请求失败（HTTP ${response.status}）`);
    }

    const payload = await response.json();
    const data = payload && payload.data;
    if (payload?.code !== 200 || !data || !Array.isArray(data.list)) {
      throw new Error(payload?.msg || '接口返回格式异常');
    }
    return data;
  }

  async function fetchAll(mode) {
    let first;
    let pageSize = PAGE_SIZE;
    try {
      first = await requestPage(mode, 1, pageSize);
    } catch (error) {
      // The service has historically accepted 50 and 100, but 50 is a safe fallback.
      if (pageSize === 50) throw error;
      pageSize = 50;
      first = await requestPage(mode, 1, pageSize);
    }

    const pages = Math.max(1, number(first.pages) || Math.ceil(number(first.totalCount) / pageSize));
    const all = [...first.list];
    for (let start = 2; start <= pages; start += 4) {
      const pageNumbers = [];
      for (let pageNo = start; pageNo < start + 4 && pageNo <= pages; pageNo += 1) {
        pageNumbers.push(pageNo);
      }
      const results = await Promise.all(pageNumbers.map((pageNo) => requestPage(mode, pageNo, pageSize)));
      results.forEach((data) => all.push(...data.list));
    }

    return {
      items: all,
      totalCount: number(first.totalCount) || all.length,
    };
  }

  function signedPoints(item) {
    const points = Math.abs(number(item.points));
    return item.isAdd === false ? -points : points;
  }

  function parseDate(value) {
    const match = text(value).match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (!match) return Number.NaN;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function aggregate(items) {
    const dateMap = new Map();
    items.forEach((item) => {
      const date = text(item.createTime) || '未知日期';
      const description = text(item.pointsDesc) || '未命名项目';
      const direction = item.isAdd === false ? 'spend' : 'add';
      let dateGroup = dateMap.get(date);
      if (!dateGroup) {
        dateGroup = { date, total: 0, groups: new Map(), order: dateMap.size };
        dateMap.set(date, dateGroup);
      }

      const key = `${direction}\u0000${description}`;
      let group = dateGroup.groups.get(key);
      if (!group) {
        group = { description, direction, points: 0, count: 0 };
        dateGroup.groups.set(key, group);
      }
      const points = signedPoints(item);
      group.points += points;
      group.count += 1;
      dateGroup.total += points;
    });

    return [...dateMap.values()]
      .sort((a, b) => {
        const ad = parseDate(a.date);
        const bd = parseDate(b.date);
        if (Number.isFinite(ad) && Number.isFinite(bd) && ad !== bd) return bd - ad;
        return a.order - b.order;
      })
      .map((dateGroup) => ({
        ...dateGroup,
        groups: [...dateGroup.groups.values()],
      }));
  }

  function formatPoints(value) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${new Intl.NumberFormat('zh-CN').format(value)}`;
  }

  function renderShell(panel, mode, status, readyState = 'ready') {
    panel.replaceChildren();
    panel.dataset.hrgMode = mode;
    panel.dataset.hrgReady = readyState;

    const toolbar = document.createElement('div');
    toolbar.className = 'hrg-toolbar';
    const title = document.createElement('div');
    title.className = 'hrg-title';
    const heading = document.createElement('strong');
    heading.textContent = `积分明细 · ${MODE_LABELS[mode]}`;
    const statusText = document.createElement('span');
    statusText.className = 'hrg-status';
    statusText.setAttribute('aria-live', 'polite');
    statusText.textContent = status;
    title.append(heading, statusText);
    toolbar.appendChild(title);
    panel.appendChild(toolbar);
    return { toolbar, title, statusText };
  }

  function renderLoading(panel, mode) {
    const { toolbar } = renderShell(panel, mode, '正在加载全部分页…', 'loading');
    toolbar.appendChild(createButton('取消聚合显示', 'restore'));
    const loading = document.createElement('div');
    loading.className = 'hrg-loading';
    loading.textContent = '正在读取全部积分明细，请稍候…';
    panel.appendChild(loading);
  }

  function renderError(panel, mode, error) {
    const { toolbar } = renderShell(panel, mode, '加载失败', 'error');
    toolbar.appendChild(createButton('重新加载', 'retry'));
    const box = document.createElement('div');
    box.className = 'hrg-error';
    box.textContent = `无法加载积分明细：${error?.message || error}`;
    panel.appendChild(box);
  }

  function renderData(panel, mode, result) {
    const groups = aggregate(result.items);
    const mergedCount = groups.reduce((sum, group) => sum + group.groups.length, 0);
    const { toolbar, statusText } = renderShell(
      panel,
      mode,
      `已加载 ${result.items.length} 条，合并为 ${mergedCount} 项，${groups.length} 个日期`,
    );
    toolbar.querySelector('.hrg-actions')?.remove();
    const actions = document.createElement('div');
    actions.className = 'hrg-actions';
    actions.append(
      createButton('全部展开', 'expand'),
      createButton('全部折叠', 'collapse'),
      createButton('重新加载', 'retry'),
      createButton('原始明细', 'restore'),
    );
    toolbar.appendChild(actions);

    const rule = document.createElement('div');
    rule.className = 'hrg-rule';
    rule.textContent = '聚合规则：同一天内按描述和收支方向合并积分；括号内为原始记录条数。';
    panel.appendChild(rule);

    const list = document.createElement('div');
    list.className = 'hrg-groups';
    list.setAttribute('role', 'list');
    if (!groups.length) {
      const empty = document.createElement('div');
      empty.className = 'hrg-empty';
      empty.textContent = `暂无“${MODE_LABELS[mode]}”明细`;
      list.appendChild(empty);
    }

    groups.forEach((dateGroup, index) => {
      const details = document.createElement('details');
      details.className = 'hrg-date-group';
      details.dataset.hrgDate = dateGroup.date;
      // Keep date groups compact by default; use “全部展开” when needed.
      details.open = false;

      const summary = document.createElement('summary');
      summary.className = 'hrg-date-summary';
      const dateLabel = document.createElement('span');
      dateLabel.className = 'hrg-date-label';
      dateLabel.textContent = dateGroup.date;
      const dateMeta = document.createElement('span');
      dateMeta.className = 'hrg-date-meta';
      dateMeta.textContent = `${formatPoints(dateGroup.total)} · ${dateGroup.groups.length} 项`;
      summary.append(dateLabel, dateMeta);
      details.appendChild(summary);

      const rows = document.createElement('div');
      rows.className = 'hrg-rows';
      rows.setAttribute('role', 'list');
      dateGroup.groups.forEach((group) => {
        const row = document.createElement('div');
        row.className = 'hrg-row';
        row.setAttribute('role', 'listitem');
        const description = document.createElement('span');
        description.className = 'hrg-description';
        description.textContent = group.description;
        description.title = group.description;
        const points = document.createElement('span');
        points.className = `hrg-points ${group.direction === 'add' ? 'is-add' : 'is-spend'}`;
        points.textContent = formatPoints(group.points);
        const count = document.createElement('span');
        count.className = 'hrg-count';
        count.textContent = `×${group.count}`;
        count.title = `${group.count} 条原始记录`;
        row.append(description, points, count);
        rows.appendChild(row);
      });
      details.appendChild(rows);
      list.appendChild(details);
    });
    panel.appendChild(list);

    // Keep the result accessible to page-level diagnostics without exposing raw records in the DOM.
    panel.dataset.hrgRawCount = String(result.items.length);
    panel.dataset.hrgMergedCount = String(mergedCount);
    statusText.title = `${result.totalCount} 条接口记录`;
  }

  function restoreOriginal(dialog) {
    dialog.dataset.hrgDisabled = 'true';
    dialog.querySelectorAll('.stone-dlg-container').forEach((element) => {
      if (!element.closest(`#${PANEL_ID}`)) element.style.removeProperty('display');
    });
    getPanel(dialog)?.remove();
  }

  function getDateGroups(panel) {
    return [...panel.querySelectorAll('.hrg-date-group')];
  }

  function loadMode(dialog, mode, force = false) {
    const current = ensureState(dialog);
    const panel = ensurePanel(dialog);
    if (!panel) return;

    if (!force && current.cache.has(mode)) {
      renderData(panel, mode, current.cache.get(mode));
      return;
    }
    if (current.inFlight.has(mode)) return;

    const requestId = ++current.requestId;
    renderLoading(panel, mode);
    const promise = fetchAll(mode)
      .then((result) => {
        current.cache.set(mode, result);
        if (current.dialog === dialog && dialog.isConnected && getActiveMode(dialog) === mode && requestId === current.requestId) {
          renderData(panel, mode, result);
        }
        return result;
      })
      .catch((error) => {
        if (current.dialog === dialog && dialog.isConnected && getActiveMode(dialog) === mode && requestId === current.requestId) {
          renderError(panel, mode, error);
        }
        throw error;
      })
      .finally(() => current.inFlight.delete(mode));
    current.inFlight.set(mode, promise);
    // The catch above renders the user-facing error; this handler prevents an unhandled rejection.
    promise.catch(() => {});
  }

  function sync() {
    const dialog = getDialog();
    if (!dialog) {
      state = null;
      return;
    }
    if (dialog.dataset.hrgDisabled === 'true') return;
    const current = ensureState(dialog);
    const mode = getActiveMode(dialog);
    const panel = ensurePanel(dialog);
    if (!panel) return;

    const panelMode = panel.dataset.hrgMode;
    if (panelMode !== mode) {
      loadMode(dialog, mode);
      return;
    }
    if (panel.dataset.hrgReady === 'error' || panel.dataset.hrgReady === 'loading') return;
    if (!current.cache.has(mode)) loadMode(dialog, mode);
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      sync();
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('.detail-box')) {
      const dialog = getDialog();
      if (dialog) delete dialog.dataset.hrgDisabled;
      scheduleSync();
    } else if (target.closest('.detail-dialogStone .o-tab-nav')) {
      scheduleSync();
    }

    const panel = target.closest(`#${PANEL_ID}`);
    const button = target.closest('[data-hrg-action]');
    if (!panel || !button || !panel.contains(button)) return;
    const action = button.dataset.hrgAction;
    if (action === 'expand' || action === 'collapse') {
      getDateGroups(panel).forEach((group) => { group.open = action === 'expand'; });
    } else if (action === 'retry') {
      const dialog = panel.closest(MODAL_SELECTOR);
      if (dialog) loadMode(dialog, panel.dataset.hrgMode || getActiveMode(dialog), true);
    } else if (action === 'restore') {
      const dialog = panel.closest(MODAL_SELECTOR);
      if (dialog) restoreOriginal(dialog);
    }
  }, true);

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  scheduleSync();
})();
