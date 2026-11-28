const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizeItem, analyzeLedger } = require('../hiascend-rewards-aggregator.user.js');

function report(rows, balance, asOf = '2026-11-28T12:00:00+08:00') {
  const items = [...rows].reverse().map(([createTime, points, isAdd, pointsDesc], index) =>
    normalizeItem({ createTime, points, isAdd, pointsDesc }, index));
  return analyzeLedger(items, balance, Date.parse(asOf));
}

function expiry(result) {
  return [...result.expiryByMonth].map(([at, { remaining, used }]) =>
    [new Date(at).toISOString().slice(0, 10), remaining, used]);
}

test('redeems across batches and reconciles the current balance and composition', () => {
  const result = report([
    ['2026/1/20', 100, true, '代码贡献'],
    ['2026-02-17', 300, true, '技术文章'],
    ['2026-04-01', '150', false, '礼品兑换'],
    ['2026-10-31', 250, true, '技术文章'],
  ], 500);
  assert.equal(result.issue, '');
  assert.deepEqual(expiry(result), [
    ['2027-01-01', 0, 100],
    ['2027-02-01', 250, 50],
    ['2027-10-01', 250, 0],
  ]);
  assert.deepEqual([...result.liveBySource], [['技术文章', 500]]);
  assert.equal(result.income, 650);
});

test('starts the validity window on the first of the earning month in China', () => {
  const rows = [['2025-11-30T16:05:00Z', 100, true, '代码贡献']];
  assert.deepEqual(expiry(report(rows, 100, '2026-11-30T23:59:59+08:00')), [['2026-12-01', 100, 0]]);
  const result = report(rows, 0, '2026-12-01T00:00:00+08:00');
  assert.deepEqual(expiry(result), []);
  assert.equal(result.issue, '');
});

test('does not deduct explicit expiry entries from a newer available batch', () => {
  const result = report([
    ['2025-10-14', 200, true, '历史活动'],
    ['2026-06-01', 75, false, '礼品兑换'],
    ['2026-09-30', 300, true, '代码贡献'],
    ['2026-10-03', 125, false, '积分到期扣除'],
    ['2026-10-03', 50, false, '礼品兑换'],
  ], 250);
  assert.equal(result.issue, '');
  assert.deepEqual(expiry(result), [['2027-09-01', 250, 50]]);
  assert.equal(result.income, 500);
});

test('restores the underlying lot on a matched refund and reuses it on the next debit', () => {
  const result = report([
    ['2026-01-20', 100, true, '技术文章'],
    ['2026-02-17', 200, true, '代码贡献'],
    ['2026-02-18', 150, false, '兑换：体脂秤'],
    ['2026-02-18', 150, true, '撤回兑换：体脂秤，积分返还'],
    ['2026-02-18', 25, false, '兑换：其他商品'],
  ], 275);
  assert.equal(result.issue, '');
  assert.equal(result.income, 300);
  assert.deepEqual(expiry(result), [['2027-01-01', 75, 25], ['2027-02-01', 200, 0]]);
});

test('keeps a matched refund on the original expiry date, including already expired lots', () => {
  const result = report([
    ['2025-10-14', 100, true, '历史活动'],
    ['2026-07-01', 200, true, '代码贡献'],
    ['2026-07-02', 120, false, '兑换：体脂秤'],
    ['2026-10-02', 120, true, '退还积分：体脂秤'],
  ], 200);
  assert.equal(result.issue, '');
  assert.deepEqual(expiry(result), [['2027-07-01', 200, 0]]);
  assert.equal(result.income, 300);
});

test('marks ambiguous refunds and debits with no prior available points', () => {
  const earns = ['2026-03-05', 200, true, '技术文章'];
  const ambiguous = report([
    earns,
    ['2026-03-06', 50, false, '兑换：商品甲'],
    ['2026-03-07', 50, false, '兑换：商品乙'],
    ['2026-04-10', 50, true, '积分返还'],
  ], 150);
  assert.match(ambiguous.issue, /无法唯一对应/);
  assert.match(report([['2026-03-04', 50, false, '兑换'], earns], 150).issue, /超过当时可追溯/);
});

test('marks balance discrepancies and malformed entries even when a balance is available', () => {
  assert.match(report([['2026-05-05', 100, true, '代码贡献']], 120).issue, /与站点余额/);
  assert.match(report([['2026-02-31', 100, true, '代码贡献']], 0).issue, /缺少可识别/);
});
