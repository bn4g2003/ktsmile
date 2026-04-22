import * as XLSX from "xlsx";
import type { PayrollRunDetailRow } from "@/lib/actions/payroll";

export type PayrollExcelPayload = {
  year: number;
  month: number;
  standardWorkDays: number;
  overtimeRatePerHour: number;
  rows: PayrollRunDetailRow[];
};

export function buildPayrollExcelBuffer(payload: PayrollExcelPayload): ArrayBuffer {
  const { year, month, standardWorkDays, overtimeRatePerHour, rows } = payload;
  const monthStr = String(month).padStart(2, "0");
  
  // Build header rows
  const header1 = [
    "BẢNG LƯƠNG",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ];
  const header2 = [
    `Tháng ${monthStr}/${year}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ];
  const header3 = [
    `Số ngày làm việc: ${standardWorkDays}`,
    `Lương OT: ${overtimeRatePerHour.toLocaleString("vi-VN")}/giờ`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ];
  
  // Column headers
  const colHeaders = [
    "STT",
    "Mã NV",
    "Họ tên",
    "Lương CB",
    "Ngày công",
    "Lương tính theo ngày công",
    "Phụ cấp ăn trưa",
    "Phụ cấp xăng/xe",
    "Phụ cấp điện thoại",
    "Thưởng lễ",
    "Thưởng theo doanh số",
    "Tổng thu nhập",
    "BHXH",
    "BHYT",
    "BHTN",
    "Tổng tiền BH",
    "Người phụ thuộc",
    "Giảm trừ gia cảnh",
    "Thu nhập chịu thuế",
    "Thuế TNCN",
    "Tạm ứng",
    "Thực lĩnh",
    "Ghi chú",
  ];
  
  // Data rows
  const dataRows = rows.map((r, idx) => [
    idx + 1,
    r.employee_code,
    r.employee_name,
    r.base_salary,
    r.worked_days,
    r.gross_salary,
    r.lunch_allowance,
    r.fuel_allowance,
    r.phone_allowance,
    r.holiday_bonus,
    r.sales_bonus,
    r.total_income,
    r.social_insurance,
    r.health_insurance,
    r.unemployment_insurance,
    r.total_insurance,
    r.dependent_count,
    r.family_deduction_amount,
    r.taxable_income,
    r.personal_income_tax,
    r.advance_payment,
    r.net_salary,
    r.note ?? "",
  ]);
  
  // Calculate totals
  const totals = rows.reduce(
    (acc, r) => ({
      base: acc.base + r.base_salary,
      worked: acc.worked + r.worked_days,
      gross: acc.gross + r.gross_salary,
      lunch: acc.lunch + r.lunch_allowance,
      fuel: acc.fuel + r.fuel_allowance,
      phone: acc.phone + r.phone_allowance,
      holiday: acc.holiday + r.holiday_bonus,
      sales: acc.sales + r.sales_bonus,
      totalIncome: acc.totalIncome + r.total_income,
      bhxh: acc.bhxh + r.social_insurance,
      bhyt: acc.bhyt + r.health_insurance,
      bhtn: acc.bhtn + r.unemployment_insurance,
      totalInsurance: acc.totalInsurance + r.total_insurance,
      dependents: acc.dependents + r.dependent_count,
      familyDeduction: acc.familyDeduction + r.family_deduction_amount,
      taxable: acc.taxable + r.taxable_income,
      tax: acc.tax + r.personal_income_tax,
      advance: acc.advance + r.advance_payment,
      net: acc.net + r.net_salary,
    }),
    {
      base: 0,
      worked: 0,
      gross: 0,
      lunch: 0,
      fuel: 0,
      phone: 0,
      holiday: 0,
      sales: 0,
      totalIncome: 0,
      bhxh: 0,
      bhyt: 0,
      bhtn: 0,
      totalInsurance: 0,
      dependents: 0,
      familyDeduction: 0,
      taxable: 0,
      tax: 0,
      advance: 0,
      net: 0,
    }
  );
  
  const totalRow = [
    "",
    "",
    "TỔNG CỘNG",
    totals.base,
    totals.worked,
    totals.gross,
    totals.lunch,
    totals.fuel,
    totals.phone,
    totals.holiday,
    totals.sales,
    totals.totalIncome,
    totals.bhxh,
    totals.bhyt,
    totals.bhtn,
    totals.totalInsurance,
    totals.dependents,
    totals.familyDeduction,
    totals.taxable,
    totals.tax,
    totals.advance,
    totals.net,
    "",
  ];
  
  // Combine all rows
  const aoa = [header1, header2, header3, colHeaders, ...dataRows, totalRow];
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  
  // Set column widths
  ws["!cols"] = [
    { wch: 5 },  // STT
    { wch: 10 }, // Mã NV
    { wch: 20 }, // Họ tên
    { wch: 12 }, // Lương CB
    { wch: 10 }, // Ngày công
    { wch: 14 }, // Lương tính theo ngày công
    { wch: 14 }, // Phụ cấp ăn trưa
    { wch: 14 }, // Phụ cấp xăng/xe
    { wch: 14 }, // Phụ cấp điện thoại
    { wch: 12 }, // Thưởng lễ
    { wch: 16 }, // Thưởng theo doanh số
    { wch: 14 }, // Tổng thu nhập
    { wch: 12 }, // BHXH
    { wch: 12 }, // BHYT
    { wch: 12 }, // BHTN
    { wch: 12 }, // Tổng tiền BH
    { wch: 12 }, // Người phụ thuộc
    { wch: 16 }, // Giảm trừ gia cảnh
    { wch: 14 }, // Thu nhập chịu thuế
    { wch: 12 }, // Thuế TNCN
    { wch: 12 }, // Tạm ứng
    { wch: 12 }, // Thực lĩnh
    { wch: 20 }, // Ghi chú
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, `BangLuong_${monthStr}_${year}`);
  
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}