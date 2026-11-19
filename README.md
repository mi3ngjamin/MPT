# MPT

MPT is a personal finance app for one owner. It replaces a spreadsheet for brokerage accounts and a checking register. Portfolios can belong to the owner or be kept out of net worth. The investment ledger is the only source of positions and cash. Checking is cash flow, not a budget.

The app is a Vite + React + TypeScript client. Data lives in Supabase with row level security. It is deployed to GitHub Pages from `main`.

## Local development

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:5173/MPT/`. The Vite `base` is `/MPT/` so the dev server uses that path too.

`?demo=1` loads sample books and skips sign-in. Sample numbers are fake.

```bash
npm run lint
npm run build
npm run preview
```

Optional environment variables:

| Name | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL. Defaults to the public project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable client key. Safe to ship in the browser. |
| `VITE_FINNHUB_API_KEY` | Live stock and ETF quotes. Without it, last-known and manual prices still work. |

Copy those into `.env.local` if you do not want the built-in defaults. Do not put a service-role key anywhere in this app.

### Sign-in

The owner signs in with an email magic link or with email and password. Magic link calls `signInWithOtp` with `shouldCreateUser: false`, so unknown emails are rejected. Create the user in the Supabase dashboard first.

In Authentication → URL configuration, set the site URL and an additional redirect URL to:

- `https://mi3ngjamin.github.io/MPT/`
- `http://localhost:5173/MPT/` for local development

The client uses the implicit flow and reads tokens from the URL before the hash router starts, so a magic-link redirect does not 404 on GitHub Pages.

## Database

Migrations are in `supabase/migrations/` and must be applied in filename order:

1. `20261120010000_helpers.sql`
2. `20261120010100_investments.sql`
3. `20261120010200_prices.sql`
4. `20261120010300_checking.sql`
5. `20261120010400_liabilities_and_prefs.sql`
6. `20261120010500_finalize.sql`

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261120010000_helpers.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261120010100_investments.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261120010200_prices.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261120010300_checking.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261120010400_liabilities_and_prefs.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261120010500_finalize.sql
```

They are written to be re-run: tables use `if not exists`, and policies are dropped before they are created. The last file drops the migration helper. `scripts/auth-stub.sql` is only for a local Postgres that does not have Supabase's `auth` schema. Do not run it on the hosted project.

`scripts/verify-migrations.sh` applies the set twice to a throwaway local database and checks that each table has RLS, that `anon` has no grants, and that one user cannot read or spoof another user's rows.

Every table has `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, RLS enabled, and select/insert/update/delete policies limited to that user. `authenticated` is granted those four privileges explicitly. Money and quantities are `numeric`.

### Tables

- `portfolios` — name, `include_in_net_worth`, sort order.
- `accounts` — portfolio, name, `account_type` (`brokerage`, `retirement`, `crypto`, `other`), `tax_treatment` (`taxable`, `tax_deferred`, `tax_free`). Cash is not stored.
- `activities` — the investment ledger. See the rules below.
- `tax_lots` — reserved for a future specific-lot method. The app does not write it.
- `quotes` — Finnhub or manual prices, with `fetched_at`. Unique on user, symbol, and source.
- `what_if_prices` — one hypothetical price per symbol.
- `price_scenarios` and `price_scenario_prices` — named sets of what-if prices.
- `modeled_buys` — a saved buy-more amount per account and symbol.
- `checking_accounts` — name, opening balance, opening date, optional low-balance floor.
- `checking_transactions` — signed amount, category, cleared flag, optional recurring link.
- `recurring_items` — bills and income. Cadence is monthly, every N weeks, yearly, or once.
- `recurring_occurrences` — a paid or skipped date, optionally linked to a transaction.
- `liabilities` — name, type, balance owed, as-of date, include flag, unresolved flag.
- `net_worth_snapshots` — point-in-time totals saved from Settings.
- `preferences` — price mode, theme, legacy-import status, projection length, active scenario. The primary key is `user_id`.

## Engine rules

Activity rows are sorted by date, then `created_at`, then action priority when timestamps tie (openings before trades), then id. Dates are calendar dates, never UTC midnight.

- **Buy:** quantity increases, basis increases by `qty × price × multiplier + fees`, cash decreases by the same amount. Nothing is realized.
- **Sell:** basis decreases by `qty × average cost`. Realized P/L is proceeds (`qty × price × multiplier − fees`) minus that basis. Selling more than the open quantity is flagged and still applied.
- **Buy to open** matches a buy. **Sell to close** matches a sell. The multiplier defaults to 100 for options.
- **Sell to open:** quantity goes negative, basis goes negative by the credit (`qty × price × multiplier − fees`), cash increases by that credit. Nothing is realized.
- **Buy to close:** realized P/L is the credit relieved minus the cost to close (`qty × price × multiplier + fees`).
- **Expire:** remaining contracts close at $0. A long realizes a loss of the remaining basis. A short realizes the remaining credit.
- **Assign / exercise:** premium is folded into the stock and is not realized on the option. A short put buys `multiplier × contracts` shares at the strike, and the premium reduces the share basis (`strike − premium per share`). A short call sells shares at the strike, and the premium is added to proceeds. A long call adds the premium to the new share basis. A long put subtracts the premium from sale proceeds. Option rows store underlying, expiry, strike, and right (`C` or `P`).
- **Opening position:** `amount` is the total cost basis (negative for a short). `price` is only a last-known fallback. Cash does not change.
- **Opening cash, contribution, withdrawal, dividend, interest, fee:** cash only. Dividends do not change basis.
- **Cash transfer:** moves cash to another account. It is not a contribution, a withdrawal, or a realized gain.
- **In-kind transfer:** moves quantity and pro-rata average-cost basis. No realized P/L.
- **Split:** `ratio` is new shares per old share. Quantity scales. Basis stays put.
- **Dividend reinvest:** books the cash dividend and the purchase. Omit `amount` and the dividend matches the purchase, so cash is unchanged before any difference you enter.
- **Adjustment:** adds `delta_quantity`, `delta_cost_basis`, and `delta_cash`. A note is required.
- **Negative cash** is flagged. The row is not rejected.
- **Prices:** a live Finnhub quote wins for stocks and ETFs, even when it is stale (older than 36 hours, which is flagged). Manual prices are explicit current prices for options, crypto, and anything without a live quote. Trade and opening prices are a last-known fallback and are flagged. A missing price stays blank and is left out of totals. It is never treated as $0. What-if mode uses a saved what-if price when one exists, then the same chain.

