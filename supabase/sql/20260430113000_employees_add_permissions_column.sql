alter table public.employees
  add column if not exists permissions text;

comment on column public.employees.permissions is
  'Quyền hạn chi tiết của nhân sự (mô tả text).';
