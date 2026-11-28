// ==UserScript==
// @name         HiAscend 积分明细聚合
// @namespace    https://www.hiascend.com/
// @version      1.1.0
// @description  在昇腾社区积分明细中查看到期估算、积分来源和月度收入，并按日期聚合流水。
// @match        https://www.hiascend.com/developer/rewards*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const API_ROOT = '/ascendgateway/ascendservice/exchange/center';
  const PAGE_SIZE = 50;
  const DAY = 86_400_000;
  const CHINA_OFFSET = 8 * 3_600_000;
  const pointFormat = new Intl.NumberFormat('zh-CN');
  const percentFormat = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 });
  const PANEL_ID = 'hiascend-rewards-aggregator-panel';
  const MODAL_SELECTOR = '.detail-dialogStone';
  const TAB_SELECTOR = '.o-tab-nav-list:not(.width-measurement) .o-tab-nav';
  const MODE_LABELS = { all: '全部', add: '获得', spend: '支出' };
  const CHART_COLORS = [
    'var(--o-color-auxiliary1, #2e53fa)',
    'var(--o-color-auxiliary6, #03b5a5)',
    'var(--o-color-auxiliary2, #7b25f4)',
    'var(--o-color-warning1, #fa7305)',
    'var(--o-color-auxiliary5, #058ef0)',
    'var(--o-color-auxiliary4, #e2127a)',
    'var(--o-color-control2, #737780)',
  ];

  const css = `
    .detail-dialogStone[data-hrg-active] .stone-dlg-container { display: none !important; }
    #${PANEL_ID} {
      --hrg-border: var(--o-color-control4, rgba(0, 0, 0, .1));
      --hrg-muted: var(--o-color-info3, #666);
      --hrg-surface: var(--o-color-fill1, #f4f5f7);
      --hrg-card: var(--o-color-fill2, #fff);
      --hrg-accent: var(--o-color-link1, #2e53fa);
      --hrg-radius: var(--o-radius-s, 8px);
      --hrg-gap: var(--o3-gap-4, 12px);
      --hrg-chart-height: 104px;
      box-sizing: border-box;
      width: 100%;
      max-height: min(62vh, 590px);
      overflow: auto;
      color: var(--o-color-info2, #202329);
      font-family: var(--o-font_family, inherit);
      font-size: var(--o-font_size-tip1, 14px);
      line-height: 1.5;
      scrollbar-gutter: stable;
      padding: 1px;
    }
    #${PANEL_ID} *, #${PANEL_ID} *::before { box-sizing: border-box; }
    #${PANEL_ID} .hrg-toolbar,
    #${PANEL_ID} .hrg-card-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px var(--hrg-gap);
    }
    #${PANEL_ID} .hrg-toolbar { margin-bottom: var(--hrg-gap); }
    #${PANEL_ID} .hrg-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    #${PANEL_ID} .hrg-button { cursor: pointer; font-family: inherit; }
    #${PANEL_ID} .hrg-views { display: flex; flex-wrap: wrap; gap: 2px 12px; }
    #${PANEL_ID} .hrg-view {
      padding: 4px 0;
      border: 0;
      border-bottom: 2px solid transparent;
      background: transparent;
      cursor: pointer;
      font: inherit;
      color: var(--hrg-muted);
    }
    #${PANEL_ID} .hrg-view[aria-pressed="true"] {
      border-color: var(--hrg-accent);
      color: var(--hrg-accent);
      font-weight: var(--o-font_weight-semibold, 600);
    }
    #${PANEL_ID} :is(button, select, summary):focus-visible {
      outline: 2px solid var(--hrg-accent);
      outline-offset: -2px;
    }
    #${PANEL_ID} .hrg-overview {
      display: grid;
      gap: var(--hrg-gap);
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
    }
    #${PANEL_ID} .hrg-card {
      background: var(--hrg-card);
      border: 1px solid var(--hrg-border);
      border-radius: var(--hrg-radius);
      min-width: 0;
      padding: var(--hrg-gap);
    }
    #${PANEL_ID} .hrg-expiry, #${PANEL_ID} .hrg-overview > p { grid-column: 1 / -1; }
    #${PANEL_ID} .hrg-card h3 {
      color: var(--o-color-info1, inherit);
      font-size: 16px;
      font-weight: var(--o-font_weight-semibold, 600);
      line-height: 1.4;
      margin: 0;
    }
    #${PANEL_ID} .hrg-card-heading { margin-bottom: var(--hrg-gap); }
    #${PANEL_ID} .hrg-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      column-gap: 8px;
      background: var(--hrg-surface);
      border-radius: var(--hrg-radius);
      margin: var(--hrg-gap) 0 8px;
      padding: var(--hrg-gap);
    }
    #${PANEL_ID} .hrg-metrics > div {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    #${PANEL_ID} .hrg-metrics dt { color: var(--hrg-muted); font-size: 12px; }
    #${PANEL_ID} .hrg-metrics dd {
      margin: 4px 0 0;
      font-size: clamp(16px, 3.5vw, 24px);
      font-variant-numeric: tabular-nums;
      font-weight: var(--o-font_weight-semibold, 600);
      overflow-wrap: anywhere;
    }
    #${PANEL_ID} .hrg-expiry-details, #${PANEL_ID} .hrg-no-expiry { margin-top: 8px; }
    #${PANEL_ID} .hrg-expiry-details summary { color: var(--hrg-accent); cursor: pointer; }
    #${PANEL_ID} .hrg-expiry-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-variant-numeric: tabular-nums; }
    #${PANEL_ID} .hrg-expiry-table :is(th, td) {
      border-bottom: 1px solid var(--hrg-border);
      padding: 6px 4px;
      text-align: right;
    }
    #${PANEL_ID} .hrg-expiry-table :is(th, td):first-child { text-align: left; }
    #${PANEL_ID} .hrg-expiry-table th { font-size: 12px; color: var(--hrg-muted); }
    #${PANEL_ID} .hrg-select {
      max-width: 100%;
      background: var(--hrg-card);
      border: 1px solid var(--hrg-border);
      border-radius: var(--o-radius_control-xs, 4px);
      color: inherit;
      font: inherit;
      font-size: 12px;
      padding: 4px 6px;
    }
    #${PANEL_ID} .hrg-composition { display: flex; align-items: center; gap: var(--hrg-gap); }
    #${PANEL_ID} .hrg-pie { width: 29%; max-width: 144px; aspect-ratio: 1; border-radius: 50%; flex: none; }
    #${PANEL_ID} .hrg-legend { flex: 1; min-width: 0; list-style: none; padding: 0; margin: 0; }
    #${PANEL_ID} .hrg-legend li {
      display: grid;
      grid-template-columns: 8px minmax(0, 1fr) auto;
      align-items: center;
      gap: 6px;
      padding: 3px 0;
      font-size: 12px;
    }
    #${PANEL_ID} .hrg-swatch { width: 8px; height: 8px; border-radius: 50%; }
    #${PANEL_ID} .hrg-source { overflow-wrap: anywhere; }
    #${PANEL_ID} .hrg-source-value { color: var(--hrg-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
    #${PANEL_ID} .hrg-chart-summary, #${PANEL_ID} .hrg-note, #${PANEL_ID} .hrg-status {
      color: var(--hrg-muted);
      font-size: 12px;
      margin: 0;
    }
    #${PANEL_ID} .hrg-chart-summary, #${PANEL_ID} .hrg-details-status { margin-bottom: 8px; }
    #${PANEL_ID} .hrg-warning { color: var(--o-color-warning3, #a13f00); }
    #${PANEL_ID} .hrg-income-chart { display: grid; gap: 6px; grid-template-columns: auto minmax(0, 1fr); }
    #${PANEL_ID} .hrg-scale {
      height: var(--hrg-chart-height);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      color: var(--hrg-muted);
      font-size: 11px;
      text-align: right;
    }
    #${PANEL_ID} .hrg-chart-scroll { overflow-x: auto; }
    #${PANEL_ID} .hrg-bars {
      display: grid;
      --hrg-month-width: 18px;
      grid-template-columns: repeat(var(--hrg-months), minmax(var(--hrg-month-width), 1fr));
      min-width: calc(var(--hrg-months) * var(--hrg-month-width));
      background-image: linear-gradient(to bottom, var(--hrg-border) 1px, transparent 1px);
      background-size: 100% calc(var(--hrg-chart-height) / 2);
      background-repeat: repeat-y;
    }
    #${PANEL_ID} .hrg-bars.is-history { --hrg-month-width: 30px; }
    #${PANEL_ID} .hrg-month { display: grid; grid-template-rows: var(--hrg-chart-height) 20px; text-align: center; }
    #${PANEL_ID} .hrg-month-bar {
      position: relative;
      display: block;
      appearance: none;
      background: transparent;
      border: 0;
      cursor: pointer;
      padding: 0;
    }
    #${PANEL_ID} .hrg-month-bar::before {
      content: '';
      position: absolute;
      background: var(--hrg-accent);
      border-radius: 3px 3px 0 0;
      width: 62%;
      max-width: 24px;
      height: var(--hrg-bar-height);
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
    }
    #${PANEL_ID} .hrg-month-bar:hover::before, #${PANEL_ID} .hrg-month-bar:focus-visible::before {
      background: var(--o-color-main2-end, #7b25f4);
    }
    #${PANEL_ID} .hrg-month-label {
      background: var(--hrg-card);
      border-top: 1px solid var(--hrg-border);
      color: var(--hrg-muted);
      font-size: 11px;
      padding-top: 2px;
    }
    #${PANEL_ID} .hrg-date-group {
      border: 1px solid var(--hrg-border);
      border-radius: var(--hrg-radius);
      margin-bottom: 8px;
      overflow: hidden;
    }
    #${PANEL_ID} .hrg-date-summary {
      align-items: center;
      background: var(--hrg-surface);
      cursor: pointer;
      display: grid;
      gap: 8px;
      grid-template-columns: 8px minmax(0, 1fr) auto;
      list-style: none;
      padding: 10px var(--hrg-gap);
    }
    #${PANEL_ID} .hrg-date-summary::-webkit-details-marker { display: none; }
    #${PANEL_ID} .hrg-date-summary::before {
      border-bottom: 1px solid currentColor;
      border-right: 1px solid currentColor;
      content: '';
      height: 7px;
      transform: rotate(-45deg);
      width: 7px;
    }
    #${PANEL_ID} .hrg-date-group[open] .hrg-date-summary::before { transform: rotate(45deg); }
    #${PANEL_ID} .hrg-date-label { font-weight: var(--o-font_weight-semibold, 600); }
    #${PANEL_ID} .hrg-date-meta { color: var(--hrg-muted); font-size: 12px; white-space: nowrap; }
    #${PANEL_ID} .hrg-row {
      align-items: center;
      border-top: 1px solid var(--hrg-border);
      display: grid;
      gap: 8px;
      grid-template-columns: minmax(0, 1fr) auto 38px;
      padding: 9px var(--hrg-gap);
    }
    #${PANEL_ID} .hrg-description { overflow-wrap: anywhere; }
    #${PANEL_ID} .hrg-points { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
    #${PANEL_ID} .hrg-points.is-add { color: var(--o-color-success3, #08763b); }
    #${PANEL_ID} .hrg-points.is-spend { color: var(--o-color-danger3, #c00016); }
    #${PANEL_ID} .hrg-count { color: var(--hrg-muted); font-size: 12px; text-align: right; white-space: nowrap; }
    #${PANEL_ID} .hrg-empty, #${PANEL_ID} .hrg-error {
      background: var(--hrg-surface);
      border-radius: var(--hrg-radius);
      color: var(--hrg-muted);
      padding: 16px var(--hrg-gap);
      text-align: center;
    }
    #${PANEL_ID} .hrg-error { color: var(--o-color-danger3, #c00016); }
    @media (max-width: 480px) {
      #${PANEL_ID} { --hrg-chart-height: 92px; max-height: min(71dvh, 590px); }
    }
  `;

  let state = null;
  let scheduled = false;

  function getDialog() {
    const dialog = document.querySelector(MODAL_SELECTOR);
    return dialog?.getClientRects().length ? dialog : null;
  }

  function getActiveMode(dialog) {
    const active = [...dialog.querySelectorAll(TAB_SELECTOR)].find((tab) =>
      tab.classList.contains('o-tab-nav-active') && Object.values(MODE_LABELS).includes(tab.textContent.trim()));
    return Object.keys(MODE_LABELS).find((mode) => MODE_LABELS[mode] === active?.textContent.trim()) ?? 'all';
  }

  function ensureState(dialog) {
    if (!state || state.dialog !== dialog) {
      state = {
        dialog,
        pending: null,
        result: null,
        error: null,
        view: 'overview',
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

  function createButton(label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'o-btn o-btn-primary o-btn-small o-btn-outline hrg-button';
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
      tabContent.appendChild(panel);
    }
    if (!dialog.hasAttribute('data-hrg-active')) dialog.dataset.hrgActive = '';
    return panel;
  }

  function text(value) {
    return String(value ?? '').trim();
  }

  async function requestData(path) {
    const response = await fetch(`${API_ROOT}/${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`接口请求失败（HTTP ${response.status}）`);
    const payload = await response.json();
    if (!payload?.data || (payload.code !== 200 && payload.success !== true)) {
      throw new Error(payload?.msg || '接口返回格式异常');
    }
    return payload.data;
  }

  async function fetchAll() {
    async function fetchPage(pageNo) {
      const data = await requestData(`points/details?pageNo=${pageNo}&pageSize=${PAGE_SIZE}`);
      if (!Array.isArray(data.list)) throw new Error('积分明细格式异常');
      return data;
    }

    const first = await fetchPage(1);
    const total = readPoints(first.totalCount);
    const declaredPages = readPoints(first.pages);
    const pages = declaredPages ?? Math.ceil((total ?? first.list.length) / PAGE_SIZE);
    if (total === null && first.list.length >= PAGE_SIZE && !declaredPages) {
      throw new Error('接口未返回完整分页信息，请重新加载');
    }

    const rows = [...first.list];
    for (let start = 2; start <= pages; start += 4) {
      const pageNumbers = Array.from({ length: Math.min(4, pages - start + 1) }, (_, i) => start + i);
      const results = await Promise.all(pageNumbers.map(fetchPage));
      for (const page of results) {
        if (page.list.length === 0 || (total !== null && readPoints(page.totalCount) !== total)) {
          throw new Error('加载期间积分明细发生变化，请重新加载');
        }
        rows.push(...page.list);
      }
    }
    if (total !== null && rows.length !== total) {
      throw new Error('积分明细条数与接口总数不一致，请重新加载');
    }
    return rows.map(normalizeItem);
  }

  function readPoints(value) {
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
    const amount = Number(value);
    return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
  }

  function parseDate(value) {
    const raw = text(value);
    // Treat unzoned values as China wall time. Zoned timestamps are converted to China wall time.
    const match = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(raw);
    if (!match) return NaN;
    const [, year, month, day, hour = '00', minute = '00', second = '00', ms = '0', zone] = match;
    const date = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second, +ms.padEnd(3, '0'));
    const utc = new Date(date);
    if (utc.getUTCFullYear() !== +year || utc.getUTCMonth() !== +month - 1 ||
        utc.getUTCDate() !== +day || +hour > 23 || +minute > 59 || +second > 59) return NaN;
    if (!zone) return date;
    const isoDate = utc.toISOString().replace(/Z$/, zone);
    return Date.parse(isoDate) + CHINA_OFFSET;
  }

  function dateLabel(at) {
    return new Date(at).toISOString().slice(0, 10);
  }

  function monthStart(at, offset = 0) {
    const date = new Date(at);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1);
  }

  function normalizeItem(item, index) {
    const at = parseDate(item?.createTime);
    const raw = item?.points;
    const rawPoints = typeof raw === 'string' ? raw.trim() : raw;
    const sign = item?.isAdd;
    const isAdd = [true, 'true', 1, '1'].includes(sign);
    const isSpend = [false, 'false', 0, '0'].includes(sign);
    const negative = Number(rawPoints) < 0;
    let direction = 'unknown';
    if (isAdd && !negative) direction = 'add';
    if (isSpend || (!isAdd && negative)) direction = 'spend';
    const points = typeof rawPoints === 'string' && rawPoints.startsWith('-')
      ? readPoints(rawPoints.slice(1)) : readPoints(typeof rawPoints === 'number' ? Math.abs(rawPoints) : rawPoints);
    return {
      at,
      date: Number.isFinite(at) ? dateLabel(at) : text(item?.createTime) || '未知日期',
      description: text(item?.pointsDesc) || '未命名项目',
      direction,
      points,
      index,
    };
  }

  function addTo(map, key, points) {
    map.set(key, (map.get(key) ?? 0) + points);
  }

  function isExpiry(description) {
    return /(?:积分.{0,8}(?:过期|失效|到期)|(?:过期|失效|到期).{0,8}积分|^(?:过期|失效|到期)(?:清零|扣除)?$)/.test(description);
  }

  function isRefund(description) {
    return /返还|退还|退回|退款|撤回兑换|(?:取消|撤销)兑换|兑换(?:取消|撤销|撤回)/.test(description);
  }

  function exchangeName(description) {
    return description.replace(/积分|礼品|商品|兑换|订单|撤回|撤销|取消|退还|退回|返还|退款|扣除|[\s:：,，。()[\]（）【】]/g, '');
  }

  function analyzeLedger(items, officialBalance, now = Date.now()) {
    const today = Math.floor((now + CHINA_OFFSET) / DAY) * DAY;
    const ordered = [...items].sort((a, b) =>
      (a.at || 0) - (b.at || 0) || b.index - a.index);
    const incomeBySource = new Map();
    const incomeByMonth = new Map();
    const lots = [];
    const spendsByAmount = new Map();
    let firstLive = 0;
    let nextSpendable = 0;
    let unpostedExpiry = 0;
    let income = 0;
    let issue = '';

    function expireThrough(at) {
      while (firstLive < lots.length && lots[firstLive].expires <= at) {
        unpostedExpiry += lots[firstLive].remaining;
        firstLive += 1;
      }
      nextSpendable = Math.max(firstLive, nextSpendable);
    }

    for (const item of ordered) {
      const { at, direction, description, points } = item;
      if (points === 0) continue;
      if (!Number.isFinite(at) || at >= today + DAY || points === null || direction === 'unknown') {
        issue ||= '有流水缺少可识别的日期、积分或收支方向';
        continue;
      }
      expireThrough(at);
      if (direction === 'add' && !isRefund(description)) {
        lots.push({ description, expires: monthStart(at, 12), earned: points, remaining: points });
        addTo(incomeBySource, description, points);
        addTo(incomeByMonth, monthStart(at), points);
        income += points;
      } else if (direction === 'add') {
        // Restore the original lots only when a single earlier debit can be matched.
        const name = exchangeName(description);
        const candidates = (spendsByAmount.get(points) ?? []).filter((spend) =>
          !spend.refunded && (!name || spend.name === name));
        if (candidates.length !== 1) {
          issue ||= '有兑换返还无法唯一对应到原支出';
          continue;
        }
        const spend = candidates[0];
        spend.refunded = true;
        for (const { index, used } of spend.allocations) {
          if (index < firstLive) continue;
          lots[index].remaining += used;
          nextSpendable = Math.min(nextSpendable, index);
        }
      } else if (isExpiry(description)) {
        // The calendar already expired these lots. A ledger posting just confirms the loss.
        if (points > unpostedExpiry) issue ||= '过期扣减与已到期批次不一致';
        unpostedExpiry = Math.max(0, unpostedExpiry - points);
      } else {
        let pending = points;
        const allocations = [];
        while (pending > 0 && nextSpendable < lots.length) {
          const lot = lots[nextSpendable];
          const used = Math.min(pending, lot.remaining);
          if (used) allocations.push({ index: nextSpendable, used });
          lot.remaining -= used;
          pending -= used;
          if (lot.remaining === 0) nextSpendable += 1;
        }
        if (pending > 0) {
          issue ||= '有支出超过当时可追溯的可用积分';
        } else {
          const spends = spendsByAmount.get(points) ?? [];
          spends.push({ name: exchangeName(description), allocations, refunded: false });
          spendsByAmount.set(points, spends);
        }
      }
    }

    expireThrough(today);
    const liveBySource = new Map();
    const expiryByMonth = new Map();
    let estimatedBalance = 0;
    for (const lot of lots.slice(firstLive)) {
      const bucket = expiryByMonth.get(lot.expires) ?? { remaining: 0, used: 0 };
      bucket.remaining += lot.remaining;
      bucket.used += lot.earned - lot.remaining;
      expiryByMonth.set(lot.expires, bucket);
      if (!lot.remaining) continue;
      addTo(liveBySource, lot.description, lot.remaining);
      estimatedBalance += lot.remaining;
    }
    if (officialBalance !== null && officialBalance !== estimatedBalance) {
      issue ||= `流水估算余额 ${pointFormat.format(estimatedBalance)} 与站点余额 ${pointFormat.format(officialBalance)} 不一致`;
    }
    return { today, officialBalance, estimatedBalance, income, incomeBySource, incomeByMonth, liveBySource, expiryByMonth, issue };
  }

  function aggregate(items) {
    const dateMap = new Map();
    items.forEach((item) => {
      const { date, description, direction } = item;
      let dateGroup = dateMap.get(date);
      if (!dateGroup) {
        dateGroup = { date, total: 0, groups: new Map(), order: dateMap.size };
        dateMap.set(date, dateGroup);
      }

      const key = `${direction}\u0000${description}`;
      let group = dateGroup.groups.get(key);
      if (!group) {
        group = { description, direction, points: 0, count: 0, incomplete: false };
        dateGroup.groups.set(key, group);
      }
      const points = direction === 'spend' ? -(item.points ?? 0) : item.points ?? 0;
      group.incomplete ||= item.points === null || direction === 'unknown';
      dateGroup.incomplete ||= group.incomplete;
      group.points += points;
      group.count += 1;
      dateGroup.total += points;
    });

    return [...dateMap.values()]
      .sort((a, b) => {
        const ad = parseDate(a.date);
        const bd = parseDate(b.date);
        if (Number.isFinite(ad) || Number.isFinite(bd)) return (bd || 0) - (ad || 0);
        return a.order - b.order;
      })
      .map((dateGroup) => ({
        ...dateGroup,
        groups: [...dateGroup.groups.values()],
      }));
  }

  function formatPoints(value) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${pointFormat.format(value)}`;
  }

  function element(tag, className, label) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label !== undefined) node.textContent = label;
    return node;
  }

  function formatDays(days) {
    return days === 0 ? '今天' : days === 1 ? '明天' : `${days} 天后`;
  }

  function renderExpiry(report) {
    const section = element('section', 'hrg-card hrg-expiry');
    section.append(element('h3', '', '积分到期'));
    const { officialBalance, estimatedBalance, expiryByMonth, today, issue } = report;
    const expiry = [...expiryByMonth];
    const buckets = expiry.filter(([, month]) => month.remaining > 0);
    const [nextAt, next] = buckets[0] ?? [];
    const soon = buckets.reduce((total, [at, month]) => total + (at - today <= 30 * DAY ? month.remaining : 0), 0);
    const balance = officialBalance ?? (issue ? null : estimatedBalance);
    const metrics = element('dl', 'hrg-metrics');
    const values = [
      [officialBalance === null && !issue ? '流水估算余额' : '可用积分', balance],
      ['30 天内预计到期', issue ? null : soon],
      [issue || !next ? '最近预计到期' : `最近 · ${formatDays((nextAt - today) / DAY)}`, issue ? null : next?.remaining],
    ];
    for (const [label, amount] of values) {
      const item = element('div');
      item.append(element('dt', '', label), element('dd', '', amount == null ? '—' : pointFormat.format(amount)));
      metrics.append(item);
    }
    section.append(metrics);

    if (issue) {
      section.append(element('p', 'hrg-note hrg-warning', `${issue}，暂无法生成可靠的到期明细。`));
      return section;
    }
    const balanceNote = officialBalance === null ? '站点余额暂不可读取。' : '估算合计已与站点余额对账。';
    section.append(element('p', 'hrg-note', `按北京时间从获取月起算 12 个月，支出按先到期先扣估算。${balanceNote}`));
    if (!buckets.length) section.append(element('p', 'hrg-note hrg-no-expiry', '暂无待到期积分。'));
    if (!expiry.length) return section;

    const details = element('details', 'hrg-expiry-details');
    details.append(element('summary', '', '查看到期月份与已抵扣积分'));
    const table = element('table', 'hrg-expiry-table');
    const heading = table.createTHead().insertRow();
    for (const label of ['失效日期', '倒计时', '预计剩余', '已抵扣（估算）']) {
      const column = element('th', '', label);
      column.scope = 'col';
      heading.append(column);
    }
    const body = table.createTBody();
    for (const [at, { remaining, used }] of expiry) {
      const row = body.insertRow();
      for (const value of [dateLabel(at), remaining ? formatDays((at - today) / DAY) : '—', pointFormat.format(remaining), pointFormat.format(used)]) {
        row.insertCell().textContent = value;
      }
    }
    details.append(table);
    section.append(details);
    return section;
  }

  function chartCard(title, label, choices) {
    const section = element('section', 'hrg-card');
    const header = element('div', 'hrg-card-heading');
    const select = element('select', 'hrg-select');
    select.setAttribute('aria-label', label);
    for (const [value, name] of choices) {
      const option = element('option', '', name);
      option.value = value;
      select.append(option);
    }
    header.append(element('h3', '', title), select);
    const body = element('div');
    section.append(header, body);
    return { section, select, body };
  }

  function renderComposition(report) {
    const choices = [['income', '历史获得']];
    if (!report.issue) choices.unshift(['balance', '当前余额（估算）']);
    const { section, select, body } = chartCard('积分组成', '积分组成统计口径', choices);
    function update() {
      const available = select.value === 'balance';
      const total = available ? report.estimatedBalance : report.income;
      const bySource = available ? report.liveBySource : report.incomeBySource;
      body.replaceChildren();
      if (!total) {
        body.append(element('p', 'hrg-empty', available ? '暂无可用积分' : '暂无积分收入'));
        return;
      }

      const ranked = [...bySource].sort((a, b) => b[1] - a[1]);
      const slices = ranked.slice(0, 6);
      if (ranked.length === 7) slices.push(ranked[6]);
      if (ranked.length > 7) {
        slices.push([`其他（${ranked.length - 6} 项）`, ranked.slice(6).reduce((sum, [, points]) => sum + points, 0)]);
      }
      const chart = element('div', 'hrg-composition');
      const pie = element('div', 'hrg-pie');
      pie.setAttribute('aria-hidden', 'true');
      const legend = element('ul', 'hrg-legend');
      let end = 0;
      const segments = slices.map(([label, points], index) => {
        const color = CHART_COLORS[index];
        const start = end;
        end += points;
        const li = element('li');
        const swatch = element('span', 'hrg-swatch');
        swatch.style.background = color;
        const name = element('span', 'hrg-source', label);
        const value = `${pointFormat.format(points)} · ${percentFormat.format(points / total)}`;
        li.append(swatch, name, element('span', 'hrg-source-value', value));
        li.title = `${label} · ${value}`;
        legend.append(li);
        return `${color} ${start / total * 100}% ${end / total * 100}%`;
      });
      pie.style.backgroundImage = `conic-gradient(${segments.join(', ')})`;
      chart.append(pie, legend);
      body.append(chart);
    }
    update();
    select.addEventListener('change', update);
    return section;
  }

  function renderIncome(report) {
    const { section, select, body } = chartCard('月度积分收入', '积分收入时间范围', [
      ['recent', '近 12 个月'], ['all', '全部月份'],
    ]);
    function update() {
      const last = monthStart(report.today);
      const showHistory = select.value === 'all' && report.incomeByMonth.size > 0;
      const first = showHistory ? report.incomeByMonth.keys().next().value : monthStart(last, -11);
      const months = [];
      for (let month = first; month <= last; month = monthStart(month, 1)) {
        months.push({ month: dateLabel(month).slice(0, 7), points: report.incomeByMonth.get(month) ?? 0 });
      }
      const maximum = Math.max(1, ...months.map(({ points }) => points));
      const scale = 10 ** Math.floor(Math.log10(maximum));
      const top = Math.ceil(maximum / scale) * scale;
      const summary = element('p', 'hrg-chart-summary');
      summary.setAttribute('aria-live', 'polite');
      const total = months.reduce((sum, { points }) => sum + points, 0);
      const summaryText = `${months[0].month} 至 ${months.at(-1).month} · 共 ${pointFormat.format(total)} 积分`;
      summary.textContent = summaryText;
      const chart = element('div', 'hrg-income-chart');
      const scaleLabels = element('div', 'hrg-scale');
      scaleLabels.setAttribute('aria-hidden', 'true');
      scaleLabels.append(element('span', '', pointFormat.format(top)), element('span', '', '0'));
      const scroller = element('div', 'hrg-chart-scroll');
      const bars = element('div', showHistory ? 'hrg-bars is-history' : 'hrg-bars');
      bars.style.setProperty('--hrg-months', months.length);
      for (const { month, points } of months) {
        const cell = element('div', 'hrg-month');
        const bar = element('button', 'hrg-month-bar');
        const label = `${month} · ${pointFormat.format(points)} 积分`;
        bar.type = 'button';
        bar.setAttribute('aria-label', label);
        bar.title = label;
        bar.style.setProperty('--hrg-bar-height', `${points / top * 100}%`);
        bar.addEventListener('focus', () => { summary.textContent = label; });
        bar.addEventListener('blur', () => { summary.textContent = summaryText; });
        bar.addEventListener('click', () => { summary.textContent = label; });
        const tick = showHistory && month.endsWith('-01') ? `${month.slice(2, 4)}/01` : month.slice(5);
      cell.append(bar, element('span', 'hrg-month-label', tick));
        bars.append(cell);
      }
      scroller.append(bars);
      chart.append(scaleLabels, scroller);
      body.replaceChildren(summary, chart);
    }
    update();
    select.addEventListener('change', update);
    return section;
  }

  function renderOverview(report) {
    const overview = element('div', 'hrg-overview');
    overview.append(renderExpiry(report), renderComposition(report), renderIncome(report));
    if (report.issue) {
      overview.append(element('p', 'hrg-note', '历史图表统计可识别的获得流水，兑换返还不计入收入。'));
    }
    return overview;
  }

  function renderShell(panel, mode, readyState) {
    panel.replaceChildren();
    panel.dataset.hrgMode = mode;
    panel.dataset.hrgReady = readyState;

    const toolbar = element('div', 'hrg-toolbar');
    const actions = element('div', 'hrg-actions');
    toolbar.append(actions);
    panel.append(toolbar);
    return { toolbar, actions };
  }

  function renderLoading(panel, mode) {
    const { actions } = renderShell(panel, mode, 'loading');
    actions.append(createButton('原始明细', 'restore'));
    const loading = element('p', 'hrg-empty', '正在加载全部积分流水，完成后计算到期积分…');
    loading.setAttribute('role', 'status');
    panel.append(loading);
  }

  function renderError(panel, mode, error) {
    const { actions } = renderShell(panel, mode, 'error');
    actions.append(createButton('重新加载', 'retry'), createButton('原始明细', 'restore'));
    const message = element('p', 'hrg-error', `无法加载积分明细：${error.message}`);
    message.setAttribute('role', 'status');
    panel.append(message);
  }

  function renderDateList(panel, mode, items) {
    const rows = mode === 'all' ? items : items.filter((item) => item.direction === mode);
    const groups = aggregate(rows);
    const mergedCount = groups.reduce((sum, date) => sum + date.groups.length, 0);
    panel.append(element('p', 'hrg-details-status hrg-status',
      `${rows.length} 条流水，合并为 ${mergedCount} 项 · ×N 表示原始记录条数`));
    if (!groups.length) {
      panel.append(element('p', 'hrg-empty', `暂无“${MODE_LABELS[mode]}”明细`));
      return;
    }

    const list = element('div', 'hrg-groups');
    for (const dateGroup of groups) {
      const details = element('details', 'hrg-date-group');
      details.dataset.hrgDate = dateGroup.date;

      const summary = element('summary', 'hrg-date-summary');
      const total = dateGroup.incomplete ? '—' : formatPoints(dateGroup.total);
      summary.append(
        element('span', 'hrg-date-label', dateGroup.date),
        element('span', 'hrg-date-meta', `${total} · ${dateGroup.groups.length} 项`),
      );

      const mergedRows = element('div', 'hrg-rows');
      mergedRows.setAttribute('role', 'list');
      for (const group of dateGroup.groups) {
        const row = element('div', 'hrg-row');
        row.setAttribute('role', 'listitem');
        const points = group.incomplete ? '—' : formatPoints(group.points);
        row.append(
          element('span', 'hrg-description', group.description),
          element('span', `hrg-points is-${group.direction}`, points),
          element('span', 'hrg-count', `×${group.count}`),
        );
        mergedRows.append(row);
      }
      details.append(summary, mergedRows);
      list.append(details);
    }
    panel.append(list);
  }

  function renderData(panel, mode, { items, balance }, view) {
    const { toolbar, actions } = renderShell(panel, mode, 'ready');
    const showOverview = mode === 'all' && view === 'overview';
    if (mode === 'all') {
      const views = element('div', 'hrg-views');
      views.setAttribute('role', 'group');
      views.setAttribute('aria-label', '积分视图');
      for (const [value, label] of [['overview', '积分概览'], ['details', '日期明细']]) {
        const button = element('button', 'hrg-view', label);
        button.type = 'button';
        button.dataset.hrgAction = value;
        button.setAttribute('aria-pressed', String(view === value));
        views.append(button);
      }
      toolbar.prepend(views);
    }
    if (!showOverview) actions.append(createButton('全部展开', 'expand'), createButton('全部折叠', 'collapse'));
    actions.append(createButton('重新加载', 'retry'), createButton('原始明细', 'restore'));

    if (showOverview) panel.append(renderOverview(analyzeLedger(items, balance)));
    else renderDateList(panel, mode, items);
  }

  function restoreOriginal(dialog) {
    dialog.dataset.hrgDisabled = 'true';
    delete dialog.dataset.hrgActive;
    getPanel(dialog)?.remove();
  }

  function renderCurrent(current, panel) {
    const mode = getActiveMode(current.dialog);
    if (current.pending) renderLoading(panel, mode);
    else if (current.error) renderError(panel, mode, current.error);
    else if (current.result) renderData(panel, mode, current.result, current.view);
    panel.scrollTop = 0;
  }

  function loadLedger(current, panel, force = false) {
    if (!current.pending && (force || (!current.result && !current.error))) {
      current.pending = Promise.all([
        fetchAll(),
        requestData('getUserData').then((data) => readPoints(data.points)).catch(() => null),
      ]).then(([items, balance]) => {
        current.result = { items, balance };
        current.error = null;
      }).catch((error) => {
        current.result = null;
        current.error = error;
      }).finally(() => {
        current.pending = null;
        const dialog = current.dialog;
        const activePanel = getPanel(dialog);
        if (state === current && dialog.isConnected && activePanel && dialog.dataset.hrgDisabled !== 'true') {
          renderCurrent(current, activePanel);
        }
      });
    }
    renderCurrent(current, panel);
  }

  function sync() {
    const dialog = getDialog();
    if (!dialog) {
      if (state) {
        delete state.dialog.dataset.hrgActive;
        getPanel(state.dialog)?.remove();
        state = null;
      }
      return;
    }
    if (dialog.dataset.hrgDisabled === 'true') return;
    const current = ensureState(dialog);
    const panel = ensurePanel(dialog);
    if (panel && panel.dataset.hrgMode !== getActiveMode(dialog)) loadLedger(current, panel);
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      sync();
    });
  }

  if (typeof document === 'undefined' && typeof module !== 'undefined') {
    module.exports = { normalizeItem, analyzeLedger };
    return;
  }

  const style = document.createElement('style');
  style.dataset.hrg = 'true';
  style.textContent = css;
  document.head.appendChild(style);

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('.detail-box')?.textContent.trim() === '积分明细') {
      const dialog = document.querySelector(MODAL_SELECTOR);
      if (dialog) delete dialog.dataset.hrgDisabled;
      scheduleSync();
    } else if (target.closest('.detail-dialogStone .o-tab-nav')) {
      scheduleSync();
    }

    const panel = target.closest(`#${PANEL_ID}`);
    const button = target.closest('[data-hrg-action]');
    if (!panel || !button || !panel.contains(button)) return;
    const dialog = panel.closest(MODAL_SELECTOR);
    if (!dialog) return;
    const current = ensureState(dialog);
    const action = button.dataset.hrgAction;
    if (action === 'expand' || action === 'collapse') {
      panel.querySelectorAll('.hrg-date-group').forEach((group) => { group.open = action === 'expand'; });
    } else if (action === 'retry') {
      loadLedger(current, panel, true);
    } else if (action === 'restore') {
      restoreOriginal(dialog);
    } else if ((action === 'overview' || action === 'details') && action !== current.view) {
      current.view = action;
      renderCurrent(current, panel);
      panel.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    }
  }, true);

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  scheduleSync();
})();