Average cost on a taxable account is labeled “not tax lot basis.”

Net worth is the invested value and cash of portfolios with `include_in_net_worth`, plus checking, minus liabilities that are included and resolved. If any liability is unresolved, the figure is labeled “Net worth before unresolved taxes/liabilities” and those balances are not subtracted.

## Seeding a user

The statements below use a psql variable. Run them as a role that bypasses RLS (the Supabase SQL editor does) after substituting the owner’s `auth.users.id`:

```bash
psql "$DATABASE_URL" -v user_id='00000000-0000-0000-0000-000000000000'
```

The app’s own inserts do not need `user_id` because it defaults to `auth.uid()`. In the SQL editor, replace `:'user_id'` with a quoted uuid literal.

```sql
-- Portfolios. Family books stay out of net worth.
insert into public.portfolios (id, user_id, name, include_in_net_worth, sort_order)
values
  ('11111111-1111-1111-1111-111111111111', :'user_id', 'Brokerage', true, 0),
  ('22222222-2222-2222-2222-222222222222', :'user_id', 'Retirement', true, 1),
  ('33333333-3333-3333-3333-333333333333', :'user_id', 'Family', false, 2);

insert into public.accounts (id, user_id, portfolio_id, name, account_type, tax_treatment, sort_order)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', :'user_id', '11111111-1111-1111-1111-111111111111', 'PCRA (SCHWAB)', 'brokerage', 'taxable', 0),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', :'user_id', '22222222-2222-2222-2222-222222222222', 'Roth IRA', 'retirement', 'tax_free', 0);

-- Opening cash, then an opening lot. amount is total cost basis. price is a fallback only.
insert into public.activities (user_id, account_id, activity_date, action, asset_type, amount, note)
values (:'user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '2024-01-02', 'opening_cash', 'cash', 1500.00, 'Cutover cash');

insert into public.activities (
  user_id, account_id, activity_date, action, asset_type, symbol, quantity, amount, price, multiplier, note
) values (
  :'user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '2024-01-02', 'opening_position', 'stock_etf',
  'VTI', 100, 25000.00, 250.00, 1, 'Cutover lot'
);

-- Later trades, a cash transfer, an in-kind transfer, and a split use the same table.
-- Buy: quantity, price, fees. Sell: quantity, price, fees.
-- Transfer: transfer_account_id, amount. In-kind: transfer_account_id, symbol, quantity.
-- Split: symbol, ratio (4 means 4-for-1).

-- Short put. Nothing is realized until it is closed, assigned, or expires.
insert into public.activities (
  user_id, account_id, activity_date, action, asset_type, symbol,
  quantity, price, fees, multiplier, underlying, expiry, strike, option_right
) values (
  :'user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '2024-06-01', 'sell_to_open', 'option',
  'EXAMPLE240621P00150000', 1, 2.50, 0.65, 100, 'EXAMPLE', '2024-06-21', 150, 'P'
);

insert into public.checking_accounts (user_id, name, opening_balance, opening_date, low_balance_floor)
values (:'user_id', 'Operating', 2500.00, '2024-01-01', 500.00);

insert into public.recurring_items (
  user_id, account_id, name, kind, amount, cadence, day_of_month, autopay, category
)
select :'user_id', id, 'Rent', 'bill', 1800.00, 'monthly', 1, true, 'Home'
from public.checking_accounts
where user_id = :'user_id' and name = 'Operating';

insert into public.liabilities (user_id, name, liability_type, balance, as_of, include_in_net_worth, unresolved, note)
values (:'user_id', 'Estimated tax', 'tax', 4200.00, '2024-04-01', true, true, 'Not final');
```

If `psql` variables are awkward, paste the uuid literal in place of `:'user_id'`.

## Old browser data

On the first real sign-in, if this browser still has `transactions`, `categories`, `investments`, `livePrices`, or `budgetItems`, MPT offers a one-click import. Trades become buy/sell rows under an Imported portfolio. The old `startingBalance` becomes the checking opening balance. Monthly budget rows become recurring items. Old live prices are imported as stale quotes, not as current typed prices. Trade prices stay on the activity and are only a fallback.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: Node 20, `npm ci`, lint, `npm test`, `npm run build`, then the `dist` folder is published to the `gh-pages` branch. The Finnhub key is the existing `REACT_APP_FINNHUB_API_KEY` secret, mapped to `VITE_FINNHUB_API_KEY`. The Supabase URL and publishable key are public build env values.

GitHub Pages serves the site at `https://mi3ngjamin.github.io/MPT/`. Routes use a hash (`#/investments`) so a refresh does not 404. `public/404.html` also sends any deep path back to `/MPT/`.
