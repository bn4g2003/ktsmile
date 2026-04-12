-- Bổ sung trường theo form «Đơn hàng Sản xuất» phổ biến (labo nha khoa)

-- ---------------------------------------------------------------------------
-- Đơn: người gửi, BN, loại hàng, mốc thời gian, chỉ định, viền, ghi chú, phụ kiện
-- ---------------------------------------------------------------------------
alter table public.lab_orders
  add column if not exists sender_name text;

alter table public.lab_orders
  add column if not exists sender_phone text;

alter table public.lab_orders
  add column if not exists delivery_address text;

alter table public.lab_orders
  add column if not exists patient_age smallint
    check (patient_age is null or (patient_age >= 0 and patient_age <= 150));

alter table public.lab_orders
  add column if not exists patient_gender text;

do $g$
begin
  alter table public.lab_orders
    add constraint lab_orders_patient_gender_check
    check (patient_gender is null or patient_gender in ('male', 'female', 'unspecified'));
exception
  when duplicate_object then null;
end
$g$;

alter table public.lab_orders
  add column if not exists order_category text not null default 'new_work';

do $oc$
begin
  alter table public.lab_orders
    add constraint lab_orders_order_category_check
    check (order_category in ('new_work', 'warranty', 'repair'));
exception
  when duplicate_object then null;
end
$oc$;

comment on column public.lab_orders.order_category is 'Loại hàng đơn: mới / bảo hành / sửa chữa';

alter table public.lab_orders
  add column if not exists due_completion_at timestamptz;

alter table public.lab_orders
  add column if not exists due_delivery_at timestamptz;

alter table public.lab_orders
  add column if not exists clinical_indication text;

alter table public.lab_orders
  add column if not exists margin_above_gingiva boolean not null default false;

alter table public.lab_orders
  add column if not exists margin_at_gingiva boolean not null default false;

alter table public.lab_orders
  add column if not exists margin_subgingival boolean not null default false;

alter table public.lab_orders
  add column if not exists margin_shoulder boolean not null default false;

alter table public.lab_orders
  add column if not exists notes_accounting text;

alter table public.lab_orders
  add column if not exists notes_coordination text;

alter table public.lab_orders
  add column if not exists accessories jsonb not null default '{}'::jsonb;

comment on column public.lab_orders.accessories is 'Phụ kiện kèm đơn (JSON: mã -> số lượng, ví dụ opposing_arch)';

-- ---------------------------------------------------------------------------
-- Dòng đơn: Rời / Cầu (đơn vị cầu nối)
-- ---------------------------------------------------------------------------
alter table public.lab_order_lines
  add column if not exists arch_connection text not null default 'unit';

do $ac$
begin
  alter table public.lab_order_lines
    add constraint lab_order_lines_arch_connection_check
    check (arch_connection in ('unit', 'bridge'));
exception
  when duplicate_object then null;
end
$ac$;

comment on column public.lab_order_lines.arch_connection is 'unit = răng rời; bridge = cầu';
