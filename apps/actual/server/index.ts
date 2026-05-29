import * as api from '@actual-app/api';
import express from 'express';
import path from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER_URL = process.env.ACTUAL_SERVER_URL ?? 'http://actual:5006';
const PASSWORD   = process.env.ACTUAL_PASSWORD   ?? '';
const BUDGET_ID  = process.env.ACTUAL_BUDGET_ID  ?? '';
const CURRENCY   = process.env.ACTUAL_CURRENCY   ?? 'EUR';
const DATA_DIR   = '/tmp/actual-data';

let ready      = false;
let initError: string | null = null;

function fmt(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function syncBudget() {
  await (api as any).downloadBudget(BUDGET_ID);
}

async function initialize() {
  if (!BUDGET_ID) {
    initError = 'ACTUAL_BUDGET_ID not configured';
    console.warn(initError);
    return;
  }
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    await (api as any).init({ serverURL: SERVER_URL, password: PASSWORD, dataDir: DATA_DIR });
    await syncBudget();
    ready = true;
    console.log('actual-sat initialized');
    setInterval(() => syncBudget().catch(console.error), 5 * 60 * 1000);
  } catch (err) {
    initError = String(err);
    console.error('Initialization failed:', err);
  }
}

const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: ready ? 'ok' : 'error', error: initError });
});

app.get('/widget', async (_req, res) => {
  if (!ready) {
    res.json({
      title: 'Budget',
      status: 'error',
      summary: initError ?? 'Initializing...',
      metrics: [],
    });
    return;
  }

  try {
    const data = await (api as any).getBudgetMonth(currentMonth());
    const groups: any[] = (data.groupList ?? []).filter((g: any) => !g.is_income);

    let totalBudgeted = 0;
    let totalSpent    = 0;
    let overCount     = 0;

    for (const g of groups) {
      totalBudgeted += g.budgeted ?? 0;
      totalSpent    += Math.abs(g.spent ?? 0);
      for (const cat of g.categories ?? []) {
        if ((cat.balance ?? 0) < 0) overCount++;
      }
    }

    const remaining = totalBudgeted - totalSpent;

    res.json({
      title: 'Budget',
      status: overCount > 0 ? 'warn' : 'ok',
      summary: `${fmt(totalSpent)} spent of ${fmt(totalBudgeted)}`,
      metrics: [
        { label: 'Spent',       value: fmt(totalSpent) },
        { label: 'Remaining',   value: fmt(remaining), alert: remaining < 0 },
        { label: 'Over budget', value: overCount,      alert: overCount > 0 },
      ],
    });
  } catch (err) {
    console.error('/widget error:', err);
    res.json({ title: 'Budget', status: 'error', summary: 'Could not read budget', metrics: [] });
  }
});

app.get('/api/budget', async (_req, res) => {
  if (!ready) { res.status(503).json({ error: initError ?? 'Not ready' }); return; }

  try {
    const data = await (api as any).getBudgetMonth(currentMonth());

    const groups = (data.groupList ?? [])
      .filter((g: any) => !g.is_income)
      .map((g: any) => ({
        id:         g.id,
        name:       g.name,
        budgeted:   g.budgeted   ?? 0,
        spent:      Math.abs(g.spent ?? 0),
        balance:    g.balance    ?? 0,
        categories: (g.categories ?? []).map((c: any) => ({
          id:       c.id,
          name:     c.name,
          budgeted: c.budgeted ?? 0,
          spent:    Math.abs(c.spent ?? 0),
          balance:  c.balance  ?? 0,
        })),
      }));

    res.json({ month: currentMonth(), groups, toBudget: data.toBudget ?? 0 });
  } catch (err) {
    console.error('/api/budget error:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/accounts', async (_req, res) => {
  if (!ready) { res.status(503).json({ error: initError ?? 'Not ready' }); return; }

  try {
    const accounts = ((await (api as any).getAccounts()) as any[])
      .filter((a: any) => !a.closed)
      .map((a: any) => ({
        id:        a.id,
        name:      a.name,
        type:      a.type      ?? 'other',
        on_budget: a.on_budget ?? true,
        balance:   a.balance   ?? 0,
      }));

    res.json(accounts);
  } catch (err) {
    console.error('/api/accounts error:', err);
    res.status(500).json({ error: String(err) });
  }
});

const STATIC = path.join(__dirname, 'static');
app.use(express.static(STATIC));
app.get('*', (_req, res) => res.sendFile(path.join(STATIC, 'index.html')));

app.listen(8080, () => {
  console.log('actual-sat listening on :8080');
  initialize().catch(console.error);
});
