import { formatVnd } from "@/lib/format/currency";
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
  const partnerLine =
    p.partner_code || p.partner_name
      ? `${escapeHtml(p.partner_code ?? "")}${p.partner_code && p.partner_name ? " — " : ""}${escapeHtml(p.partner_name ?? "")}`
      : "—";
  const rows = p.lines
    .map(
      (l, i) =>
        `<tr>
          <td class="num">${i + 1}</td>
          <td>${escapeHtml(l.product_code)}</td>
          <td>${escapeHtml(l.product_name)}</td>
          <td>${escapeHtml(l.unit || "—")}</td>
          <td>${escapeHtml(l.tooth_positions)}</td>
          <td>${escapeHtml(l.shade ?? "—")}</td>
          <td class="num">${escapeHtml(l.tooth_count != null ? String(l.tooth_count) : "—")}</td>
          <td>${escapeHtml(formatLabOrderLineWorkType(l.work_type))}</td>
          <td>${escapeHtml(formatArchConnection(l.arch_connection ?? "unit"))}</td>
          <td class="num">${escapeHtml(fmtQty(l.quantity))}</td>
          <td class="num">${escapeHtml(formatVnd(l.unit_price))}</td>
          <td class="num">${escapeHtml(String(l.discount_percent))}</td>
          <td class="num">${escapeHtml(formatVnd(l.discount_amount ?? 0))}</td>
          <td class="num">${escapeHtml(formatVnd(l.line_amount))}</td>
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
    <h1>Đơn hàng phục hình</h1>
    <p class="muted" style="text-align:center;">Số đơn: <strong>${escapeHtml(p.order_number)}</strong> · Ngày nhận: ${escapeHtml(p.received_at)}</p>
    <p class="muted" style="text-align:center;font-size:11px;">In lúc: ${escapeHtml(gen)}</p>
    <table class="kv">
      <tbody>
        <tr><th>Khách hàng</th><td>${partnerLine}</td></tr>
        <tr><th>Nha khoa</th><td>${escapeHtml(p.clinic_name ?? "—")}</td></tr>
        <tr><th>Bệnh nhân</th><td>${escapeHtml(p.patient_name)}</td></tr>
        ${cat ? `<tr><th>Loại hàng</th><td>${escapeHtml(cat)}</td></tr>` : ""}
        ${yearG ? `<tr><th>Năm sinh / giới</th><td>${escapeHtml(yearG)}</td></tr>` : ""}
        ${p.due_completion_at ? `<tr><th>Hẹn hoàn thành</th><td>${escapeHtml(formatDateTime(p.due_completion_at))}</td></tr>` : ""}
        ${p.due_delivery_at ? `<tr><th>Hẹn giao</th><td>${escapeHtml(formatDateTime(p.due_delivery_at))}</td></tr>` : ""}
        ${p.clinical_indication ? `<tr><th>Chỉ định</th><td>${escapeHtml(p.clinical_indication)}</td></tr>` : ""}
        ${p.margin_summary ? `<tr><th>Viền</th><td>${escapeHtml(p.margin_summary)}</td></tr>` : ""}
        ${p.accessories_summary ? `<tr><th>Phụ kiện</th><td>${escapeHtml(p.accessories_summary)}</td></tr>` : ""}
        ${p.notes_accounting ? `<tr><th>Ghi chú kế toán</th><td>${escapeHtml(p.notes_accounting)}</td></tr>` : ""}
        ${p.notes_coordination ? `<tr><th>Ghi chú điều phối</th><td>${escapeHtml(p.notes_coordination)}</td></tr>` : ""}
        <tr><th>Trạng thái</th><td>${escapeHtml(formatOrderStatus(p.status))}</td></tr>
        <tr><th>Ghi chú đơn</th><td>${escapeHtml(p.notes ?? "—")}</td></tr>
      </tbody>
    </table>
    <h2>Chi tiết sản phẩm</h2>
    <table>
      <thead>
        <tr>
          <th class="num">STT</th>
          <th>Mã SP</th>
          <th>Tên SP</th>
          <th>ĐVT</th>
          <th>Vị trí răng</th>
          <th>Màu</th>
          <th class="num">Số răng</th>
          <th>Loại SP</th>
          <th>Rời/Cầu</th>
          <th class="num">SL</th>
          <th class="num">Đơn giá</th>
          <th class="num">CK %</th>
          <th class="num">Giảm VNĐ</th>
          <th class="num">Thành tiền</th>
          <th>Ghi chú</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="15">Chưa có dòng.</td></tr>`}</tbody>
      <tfoot>
        <tr>
          <th colspan="13" class="num">Cộng</th>
          <th class="num">${escapeHtml(formatVnd(total))}</th>
          <th></th>
        </tr>
      </tfoot>
    </table>
  `;
}

export function labOrderPrintTitle(p: LabOrderPrintPayload): string {
  return `Đơn hàng · ${p.order_number} — KT Smile Lab`;
}
