import { BRAND_LOGO_PUBLIC_PATH } from "@/lib/brand/logo-public-path";
import { htmlBangChu } from "@/lib/reports/amount-in-words-html";
import { escapeHtml } from "@/lib/reports/escape-html";
import { PAYROLL_SLIP_DEFAULT_COMPANY_NAME } from "@/lib/reports/payroll-slip-constants";

/** Cùng file logo header trang web (`BrandLogo`). */
export const PAYROLL_SLIP_LOGO_PUBLIC_PATH = BRAND_LOGO_PUBLIC_PATH;

export const PAYROLL_SLIP_PAGE_WIDTH_MM = 210;
export const PAYROLL_SLIP_PAGE_HEIGHT_MM = 297;

export type PayrollSlipRow = {
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

export type PayrollSlipOptions = {
  year: number;
  month: number;
  companyName?: string;
  title?: string;
  pageBreakAfter?: boolean;
};

export { PAYROLL_SLIP_DEFAULT_COMPANY_NAME };

export function buildPayrollSlipPrintOptsDraft(year: number, month: number, companyName?: string): PayrollSlipOptions {
  return {
    year,
    month,
    companyName: companyName ?? PAYROLL_SLIP_DEFAULT_COMPANY_NAME,
    title: "PHIẾU LƯƠNG (TẠM TÍNH)",
  };
}

export function buildPayrollSlipPrintOptsBatchMerged(year: number, month: number, companyName?: string): PayrollSlipOptions {
  return { year, month, companyName: companyName ?? PAYROLL_SLIP_DEFAULT_COMPANY_NAME, title: "PHIẾU LƯƠNG" };
}

export function buildPayrollSlipPrintOptsSealed(year: number, month: number, companyName?: string): PayrollSlipOptions {
  return { year, month, companyName: companyName ?? PAYROLL_SLIP_DEFAULT_COMPANY_NAME, title: "PHIẾU LƯƠNG" };
}

/**
 * Html2canvas không áp `@media print` — bắt chước in khi export PDF (`payroll-pdf.ts` gán `payroll-pdf-capture` trên `<html>`).
 */
export const PAYROLL_PDF_CAPTURE_STYLE = `
        html.payroll-pdf-capture,
        html.payroll-pdf-capture body {
          max-width: none !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        html.payroll-pdf-capture .payroll-slip-batch-root {
          max-width: none;
          width: 100%;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html.payroll-pdf-capture .payroll-slip {
          display: flex;
          flex-direction: column;
          max-width: none;
          width: 100%;
          box-sizing: border-box;
        }
        html.payroll-pdf-capture .payroll-slip.page-break {
          page-break-after: always;
          break-after: page;
        }
        html.payroll-pdf-capture .payroll-slip-batch-root > section.payroll-slip:last-of-type {
          page-break-after: auto;
          break-after: auto;
        }
        html.payroll-pdf-capture .salary-table th,
        html.payroll-pdf-capture .salary-table td {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        html.payroll-pdf-capture body { background: #ffffff !important; }
        html.payroll-pdf-capture .payroll-slip {
          background: #ffffff !important;
          border: 1px solid #d1d5db !important;
          box-shadow: none !important;
        }
        html.payroll-pdf-capture .slip-doc-head {
          border-bottom-color: #d1d5db !important;
        }
        html.payroll-pdf-capture .title-band {
          background-color: #ffffff !important;
          color: #111827 !important;
          font-size: 52px !important;
          padding: 18px 0 !important;
        }
        html.payroll-pdf-capture .slip-logo {
          max-height: 200px !important;
          max-width: min(100%, 560px) !important;
          width: auto !important;
          height: auto !important;
        }
        html.payroll-pdf-capture .info-table td {
          border: 1px solid #e5e7eb !important;
        }
        html.payroll-pdf-capture .info-table td.label-cell {
          background-color: #f9fafb !important;
        }
        html.payroll-pdf-capture table.salary-table {
          border-collapse: collapse !important;
        }
        html.payroll-pdf-capture .salary-table th,
        html.payroll-pdf-capture .salary-table td {
          border: 1px solid #e5e7eb !important;
        }
        html.payroll-pdf-capture .salary-table thead th {
          background-color: #f3f4f6 !important;
          border-bottom: 2px solid #d1d5db !important;
          color: #374151 !important;
        }
        html.payroll-pdf-capture .salary-table tr.section-row td {
          background-color: #f9fafb !important;
          color: #111827 !important;
        }
        html.payroll-pdf-capture .salary-table tr.total-row td {
          background-color: #f3f4f6 !important;
          border-top: 2px solid #9ca3af !important;
          color: #111827 !important;
        }
        html.payroll-pdf-capture .payroll-slip .bang-chu-line {
          background-color: #f9fafb !important;
          border: 1px solid #e5e7eb !important;
          border-left-width: 4px !important;
          border-left-color: #3b82f6 !important;
        }
        html.payroll-pdf-capture .info-table td,
        html.payroll-pdf-capture .salary-table th,
        html.payroll-pdf-capture .salary-table td {
          font-size: 13px !important;
          line-height: 1.45 !important;
          padding: 8px 10px !important;
        }
        html.payroll-pdf-capture .signature-block .label {
          font-size: 26px !important;
        }
        html.payroll-pdf-capture .signature-block .note {
          font-size: 14px !important;
        }
      `;

const PAYROLL_HTML2PDF_PARENT_SCOPE = ".html2pdf__overlay .html2pdf__container";

function payrollSlipBaseStylesCss(): string {
  return `
        * { box-sizing: border-box; }
        body {
          font-family: "Times New Roman", Times, "Noto Serif", serif;
          font-size: 13px;
          margin: 0;
          padding: 24px;
          color: #1f2937;
          background: #f3f4f6;
          -webkit-font-smoothing: antialiased;
        }
        .payroll-slip {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: ${PAYROLL_SLIP_PAGE_WIDTH_MM}mm;
          margin: 0 auto;
          page-break-inside: avoid;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 32px 40px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          min-height: 0;
        }
        .page-break {
          break-after: page;
          page-break-after: always;
        }
        .payroll-slip-batch-root {
          width: 100%;
          max-width: ${PAYROLL_SLIP_PAGE_WIDTH_MM}mm;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .slip-doc-head {
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 20px;
          margin-bottom: 24px;
        }
        .slip-brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }
        .slip-logo-wrap {
          flex: 1 1 0;
          min-width: 0;
          max-width: 68%;
        }
        .slip-logo {
          height: auto;
          max-height: 200px;
          max-width: 100%;
          width: auto;
          object-fit: contain;
          display: block;
        }
        .slip-brand-text {
          flex: 0 0 auto;
          max-width: 32%;
          text-align: right;
        }
        .company-name {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          font-family: "Times New Roman", Times, serif;
        }
        .company-sub {
          font-size: 14px;
          color: #6b7280;
          margin-top: 4px;
          font-family: "Times New Roman", Times, serif;
        }
        .title-band {
          text-align: center;
          font-size: 52px;
          font-weight: 800;
          line-height: 1.15;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin: 0 0 8px;
          color: #111827;
          font-family: "Times New Roman", Times, serif;
        }
        .period {
          text-align: center;
          font-size: 14px;
          color: #4b5563;
          margin: 0;
          font-family: "Times New Roman", Times, serif;
        }
        .period strong {
          color: #111827;
          font-weight: 600;
        }
        .info-panel {
          margin-bottom: 24px;
        }
        .info-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .info-table td {
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          font-size: 13px;
          vertical-align: middle;
        }
        .info-table .label-cell {
          width: 18%;
          background: #f9fafb;
          color: #4b5563;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .info-table .value-cell {
          width: 32%;
          color: #111827;
          font-weight: 600;
        }
        .info-table .note-cell {
          color: #4b5563;
          font-style: italic;
          font-weight: normal;
        }
        .slip-salary-panel {
          margin-bottom: 24px;
        }
        table.salary-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .salary-table col.salary-col-stt { width: 16%; }
        .salary-table col.salary-col-desc { width: 34%; }
        .salary-table col.salary-col-amount { width: 50%; }
        .salary-table th, .salary-table td {
          border: 1px solid #e5e7eb;
          padding: 10px 12px;
          font-size: 13px;
          vertical-align: middle;
        }
        .salary-table th {
          background: #f3f4f6;
          color: #374151;
          font-weight: 700;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          text-align: left;
          border-bottom: 2px solid #d1d5db;
        }
        .salary-table th.center { text-align: center; }
        .salary-table th.right { text-align: right; }
        .salary-table td.stt {
          text-align: center;
          color: #6b7280;
        }
        .salary-table td.num {
          text-align: right;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: #111827;
        }
        .section-row td {
          background: #f9fafb;
          color: #374151;
          font-weight: 700;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .total-row td {
          background: #f3f4f6;
          color: #111827;
          font-weight: 800;
          font-size: 14px;
          text-transform: uppercase;
          border-top: 2px solid #9ca3af;
        }
        .total-label {
          text-align: right;
          padding-right: 24px !important;
        }
        .total-row td.num-negative,
        .salary-table td.num-negative {
          color: #dc2626;
        }
        .payroll-slip .bang-chu-line {
          margin: 0 0 24px 0 !important;
          padding: 14px 16px;
          font-size: 14px !important;
          font-style: italic !important;
          color: #1f2937 !important;
          line-height: 1.5 !important;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-left: 4px solid #3b82f6;
          border-radius: 4px;
        }
        .slip-foot {
          margin-top: auto;
          padding-top: 16px;
        }
        .signatures {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          text-align: center;
        }
        .signature-block {
          min-height: 120px;
        }
        .signature-block .label {
          font-weight: 700;
          color: #111827;
          font-size: 26px;
          text-transform: uppercase;
          margin-bottom: 6px;
          font-family: "Times New Roman", Times, serif;
        }
        .signature-block .note {
          color: #6b7280;
          font-size: 14px;
          font-style: italic;
        }
        @media print {
          html, body { background: #fff !important; padding: 0 !important; }
          @page { size: A4 portrait; margin: 15mm; }
          .payroll-slip {
            border: none;
            border-radius: 0;
            padding: 0;
            box-shadow: none;
          }
          .payroll-slip-batch-root { gap: 0; }
          .salary-table th, .salary-table td, .info-table td, .section-row td, .total-row td {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .payroll-slip .bang-chu-line {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        `;
}

function payrollSlipEmbeddedStylesCss(): string {
  return `${payrollSlipBaseStylesCss()}${PAYROLL_PDF_CAPTURE_STYLE}`;
}

export function getPayrollSlipStylesForHtml2PdfParent(): string {
  const scope = PAYROLL_HTML2PDF_PARENT_SCOPE;
  const withoutGlobalStar = payrollSlipBaseStylesCss().replace(/^\s*\*\s*\{[^}]*\}\s*/m, "");
  const containerAsRoot = withoutGlobalStar.replace(/^\s*body\s*\{/m, `${scope} {`);
  const captureScoped = PAYROLL_PDF_CAPTURE_STYLE.replace(/html\.payroll-pdf-capture/g, scope);
  return `        ${scope} * { box-sizing: border-box; }
        ${containerAsRoot}
        ${captureScoped}`;
}

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

function buildSlipBody(rowData: PayrollSlipRow, opts: PayrollSlipOptions): string {
  const totalIncome = rowData.total_income;
  const totalInsurance = rowData.total_insurance;
  const familyDeduction = rowData.family_deduction_amount;
  const taxableIncome = rowData.taxable_income;
  const personalIncomeTax = rowData.personal_income_tax;
  const advancePayment = rowData.advance_payment;
  const actualNet = rowData.net_salary;
  const title = opts.title ?? "PHIẾU LƯƠNG";
  const company = opts.companyName ?? PAYROLL_SLIP_DEFAULT_COMPANY_NAME;
  const attendanceNote = rowData.note?.trim() || "Không có ghi chú";

  return `
    <section class="payroll-slip${opts.pageBreakAfter ? " page-break" : ""}">
      <header class="slip-doc-head">
        <div class="slip-brand-row">
          <div class="slip-logo-wrap">
            <img class="slip-logo" src="${PAYROLL_SLIP_LOGO_PUBLIC_PATH}" alt="Logo" loading="lazy" />
          </div>
          <div class="slip-brand-text">
            <div class="company-name">${escapeHtml(company)}</div>
            <div class="company-sub">Bộ phận Nhân sự & Tiền lương</div>
          </div>
        </div>
        <h1 class="title-band">${escapeHtml(title)}</h1>
        <p class="period">Kỳ lương: Tháng <strong>${opts.month}</strong> Năm <strong>${opts.year}</strong></p>
      </header>

      <div class="info-panel">
        <table class="info-table">
          <tbody>
            <tr>
              <td class="label-cell">Mã NV</td>
              <td class="value-cell">${escapeHtml(rowData.employee_code)}</td>
              <td class="label-cell">Họ và tên</td>
              <td class="value-cell">${escapeHtml(rowData.employee_name)}</td>
            </tr>
            <tr>
              <td class="label-cell">Chức vụ</td>
              <td class="value-cell">${escapeHtml(rowData.position ?? "—")}</td>
              <td class="label-cell">Bộ phận</td>
              <td class="value-cell">${escapeHtml(rowData.department ?? "—")}</td>
            </tr>
            <tr>
              <td class="label-cell">Ngày công</td>
              <td class="value-cell">${String(rowData.worked_days)}</td>
              <td class="label-cell">Nghỉ có lương</td>
              <td class="value-cell">${String(rowData.paid_leave_days)}</td>
            </tr>
            <tr>
              <td class="label-cell">Giờ OT</td>
              <td class="value-cell">${String(rowData.overtime_hours)}</td>
              <td class="label-cell">Nghỉ không lương</td>
              <td class="value-cell">${String(rowData.unpaid_leave_days)}</td>
            </tr>
            <tr>
              <td class="label-cell">Ghi chú</td>
              <td class="value-cell note-cell" colspan="3">${escapeHtml(attendanceNote)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="slip-salary-panel">
        <table class="salary-table">
          <colgroup>
            <col class="salary-col-stt" />
            <col class="salary-col-desc" />
            <col class="salary-col-amount" />
          </colgroup>
          <thead>
            <tr>
              <th class="center">STT</th>
              <th>HẠN MỤC</th>
              <th class="right">SỐ TIỀN</th>
            </tr>
          </thead>
          <tbody>
            ${row("Lương cơ bản", money(rowData.base_salary), "01")}
            ${row("Số ngày công", String(rowData.worked_days), "02")}
            ${row("Lương tính theo ngày công", money(rowData.gross_salary), "A")}
            <tr class="section-row"><td colspan="3">PHỤ CẤP</td></tr>
            ${row("Phụ cấp ăn trưa", dashOrMoney(rowData.lunch_allowance), "03")}
            ${row("Phụ cấp xăng/xe", dashOrMoney(rowData.fuel_allowance), "04")}
            ${row("Phụ cấp điện thoại", dashOrMoney(rowData.phone_allowance), "05")}
            ${row("Thưởng lễ", dashOrMoney(rowData.holiday_bonus), "06")}
            ${row("Thưởng theo doanh số", dashOrMoney(rowData.sales_bonus), "07")}
            ${row("Tổng thu nhập", money(totalIncome), "B")}
            <tr class="section-row"><td colspan="3">CÁC KHOẢN KHẤU TRỪ VÀO LƯƠNG</td></tr>
            ${row("BHXH (8%)", dashOrMoney(rowData.social_insurance), "08")}
            ${row("BHYT (1,5%)", dashOrMoney(rowData.health_insurance), "09")}
            ${row("BHTN (1%)", dashOrMoney(rowData.unemployment_insurance), "10")}
            ${row("Tổng tiền BH", money(totalInsurance), "C1")}
            ${row("Người phụ thuộc", String(rowData.dependent_count), "11")}
            ${row("Số tiền giảm trừ gia cảnh", money(familyDeduction), "12")}
            ${row("Thu nhập chịu thuế", dashOrMoney(taxableIncome), "13")}
            ${row("Thuế TNCN", dashOrMoney(personalIncomeTax), "C2")}
            ${row("Tạm ứng", dashOrMoney(advancePayment), "C3")}
            <tr class="total-row">
              <td colspan="2" class="total-label">THỰC LĨNH</td>
              <td class="num">${dashOrMoney(actualNet)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${htmlBangChu(actualNet, "Bằng chữ")}

      <footer class="slip-foot">
        <div class="signatures">
          <div class="signature-block">
            <div class="label">NGƯỜI LẬP PHIẾU</div>
            <div class="note">(Ký và ghi rõ họ tên)</div>
          </div>
          <div class="signature-block">
            <div class="label">NGƯỜI NHẬN TIỀN</div>
            <div class="note">(Ký và ghi rõ họ tên)</div>
          </div>
        </div>
      </footer>
    </section>
  `;
}

function docShell(innerBody: string, titleText: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(titleText)}</title>
  <style>
${payrollSlipEmbeddedStylesCss()}
  </style>
</head>
<body>
  <div class="payroll-slip-batch-root">${innerBody}</div>
</body>
</html>`;
}

export function buildPayrollSlipHtml(rowData: PayrollSlipRow, opts: PayrollSlipOptions): string {
  return docShell(buildSlipBody(rowData, opts), opts.title ?? `Phiếu lương ${rowData.employee_code}`);
}

export function buildPayrollBatchPrintHtml(rows: PayrollSlipRow[], opts: PayrollSlipOptions): string {
  const inner = rows
    .map((r, index) =>
      buildSlipBody(r, {
        ...opts,
        pageBreakAfter: index < rows.length - 1,
        title: opts.title ?? "PHIẾU LƯƠNG",
      }),
    )
    .join("");
  return docShell(inner, opts.title ?? "In hàng loạt phiếu lương");
}
