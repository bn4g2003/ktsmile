-- Đơn phục hình: tên nha khoa nhập tay; dòng đơn: số răng + làm mới / bảo hành

alter table public.lab_orders
  add column if not exists clinic_name text;

comment on column public.lab_orders.clinic_name is
  'Tên nha khoa / phòng khám trên đơn (nhập tay). Khách hàng (đối tác) chọn từ danh mục.';

do $m$
begin
  create type public.lab_order_line_work_type as enum ('new_work', 'warranty');
exception
  when duplicate_object then null;
end
$m$;

alter table public.lab_order_lines
  add column if not exists tooth_count integer
  check (tooth_count is null or tooth_count >= 0);

alter table public.lab_order_lines
  add column if not exists work_type public.lab_order_line_work_type not null default 'new_work';

comment on column public.lab_order_lines.tooth_count is 'Số răng (bổ sung cho vị trí / SL hàng).';
comment on column public.lab_order_lines.work_type is 'Làm mới hoặc bảo hành.';
