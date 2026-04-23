import { amountInWordsVietnamese } from "@/lib/format/currency";
import { escapeHtml } from "@/lib/reports/escape-html";
import { htmlHoaDonPhongNhaCustomerBlock } from "@/lib/reports/partner-kv-html";

/** Chân phiếu giao tháng: cộng tiền hàng, CK, nợ, thu, nợ cuối kỳ. */
export type DeliveryNoteMonthlyFooter = {
  subtotal_goods: number;
  discount_label: string;
  discount_amount: number;
  other_fees: number;
  opening_debt: number;
  payments_in_period: number;
  closing_debt: number;
};

const MONTHLY_DELIVERY_NOTE_SUPPORT_LINES = [
  "Nếu có bất kỳ sai sót hay thắc mắc cần hỗ trợ xin Quý khách vui lòng liên lạc với Lab khi nhận được phiếu này. Xin chân thành cảm ơn!",
  "Quý khách hàng thanh toán tiền vui lòng liên hệ hotline: 0906 3535 68 (Mr.Kiên)",
] as const;

export type DeliveryNoteLine = {
  product_code: string;
  product_name: string;
  tooth_positions: string;
  quantity: number;
  shade: string | null;
  /** Chỉ dùng khi in phiếu tháng (bảng phẳng). */
  unit_price?: number;
  line_amount?: number;
  notes?: string | null;
};

export type DeliveryNoteOrder = {
  order_number: string;
  patient_name: string;
  clinic_name: string | null;
  notes: string | null;
  /** Ngày nhận đơn (YYYY-MM-DD), dùng cho cột Ngày trên phiếu tháng. */
  received_date?: string;
  lines: DeliveryNoteLine[];
};

export type DeliveryNotePayload = {
  partner_code: string | null;
  partner_name: string | null;
  partner_address?: string | null;
  partner_phone?: string | null;
  partner_tax_id?: string | null;
  /** Ngày đại diện (vd ngày đầu tháng hoặc ngày nhận đơn). */
  delivery_date: string;
  /** Nếu có: hiển thị thay cho dòng “Ngày giao” (vd tháng hoặc mã đơn). */
  period_subtitle?: string | null;
  /** Tiêu đề lớn kiểu “THÁNG 02 2026” (phiếu giao tháng). */
  period_heading?: string | null;
  /** `monthly_flat`: một bảng xuyên suốt; mặc định: khối theo từng đơn. */
  layout?: "per_order" | "monthly_flat";
  monthly_footer?: DeliveryNoteMonthlyFooter | null;
  generated_at: string;
  orders: DeliveryNoteOrder[];
};

function fmtQty(n: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n);
}

/** DD/MM từ YYYY-MM-DD (chỉ ngày nhận, không năm — giống phiếu giao mẫu). */
export function formatDeliveryNoteDayMonth(isoDate: string): string {
  const d = isoDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return isoDate;
  const [y, m, day] = d.split("-");
  return `${day}/${m}`;
}

