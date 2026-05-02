import { escapeHtml } from "@/lib/reports/escape-html";
import { htmlBangChu } from "@/lib/reports/amount-in-words-html";
import { htmlHoaDonPhongNhaCustomerBlock, type PartnerTaxDisplay } from "@/lib/reports/partner-kv-html";
import type { LabOrderRow } from "@/lib/actions/lab-orders";
import { formatDate } from "@/lib/format/date";

export type LabOrderListReportPayload = {
  filtersDesc: string;
  generatedAt: string;
  rows: LabOrderRow[];
  customerHeader?: PartnerTaxDisplay;
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

    ${htmlHoaDonPhongNhaCustomerBlock(p.customerHeader)}

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
    ${htmlBangChu(subtotal, "Bằng chữ (cộng tiền hàng)")}
    ${htmlBangChu(finalBalance, "Bằng chữ (nợ cuối kỳ)")}

    <div style="margin-top:20px;display:flex;justify-content:flex-end;align-items:flex-start;">
      <div style="text-align:center;min-width:200px;">
        <div style="font-size:11px;color:#334155;">${new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
        <div style="font-weight:700;margin-top:5px;color:#0f172a;">NGƯỜI LẬP PHIẾU</div>
        <div style="margin-top:50px;font-size:10px;color:#475569;">(Ký và ghi rõ họ tên)</div>
      </div>
    </div>

    <style>
      /* ── Bảng dữ liệu chính ── */
      table.lol-table { width: 100% !important; border-collapse: collapse !important; margin-top: 6px; table-layout: fixed !important; }

      /* Header bảng: nền xanh đậm, chữ trắng — KHÔNG override bằng màu xám */
      .lol-table .lol-th {
        background-color: #1e3a5f !important;
        color: #ffffff !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        font-size: 10px !important;
        text-align: center !important;
        vertical-align: middle !important;
        border: 1px solid #1e3a5f !important;
        padding: 6px 4px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* Cell dữ liệu */
      .lol-table .lol-td {
        border: 1px solid #64748b !important;
        color: #0f172a !important;
        font-size: 11px !important;
        vertical-align: top !important;
        padding: 5px 4px !important;
        word-wrap: break-word !important;
      }

      /* Logo: giữ khung card bo góc như bản in */
      .logo {
        max-width: 130px !important;
        max-height: 90px !important;
        height: auto !important;
        display: inline-block !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 10px !important;
        padding: 6px !important;
        background: #fff !important;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08) !important;
        object-fit: contain !important;
      }

      table.dn-kv th { color: #0f172a !important; background: none !important; }
      .lol-foot td { font-size: 11px !important; }

      @media print {
        .lol-table .lol-th {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .lol-foot-total td {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .lol-table tbody tr { page-break-inside: avoid; }
      }
    </style>
  `;
}
