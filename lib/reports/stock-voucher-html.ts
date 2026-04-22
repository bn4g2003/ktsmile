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
  const isOutbound = p.movement_type === "outbound";
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
    <div style="margin-top: -10px;">
      <h1>${escapeHtml(kind)}</h1>
      <p style="text-align:center; font-size: 13px; margin: 0 0 15px 0;">
        Số: <strong>${escapeHtml(p.document_number)}</strong> 
        <span style="margin: 0 10px; color: #cbd5e1;">|</span> 
        Ngày: <strong>${p.document_date.split('-').reverse().join('/')}</strong>
      </p>

      <table class="kv" style="margin-bottom: 15px;">
        <tbody>
          <tr>
            <th style="width: 100px;">Đối tác:</th>
            <td style="font-weight: 700;">${partnerLine}</td>
          </tr>
          <tr>
            <th>Lý do:</th>
            <td>${escapeHtml(p.reason ?? "—")}</td>
          </tr>
          <tr>
            <th>Ghi chú:</th>
            <td>${escapeHtml(p.notes ?? "—")}</td>
          </tr>
        </tbody>
      </table>

      <table style="margin-bottom: 15px;">
        <thead>
          <tr>
            <th style="width: 30px;" class="num">STT</th>
            <th style="width: 90px;">Mã vật tư</th>
            <th>Tên vật phẩm</th>
            <th style="width: 50px;">ĐVT</th>
            <th style="width: 60px;" class="num">SL</th>
            <th style="width: 90px;" class="num">Đơn giá</th>
            <th style="width: 100px;" class="num">Thành tiền</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="7" style="text-align:center;">Chưa có dữ liệu dòng phiếu.</td></tr>`}</tbody>
        <tfoot>
          <tr>
            <th colspan="6" class="num" style="font-size: 11px;">Tổng cộng:</th>
            <th class="num" style="font-size: 11px;">${escapeHtml(formatVnd(total))}</th>
          </tr>
        </tfoot>
      </table>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; margin-top: 30px; min-height: 100px;">
        <div>
          <div style="font-weight: 700;">Người lập phiếu</div>
          <div style="font-size: 10px; font-style: italic; color: #64748b;">(Ký, họ tên)</div>
        </div>
        <div>
          <div style="font-weight: 700;">Người ${isOutbound ? 'nhận' : 'giao'} hàng</div>
          <div style="font-size: 10px; font-style: italic; color: #64748b;">(Ký, họ tên)</div>
        </div>
        <div>
          <div style="font-weight: 700;">Thủ kho</div>
          <div style="font-size: 10px; font-style: italic; color: #64748b;">(Ký, họ tên)</div>
        </div>
        <div>
          <div style="font-weight: 700;">Giám đốc</div>
          <div style="font-size: 10px; font-style: italic; color: #64748b;">(Ký, họ tên)</div>
        </div>
      </div>

      <div style="margin-top: 50px; text-align: right; font-size: 10px; color: #94a3b8;">
        In lúc: ${escapeHtml(gen)} — Hệ thống quản lý KTSmile Lab
      </div>
    </div>
  `;
}

export function stockVoucherPrintTitle(p: StockDocumentPrintPayload): string {
  const kind = p.movement_type === "inbound" ? "Phiếu nhập kho" : "Phiếu xuất kho";
  return `${kind} · ${p.document_number} — KT Smile Lab`;
}
