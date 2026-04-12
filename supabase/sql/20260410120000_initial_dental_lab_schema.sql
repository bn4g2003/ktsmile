-- Dental lab ERP: master + transactional schema (Supabase / PostgreSQL)
-- Naming: English identifiers; app layer can map labels to Vietnamese.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.partner_type as enum (
  'customer_clinic',
  'customer_labo',
  'supplier'
);

create type public.stock_movement_type as enum (
  'inbound',
  'outbound'
);

create type public.cash_direction as enum (
  'receipt',
  'payment'
);

create type public.lab_order_status as enum (
  'draft',
  'in_progress',
  'completed',
  'delivered',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- Updated-at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- Bảng 1 — Partners (khách hàng nha khoa / labo / nhà cung cấp)
-- ===========================================================================
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  partner_type public.partner_type not null,
  representative_name text,
  phone text,
  address text,
  tax_id text,
  default_discount_percent numeric(5, 2) default 0
    check (default_discount_percent >= 0 and default_discount_percent <= 100),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger partners_set_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

comment on table public.partners is 'Danh mục khách hàng (phòng khám/labo) và nhà cung cấp';

-- ===========================================================================
-- Bảng 2 — Products & materials
-- ===========================================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null,
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  warranty_years smallint check (warranty_years is null or warranty_years >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

comment on table public.products is 'Sản phẩm / vật tư (phôi sứ, cùi giả, vật liệu in 3D...)';

-- Giá bán theo từng khách (ưu tiên khi tạo đơn; không có thì fallback products.unit_price)
create table public.partner_product_prices (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, product_id)
);

create index partner_product_prices_partner_id_idx on public.partner_product_prices (partner_id);

create trigger partner_product_prices_set_updated_at
  before update on public.partner_product_prices
  for each row execute function public.set_updated_at();

comment on table public.partner_product_prices is 'Bảng giá riêng theo phòng khám/labo (override giá lẻ mặc định)';

-- ===========================================================================
-- Bảng 3 — Employees
-- ===========================================================================
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  role text not null,
  base_salary numeric(14, 2) not null default 0 check (base_salary >= 0),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

comment on table public.employees is 'Nhân sự — role dùng cho phân quyền đăng nhập sau này';

-- ===========================================================================
-- Bảng 4 — Lab orders (đơn phục hình) + dòng chi tiết
-- ===========================================================================
create table public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  received_at date not null default (current_date),
  partner_id uuid not null references public.partners (id) on delete restrict,
  patient_name text not null,
  status public.lab_order_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lab_orders_partner_id_idx on public.lab_orders (partner_id);
create index lab_orders_received_at_idx on public.lab_orders (received_at desc);

create trigger lab_orders_set_updated_at
  before update on public.lab_orders
  for each row execute function public.set_updated_at();

create table public.lab_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.lab_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  tooth_positions text not null,
  shade text,
  quantity numeric(10, 2) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  discount_percent numeric(5, 2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  line_amount numeric(14, 2) generated always as (
    round(quantity * unit_price * (1 - discount_percent / 100.0), 2)
  ) stored,
  notes text,
  created_at timestamptz not null default now()
);

create index lab_order_lines_order_id_idx on public.lab_order_lines (order_id);
create index lab_order_lines_product_id_idx on public.lab_order_lines (product_id);

comment on column public.lab_order_lines.tooth_positions is 'Ký hiệu răng, ví dụ 11-21, 45-47';
comment on column public.lab_order_lines.shade is 'Màu sứ, ví dụ A1, A2, 3M2';

-- ===========================================================================
-- Bảng 5 — Inventory documents (PNK / PXK) + dòng
-- ===========================================================================
create table public.stock_documents (
  id uuid primary key default gen_random_uuid(),
  document_number text not null unique,
  document_date date not null default (current_date),
  movement_type public.stock_movement_type not null,
  partner_id uuid references public.partners (id) on delete set null,
  reason text,
  notes text,
  posting_status text not null default 'posted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_documents_posting_status_check check (posting_status in ('draft', 'posted'))
);

comment on column public.stock_documents.posting_status is
  'draft = yêu cầu/chưa trừ tồn; posted = đã ghi nhận nhập−xuất';

create index stock_documents_document_date_idx on public.stock_documents (document_date desc);
create index stock_documents_movement_type_idx on public.stock_documents (movement_type);
create index stock_documents_posting_status_idx on public.stock_documents (posting_status);

create trigger stock_documents_set_updated_at
  before update on public.stock_documents
  for each row execute function public.set_updated_at();

create table public.stock_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.stock_documents (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity numeric(14, 4) not null check (quantity > 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  line_amount numeric(14, 2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now()
);

create index stock_lines_document_id_idx on public.stock_lines (document_id);
create index stock_lines_product_id_idx on public.stock_lines (product_id);

-- Tồn kho theo công thức: sum(nhập) - sum(xuất)
create or replace view public.v_product_stock as
select
  p.id as product_id,
  p.code as product_code,
  p.name as product_name,
  p.unit,
  coalesce(
    sum(
      case
        when d.movement_type = 'inbound' then sl.quantity
        when d.movement_type = 'outbound' then -sl.quantity
      end
    ),
    0
  )::numeric(14, 4) as quantity_on_hand
from public.products p
left join public.stock_lines sl on sl.product_id = p.id
left join public.stock_documents d
  on d.id = sl.document_id
  and d.posting_status = 'posted'
group by p.id, p.code, p.name, p.unit;

comment on view public.v_product_stock is
  'Tồn kho = tổng nhập − tổng xuất (chỉ phiếu posting_status = posted)';

-- ===========================================================================
-- Bảng 6 — Cashbook (sổ quỹ thu/chi)
-- ===========================================================================
create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default (current_date),
  doc_number text not null,
  payment_channel text not null,
  direction public.cash_direction not null,
  business_category text not null,
  amount numeric(14, 2) not null check (amount > 0),
  partner_id uuid references public.partners (id) on delete set null,
  description text,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_transactions_doc_number_key unique (doc_number)
);

create index cash_transactions_date_idx on public.cash_transactions (transaction_date desc);
create index cash_transactions_partner_id_idx on public.cash_transactions (partner_id);
create index cash_transactions_direction_idx on public.cash_transactions (direction);

create trigger cash_transactions_set_updated_at
  before update on public.cash_transactions
  for each row execute function public.set_updated_at();

comment on column public.cash_transactions.payment_channel is 'cash, mbbank, acb, ...';
comment on column public.cash_transactions.business_category is 'Thu bán hàng, Chi mua hàng, Chi hoa hồng, ...';
comment on column public.cash_transactions.reference_type is 'lab_order | stock_document | manual';

-- ===========================================================================
-- Công nợ — số dư đầu kỳ theo tháng (nhập tay); phát sinh lấy từ đơn & thu tiền
-- ===========================================================================
create table public.partner_opening_balances (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  year smallint not null check (year >= 2000 and year <= 2100),
  month smallint not null check (month >= 1 and month <= 12),
  opening_balance numeric(14, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, year, month)
);

create trigger partner_opening_balances_set_updated_at
  before update on public.partner_opening_balances
  for each row execute function public.set_updated_at();

-- Phát sinh phải thu từ đơn (chỉ tính đơn không hủy)
create or replace view public.v_partner_order_totals as
select
  lo.partner_id,
  sum(lol.line_amount) as total_order_amount
from public.lab_orders lo
join public.lab_order_lines lol on lol.order_id = lo.id
where lo.status <> 'cancelled'
group by lo.partner_id;

-- Thu từ khách (giảm công nợ) — điều chỉnh business_category trong app cho đúng nghiệp vụ
create or replace view public.v_partner_receipt_totals as
select
  partner_id,
  sum(amount) as total_receipts
from public.cash_transactions
where direction = 'receipt' and partner_id is not null
group by partner_id;

comment on view public.v_partner_order_totals is 'Tổng giá trị đơn (theo partner) để đối chiếu công nợ';
comment on view public.v_partner_receipt_totals is 'Tổng đã thu từ đối tác (theo partner)';

-- Báo cáo theo tháng: phát sinh bán (theo ngày nhận đơn) và đã thu
create or replace view public.v_orders_by_partner_month as
select
  lo.partner_id,
  date_trunc('month', lo.received_at) as month,
  sum(lol.line_amount) as order_amount
from public.lab_orders lo
join public.lab_order_lines lol on lol.order_id = lo.id
where lo.status <> 'cancelled'
group by lo.partner_id, date_trunc('month', lo.received_at);

create or replace view public.v_cash_by_partner_month as
select
  ct.partner_id,
  date_trunc('month', ct.transaction_date) as month,
  ct.direction,
  sum(ct.amount) as total_amount
from public.cash_transactions ct
where ct.partner_id is not null
group by ct.partner_id, date_trunc('month', ct.transaction_date), ct.direction;

comment on view public.v_orders_by_partner_month is 'Giá trị đơn theo partner và tháng (received_at)';
comment on view public.v_cash_by_partner_month is 'Thu/chi có đối tượng partner theo tháng';

-- ---------------------------------------------------------------------------
-- Helpful indexes for reporting
-- ---------------------------------------------------------------------------
create index lab_orders_status_idx on public.lab_orders (status);
