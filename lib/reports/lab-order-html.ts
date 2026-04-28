import { formatVnd } from "@/lib/format/currency";
import { amountInWordsVietnamese } from "@/lib/format/currency";
import { formatLabOrderCategory, formatOrderStatus, formatPatientGender } from "@/lib/format/labels";
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

function lineDiscountLabel(discountPercent: number, discountAmount: number): string {
  const parts: string[] = [];
  if (discountPercent > 0) parts.push(`${discountPercent}%`);
  if (discountAmount > 0) parts.push(formatVnd(discountAmount));
  return parts.join(" + ") || "—";
}

export function buildLabOrderBodyHtml(p: LabOrderPrintPayload): string {
  const partnerInner =
    p.partner_code || p.partner_name
      ? `${escapeHtml(p.partner_code ?? "")}${p.partner_code && p.partner_name ? " — " : ""}${escapeHtml(p.partner_name ?? "")}`
      : null;
  const cat = p.order_category ? formatLabOrderCategory(p.order_category) : "—";
  const yearG =
    p.patient_year_of_birth != null || p.patient_gender
      ? (p.patient_year_of_birth != null ? String(p.patient_year_of_birth) : "") +
        (p.patient_gender ? (p.patient_year_of_birth != null ? " · " : "") + formatPatientGender(p.patient_gender) : "")
      : "—";
  const rows = p.lines
    .map(
      (l, i) =>
        `<tr>
          <td class="c">${i + 1}</td>
          <td>${escapeHtml(l.product_code || "—")}</td>
          <td><strong>${escapeHtml(l.product_name || "—")}</strong></td>
          <td>
            ${escapeHtml(l.tooth_positions || "—")}
            ${l.shade ? `<br/><span class="shade">Màu: ${escapeHtml(l.shade)}</span>` : ""}
          </td>
          <td class="r">${escapeHtml(fmtQty(l.quantity))}</td>
          <td class="r">${escapeHtml(formatVnd(l.unit_price))}</td>
          <td class="c">${escapeHtml(lineDiscountLabel(l.discount_percent, l.discount_amount))}</td>
          <td class="r"><strong>${escapeHtml(formatVnd(l.line_amount))}</strong></td>
        </tr>`,
    )
    .join("");
  const total = p.lines.reduce((s, l) => s + l.line_amount, 0);
  const words = amountInWordsVietnamese(Math.round(total));
  const now = new Date();
  const dayLine = `TP. HCM, ngày ${String(now.getDate()).padStart(2, "0")} tháng ${String(now.getMonth() + 1).padStart(2, "0")} năm ${now.getFullYear()}`;

  return `
    <section class="ocf-root">
      <div class="ocf-title-wrap">
        <h1>PHIẾU XÁC NHẬN ĐƠN HÀNG</h1>
        <div class="ocf-sub">Số đơn: <strong>${escapeHtml(p.order_number)}</strong> · Ngày nhận: ${escapeHtml(formatDate(p.received_at))}</div>
      </div>

      <div class="ocf-meta-grid">
        <div class="ocf-meta-box">
          <div class="ocf-meta-head">THÔNG TIN KHÁCH HÀNG</div>
          <table class="ocf-kv">
            <tbody>
              <tr><th>Tên KH:</th><td>${partnerInner || "—"}</td></tr>
              <tr><th>Địa chỉ:</th><td>${escapeHtml(p.partner_address?.trim() || "—")}</td></tr>
              <tr><th>MST:</th><td>${escapeHtml(p.partner_tax_id?.trim() || "—")}</td></tr>
              <tr><th>ĐT:</th><td>${escapeHtml(p.partner_phone?.trim() || "—")}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="ocf-meta-box">
          <div class="ocf-meta-head">THÔNG TIN PHỤC HÌNH</div>
          <table class="ocf-kv">
            <tbody>
              <tr><th>Nha khoa:</th><td>${escapeHtml(p.clinic_name?.trim() || "—")}</td></tr>
              <tr><th>Bệnh nhân:</th><td><strong>${escapeHtml(p.patient_name)}</strong></td></tr>
              <tr><th>Loại hàng:</th><td>${escapeHtml(cat)}</td></tr>
              <tr><th>Năm sinh/GT:</th><td>${escapeHtml(yearG)}</td></tr>
              <tr><th>Hẹn giao:</th><td>${p.due_delivery_at ? escapeHtml(formatDateTime(p.due_delivery_at)) : "—"}</td></tr>
              <tr><th>Hẹn hoàn thành:</th><td>${p.due_completion_at ? escapeHtml(formatDateTime(p.due_completion_at)) : "—"}</td></tr>
              <tr><th>Trạng thái:</th><td>${escapeHtml(formatOrderStatus(p.status))}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      ${p.clinical_indication ? `<div class="ocf-note"><strong>Chỉ định:</strong> ${escapeHtml(p.clinical_indication)}</div>` : ""}

      <table class="ocf-table">
        <thead>
          <tr>
            <th class="c" style="width:44px;">STT</th>
            <th style="width:72px;">Mã SP</th>
            <th>Tên sản phẩm</th>
            <th style="width:135px;">Răng/Màu</th>
            <th class="r" style="width:50px;">SL</th>
            <th class="r" style="width:90px;">Đơn giá</th>
            <th class="c" style="width:86px;">CK</th>
            <th class="r" style="width:105px;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="8" class="c">Chưa có dòng sản phẩm.</td></tr>`}</tbody>
        <tfoot>
          <tr>
            <td colspan="7" class="r lbl">Tổng cộng (VND):</td>
            <td class="r val">${escapeHtml(formatVnd(total))}</td>
          </tr>
        </tfoot>
      </table>

      <div class="ocf-foot-note">
        <p><strong>Bằng chữ:</strong> <em>${escapeHtml(words)}.</em></p>
        <p><strong>Ghi chú đơn:</strong> <em>${escapeHtml(p.notes?.trim() || "Không có ghi chú.")}</em></p>
        ${p.notes_accounting ? `<p><strong>Ghi chú kế toán:</strong> <em>${escapeHtml(p.notes_accounting)}</em></p>` : ""}
        ${p.notes_coordination ? `<p><strong>Ghi chú điều phối:</strong> <em>${escapeHtml(p.notes_coordination)}</em></p>` : ""}
      </div>

      <div class="ocf-sign-wrap">
        <div class="sg"><p class="ttl">Khách hàng</p><p class="hint">(Ký, ghi rõ họ tên)</p></div>
        <div class="sg"><p class="ttl">Người giao hàng</p><p class="hint">(Ký, ghi rõ họ tên)</p></div>
        <div class="sg"><p class="date">${escapeHtml(dayLine)}</p><p class="ttl">Người lập phiếu</p><p class="hint">(Ký, ghi rõ họ tên)</p></div>
      </div>
      <p class="ocf-bottom">* Phiếu xác nhận này đồng thời là căn cứ đối chiếu công nợ. Vui lòng kiểm tra kỹ thông tin trước khi ký nhận.</p>
    </section>

    <style>
      .ocf-root{color:#111827;font-family:"Times New Roman",Times,serif;}
      .ocf-title-wrap{text-align:center;margin-bottom:14px;}
      .ocf-title-wrap h1{margin:0;font-size:28px;font-weight:800;letter-spacing:.02em;color:#111827;}
      .ocf-sub{margin-top:6px;font-size:12px;color:#4b5563;}
      .ocf-meta-grid{display:grid;grid-template-columns:1fr 1fr;border:2px solid #111827;margin:0 0 16px;}
      .ocf-meta-box{min-width:0;}
      .ocf-meta-box:first-child{border-right:2px solid #111827;}
      .ocf-meta-head{background:#f3f4f6;padding:7px 10px;font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;border-bottom:2px solid #111827;}
      .ocf-kv{width:100%;border-collapse:collapse;margin:0;}
      .ocf-kv th,.ocf-kv td{border:none;padding:4px 10px;vertical-align:top;font-size:12px;}
      .ocf-kv th{width:94px;color:#4b5563;font-weight:600;text-align:left;text-transform:none;}
      .ocf-kv td{color:#111827;}
      .ocf-note{margin-bottom:10px;font-size:12px;color:#111827;}
      .ocf-table{width:100%;border-collapse:collapse;border:2px solid #111827;margin-top:8px;}
      .ocf-table th,.ocf-table td{border:1px solid #9ca3af;padding:7px 8px;font-size:11px;vertical-align:top;}
      .ocf-table th{background:#f3f4f6;color:#111827;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}
      .ocf-table .c{text-align:center;}
      .ocf-table .r{text-align:right;font-variant-numeric:tabular-nums;}
      .ocf-table .shade{font-size:10px;font-weight:700;color:#111827;}
      .ocf-table tfoot td{border-top:2px solid #111827;background:#f9fafb;}
      .ocf-table tfoot td.lbl{font-weight:700;text-transform:uppercase;}
      .ocf-table tfoot td.val{font-weight:800;font-size:16px;}
      .ocf-foot-note{margin-top:12px;font-size:12px;color:#374151;line-height:1.5;}
      .ocf-foot-note p{margin:3px 0;}
      .ocf-sign-wrap{margin-top:22px;border-top:1px solid #d1d5db;padding-top:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;}
      .ocf-sign-wrap .ttl{margin:0;font-size:12px;font-weight:700;text-transform:uppercase;}
      .ocf-sign-wrap .hint{margin:4px 0 0;font-size:11px;color:#6b7280;}
      .ocf-sign-wrap .date{margin:0 0 5px;font-size:11px;font-style:italic;color:#4b5563;}
      .ocf-bottom{margin-top:65px;text-align:center;font-size:10px;color:#6b7280;font-style:italic;}
      @media print{
        .ocf-meta-grid{break-inside:avoid;}
      }
    </style>
  `;
}

export function labOrderPrintTitle(p: LabOrderPrintPayload): string {
  return `Đơn hàng · ${p.order_number} — KT Smile Lab`;
}