function fmtMoneyVnd(n: number) {
  const hasFrac = Math.abs(n % 1) > 1e-9;
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: hasFrac ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function noteCell(lineNotes: string | null | undefined, orderNotes: string | null) {
  const parts = [lineNotes?.trim(), orderNotes?.trim()].filter(Boolean) as string[];
  return parts.join(" · ");
}

function monthlyDisplayUnitPrice(line: DeliveryNoteLine): number {
  const qty = Number(line.quantity ?? 0);
  const amount = Number(line.line_amount ?? 0);
  if (qty > 0 && Number.isFinite(amount)) {
    return amount / qty;
  }
  return Number(line.unit_price ?? 0);
}

export function deliveryNotePartnerDisplayName(p: Pick<DeliveryNotePayload, "partner_code" | "partner_name">): string {
  const c = p.partner_code?.trim();
  const n = p.partner_name?.trim();
  if (c && n) return `${c} — ${n}`;
  return c || n || "";
}

function htmlDeliveryNotePartnerBlock(p: DeliveryNotePayload): string {
  const name = deliveryNotePartnerDisplayName(p);
  return htmlHoaDonPhongNhaCustomerBlock(
    {
      name: name || null,
      address: p.partner_address?.trim() || null,
      phone: p.partner_phone?.trim() || null,
      taxCode: p.partner_tax_id?.trim() || null,
    },
    { nameHeader: "LAB / KHÁCH HÀNG" },
  );
}

function htmlMonthlyDeliveryFooter(f: DeliveryNoteMonthlyFooter): string {
  const row = (label: string, value: string, opts?: { strong?: boolean; highlight?: boolean }) => {
    const bg = opts?.highlight ? "background:#a9c4eb !important;" : "";
    const fw = opts?.strong ? "font-weight:800;" : "font-weight:600;";
    return `<tr>
      <td class="dn-sum-lbl" style="${fw}${bg}">${escapeHtml(label)}</td>
      <td class="dn-sum-val" style="${fw}${bg}">${value}</td>
    </tr>`;
  };

  const fmtInt = (n: number) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(n));

  const lines: string[] = [
    row("CỘNG TIỀN HÀNG :", escapeHtml(fmtInt(f.subtotal_goods))),
    row(`${f.discount_label} :`, escapeHtml(fmtInt(f.discount_amount))),
  ];
  if (f.other_fees > 0.005) {
    lines.push(row("PHÍ KHÁC (GBTT) :", escapeHtml(fmtInt(f.other_fees))));
  }
  lines.push(
    row("NỢ ĐẦU KỲ :", escapeHtml(fmtInt(f.opening_debt))),
    row("THANH TOÁN TRONG KỲ :", escapeHtml(fmtInt(f.payments_in_period))),
    row(
      "TỔNG CỘNG NỢ CUỐI KỲ :",
      escapeHtml(fmtInt(f.closing_debt)),
      { strong: true, highlight: true },
    ),
  );

  const words = amountInWordsVietnamese(Math.round(f.closing_debt)).toLocaleUpperCase("vi-VN");
  const supportHtml = MONTHLY_DELIVERY_NOTE_SUPPORT_LINES.map(
    (t) =>
      `<p style="margin:6px 0 0;font-size:8.5px;font-style:italic;color:#334155;line-height:1.45;text-align:right;">${escapeHtml(t)}</p>`,
  ).join("");

  return `
    <div class="dn-monthly-foot-wrap" style="display:flex;justify-content:flex-end;width:100%;margin-top:12px;clear:both;">
      <div class="dn-monthly-foot" style="width:fit-content;max-width:min(100%,420px);text-align:right;font-size:12px;color:#0f172a;">
        <table class="dn-sum-table" style="margin-left:auto;border-collapse:collapse;width:100%;font-size:inherit;">
          <tbody>
            ${lines.join("")}
          </tbody>
        </table>
        <div style="margin-top:10px;font-size:11px;line-height:1.45;text-align:right;word-break:break-word;">
          <strong>SỐ TIỀN BẰNG CHỮ :</strong>
          <span style="font-weight:700;"> ${escapeHtml(words)} ./.</span>
        </div>
        ${supportHtml}
      </div>
    </div>
    <style>
      .dn-sum-table td {
        border: 1px solid #94a3b8;
        padding: 6px 10px;
        font-size: 12px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .dn-sum-table .dn-sum-lbl {
        text-align: right;
        text-transform: uppercase;
        white-space: nowrap;
        background: #fff;
      }
      .dn-sum-table .dn-sum-val {
        text-align: right;
        min-width: 160px;
        font-variant-numeric: tabular-nums;
        background: #fff;
      }
    </style>
  `;
}

