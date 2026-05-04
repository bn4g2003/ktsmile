export type PayrollRunSettings = {
  standard_work_days: number;
  overtime_rate_per_hour: number;
  family_deduction_amount: number;
  dependent_deduction_amount: number;
};

export type PayrollLineInput = {
  lunch_allowance: number;
  fuel_allowance: number;
  phone_allowance: number;
  holiday_bonus: number;
  sales_bonus: number;
  social_insurance: number;
  health_insurance: number;
  unemployment_insurance: number;
  /**
   * true (mặc định): BHXH/BHYT/BHTN theo % lương CB.
   * false: dùng đúng ba số `social_insurance` / `health_insurance` / `unemployment_insurance` (đã chỉnh tay hoặc từ DB).
   */
  insurance_use_formula?: boolean;
  dependent_count: number;
  advance_payment: number;
  note?: string | null;
};

export type PayrollBaseRow = {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  position: string | null;
  department: string | null;
  base_salary: number;
  worked_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  overtime_hours: number;
  gross_salary: number;
  note: string | null;
};

export type PayrollComputedLine = PayrollBaseRow &
  PayrollRunSettings &
  PayrollLineInput & {
    total_allowance: number;
    total_income: number;
    total_insurance: number;
    taxable_income: number;
    personal_income_tax: number;
    total_deduction: number;
    net_salary: number;
  };

function toMoney(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Khấu trừ BH NLĐ trên lương cơ bản (BHXH 8%, BHYT 1,5%, BHTN 1%). */
const INSURANCE_ON_BASE = {
  social: 0.08,
  health: 0.015,
  unemployment: 0.01,
} as const;

/** % mặc định trên lương CB (đồng bộ với `INSURANCE_ON_BASE`). */
export const INSURANCE_DEFAULT_RATE_PERCENT = {
  social: INSURANCE_ON_BASE.social * 100,
  health: INSURANCE_ON_BASE.health * 100,
  unemployment: INSURANCE_ON_BASE.unemployment * 100,
} as const;

export function insuranceDeductionsFromBaseSalary(baseSalary: number) {
  const base = Math.max(0, Math.round(toMoney(baseSalary)));
  return {
    social_insurance: Math.round(base * INSURANCE_ON_BASE.social),
    health_insurance: Math.round(base * INSURANCE_ON_BASE.health),
    unemployment_insurance: Math.round(base * INSURANCE_ON_BASE.unemployment),
  };
}

export function calculatePersonalIncomeTax(taxableIncome: number): number {
  const taxable = Math.max(0, toMoney(taxableIncome));
  const bands: Array<[number, number]> = [
    [5_000_000, 0.05],
    [5_000_000, 0.1],
    [8_000_000, 0.15],
    [14_000_000, 0.2],
    [20_000_000, 0.25],
    [28_000_000, 0.3],
    [Number.POSITIVE_INFINITY, 0.35],
  ];

  let remaining = taxable;
  let tax = 0;
  for (const [width, rate] of bands) {
    if (remaining <= 0) break;
    const chunk = Math.min(remaining, width);
    tax += chunk * rate;
    remaining -= chunk;
  }
  return Math.round(tax);
}

export function calculatePayrollLine(
  row: PayrollBaseRow,
  settings: PayrollRunSettings,
  input: PayrollLineInput,
): PayrollComputedLine {
  const lunch_allowance = toMoney(input.lunch_allowance);
  const fuel_allowance = toMoney(input.fuel_allowance);
  const phone_allowance = toMoney(input.phone_allowance);
  const holiday_bonus = toMoney(input.holiday_bonus);
  const sales_bonus = toMoney(input.sales_bonus);
  const autoIns = insuranceDeductionsFromBaseSalary(row.base_salary);
  const useFormula = input.insurance_use_formula !== false;
  const social_insurance = useFormula
    ? autoIns.social_insurance
    : Math.max(0, Math.round(toMoney(input.social_insurance)));
  const health_insurance = useFormula
    ? autoIns.health_insurance
    : Math.max(0, Math.round(toMoney(input.health_insurance)));
  const unemployment_insurance = useFormula
    ? autoIns.unemployment_insurance
    : Math.max(0, Math.round(toMoney(input.unemployment_insurance)));
  const dependent_count = Math.max(0, Math.floor(toMoney(input.dependent_count)));
  const advance_payment = toMoney(input.advance_payment);
  const family_deduction_amount = Math.max(0, toMoney(settings.family_deduction_amount));
  const dependent_deduction_amount = Math.max(0, toMoney(settings.dependent_deduction_amount));

  const total_allowance = lunch_allowance + fuel_allowance + phone_allowance + holiday_bonus + sales_bonus;
  const total_income = row.gross_salary + total_allowance;
  const total_insurance = social_insurance + health_insurance + unemployment_insurance;
  const taxable_income = Math.max(
    0,
    total_income -
      total_insurance -
      family_deduction_amount -
      dependent_count * dependent_deduction_amount,
  );
  const personal_income_tax = calculatePersonalIncomeTax(taxable_income);
  const total_deduction = total_insurance + personal_income_tax + advance_payment;
  const net_salary = Math.round(total_income - total_deduction);

  return {
    ...row,
    ...settings,
    lunch_allowance,
    fuel_allowance,
    phone_allowance,
    holiday_bonus,
    sales_bonus,
    social_insurance,
    health_insurance,
    unemployment_insurance,
    dependent_count,
    advance_payment,
    note: input.note?.trim() ? input.note.trim() : null,
    total_allowance,
    total_income,
    total_insurance,
    taxable_income,
    personal_income_tax,
    total_deduction,
    net_salary,
  };
}
