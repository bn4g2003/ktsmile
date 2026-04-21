import * as XLSX from "xlsx";
import type { PayrollRunDetailRow } from "@/lib/actions/payroll";

export type PayrollExcelPayload = {
  year: number;
  month: number;
  standardWorkDays: number;
  overtimeRatePerHour: number;
  rows: PayrollRunDetailRow[];
};

export function buildPayrollExcelBuffer(payload: PayrollExcelPayload): any {
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
    "Nghỉ có lương",
    "Nghỉ không lương",
    "Giờ OT",
    "Phụ cấp",
    "Khấu trừ",
    "Tổng lương",
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
    r.paid_leave_days,
    r.unpaid_leave_days,
    r.overtime_hours,
    r.allowance,
    r.deduction,
    r.gross_salary,
    r.net_salary,
    r.note ?? "",
  ]);
  
  // Calculate totals
  const totals = rows.reduce(
    (acc, r) => ({
      base: acc.base + r.base_salary,
      worked: acc.worked + r.worked_days,
      paidLeave: acc.paidLeave + r.paid_leave_days,
      unpaidLeave: acc.unpaidLeave + r.unpaid_leave_days,
      ot: acc.ot + r.overtime_hours,
      allowance: acc.allowance + r.allowance,
      deduction: acc.deduction + r.deduction,
      gross: acc.gross + r.gross_salary,
      net: acc.net + r.net_salary,
    }),
    { base: 0, worked: 0, paidLeave: 0, unpaidLeave: 0, ot: 0, allowance: 0, deduction: 0, gross: 0, net: 0 }
  );
  
  const totalRow = [
    "",
    "",
    "TỔNG CỘNG",
    totals.base,
    totals.worked,
    totals.paidLeave,
    totals.unpaidLeave,
    totals.ot,
    totals.allowance,
    totals.deduction,
    totals.gross,
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
    { wch: 12 }, // Nghỉ có lương
    { wch: 14 }, // Nghỉ không lương
    { wch: 10 }, // Giờ OT
    { wch: 12 }, // Phụ cấp
    { wch: 12 }, // Khấu trừ
    { wch: 12 }, // Tổng lương
    { wch: 12 }, // Thực lĩnh
    { wch: 20 }, // Ghi chú
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, `BangLuong_${monthStr}_${year}`);
  
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}