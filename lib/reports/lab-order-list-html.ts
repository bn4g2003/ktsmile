import { escapeHtml } from "@/lib/reports/escape-html";
import type { LabOrderRow } from "@/lib/actions/lab-orders";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatOrderStatus, formatCoordReviewStatus } from "@/lib/format/labels";

export type LabOrderListReportPayload = {
  filtersDesc: string;
  generatedAt: string;
  rows: LabOrderRow[];
  customerHeader?: {
    name: string;
    address?: string;
    phone?: string;
    taxCode?: string;
  };
  stats?: {
    prevBalance?: number;
    discount?: number;
    paid?: number;
  };
};

export function buildLabOrderListReportHtml(p: LabOrderListReportPayload): string {
  const rowsHtml = p.rows
    .map(
      (r, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td style="width:55px;">${escapeHtml(formatDate(r.received_at))}</td>
      <td style="width:110px;">${escapeHtml(r.clinic_name ?? "") || "—"}</td>
      <td style="width:130px;"><strong>${escapeHtml(r.patient_name)}</strong></td>
      <td>${escapeHtml(r.order_number)}</td>
      <td style="width:85px;">${escapeHtml(r.tooth_positions_summary || "")}</td>
      <td class="num" style="width:35px;">1</td>
      <td class="num" style="width:85px;">${r.total_amount.toLocaleString("vi-VN")}</td>
      <td class="num" style="width:95px;"><strong>${r.total_amount.toLocaleString("vi-VN")}</strong></td>
      <td>${escapeHtml(r.notes || "")}</td>
    </tr>
  `,
    )
    .join("");

  const subtotal = p.rows.reduce((sum, r) => sum + r.total_amount, 0);
  const discount = p.stats?.discount ?? 0;
  const prevBalance = p.stats?.prevBalance ?? 0;
  const paid = p.stats?.paid ?? 0;
  const finalBalance = prevBalance + subtotal - discount - paid;

  return `
    <h1 style="color:#2563eb;margin-bottom:5px;">HOÁ ĐƠN PHÒNG NHA / LABO</h1>
    
    <div style="margin-bottom:15px;">
      <table class="kv" style="width:auto;">
        <tbody>
          <tr><th>TÊN KH</th><td>: ${escapeHtml(p.customerHeader?.name ?? "—")}</td></tr>
          <tr><th>ĐỊA CHỈ</th><td>: ${escapeHtml(p.customerHeader?.address ?? "—")}</td></tr>
          <tr><th>MST</th><td>: ${escapeHtml(p.customerHeader?.taxCode ?? "—")}</td></tr>
          <tr><th>SĐT</th><td>: ${escapeHtml(p.customerHeader?.phone ?? "—")}</td></tr>
        </tbody>
      </table>
    </div>

    <div style="text-align:center;font-weight:700;margin-bottom:10px;font-size:14px;text-transform:uppercase;">
      ${escapeHtml(p.filtersDesc)}
    </div>

    <table>
      <thead>
        <tr style="background:#2563eb;color:#fff;">
          <th class="num" style="width:30px;color:#fff;">STT</th>
          <th style="color:#fff;">NGÀY</th>
          <th style="color:#fff;">NHA KHOA</th>
          <th style="color:#fff;">TÊN BỆNH NHÂN</th>
          <th style="color:#fff;">SẢN PHẨM</th>
          <th style="color:#fff;">VỊ TRÍ RĂNG</th>
          <th class="num" style="color:#fff;">SL</th>
          <th class="num" style="color:#fff;">ĐƠN GIÁ</th>
          <th class="num" style="color:#fff;">THÀNH TIỀN</th>
          <th style="color:#fff;">GHI CHÚ</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="10" style="text-align:center;padding:20px;">Không có dữ liệu.</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="8" class="num" style="border:none;">CỘNG TIỀN HÀNG :</td>
          <td class="num" style="border-left:1px solid #cbd5e1;background:#f8fafc;">${subtotal.toLocaleString("vi-VN")}</td>
          <td style="border:none;"></td>
        </tr>
        <tr class="total-row">
          <td colspan="8" class="num" style="border:none;">CHIẾT KHẤU GIẢM :</td>
          <td class="num" style="border-left:1px solid #cbd5e1;">${discount.toLocaleString("vi-VN")}</td>
          <td style="border:none;"></td>
        </tr>
        <tr class="total-row">
          <td colspan="8" class="num" style="border:none;">NỢ ĐẦU KỲ :</td>
          <td class="num" style="border-left:1px solid #cbd5e1;">${prevBalance.toLocaleString("vi-VN")}</td>
          <td style="border:none;"></td>
        </tr>
        <tr class="total-row">
          <td colspan="8" class="num" style="border:none;">THANH TOÁN TRONG KỲ :</td>
          <td class="num" style="border-left:1px solid #cbd5e1;">${paid.toLocaleString("vi-VN")}</td>
          <td style="border:none;"></td>
        </tr>
        <tr class="total-row" style="background:#2563eb;color:#fff;">
          <td colspan="8" class="num" style="border:none;color:#fff;font-weight:800;">TỔNG CỘNG NỢ CUỐI KỲ :</td>
          <td class="num" style="border-left:1px solid #cbd5e1;color:#fff;font-weight:800;font-size:13px;">${finalBalance.toLocaleString("vi-VN")}</td>
          <td style="border:none;"></td>
        </tr>
      </tfoot>
    </table>

    <div style="margin-top:20px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="font-size:11px;font-style:italic;max-width:60%;">
        <p>Số tiền bằng chữ: <strong>${paid > 0 ? "... (đã bao gồm thanh toán)" : "—"}</strong></p>
        <p style="margin-top:5px;color:#64748b;">* Nếu có bất kỳ sai sót nào hoặc thắc mắc cần hỗ trợ quý khách vui lòng liên hệ với Lab khi nhận được phiếu này. Xin chân thành cảm ơn!</p>
      </div>
      <div style="text-align:center;min-width:200px;">
        <div style="font-size:11px;">${new Date().toLocaleDateString("vi-VN", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div style="font-weight:700;margin-top:5px;">NGƯỜI LẬP PHIẾU</div>
        <div style="margin-top:50px;font-size:10px;color:#94a3b8;">(Ký và ghi rõ họ tên)</div>
      </div>
    </div>

    <style>
      th { background-color: #2563eb !important; color:#fff !important; }
      td { height: 18px; font-size: 10px; }
      .num { font-size: 10.5px; }
      @media print {
        th { background-color: #2563eb !important; -webkit-print-color-adjust: exact; }
      }
    </style>
  `;
}
