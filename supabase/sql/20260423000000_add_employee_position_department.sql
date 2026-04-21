-- Add position and department to employees
-- ===========================================================================
alter table public.employees 
add column if not exists position text,
add column if not exists department text;

comment on column public.employees.position is 'Chức vụ';
comment on column public.employees.department is 'Bộ phận';