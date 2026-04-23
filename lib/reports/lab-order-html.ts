import { formatVnd } from "@/lib/format/currency";
import { htmlBangChu } from "@/lib/reports/amount-in-words-html";
import { formatArchConnection, formatLabOrderCategory, formatLabOrderLineWorkType, formatOrderStatus, formatPatientGender } from "@/lib/format/labels";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { escapeHtml } from "@/lib/reports/escape-html";

export type LabOrderPrintLine = {
  product_code: string;
  product_name: string;
  unit: string;
  tooth_positions: string;
  shade: string | null;
  tooth_count: number | null;
  work_type: string;
  arch_connection: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  line_amount: number;
  notes: string | null;
};

export type LabOrderPrintPayload = {
  order_number: string;
  received_at: string;
  patient_name: string;
  clinic_name: string | null;
  status: string;
  partner_code: string | null;
  partner_name: string | null;
  partner_address: string | null;
  partner_phone: string | null;
  partner_tax_id: string | null;
  notes: string | null;
  order_category?: string;
  patient_year_of_birth?: number | null;
  patient_gender?: string | null;
  due_completion_at?: string | null;
  due_delivery_at?: string | null;
  clinical_indication?: string | null;
  margin_summary?: string | null;
  notes_accounting?: string | null;
  notes_coordination?: string | null;
  accessories_summary?: string | null;
  lines: LabOrderPrintLine[];
};

function fmtQty(n: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(n);
}

