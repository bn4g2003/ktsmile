import { escapeHtml } from "@/lib/reports/escape-html";
import type { LabOrderRow } from "@/lib/actions/lab-orders";
import { formatDate } from "@/lib/format/date";

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

function formatQuantityCell(r: LabOrderRow): string {
  if (r.line_quantity_total != null && r.line_quantity_total > 0) {
    return String(r.line_quantity_total);
  }
  if (r.tooth_count_total != null && r.tooth_count_total > 0) {
    return String(r.tooth_count_total);
  }
  return "—";
}

export function buildLabOrderListReportHtml(p: LabOrderListReportPayload): string {
  const rowsHtml = p.rows
    .map(
      (r, i) => `
    <tr>
      <td class="num lol-td">${i + 1}</td>
      <td class="lol-td" style="width:52px;">${escapeHtml(formatDate(r.received_at))}</td>
      <td class="lol-td" style="width:100px;">${escapeHtml(r.clinic_name ?? "") || "—"}</td>
      <td class="lol-td" style="width:120px;"><strong>${escapeHtml(r.patient_name)}</strong></td>
      <td class="lol-td" style="width:100px;">${escapeHtml(r.order_number)}</td>
      <td class="lol-td">${escapeHtml(r.products_summary ?? "") || "—"}</td>
      <td class="lol-td" style="width:80px;">${escapeHtml(r.tooth_positions_summary || "") || "—"}</td>
      <td class="num lol-td" style="width:36px;">${escapeHtml(formatQuantityCell(r))}</td>
      <td class="num lol-td" style="width:88px;"><strong>${r.grand_total.toLocaleString("vi-VN")}</strong></td>
      <td class="lol-td">${escapeHtml(r.notes || "")}</td>
    </tr>
  `,
    )
    .join("");

  const subtotal = p.rows.reduce((sum, r) => sum + r.grand_total, 0);
  const discount = p.stats?.discount ?? 0;
  const prevBalance = p.stats?.prevBalance ?? 0;
  const paid = p.stats?.paid ?? 0;
  const finalBalance = prevBalance + subtotal - discount - paid;

  return `
    <h1 style="color:#0f172a;margin-bottom:8px;">HOÁ ĐƠN PHÒNG NHA / LABO</h1>

    <div style="margin-bottom:14px;">
      <table class="kv dn-kv" style="width:auto;">
        <tbody>
          <tr><th>TÊN KH</th><td style="color:#0f172a;">: ${escapeHtml(p.customerHeader?.name ?? "—")}</td></tr>
          <tr><th>ĐỊA CHỈ</th><td style="color:#0f172a;">: ${escapeHtml(p.customerHeader?.address ?? "—")}</td></tr>
          <tr><th>MST</th><td style="color:#0f172a;">: ${escapeHtml(p.customerHeader?.taxCode ?? "—")}</td></tr>
          <tr><th>SĐT</th><td style="color:#0f172a;">: ${escapeHtml(p.customerHeader?.phone ?? "—")}</td></tr>
        </tbody>
      </table>
    </div>

    <div style="text-align:center;font-weight:700;margin-bottom:10px;font-size:13px;text-transform:uppercase;color:#334155;">
      ${escapeHtml(p.filtersDesc)}
    </div>

    <table class="lol-table">
      <thead>
        <tr>
          <th class="lol-th num" style="width:30px;">STT</th>
          <th class="lol-th">Ngày nhận</th>
          <th class="lol-th">Nha khoa</th>
          <th class="lol-th">Bệnh nhân</th>
          <th class="lol-th">Số đơn</th>
          <th class="lol-th">Sản phẩm</th>
          <th class="lol-th">Vị trí răng</th>
          <th class="lol-th num">SL</th>
          <th class="lol-th num">Thành tiền</th>
          <th class="lol-th">Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="10" style="text-align:center;padding:20px;">Không có dữ liệu.</td></tr>'}
        <tr class="lol-foot">
          <td colspan="8" class="num" style="border:none;color:#0f172a;">CỘNG TIỀN HÀNG :</td>
          <td class="num" style="border:1px solid #64748b;background:#f1f5f9;color:#0f172a;">${subtotal.toLocaleString("vi-VN")}</td>
          <td style="border:none;"></td>
        </tr>
        <tr class="lol-foot">
          <td colspan="8" class="num" style="border:none;color:#0f172a;">CHIẾT KHẤU GIẢM :</td>
          <td class="num" style="border:1px solid #64748b;color:#0f172a;">${discount.toLocaleString("vi-VN")}</td>
          <td style="border:none;"></td>
        </tr>
        <tr class="lol-foot">
          <td colspan="8" class="num" style="border:none;color:#0f172a;">NỢ ĐẦU KỲ :</td>
          <td class="num" style="border:1px solid #64748b;color:#0f172a;">${prevBalance.toLocaleString("vi-VN")}</td>
          <td style="border:none;"></td>
        </tr>
        <tr class="lol-foot">
          <td colspan="8" class="num" style="border:none;color:#0f172a;">THANH TOÁN TRONG KỲ :</td>
          <td class="num" style="border:1px solid #64748b;color:#0f172a;">${paid.toLocaleString("vi-VN")}</td>
          <td style="border:none;"></td>
        </tr>
        <tr class="lol-foot lol-foot-total">
          <td colspan="8" class="num" style="border:none;color:#0f172a;font-weight:800;">TỔNG CỘNG NỢ CUỐI KỲ :</td>
          <td class="num" style="border:1px solid #475569;background:#e2e8f0;color:#0f172a;font-weight:800;font-size:13px;">${finalBalance.toLocaleString("vi-VN")}</td>
          <td style="border:none;"></td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top:20px;display:flex;justify-content:flex-end;align-items:flex-start;">
      <div style="text-align:center;min-width:200px;">
        <div style="font-size:11px;color:#334155;">${new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
        <div style="font-weight:700;margin-top:5px;color:#0f172a;">NGƯỜI LẬP PHIẾU</div>
        <div style="margin-top:50px;font-size:10px;color:#475569;">(Ký và ghi rõ họ tên)</div>
      </div>
    </div>

    <style>
      table.lol-table { border: 1px solid #475569; width: 100%; margin-top: 6px; }
      .lol-table th.lol-th,
      .lol-table td.lol-td {
        border: 1px solid #64748b !important;
        color: #0f172a !important;
        background: #fff !important;
        font-size: 10px;
        vertical-align: top;
      }
      .lol-table thead .lol-th {
        background: #e2e8f0 !important;
        color: #0f172a !important;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 9px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .lol-table td.lol-td { height: auto; min-height: 18px; }
      table.dn-kv th { color: #0f172a !important; }
      .lol-foot td { font-size: 11px; }
      @media print {
        .lol-table thead .lol-th {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .lol-foot-total td {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        /* Không tách một dòng tổng qua hai trang */
        .lol-table tbody tr.lol-foot {
          page-break-inside: avoid;
        }
      }
    </style>
  `;
}
