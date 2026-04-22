import { escapeHtml } from "@/lib/reports/escape-html";

type PayrollSlipRow = {
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
  lunch_allowance: number;
  fuel_allowance: number;
  phone_allowance: number;
  holiday_bonus: number;
  sales_bonus: number;
  social_insurance: number;
  health_insurance: number;
  unemployment_insurance: number;
  dependent_count: number;
  family_deduction_amount: number;
  dependent_deduction_amount: number;
  advance_payment: number;
  total_allowance: number;
  total_income: number;
  total_insurance: number;
  taxable_income: number;
  personal_income_tax: number;
  total_deduction: number;
  net_salary: number;
  note?: string | null;
};

type PayrollSlipOptions = {
  year: number;
  month: number;
  companyName?: string;
  title?: string;
  pageBreakAfter?: boolean;
};

function money(n: number) {
  return Math.round(Number(n) || 0).toLocaleString("vi-VN");
}

function dashOrMoney(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  if (Math.abs(Number(n)) < 0.005) return "—";
  return money(n);
}

function row(label: string, value: string, no: string) {
  return `
    <tr>
      <td class="stt">${escapeHtml(no)}</td>
      <td>${escapeHtml(label)}</td>
      <td class="num">${escapeHtml(value)}</td>
    </tr>
  `;
}

function buildSlipBody(rowData: PayrollSlipRow, opts: PayrollSlipOptions) {
  const totalIncome = rowData.total_income;
  const totalInsurance = rowData.total_insurance;
  const familyDeduction = rowData.family_deduction_amount;
  const taxableIncome = rowData.taxable_income;
  const personalIncomeTax = rowData.personal_income_tax;
  const advancePayment = rowData.advance_payment;
  const actualNet = rowData.net_salary;
  const title = opts.title ?? "PHIẾU LƯƠNG";
  const company = opts.companyName ?? "CÔNG TY TNHH KTSMILE";
  const attendanceNote = rowData.note?.trim() || "—";

  return `
    <section class="payroll-slip${opts.pageBreakAfter ? " page-break" : ""}">
      <div class="header-top">
        <div><strong>CÔNG TY:</strong></div>
        <div class="company-name">${escapeHtml(company.replace(/^CÔNG TY\s*:?\s*/i, ""))}</div>
      </div>

      <div class="title-band">${escapeHtml(title)}</div>
      <div class="period">Tháng ${opts.month} năm ${opts.year}</div>

      <table class="employee-table">
        <tbody>
          <tr>
            <td class="label-cell">MÃ NV</td>
            <td class="value-cell code-cell" colspan="3">${escapeHtml(rowData.employee_code)}</td>
          </tr>
          <tr>
            <td class="label-cell">HỌ VÀ TÊN:</td>
            <td class="value-cell name-cell" colspan="3">${escapeHtml(rowData.employee_name)}</td>
          </tr>
          <tr>
            <td class="sub-label-cell">Chức vụ:</td>
            <td class="sub-value-cell">${escapeHtml(rowData.position ?? "—")}</td>
            <td class="sub-label-cell">Bộ phận:</td>
            <td class="sub-value-cell">${escapeHtml(rowData.department ?? "—")}</td>
          </tr>
        </tbody>
      </table>

      <table class="summary-info-table">
        <tbody>
          <tr>
            <td class="info-label">Ngày công</td>
            <td class="info-value">${String(rowData.worked_days)}</td>
            <td class="info-label">Nghỉ có lương</td>
            <td class="info-value">${String(rowData.paid_leave_days)}</td>
          </tr>
          <tr>
            <td class="info-label">Nghỉ không lương</td>
            <td class="info-value">${String(rowData.unpaid_leave_days)}</td>
            <td class="info-label">Giờ OT</td>
            <td class="info-value">${String(rowData.overtime_hours)}</td>
          </tr>
          <tr>
            <td class="info-label">Ghi chú</td>
            <td class="info-value" colspan="3">${escapeHtml(attendanceNote)}</td>
          </tr>
        </tbody>
      </table>

      <table class="salary-table">
        <thead>
          <tr>
            <th style="width:52px">STT</th>
            <th>HẠN MỤC</th>
            <th style="width:170px" class="num">SỐ TIỀN</th>
          </tr>
        </thead>
        <tbody>
          ${row("Lương cơ bản", money(rowData.base_salary), "01")}
          ${row("Số ngày công", String(rowData.worked_days), "02")}
          ${row("Lương tính theo ngày công", money(rowData.gross_salary), "A")}
          <tr class="section-row">
            <td colspan="3">PHỤ CẤP</td>
          </tr>
          ${row("Phụ cấp ăn trưa", dashOrMoney(rowData.lunch_allowance), "03")}
          ${row("Phụ cấp xăng/xe", dashOrMoney(rowData.fuel_allowance), "04")}
          ${row("Phụ cấp điện thoại", dashOrMoney(rowData.phone_allowance), "05")}
          ${row("Thưởng lễ", dashOrMoney(rowData.holiday_bonus), "06")}
          ${row("Thưởng theo doanh số", dashOrMoney(rowData.sales_bonus), "06")}
          ${row("Tổng thu nhập", money(totalIncome), "B")}
          <tr class="section-row">
            <td colspan="3">CÁC KHOẢNG CẤU TRỪ VÀO LƯƠNG</td>
          </tr>
          ${row("BHXH (8%)", dashOrMoney(rowData.social_insurance), "07")}
          ${row("BHYT (1,5%)", dashOrMoney(rowData.health_insurance), "08")}
          ${row("BHTN (1%)", dashOrMoney(rowData.unemployment_insurance), "09")}
          ${row("Tổng tiền BH", money(totalInsurance), "C1")}
          ${row("Người phụ thuộc", String(rowData.dependent_count), "10")}
          ${row("Số tiền giảm trừ gia cảnh", money(familyDeduction), "11")}
          ${row("Thu nhập chịu thuế", dashOrMoney(taxableIncome), "12")}
          ${row("Thuế TNCN", dashOrMoney(personalIncomeTax), "C2")}
          ${row("Tạm ứng", dashOrMoney(advancePayment), "C3")}
          <tr class="total-row">
            <td colspan="2" class="total-label">THỰC LĨNH</td>
            <td class="num total-value">${dashOrMoney(actualNet)}</td>
          </tr>
        </tbody>
      </table>

      <div class="signatures">
        <div>
          <div class="label">Người lập phiếu</div>
          <div class="note">(Ký và ghi rõ họ tên)</div>
        </div>
        <div>
          <div class="label">Người nhận tiền</div>
          <div class="note">(Ký và ghi rõ họ tên)</div>
        </div>
      </div>
    </section>
  `;
}