function buildMonthlyFlatDeliveryNoteHtml(p: DeliveryNotePayload): string {
  const heading = escapeHtml(p.period_heading?.trim() || p.period_subtitle?.trim() || "");
  const sub = p.period_subtitle?.trim() && p.period_heading?.trim() !== p.period_subtitle?.trim()
    ? escapeHtml(p.period_subtitle.trim())
    : "";

  const rowHtml: string[] = [];
  let stt = 0;
  for (const o of p.orders) {
    const received = o.received_date ?? p.delivery_date;
    const ngay = formatDeliveryNoteDayMonth(received);
    const nhaKhoa = o.clinic_name?.trim() ? escapeHtml(o.clinic_name) : "";
    const bn = escapeHtml(o.patient_name);
    if (!o.lines.length) {
      stt += 1;
      const gc = escapeHtml(noteCell(null, o.notes));
      rowHtml.push(
        `<tr>
          <td class="num">${stt}</td>
          <td class="cen">${ngay}</td>
          <td class="cen">${nhaKhoa}</td>
          <td>${bn}</td>
          <td>—</td>
          <td class="cen">—</td>
          <td class="num">—</td>
          <td class="num">—</td>
          <td class="num">—</td>
          <td>${gc}</td>
        </tr>`,
      );
      continue;
    }
    for (const l of o.lines) {
      stt += 1;
      const toothRaw = [l.tooth_positions?.trim(), l.shade?.trim()].filter(Boolean).join(" · ") || "—";
      const tooth = escapeHtml(toothRaw);
      const gc = escapeHtml(noteCell(l.notes, o.notes));
      const up = monthlyDisplayUnitPrice(l);
      const amt = l.line_amount ?? 0;
      rowHtml.push(
        `<tr>
          <td class="num">${stt}</td>
          <td class="cen">${ngay}</td>
          <td class="cen">${nhaKhoa}</td>
          <td>${bn}</td>
          <td>${escapeHtml(l.product_name || l.product_code || "—")}</td>
          <td class="cen">${tooth}</td>
          <td class="num">${escapeHtml(fmtQty(l.quantity))}</td>
          <td class="num">${escapeHtml(fmtMoneyVnd(up))}</td>
          <td class="num">${escapeHtml(fmtMoneyVnd(amt))}</td>
          <td>${gc}</td>
        </tr>`,
      );
    }
  }

  return `
    <h1 style="color:#0f172a;text-align:center;margin-bottom:4px;">HOÁ ĐƠN PHÒNG NHA / LABO</h1>
    <p style="text-align:center;font-size:15px;font-weight:700;color:#0f172a;margin:0 0 6px;">${heading}</p>
    ${sub ? `<p style="text-align:center;font-size:11px;color:#475569;margin:0 0 10px;">${sub}</p>` : ""}

    ${htmlDeliveryNotePartnerBlock(p)}
    <table class="kv dn-kv" style="margin-bottom:14px;">
      <tbody>
        <tr><th>SỐ DÒNG PHIẾU</th><td style="color:#0f172a;">: ${rowHtml.length}</td></tr>
      </tbody>
    </table>

    <table class="dn-month-table">
      <thead>
        <tr>
          <th class="cen" style="width:36px;">STT</th>
          <th class="cen" style="width:44px;">NGÀY</th>
          <th class="cen" style="width:110px;">NHA KHOA</th>
          <th style="min-width:100px;">TÊN BỆNH NHÂN</th>
          <th style="min-width:120px;">SẢN PHẨM</th>
          <th class="cen" style="width:100px;">VỊ TRÍ RĂNG</th>
          <th class="num" style="width:44px;">SL</th>
          <th class="num" style="width:72px;">ĐƠN GIÁ (VNĐ)</th>
          <th class="num" style="width:80px;">THÀNH TIỀN (VNĐ)</th>
          <th style="min-width:72px;">GHI CHÚ</th>
        </tr>
      </thead>
      <tbody>
        ${rowHtml.join("")}
      </tbody>
    </table>

    <p style="font-size:9px;color:#64748b;margin-top:8px;">In lúc: ${escapeHtml(p.generated_at)}</p>

    ${p.monthly_footer ? htmlMonthlyDeliveryFooter(p.monthly_footer) : ""}

    <div style="margin-top:28px;display:grid;grid-template-columns:1fr 1fr;text-align:center;">
      <div>
        <div style="font-weight:700;">NGƯỜI NHẬN HÀNG</div>
        <div style="font-size:10px;margin-top:40px;color:#475569;">(Ký và ghi rõ họ tên)</div>
      </div>
      <div>
        <div style="font-weight:700;">LAB XÁC NHẬN</div>
        <div style="font-size:10px;margin-top:40px;color:#475569;">(Ký và ghi rõ họ tên)</div>
      </div>
    </div>

    <style>
      .dn-month-table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
      .dn-month-table th,
      .dn-month-table td {
        border: 1px solid #64748b;
        padding: 4px 5px;
        color: #0f172a;
        background: #fff;
        vertical-align: middle;
        word-wrap: break-word;
      }
      .dn-month-table thead th {
        background: #c6ddf7 !important;
        font-weight: 700;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .dn-month-table .cen { text-align: center; }
      .dn-month-table .num { text-align: right; }
      table.dn-kv th { color: #0f172a !important; }
      table.dn-kv td { color: #0f172a !important; }
    </style>
  `;
}

export function deliveryNotePrintTitle(p: DeliveryNotePayload): string {
  const who = p.partner_code || p.partner_name || "Khách hàng";
  const docLabel = p.layout === "monthly_flat" ? "Hóa đơn phòng nha/labo" : "Phiếu giao hàng";
  if (p.period_heading?.trim()) {
    return `${docLabel} · ${p.period_heading.trim()} · ${who}`;
  }
  if (p.period_subtitle?.trim()) {
    return `${docLabel} · ${p.period_subtitle.trim()} · ${who}`;
  }
  return `${docLabel} ${p.delivery_date} · ${who}`;
}

