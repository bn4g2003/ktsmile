-- Backfill Phase 1: chuyển NCC từ partners sang suppliers + gắn lại chứng từ

create table if not exists public.partner_supplier_map (
  partner_id uuid primary key references public.partners (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.suppliers (
  code,
  name,
  representative_name,
  phone,
  address,
  tax_id,
  notes,
  is_active
)
select
  p.code,
  p.name,
  p.representative_name,
  p.phone,
  p.address,
  p.tax_id,
  p.notes,
  p.is_active
from public.partners p
where p.partner_type = 'supplier'
on conflict (code) do update
set
  name = excluded.name,
  representative_name = excluded.representative_name,
  phone = excluded.phone,
  address = excluded.address,
  tax_id = excluded.tax_id,
  notes = excluded.notes,
  is_active = excluded.is_active;

insert into public.partner_supplier_map (partner_id, supplier_id)
select p.id, s.id
from public.partners p
join public.suppliers s on s.code = p.code
where p.partner_type = 'supplier'
on conflict (partner_id) do update
set supplier_id = excluded.supplier_id;

update public.stock_documents d
set supplier_id = m.supplier_id
from public.partner_supplier_map m
where d.partner_id = m.partner_id
  and d.supplier_id is null;

update public.cash_transactions c
set supplier_id = m.supplier_id
from public.partner_supplier_map m
where c.partner_id = m.partner_id
  and c.supplier_id is null;