export function buildLabOrderBodyHtml(p: LabOrderPrintPayload): string {
  const gen = formatDateTime(new Date());
  const partnerInner =
    p.partner_code || p.partner_name
      ? `${escapeHtml(p.partner_code ?? "")}${p.partner_code && p.partner_name ? " — " : ""}${escapeHtml(p.partner_name ?? "")}`
      : null;
  const leftKvRows: string[] = [];
  if (partnerInner?.trim()) {
    leftKvRows.push(`<tr><th>TÊN KH</th><td>: ${partnerInner}</td></tr>`);
  }
  if (p.partner_address?.trim()) {
    leftKvRows.push(`<tr><th>ĐỊA CHỈ</th><td>: ${escapeHtml(p.partner_address.trim())}</td></tr>`);
  }
  if (p.partner_tax_id?.trim()) {
    leftKvRows.push(`<tr><th>MST</th><td>: ${escapeHtml(p.partner_tax_id.trim())}</td></tr>`);
  }
  if (p.partner_phone?.trim()) {
    leftKvRows.push(`<tr><th>SĐT</th><td>: ${escapeHtml(p.partner_phone.trim())}</td></tr>`);
  }
  if (p.clinic_name?.trim()) {
    leftKvRows.push(`<tr><th>NHA KHOA</th><td>: ${escapeHtml(p.clinic_name.trim())}</td></tr>`);
  }
  leftKvRows.push(`<tr><th>BỆNH NHÂN</th><td>: ${escapeHtml(p.patient_name)}</td></tr>`);
  const rows = p.lines
    .map(
      (l, i) =>
        `<tr>
          <td class="num">${i + 1}</td>
          <td style="width:70px;">${escapeHtml(l.product_code)}</td>
          <td>${escapeHtml(l.product_name)}</td>
          <td style="width:120px;">${escapeHtml(l.tooth_positions)}${l.shade ? ` · ${escapeHtml(l.shade)}` : ""}</td>
          <td class="num" style="width:40px;">${escapeHtml(fmtQty(l.quantity))}</td>
          <td class="num" style="width:85px;">${escapeHtml(formatVnd(l.unit_price))}</td>
          <td class="num" style="width:105px;"><strong>${escapeHtml(formatVnd(l.line_amount))}</strong></td>
          <td>${escapeHtml(l.notes ?? "—")}</td>
        </tr>`,
    )
    .join("");
  const total = p.lines.reduce((s, l) => s + l.line_amount, 0);
  const cat = p.order_category ? formatLabOrderCategory(p.order_category) : null;
  const yearG =
    p.patient_year_of_birth != null || p.patient_gender
      ? (p.patient_year_of_birth != null ? String(p.patient_year_of_birth) : "") +
        (p.patient_gender ? (p.patient_year_of_birth != null ? " · " : "") + formatPatientGender(p.patient_gender) : "")
      : null;
  return `
    <h1 style="color:#2563eb;">PHIẾU XÁC NHẬN ĐƠN HÀNG</h1>
    <p class="muted" style="text-align:center;">Số đơn: <strong>${escapeHtml(p.order_number)}</strong> · Ngày nhận: ${escapeHtml(p.received_at)}</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
      <table class="kv">
        <tbody>
          ${leftKvRows.join("")}
          ${cat ? `<tr><th>LOẠI HÀNG</th><td>: ${escapeHtml(cat)}</td></tr>` : ""}
          ${yearG ? `<tr><th>NĂM SINH/GT</th><td>: ${escapeHtml(yearG)}</td></tr>` : ""}
        </tbody>
      </table>
      <table class="kv">
        <tbody>
          <tr><th>HẸN HOÀN THÀNH</th><td>: ${p.due_completion_at ? escapeHtml(formatDateTime(p.due_completion_at)) : "—"}</td></tr>
          <tr><th>HẸN GIAO</th><td>: ${p.due_delivery_at ? escapeHtml(formatDateTime(p.due_delivery_at)) : "—"}</td></tr>
          <tr><th>GIỎ HÀNG</th><td>: ${escapeHtml(p.accessories_summary ?? "—")}</td></tr>
          <tr><th>TRẠNG THÁI</th><td>: ${escapeHtml(formatOrderStatus(p.status))}</td></tr>
        </tbody>
      </table>
    </div>

    ${p.clinical_indication ? `<div style="margin-bottom:10px;font-size:11px;"><strong>CHỈ ĐỊNH:</strong> ${escapeHtml(p.clinical_indication)}</div>` : ""}

    <table>
      <thead>
        <tr style="background:#2563eb;color:#fff;">
          <th class="num" style="color:#fff;">STT</th>
          <th style="color:#fff;">MÃ SP</th>
          <th style="color:#fff;">TÊN SẢN PHẨM</th>
          <th style="color:#fff;">RĂNG/MÀU</th>
          <th class="num" style="color:#fff;">SL</th>
          <th class="num" style="color:#fff;">ĐƠN GIÁ</th>
          <th class="num" style="color:#fff;">THÀNH TIỀN</th>
          <th style="color:#fff;">GHI CHÚ</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="8">Chưa có dòng.</td></tr>`}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="6" class="num" style="font-weight:700;border:none;">TỔNG CỘNG:</td>
          <td class="num" style="font-weight:800;font-size:13px;background:#f1f5f9;">${escapeHtml(formatVnd(total))}</td>
          <td style="border:none;"></td>
        </tr>
      </tfoot>
    </table>
    ${htmlBangChu(total)}

    <div style="margin-top:20px;font-size:11px;color:#64748b;">
      <p>Ghi chú đơn: ${escapeHtml(p.notes ?? "—")}</p>
      ${p.notes_accounting ? `<p>Ghi chú kế toán: ${escapeHtml(p.notes_accounting)}</p>` : ""}
    </div>

    <div style="margin-top:40px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="font-size:11px;font-style:italic;max-width:60%;color:#64748b;">
        * Vui lòng kiểm tra kỹ thông tin đơn hàng khi nhận phiếu. Trân trọng cảm ơn!
      </div>
      <div style="text-align:center;min-width:200px;">
        <div style="font-size:11px;">${new Date().toLocaleDateString("vi-VN", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div style="font-weight:700;margin-top:5px;">NGƯỜI LẬP PHIẾU</div>
        <div style="margin-top:50px;font-size:10px;color:#94a3b8;">(Ký và ghi rõ họ tên)</div>
      </div>
    </div>

    <style>
      table:not(.kv) th { background-color: #2563eb !important; border-color: #1e40af !important; color: #fff !important; }
      td { height: 22px; }
      table.kv th { background: none !important; color: #1e293b !important; }
    </style>
  `;
}

export function labOrderPrintTitle(p: LabOrderPrintPayload): string {
  return `Đơn hàng · ${p.order_number} — KT Smile Lab`;
}
