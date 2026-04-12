-- Phiếu chỉ định BS, kiểm tra điều phối, giảm giá VNĐ từng dòng, giấy báo thanh toán, phiếu thu (người nộp)

-- ---------------------------------------------------------------------------
-- Phiếu chỉ định gốc (bác sĩ) — đối chiếu với đơn điều phối nhập
-- ---------------------------------------------------------------------------
create table if not exists public.doctor_prescriptions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete restrict,
  slip_date date not null default (current_date),
  slip_code text,
  patient_name text not null,
  clinic_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists doctor_prescriptions_slip_code_key
  on public.doctor_prescriptions (slip_code)
  where slip_code is not null and length(trim(slip_code)) > 0;

create index if not exists doctor_prescriptions_partner_id_idx on public.doctor_prescriptions (partner_id);
create index if not exists doctor_prescriptions_slip_date_idx on public.doctor_prescriptions (slip_date desc);

drop trigger if exists doctor_prescriptions_set_updated_at on public.doctor_prescriptions;
create trigger doctor_prescriptions_set_updated_at
  before update on public.doctor_prescriptions
  for each row execute function public.set_updated_at();

comment on table public.doctor_prescriptions is 'Phiếu chỉ định / chỉ định gốc của bác sĩ — đối chiếu với lab_orders';

create table if not exists public.doctor_prescription_lines (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.doctor_prescriptions (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  tooth_positions text not null,
  shade text,
  tooth_count integer check (tooth_count is null or tooth_count >= 0),
  quantity numeric(10, 2) not null check (quantity > 0),
  work_type public.lab_order_line_work_type not null default 'new_work',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists doctor_prescription_lines_rx_idx on public.doctor_prescription_lines (prescription_id);

-- ---------------------------------------------------------------------------
-- Đơn hàng: liên kết phiếu BS, trạng thái kiểm tra điều phối, điều chỉnh xuất GBTT
-- ---------------------------------------------------------------------------
alter table public.lab_orders
  add column if not exists doctor_prescription_id uuid references public.doctor_prescriptions (id) on delete set null;

alter table public.lab_orders
  add column if not exists coord_review_status text;

update public.lab_orders
set coord_review_status = 'verified'
where coord_review_status is null;

alter table public.lab_orders
  alter column coord_review_status set default 'pending';

alter table public.lab_orders
  alter column coord_review_status set not null;

do $c$
begin
  alter table public.lab_orders
    add constraint lab_orders_coord_review_status_check
    check (coord_review_status in ('pending', 'verified'));
exception
  when duplicate_object then null;
end
$c$;

comment on column public.lab_orders.coord_review_status is 'pending = chờ điều phối đối chiếu; verified = đã duyệt khớp / điều chỉnh xong';
comment on column public.lab_orders.doctor_prescription_id is 'Phiếu chỉ định gốc dùng đối chiếu (nếu có)';

-- Hàng cũ: đã null → verified; đơn mới (sau khi đổi default) mặc định pending.

alter table public.lab_orders
  add column if not exists coord_reviewed_at timestamptz;

create index if not exists lab_orders_coord_review_idx on public.lab_orders (coord_review_status, received_at desc);

alter table public.lab_orders
  add column if not exists billing_order_discount_percent numeric(5, 2) not null default 0
    check (billing_order_discount_percent >= 0 and billing_order_discount_percent <= 100);

alter table public.lab_orders
  add column if not exists billing_order_discount_amount numeric(14, 2) not null default 0
    check (billing_order_discount_amount >= 0);

alter table public.lab_orders
  add column if not exists billing_other_fees numeric(14, 2) not null default 0;

alter table public.lab_orders
  add column if not exists payment_notice_doc_number text;

alter table public.lab_orders
  add column if not exists payment_notice_issued_at timestamptz;

do $u$
begin
  alter table public.lab_orders
    add constraint lab_orders_payment_notice_doc_number_key unique (payment_notice_doc_number);
exception
  /* unique → tạo index; lần chạy lại thường báo 42P07 duplicate_table, không phải 42710 duplicate_object */
  when duplicate_object then null;
  when duplicate_table then null;
end
$u$;

comment on column public.lab_orders.billing_other_fees is 'Chi phí khác cộng vào giấy báo thanh toán (VD: ship, phụ phí)';
comment on column public.lab_orders.payment_notice_doc_number is 'Số giấy báo thanh toán (cấp khi xác nhận xuất)';

-- ---------------------------------------------------------------------------
-- Dòng đơn: thêm giảm giá cố định VNĐ (cộng với %)
-- (drop view trước vì phụ thuộc cột line_amount)
-- ---------------------------------------------------------------------------
drop view if exists public.v_orders_by_partner_month;
drop view if exists public.v_partner_order_totals;

alter table public.lab_order_lines
  add column if not exists discount_amount numeric(14, 2) not null default 0
    check (discount_amount >= 0);

alter table public.lab_order_lines drop column if exists line_amount;

alter table public.lab_order_lines
  add column line_amount numeric(14, 2) generated always as (
    round(
      quantity * unit_price * (1 - discount_percent / 100.0) - discount_amount,
      2
    )
  ) stored;

do $chk$
begin
  alter table public.lab_order_lines
    add constraint lab_order_lines_line_amount_nonneg check (line_amount >= 0);
exception
  when duplicate_object then null;
end
$chk$;

comment on column public.lab_order_lines.discount_amount is 'Giảm giá cố định VNĐ trên dòng (sau khi áp dụng % CK)';

create or replace view public.v_partner_order_totals as
select
  lo.partner_id,
  sum(lol.line_amount) as total_order_amount
from public.lab_orders lo
join public.lab_order_lines lol on lol.order_id = lo.id
where lo.status <> 'cancelled'
group by lo.partner_id;

create or replace view public.v_orders_by_partner_month as
select
  lo.partner_id,
  date_trunc('month', lo.received_at) as month,
  sum(lol.line_amount) as order_amount
from public.lab_orders lo
join public.lab_order_lines lol on lol.order_id = lo.id
where lo.status <> 'cancelled'
group by lo.partner_id, date_trunc('month', lo.received_at);

comment on view public.v_partner_order_totals is 'Tổng giá trị đơn (theo partner) để đối chiếu công nợ';
comment on view public.v_orders_by_partner_month is 'Giá trị đơn theo partner và tháng (received_at)';

-- ---------------------------------------------------------------------------
-- Sổ quỹ: người nộp tiền (phiếu thu)
-- ---------------------------------------------------------------------------
alter table public.cash_transactions
  add column if not exists payer_name text;

comment on column public.cash_transactions.payer_name is 'Người nộp tiền (ghi trên phiếu thu)';
