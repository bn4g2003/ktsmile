alter table public.employees
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists username text,
  add column if not exists password_plain text,
  add column if not exists notes text;

comment on column public.employees.username is
  'Tên đăng nhập nội bộ (nếu có), không thay thế auth_user_id';

comment on column public.employees.password_plain is
  'Mật khẩu lưu trực tiếp theo yêu cầu vận hành nội bộ.';
