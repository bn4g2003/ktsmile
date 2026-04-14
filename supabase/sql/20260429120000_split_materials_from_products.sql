-- Phase tách bảng: NVL sang materials (safe dual-write), giữ products cho bán.
-- Không xóa products cũ để tránh gãy FK hiện hữu (stock_lines/lab_order_lines...).

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  legacy_product_id uuid unique references public.products (id) on delete set null,
  code text not null unique,
  name text not null,
  unit text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists materials_set_updated_at on public.materials;
create trigger materials_set_updated_at
  before update on public.materials
  for each row execute function public.set_updated_at();

comment on table public.materials is
  'Danh mục nguyên vật liệu tách riêng khỏi products; legacy_product_id dùng map an toàn giai đoạn chuyển đổi';

insert into public.materials (legacy_product_id, code, name, unit, is_active, created_at, updated_at)
select p.id, p.code, p.name, p.unit, p.is_active, p.created_at, p.updated_at
from public.products p
where p.product_usage in ('inventory', 'both')
on conflict (legacy_product_id) do update
set
  code = excluded.code,
  name = excluded.name,
  unit = excluded.unit,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.material_suppliers (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  supplier_sku text,
  reference_purchase_price numeric(14, 2) check (reference_purchase_price is null or reference_purchase_price >= 0),
  lead_time_days smallint check (lead_time_days is null or lead_time_days >= 0),
  notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (material_id, supplier_id)
);

create unique index if not exists material_suppliers_one_primary_per_material
  on public.material_suppliers (material_id)
  where is_primary;

create index if not exists material_suppliers_supplier_id_idx on public.material_suppliers (supplier_id);

drop trigger if exists material_suppliers_set_updated_at on public.material_suppliers;
create trigger material_suppliers_set_updated_at
  before update on public.material_suppliers
  for each row execute function public.set_updated_at();

insert into public.material_suppliers (
  material_id, supplier_id, supplier_sku, reference_purchase_price, lead_time_days, notes, is_primary, created_at, updated_at
)
select
  m.id,
  ps.supplier_id,
  ps.supplier_sku,
  ps.reference_purchase_price,
  ps.lead_time_days,
  ps.notes,
  ps.is_primary,
  ps.created_at,
  ps.updated_at
from public.product_suppliers ps
join public.materials m on m.legacy_product_id = ps.product_id
on conflict (material_id, supplier_id) do update
set
  supplier_sku = excluded.supplier_sku,
  reference_purchase_price = excluded.reference_purchase_price,
  lead_time_days = excluded.lead_time_days,
  notes = excluded.notes,
  is_primary = excluded.is_primary,
  updated_at = now();

drop view if exists public.v_material_stock;
create view public.v_material_stock as
select
  m.id as material_id,
  m.legacy_product_id as product_id,
  m.code as material_code,
  m.name as material_name,
  m.unit,
  coalesce(
    sum(
      case
        when d.movement_type = 'inbound' then sl.quantity
        when d.movement_type = 'outbound' then -sl.quantity
      end
    ),
    0
  )::numeric(14, 4) as quantity_on_hand,
  ms.supplier_id as primary_supplier_id,
  s.code as primary_supplier_code,
  s.name as primary_supplier_name
from public.materials m
left join public.stock_lines sl on sl.product_id = m.legacy_product_id
left join public.stock_documents d on d.id = sl.document_id and d.posting_status = 'posted'
left join lateral (
  select ms2.supplier_id
  from public.material_suppliers ms2
  where ms2.material_id = m.id and ms2.is_primary
  limit 1
) ms on true
left join public.suppliers s on s.id = ms.supplier_id
group by m.id, m.legacy_product_id, m.code, m.name, m.unit, ms.supplier_id, s.code, s.name;

comment on view public.v_material_stock is
  'Tồn kho NVL từ materials (map legacy_product_id -> stock_lines.product_id), chỉ phiếu posted';
