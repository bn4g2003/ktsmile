-- Nguyên vật liệu / SP: phạm vi dùng (kho vs bán) + liên kết NCC (mã NCC, giá tham chiếu, NCC chính)

-- Đảm bảo posting_status tồn tại (view v_product_stock cần cột này; DB chưa chạy 20260417120000 vẫn migrate được)
alter table public.stock_documents
  add column if not exists posting_status text not null default 'posted';

alter table public.stock_documents
  drop constraint if exists stock_documents_posting_status_check;

alter table public.stock_documents
  add constraint stock_documents_posting_status_check
  check (posting_status in ('draft', 'posted'));

create index if not exists stock_documents_posting_status_idx
  on public.stock_documents (posting_status);

alter table public.products
  add column if not exists product_usage text not null default 'both';

alter table public.products
  drop constraint if exists products_product_usage_check;

alter table public.products
  add constraint products_product_usage_check
  check (product_usage in ('both', 'inventory', 'sales'));

comment on column public.products.product_usage is
  'both = vừa kho vừa bán; inventory = chủ yếu NVL/kho; sales = chủ yếu đơn hàng/labo';

create table if not exists public.product_suppliers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  supplier_sku text,
  reference_purchase_price numeric(14, 2) check (reference_purchase_price is null or reference_purchase_price >= 0),
  lead_time_days smallint check (lead_time_days is null or lead_time_days >= 0),
  notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, supplier_id)
);

create unique index if not exists product_suppliers_one_primary_per_product
  on public.product_suppliers (product_id)
  where is_primary;

create index if not exists product_suppliers_supplier_id_idx on public.product_suppliers (supplier_id);

create trigger product_suppliers_set_updated_at
  before update on public.product_suppliers
  for each row execute function public.set_updated_at();

comment on table public.product_suppliers is
  'NVL/SP mua từ NCC: mã hàng NCC, giá mua tham chiếu, NCC chính (một dòng is_primary / SP)';

-- Thay đổi cột view: PG không cho CREATE OR REPLACE khi thêm/lệch cột (42P16) — drop rồi tạo lại
drop view if exists public.v_products_admin_grid;
drop view if exists public.v_product_stock;

-- Tồn kho + NCC chính (dùng lưới tồn kho & đối chiếu phiếu nhập)
create view public.v_product_stock as
select
  p.id as product_id,
  p.code as product_code,
  p.name as product_name,
  p.unit,
  p.product_usage,
  coalesce(
    sum(
      case
        when d.movement_type = 'inbound' then sl.quantity
        when d.movement_type = 'outbound' then -sl.quantity
      end
    ),
    0
  )::numeric(14, 4) as quantity_on_hand,
  ps.supplier_id as primary_supplier_id,
  s.code as primary_supplier_code,
  s.name as primary_supplier_name
from public.products p
left join public.stock_lines sl on sl.product_id = p.id
left join public.stock_documents d
  on d.id = sl.document_id
  and d.posting_status = 'posted'
left join lateral (
  select ps2.supplier_id
  from public.product_suppliers ps2
  where ps2.product_id = p.id
    and ps2.is_primary
  limit 1
) ps on true
left join public.suppliers s on s.id = ps.supplier_id
group by p.id, p.code, p.name, p.unit, p.product_usage, ps.supplier_id, s.code, s.name;

comment on view public.v_product_stock is
  'Tồn kho = nhập − xuất (chỉ phiếu posting_status = posted); product_usage + NCC chính từ product_suppliers';

-- Lưới danh mục SP/NVL (đọc-only; insert/update vẫn qua bảng products)
create view public.v_products_admin_grid as
select
  p.id,
  p.code,
  p.name,
  p.unit,
  p.unit_price,
  p.warranty_years,
  p.is_active,
  p.product_usage,
  p.created_at,
  p.updated_at,
  coalesce(v.quantity_on_hand, 0)::numeric(14, 4) as quantity_on_hand,
  v.primary_supplier_id,
  v.primary_supplier_code,
  v.primary_supplier_name,
  coalesce(
    (select count(*)::int from public.product_suppliers x where x.product_id = p.id),
    0
  ) as supplier_link_count
from public.products p
left join public.v_product_stock v on v.product_id = p.id;

comment on view public.v_products_admin_grid is
  'Danh sách SP/NVL cho admin: tồn kho, NCC chính, số liên kết NCC';
