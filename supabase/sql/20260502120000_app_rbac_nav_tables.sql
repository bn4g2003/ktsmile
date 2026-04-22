-- RBAC đơn giản cho sidebar: vai trò + danh sách path (trùng href trong AppShell).
-- App ưu tiên employees.app_role_id; nếu NULL thì vẫn dùng employees.permissions + NAV_PERMISSION_RULES trong code.

create table if not exists public.app_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger app_roles_set_updated_at
  before update on public.app_roles
  for each row execute function public.set_updated_at();

comment on table public.app_roles is 'Vai trò đăng nhập — gán cho nhân viên qua employees.app_role_id';

create table if not exists public.app_role_nav_paths (
  role_id uuid not null references public.app_roles (id) on delete cascade,
  path text not null,
  primary key (role_id, path),
  constraint app_role_nav_paths_path_check check (
    path = '*' or path ~ '^/[a-zA-Z0-9_./-]*$'
  )
);

create index if not exists app_role_nav_paths_role_id_idx on public.app_role_nav_paths (role_id);

comment on table public.app_role_nav_paths is 'Path được hiển thị trên sidebar; path = * nghĩa là toàn quyền menu (giống admin).';

alter table public.employees
  add column if not exists app_role_id uuid references public.app_roles (id) on delete set null;

create index if not exists employees_app_role_id_idx on public.employees (app_role_id);

comment on column public.employees.app_role_id is 'Khi có giá trị, sidebar lấy quyền từ app_role_nav_paths; khi NULL dùng cột permissions (preset) trong code.';

-- ---------------------------------------------------------------------------
-- Seed vai trò (code trùng với PERMISSION_PRESETS trong lib/auth/permission-presets.ts)
-- ---------------------------------------------------------------------------
insert into public.app_roles (code, name, description)
values
  ('admin', 'Admin (toàn quyền)', 'Tất cả mục menu'),
  ('manager', 'Quản lý vận hành', null),
  ('accountant', 'Kế toán', null),
  ('sales', 'Kinh doanh / CSKH', null),
  ('inventory', 'Kho', null),
  ('staff', 'Nhân viên cơ bản', null)
on conflict (code) do nothing;

-- Helper: gán path theo code vai trò
insert into public.app_role_nav_paths (role_id, path)
select r.id, v.path
from public.app_roles r
cross join lateral (values
  ('admin', '*')
) as v(code, path)
where r.code = v.code
on conflict do nothing;

insert into public.app_role_nav_paths (role_id, path)
select r.id, v.path
from public.app_roles r
cross join lateral (values
  ('manager', '/'),
  ('manager', '/master/partners'),
  ('manager', '/master/products'),
  ('manager', '/master/employees'),
  ('manager', '/orders'),
  ('manager', '/orders/review'),
  ('manager', '/inventory/documents'),
  ('manager', '/inventory/stock'),
  ('manager', '/accounting/revenue'),
  ('manager', '/accounting/sales'),
  ('manager', '/accounting/cash'),
  ('manager', '/accounting/debt'),
  ('manager', '/accounting/summary'),
  ('manager', '/hr/attendance'),
  ('manager', '/hr/payroll')
) as v(code, path)
where r.code = v.code
on conflict do nothing;

insert into public.app_role_nav_paths (role_id, path)
select r.id, v.path
from public.app_roles r
cross join lateral (values
  ('accountant', '/'),
  ('accountant', '/master/partners'),
  ('accountant', '/orders'),
  ('accountant', '/accounting/revenue'),
  ('accountant', '/accounting/sales'),
  ('accountant', '/accounting/cash'),
  ('accountant', '/accounting/debt'),
  ('accountant', '/accounting/summary'),
  ('accountant', '/hr/payroll')
) as v(code, path)
where r.code = v.code
on conflict do nothing;

insert into public.app_role_nav_paths (role_id, path)
select r.id, v.path
from public.app_roles r
cross join lateral (values
  ('sales', '/'),
  ('sales', '/master/partners'),
  ('sales', '/master/prices'),
  ('sales', '/orders'),
  ('sales', '/orders/review'),
  ('sales', '/accounting/revenue'),
  ('sales', '/accounting/sales'),
  ('sales', '/accounting/debt'),
  ('sales', '/accounting/summary')
) as v(code, path)
where r.code = v.code
on conflict do nothing;

insert into public.app_role_nav_paths (role_id, path)
select r.id, v.path
from public.app_roles r
cross join lateral (values
  ('inventory', '/'),
  ('inventory', '/master/products'),
  ('inventory', '/orders'),
  ('inventory', '/inventory/documents'),
  ('inventory', '/inventory/stock'),
  ('inventory', '/hr/attendance')
) as v(code, path)
where r.code = v.code
on conflict do nothing;

insert into public.app_role_nav_paths (role_id, path)
select r.id, v.path
from public.app_roles r
cross join lateral (values
  ('staff', '/'),
  ('staff', '/orders'),
  ('staff', '/hr/attendance')
) as v(code, path)
where r.code = v.code
on conflict do nothing;

-- Gán vai trò DB theo preset cũ (chạy sau seed; chỉ cập nhật khi app_role_id đang trống)
update public.employees e
set app_role_id = r.id
from public.app_roles r
where e.app_role_id is null
  and e.permissions is not null
  and trim(e.permissions) <> ''
  and r.code = trim(e.permissions);
