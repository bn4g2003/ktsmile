create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null,
  status text not null check (status in ('present', 'half', 'paid_leave', 'unpaid_leave', 'absent')),
  overtime_hours numeric(6, 2) not null default 0 check (overtime_hours >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create index if not exists attendance_records_work_date_idx
  on public.attendance_records (work_date desc);

drop trigger if exists attendance_records_set_updated_at on public.attendance_records;
create trigger attendance_records_set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

comment on table public.attendance_records is
  'Chấm công theo ngày cho nhân sự';

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  year int not null check (year >= 2000 and year <= 2100),
  month int not null check (month >= 1 and month <= 12),
  standard_work_days numeric(5, 2) not null default 26 check (standard_work_days > 0),
  overtime_rate_per_hour numeric(14, 2) not null default 0 check (overtime_rate_per_hour >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);

drop trigger if exists payroll_runs_set_updated_at on public.payroll_runs;
create trigger payroll_runs_set_updated_at
  before update on public.payroll_runs
  for each row execute function public.set_updated_at();

create table if not exists public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete restrict,
  base_salary numeric(14, 2) not null default 0,
  worked_days numeric(6, 2) not null default 0,
  paid_leave_days numeric(6, 2) not null default 0,
  unpaid_leave_days numeric(6, 2) not null default 0,
  overtime_hours numeric(6, 2) not null default 0,
  allowance numeric(14, 2) not null default 0,
  deduction numeric(14, 2) not null default 0,
  gross_salary numeric(14, 2) not null default 0,
  net_salary numeric(14, 2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  unique (run_id, employee_id)
);

create index if not exists payroll_lines_run_id_idx on public.payroll_lines (run_id);
create index if not exists payroll_lines_employee_id_idx on public.payroll_lines (employee_id);

comment on table public.payroll_runs is
  'Header chốt lương theo tháng';
comment on table public.payroll_lines is
  'Chi tiết lương từng nhân viên theo payroll_runs';
