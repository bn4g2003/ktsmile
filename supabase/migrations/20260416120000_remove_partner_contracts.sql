-- Gỡ tính năng hợp đồng / liên kết phiếu thu (partner_contracts, contract_id).

alter table public.cash_transactions
  drop column if exists contract_id;

drop table if exists public.partner_contracts;
