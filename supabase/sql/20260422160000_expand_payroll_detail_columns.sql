alter table public.payroll_runs
  add column if not exists family_deduction_amount numeric(14, 2) not null default 11000000,
  add column if not exists dependent_deduction_amount numeric(14, 2) not null default 4400000;

alter table public.payroll_lines
  add column if not exists lunch_allowance numeric(14, 2) not null default 0,
  add column if not exists fuel_allowance numeric(14, 2) not null default 0,
  add column if not exists phone_allowance numeric(14, 2) not null default 0,
  add column if not exists holiday_bonus numeric(14, 2) not null default 0,
  add column if not exists sales_bonus numeric(14, 2) not null default 0,
  add column if not exists social_insurance numeric(14, 2) not null default 0,
  add column if not exists health_insurance numeric(14, 2) not null default 0,
  add column if not exists unemployment_insurance numeric(14, 2) not null default 0,
  add column if not exists dependent_count int not null default 0,
  add column if not exists advance_payment numeric(14, 2) not null default 0,
  add column if not exists total_allowance numeric(14, 2) not null default 0,
  add column if not exists total_income numeric(14, 2) not null default 0,
  add column if not exists total_insurance numeric(14, 2) not null default 0,
  add column if not exists taxable_income numeric(14, 2) not null default 0,
  add column if not exists personal_income_tax numeric(14, 2) not null default 0,
  add column if not exists total_deduction numeric(14, 2) not null default 0;

update public.payroll_runs
set
  family_deduction_amount = coalesce(family_deduction_amount, 11000000),
  dependent_deduction_amount = coalesce(dependent_deduction_amount, 4400000);

update public.payroll_lines
set
  lunch_allowance = case when lunch_allowance = 0 and allowance > 0 then allowance else lunch_allowance end,
  advance_payment = case when advance_payment = 0 and deduction > 0 then deduction else advance_payment end,
  total_allowance = case when total_allowance = 0 then allowance else total_allowance end,
  total_income = case when total_income = 0 then gross_salary + coalesce(allowance, 0) else total_income end,
  total_insurance = case when total_insurance = 0 then social_insurance + health_insurance + unemployment_insurance else total_insurance end,
  taxable_income = case when taxable_income = 0 then greatest(0, gross_salary + coalesce(allowance, 0) - (social_insurance + health_insurance + unemployment_insurance) - 11000000) else taxable_income end,
  personal_income_tax = case when personal_income_tax = 0 then 0 else personal_income_tax end,
  total_deduction = case when total_deduction = 0 then deduction else total_deduction end;