export function buildPayrollSlipHtml(
  rowData: PayrollSlipRow,
  opts: PayrollSlipOptions,
): string {
  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(opts.title ?? `Phiếu lương ${rowData.employee_code}`)}</title>
      <style>
        :root {
          --border: #111827;
          --muted: #6b7280;
        }
        * { box-sizing: border-box; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          margin: 0;
          padding: 18px;
          color: #111827;
          background: #fff;
        }
        .payroll-slip {
          max-width: 210mm;
          margin: 0 auto;
          page-break-inside: avoid;
        }
        .page-break {
          break-after: page;
          page-break-after: always;
        }
        .header-top {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .company-name {
          font-size: 18px;
          font-weight: 800;
        }
        .title-band {
          background: #c6e0b4;
          text-align: center;
          font-size: 22px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 6px 8px;
          margin-bottom: 4px;
        }
        .period {
          text-align: center;
          font-size: 17px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .employee-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-bottom: 0;
        }
        .employee-table td {
          border: none;
          padding: 2px 4px;
          font-size: 15px;
          font-weight: 700;
          vertical-align: middle;
        }
        .summary-info-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-bottom: 6px;
        }
        .summary-info-table td {
          border: 1px solid var(--border);
          padding: 5px 6px;
          font-size: 13px;
          line-height: 1.1;
        }
        .info-label {
          width: 110px;
          background: #f8f8f8;
          font-weight: 700;
        }
        .info-value {
          font-weight: 600;
        }
        .label-cell {
          width: 115px;
          text-transform: uppercase;
          padding-left: 0;
          white-space: nowrap;
        }
        .value-cell {
          background: #ececec;
          text-align: center;
          font-size: 18px;
          font-weight: 800;
        }
        .code-cell {
          width: 160px;
        }
        .name-cell {
          font-size: 17px;
        }
        .sub-label-cell,
        .sub-value-cell {
          font-size: 13px;
          font-weight: 500;
          background: transparent;
        }
        .sub-label-cell {
          width: 70px;
          padding-left: 18px;
          white-space: nowrap;
        }
        .sub-value-cell {
          width: 180px;
          padding-right: 18px;
        }
        table.salary-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-top: 6px;
        }
        .salary-table th, .salary-table td {
          border: 1px solid var(--border);
          padding: 2px 6px;
          font-size: 14px;
          line-height: 1.05;
          vertical-align: middle;
        }
        .salary-table th {
          text-transform: uppercase;
          background: #bceff0;
          font-size: 15px;
          font-weight: 800;
          text-align: center;
        }
        .stt {
          width: 52px;
          text-align: center;
          font-weight: 700;
        }
        .num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .section-row td {
          background: #f7eec6;
          text-align: center;
          font-weight: 800;
          font-size: 15px;
          text-transform: uppercase;
        }
        .total-row td {
          background: #fff200;
          font-weight: 900;
          font-size: 16px;
          text-transform: uppercase;
        }
        .total-label {
          text-align: center;
        }
        .total-value {
          text-align: right;
        }
        .signatures {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
          margin-top: 30px;
          text-align: center;
          font-size: 13px;
        }
        .label {
          font-weight: 700;
          margin-bottom: 4px;
        }
        .note {
          color: var(--muted);
        }
        @media print {
          html, body { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
          @page { size: A4 portrait; margin: 10mm; }
          .payroll-slip { max-width: none; width: 100%; }
          .salary-table th, .salary-table td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .title-band, .section-row td, .total-row td, .value-cell, .employee-table td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      ${buildSlipBody(rowData, opts)}
    </body>
    </html>
  `;
}

export function buildPayrollBatchPrintHtml(
  rows: PayrollSlipRow[],
  opts: PayrollSlipOptions,
): string {
  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(opts.title ?? "In hàng loạt phiếu lương")}</title>
      <style>
        :root {
          --border: #111827;
          --muted: #6b7280;
        }
        * { box-sizing: border-box; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          margin: 0;
          padding: 18px;
          color: #111827;
          background: #fff;
        }
        .page-break {
          break-after: page;
          page-break-after: always;
        }
        .payroll-slip {
          max-width: 210mm;
          margin: 0 auto;
          page-break-inside: avoid;
        }
        .header {
          text-align: center;
          margin-bottom: 14px;
        }
        .company {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .period {
          margin-top: 8px;
          font-size: 14px;
        }
        .employee-box {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px 18px;
          font-size: 13px;
          margin-bottom: 14px;
        }
        .employee-box span {
          font-weight: 700;
        }
        .section-title {
          margin: 12px 0 6px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        th, td {
          border: 1px solid var(--border);
          padding: 6px 8px;
          font-size: 12px;
          vertical-align: middle;
        }
        th {
          text-transform: uppercase;
          background: #f3f4f6;
          font-size: 11px;
        }
        .stt {
          width: 54px;
          text-align: center;
          font-weight: 700;
        }
        .num {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .detail-table {
          margin-top: 0;
        }
        .summary-table {
          margin-top: 10px;
        }
        .summary-table td {
          font-size: 14px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .signatures {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
          margin-top: 42px;
          text-align: center;
          font-size: 12px;
        }
        .label {
          font-weight: 700;
          margin-bottom: 4px;
        }
        .note {
          color: var(--muted);
        }
        @media print {
          html, body { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
          @page { size: A4 portrait; margin: 10mm; }
          .payroll-slip { max-width: none; width: 100%; }
        }
      </style>
    </head>
    <body>
      ${rows
        .map((r, index) =>
          buildSlipBody(r, {
            ...opts,
            pageBreakAfter: index < rows.length - 1,
            title: opts.title ?? "PHIẾU LƯƠNG",
          }),
        )
        .join("")}
    </body>
    </html>
  `;
}
