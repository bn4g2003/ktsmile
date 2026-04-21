import { escapeHtml } from "@/lib/reports/escape-html";
import type { LabOrderRow } from "@/lib/actions/lab-orders";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatOrderStatus, formatCoordReviewStatus } from "@/lib/format/labels";

export type LabOrderListReportPayload = {
  filtersDesc: string;
  generatedAt: string;
  rows: LabOrderRow[];
};

export function buildLabOrderListReportHtml(p: LabOrderListReportPayload): string {
  const rowsHtml = p.rows
    .map(
      (r, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td><strong>${escapeHtml(r.order_number)}</strong></td>
      <td>${escapeHtml(r.partner_code ?? "")} — ${escapeHtml(r.partner_name ?? "")}</td>
      <td>${escapeHtml(formatDate(r.received_at))}</td>
      <td>${escapeHtml(r.patient_name)}</td>
      <td>${escapeHtml(r.clinic_name ?? "—")}</td>
      <td><span class="badge badge-${r.status}">${escapeHtml(formatOrderStatus(r.status))}</span></td>
      <td class="num"><strong>${r.total_amount.toLocaleString("vi-VN")}</strong></td>
    </tr>
  `,
    )
    .join("");

  const totalAmount = p.rows.reduce((sum, r) => sum + r.total_amount, 0);

  return `
    <h1>Danh sách đơn hàng phục hình</h1>
    <p class="muted" style="text-align:center;">${escapeHtml(p.filtersDesc)}</p>
    <p class="muted" style="text-align:center;font-size:11px;">In lúc: ${escapeHtml(p.generatedAt)} · Số lượng: ${p.rows.length} đơn</p>

    <table>
      <thead>
        <tr>
          <th class="num" style="width:40px;">STT</th>
          <th style="width:120px;">Số đơn</th>
          <th>Khách hàng</th>
          <th style="width:100px;">Ngày nhận</th>
          <th>Bệnh nhân</th>
          <th>Nha khoa</th>
          <th style="width:100px;">Trạng thái</th>
          <th class="num" style="width:110px;">Tổng tiền</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="8" style="text-align:center;padding:24px;color:#666;">Không có dữ liệu phù hợp bộ lọc.</td></tr>'}
      </tbody>
      ${p.rows.length > 0 ? `
      <tfoot>
        <tr>
          <td colspan="7" style="text-align:right;font-weight:700;">TỔNG CỘNG (${p.rows.length} đơn):</td>
          <td class="num" style="font-weight:700;font-size:14px;">${totalAmount.toLocaleString("vi-VN")}</td>
        </tr>
      </tfoot>
      ` : ''}
    </table>

    <style>
      table { font-size: 11px; }
      th { white-space: nowrap; }
      .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
      .badge-draft { background: #e2e8f0; color: #475569; }
      .badge-in_progress { background: #dcfce7; color: #166534; }
      .badge-completed { background: #dbeafe; color: #1e40af; }
      .badge-delivered { background: #fef9c3; color: #854d0e; }
      .badge-cancelled { background: #fee2e2; color: #991b1b; }
      @media print {
        .badge { border: 1px solid #ccc; }
      }
    </style>
  `;
}
