-- Add cash account opening balance table
-- ===========================================================================
create table public.cash_account_opening_balances (
  id uuid primary key default gen_random_uuid(),
  payment_channel text not null,
  year integer not null check (year >= 1900),
  month integer not null check (month >= 1 and month <= 12),
  opening_balance numeric(14, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_channel, year, month)
);

create index cash_account_opening_balances_channel_year_month_idx 
  on public.cash_account_opening_balances (payment_channel, year, month);

create trigger cash_account_opening_balances_set_updated_at
  before update on public.cash_account_opening_balances
  for each row execute function public.set_updated_at();

comment on table public.cash_account_opening_balances is 'Số dư đầu kỳ của các tài khoản quỹ';
comment on column public.cash_account_opening_balances.payment_channel is 'cash, mbbank, acb, ...';
comment on column public.cash_account_opening_balances.opening_balance is 'Số dư đầu kỳ';