/**
 * MoneyMetrics rules, ported from harshjha15335/MoneyMetrics @ ffd00ae:
 * - calculateWeeklyAverages + checkAlertsAndAnomalies + CATEGORY_BUDGETS: js/dashboard.js
 * - parseBankSMS: js/sms.js
 * The repository flags an anomaly when a category's last-7-day spend exceeds its
 * historical weekly average by 40% (and that average is above ₹500). It is not a
 * z-score detector, so the exhibit does not call it one.
 */
export const MONEYMETRICS_COMMIT = 'ffd00ae6e26891b44d37420953e3c1ada803d034';
export const moneymetricsSource = (path: string) => `https://github.com/harshjha15335/MoneyMetrics/blob/${MONEYMETRICS_COMMIT}/${path}`;

export const CATEGORY_BUDGETS: Record<string, number> = {
  'Food & Drinks': 10000, 'Rent & Living': 30000, 'Travel & Transit': 5000, 'Entertainment': 4000, 'Shopping': 8000, 'Other': 5000,
};
export interface Txn { date: string; category: string; amount: number; type: 'expense' | 'income'; note: string }
const DAY = 86400000;

/** calculateWeeklyAverages(transactions) with an injectable "now". */
export function weeklyAnomalies(transactions: Txn[], now: Date) {
  const oneWeekAgo = new Date(now.getTime() - 7 * DAY);
  const historical: Record<string, number> = {}, current: Record<string, number> = {};
  let oldest = now;
  for (const t of transactions) if (t.type === 'expense') {
    const d = new Date(t.date);
    if (d < oldest) oldest = d;
    if (d >= oneWeekAgo) current[t.category] = (current[t.category] ?? 0) + t.amount;
    else historical[t.category] = (historical[t.category] ?? 0) + t.amount;
  }
  const weeksElapsed = Math.max(1, (oneWeekAgo.getTime() - oldest.getTime()) / (7 * DAY));
  const rows = Object.entries(current).map(([cat, spent]) => {
    const avg = (historical[cat] ?? 0) / weeksElapsed;
    return { cat, current: spent, avg, anomaly: avg > 500 && spent > avg * 1.4 };
  });
  return { weeksElapsed, rows, anomalies: rows.filter(r => r.anomaly) };
}

/** checkAlertsAndAnomalies: budget alerts over month-to-date category totals, then anomaly alerts. */
export function alerts(categoryTotals: Record<string, number>, anomalies: { cat: string }[]) {
  const out: { type: 'critical' | 'warning' | 'anomaly'; msg: string }[] = [];
  for (const [cat, spent] of Object.entries(categoryTotals)) {
    const limit = CATEGORY_BUDGETS[cat];
    if (!limit) continue;
    if (spent >= limit) out.push({ type: 'critical', msg: `Exceeded 100% monthly budget for ${cat}!` });
    else if (spent >= limit * .8) out.push({ type: 'warning', msg: `Reached 80% monthly budget for ${cat}.` });
  }
  for (const a of anomalies) out.push({ type: 'anomaly', msg: `Anomaly detected: Spending on ${a.cat} is 40% higher than your weekly average.` });
  return out;
}

export function monthTotals(transactions: Txn[], now: Date) {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, totals: Record<string, number> = {};
  for (const t of transactions) if (t.type === 'expense' && t.date.startsWith(month)) totals[t.category] = (totals[t.category] ?? 0) + t.amount;
  return totals;
}

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
function parseIndianDate(raw: string) {
  const parts = raw.replace(/[/-]/g, ' ').split(/\s+/);
  if (parts.length < 3) return null;
  let [day, month, year] = parts;
  month = Number.isNaN(Number(month)) ? MONTHS[month.toLowerCase().substring(0, 3)] || '01' : month.padStart(2, '0');
  day = day.padStart(2, '0');
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
}

/** parseBankSMS(text): amount, type, date and bank source from a bank SMS. */
export function parseBankSMS(text: string, today = new Date()) {
  const clean = text.toLowerCase().replace(/,/g, '');
  const amountMatch = clean.match(/(?:rs\.?|inr|₹)\s?([\d.]+)|(?:debited|credited)(?:\s(?:by|with|of|from|to))?\s?(?:rs\.?|inr|₹)?\s?([\d.]+)/i);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1] || amountMatch[2]);
  const type = clean.includes('credited') || clean.includes('received') ? 'income' : 'expense';
  const dateMatch = text.match(/(\d{1,2}(?:-|\/|\.|\s)(?:\w+|[\d]{1,2})(?:-|\/|\.|\s)\d{2,4})/);
  const date = (dateMatch && parseIndianDate(dateMatch[1])) || today.toISOString().split('T')[0];
  const bank = ['SBI', 'HDFC', 'ICICI', 'AXIS', 'KOTAK', 'PNB', 'UPI', 'PAYTM', 'GPAY'].find(b => text.toUpperCase().includes(b));
  return { amount, type, date, source: bank ? `${bank} Transaction` : 'Bank SMS' } as const;
}

/** Synthetic ledger for the exhibit: six quiet weeks, then an optional unusual week. Never real data. */
export function syntheticLedger(now: Date, unusualCategory: string | null): Txn[] {
  const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY).toISOString().slice(0, 10);
  const weekly: [string, number, string][] = [['Food & Drinks', 1800, 'Canteen and groceries'], ['Travel & Transit', 650, 'Local train pass top-up'], ['Entertainment', 380, 'Cinema'], ['Shopping', 900, 'Stationery and essentials']];
  const out: Txn[] = [{ date: iso(40), category: 'Other', amount: 25000, type: 'income', note: 'Monthly allowance (synthetic)' }];
  for (let week = 0; week < 6; week++) weekly.forEach(([category, amount, note], i) => out.push({ date: iso(9 + week * 7 + i), category, amount: amount + ((week * 37 + i * 53) % 120), type: 'expense', note }));
  weekly.forEach(([category, amount, note], i) => out.push({ date: iso(1 + i), category, amount: category === unusualCategory ? Math.round(amount * 2.1) : amount, type: 'expense', note: category === unusualCategory ? `${note} · unusual week` : note }));
  return out;
}
