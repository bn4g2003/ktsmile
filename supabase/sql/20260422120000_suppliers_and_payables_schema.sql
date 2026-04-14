-- Phase 1: tách NCC khỏi partners, bổ sung công nợ phải trả NCC

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  representative_name text,
  phone text,
  address text,
  tax_id text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

comment on table public.suppliers is 'Danh mục nhà cung cấp (đã tách khỏi partners)';

alter table public.stock_documents
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null;

alter table public.cash_transactions
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null;

create index if not exists stock_documents_supplier_id_idx on public.stock_documents (supplier_id);
create index if not exists cash_transactions_supplier_id_idx on public.cash_transactions (supplier_id);

create table if not exists public.supplier_opening_balances (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  year smallint not null check (year >= 2000 and year <= 2100),
  month smallint not null check (month >= 1 and month <= 12),
  opening_balance numeric(14, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, year, month)
);

create trigger supplier_opening_balances_set_updated_at
  before update on public.supplier_opening_balances
  for each row execute function public.set_updated_at();

-- Tổng nhập kho theo NCC theo tháng (phát sinh tăng phải trả)
create or replace view public.v_supplier_inbound_by_month as
select
  d.supplier_id,
  date_trunc('month', d.document_date::timestamp)::date as month,
  sum(coalesce(sl.line_amount, round(sl.quantity * sl.unit_price, 2)))::numeric(14, 2) as inbound_amount
from public.stock_documents d
join public.stock_lines sl on sl.document_id = d.id
where d.movement_type = 'inbound'
  and d.supplier_id is not null
group by d.supplier_id, date_trunc('month', d.document_date::timestamp)::date;

-- Tổng chi NCC theo tháng (phát sinh giảm phải trả)
create or replace view public.v_supplier_payments_by_month as
select
  c.supplier_id,
  date_trunc('month', c.transaction_date::timestamp)::date as month,
  sum(c.amount)::numeric(14, 2) as payment_amount
from public.cash_transactions c
where c.direction = 'payment'
  and c.supplier_id is not null
group by c.supplier_id, date_trunc('month', c.transaction_date::timestamp)::date;

comment on view public.v_supplier_inbound_by_month is
  'PS tăng công nợ NCC theo tháng từ phiếu nhập kho (mọi phiếu inbound có supplier_id). '
  'Nếu DB đã có cột stock_documents.posting_status, nên thay view để chỉ tính posting_status = posted.';

comment on view public.v_supplier_payments_by_month is
  'PS giảm công nợ NCC theo tháng từ sổ quỹ (direction=payment)';