export function buildDeliveryNoteBodyHtml(p: DeliveryNotePayload): string {
  if (p.layout === "monthly_flat") {
    return buildMonthlyFlatDeliveryNoteHtml(p);
  }

  const orderRows = p.orders
    .map((o, idx) => {
      const lineHtml = o.lines
        .map(
          (l) =>
            `<tr>
              <td style="width:70px;">${escapeHtml(l.product_code)}</td>
              <td>${escapeHtml(l.product_name)}</td>
              <td style="width:130px;">${escapeHtml(l.tooth_positions || "—")}${l.shade ? ` · ${escapeHtml(l.shade)}` : ""}</td>
              <td class="num" style="width:50px;">${escapeHtml(fmtQty(l.quantity))}</td>
            </tr>`,
        )
        .join("");
      return `<section class="order-block">
        <h3 style="background:#f1f5f9;padding:4px 8px;font-size:11px;margin-bottom:6px;border-left:3px solid #2563eb;">
          ${idx + 1}. ĐƠN ${escapeHtml(o.order_number)} — BN: ${escapeHtml(o.patient_name)}
        </h3>
        ${o.clinic_name ? `<div style="font-size:10px;margin-bottom:4px;color:#334155;padding-left:11px;">Nha khoa: ${escapeHtml(o.clinic_name)}</div>` : ""}
        <table class="dn-line-table">
          <thead>
            <tr>
              <th class="dn-line-th" style="width:70px;">MÃ SP</th>
              <th class="dn-line-th">TÊN SẢN PHẨM</th>
              <th class="dn-line-th" style="width:130px;">RĂNG/MÀU</th>
              <th class="dn-line-th num" style="width:50px;">SL</th>
            </tr>
          </thead>
          <tbody>${lineHtml || `<tr><td colspan="4">Không có dòng.</td></tr>`}</tbody>
        </table>
        ${o.notes ? `<div style="font-size:10px;margin-top:4px;color:#334155;padding-left:11px;">Ghi chú: ${escapeHtml(o.notes)}</div>` : ""}
      </section>`;
    })
    .join("");

  const periodLine = p.period_subtitle?.trim()
    ? escapeHtml(p.period_subtitle.trim())
    : `Ngày giao: <strong>${escapeHtml(p.delivery_date)}</strong>`;

  return `
    <h1 style="color:#0f172a;">PHIẾU GIAO HÀNG TỔNG HỢP</h1>
    <p style="text-align:center;font-size:12px;color:#334155;margin-bottom:10px;">${periodLine}</p>

    ${htmlDeliveryNotePartnerBlock(p)}
    <table class="kv dn-kv" style="margin-bottom:20px;">
      <tbody>
        <tr><th>SỐ ĐƠN HÀNG</th><td style="color:#0f172a;">: ${p.orders.length} đơn</td></tr>
      </tbody>
    </table>

    <div style="border-top:1px dashed #cbd5e1;padding-top:10px;">
      ${orderRows || "<p>Không có đơn hàng.</p>"}
    </div>

    <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;text-align:center;">
      <div>
        <div style="font-weight:700;">NGƯỜI NHẬN HÀNG</div>
        <div style="font-size:10px;margin-top:40px;color:#475569;">(Ký và ghi rõ họ tên)</div>
      </div>
      <div>
        <div style="font-weight:700;">LAB XÁC NHẬN</div>
        <div style="font-size:10px;margin-top:40px;color:#475569;">(Ký và ghi rõ họ tên)</div>
      </div>
    </div>

    <style>
      .order-block { margin-top: 16px; page-break-inside: avoid; }
      .dn-line-table { border: 1px solid #475569; }
      .dn-line-table th.dn-line-th,
      .dn-line-table td {
        border: 1px solid #64748b !important;
        color: #0f172a !important;
        background: #fff !important;
      }
      .dn-line-table thead .dn-line-th {
        background: #e2e8f0 !important;
        color: #0f172a !important;
        font-weight: 700;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      table.dn-kv th { color: #0f172a !important; }
      table.dn-kv td { color: #0f172a !important; }
      .order-block h3 { color: #0f172a !important; }
      .dn-line-table td { height: 20px; font-size: 10.5px; }
    </style>
  `;
}
