import { formatVnd } from "@/lib/format/currency";
import { formatMovement } from "@/lib/format/labels";
import { escapeHtml } from "@/lib/reports/escape-html";

export type StockDocumentPrintLine = {
  product_code: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  line_amount: number;
};

export type StockDocumentPrintPayload = {
  document_number: string;
  document_date: string;
  movement_type: "inbound" | "outbound";
  partner_code: string | null;
  partner_name: string | null;
  reason: string | null;
  notes: string | null;
  lines: StockDocumentPrintLine[];
};

function fmtQty(n: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(n);
}

/** HTML phần thân (đã escape) — dùng với buildPrintShell. */
export function buildStockVoucherBodyHtml(p: StockDocumentPrintPayload): string {
  const kind = formatMovement(p.movement_type);
  const gen = new Date().toLocaleString("vi-VN");
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
          <td class="num">${escapeHtml(fmtQty(l.quantity))}</td>
          <td class="num">${escapeHtml(formatVnd(l.unit_price))}</td>
          <td class="num">${escapeHtml(formatVnd(l.line_amount))}</td>
        </tr>`,
    )
    .join("");
  const total = p.lines.reduce((s, l) => s + l.line_amount, 0);
  return `
    <h1>${escapeHtml(kind)}</h1>
    <p class="muted">Số phiếu: <strong>${escapeHtml(p.document_number)}</strong> · Ngày: ${escapeHtml(p.document_date)} · ${escapeHtml(gen)}</p>
    <table class="kv">
      <tbody>
        <tr><th>Loại phiếu</th><td>${escapeHtml(kind)}</td></tr>
        <tr><th>Đối tác</th><td>${partnerLine}</td></tr>
        <tr><th>Lý do</th><td>${escapeHtml(p.reason ?? "—")}</td></tr>
        <tr><th>Ghi chú</th><td>${escapeHtml(p.notes ?? "—")}</td></tr>
      </tbody>
    </table>
    <h2>Chi tiết vật tư</h2>
    <table>
      <thead>
        <tr>
          <th class="num">STT</th>
          <th>Mã SP</th>
          <th>Tên SP</th>
          <th>ĐVT</th>
          <th class="num">SL</th>
          <th class="num">Đơn giá</th>
          <th class="num">Thành tiền</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="7">Chưa có dòng.</td></tr>`}</tbody>
      <tfoot>
        <tr>
          <th colspan="6" class="num">Cộng</th>
          <th class="num">${escapeHtml(formatVnd(total))}</th>
        </tr>
      </tfoot>
    </table>
  `;
}

export function stockVoucherPrintTitle(p: StockDocumentPrintPayload): string {
  const kind = p.movement_type === "inbound" ? "Phiếu nhập kho" : "Phiếu xuất kho";
  return `${kind} · ${p.document_number} — KT Smile Lab`;
}
