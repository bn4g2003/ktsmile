-- Hợp đồng với đối tác + liên kết phiếu thu/chi (sổ quỹ)

create table public.partner_contracts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete restrict,
  contract_number text not null unique,
  title text not null,
  signed_date date,
  valid_from date not null default (current_date),
  valid_to date,
  status text not null default 'active'
    check (status in ('draft', 'active', 'closed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index partner_contracts_partner_id_idx on public.partner_contracts (partner_id);
create index partner_contracts_status_idx on public.partner_contracts (status);

create trigger partner_contracts_set_updated_at
  before update on public.partner_contracts
  for each row execute function public.set_updated_at();

comment on table public.partner_contracts is 'Hợp đồng khách/lab — phiếu thu có thể gắn contract_id';

alter table public.cash_transactions
  add column contract_id uuid references public.partner_contracts (id) on delete set null;

create index cash_transactions_contract_id_idx on public.cash_transactions (contract_id);

comment on column public.cash_transactions.contract_id is 'Hợp đồng liên quan (thường dùng cho phiếu thu)';
