import { escapeHtml } from "@/lib/reports/escape-html";

export type PartnerTaxDisplay = {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  taxCode?: string | null;
};

/**
 * Hoá đơn phòng nha / labo (danh sách): không có `h` = nhiều lab / chưa chọn KH → ẩn block.
 * Có `h` → chỉ in từng dòng khi có dữ liệu (không hiển thị hàng toàn "—").
 */
export function htmlHoaDonPhongNhaCustomerBlock(h: PartnerTaxDisplay | undefined): string {
  if (!h) return "";
  const rows: string[] = [];
  const n = h.name?.trim();
  const a = h.address?.trim();
  const t = h.taxCode?.trim();
  const p = h.phone?.trim();
  if (n) rows.push(`<tr><th>TÊN KH</th><td style="color:#0f172a;">: ${escapeHtml(n)}</td></tr>`);
  if (a) rows.push(`<tr><th>ĐỊA CHỈ</th><td style="color:#0f172a;">: ${escapeHtml(a)}</td></tr>`);
  if (t) rows.push(`<tr><th>MST</th><td style="color:#0f172a;">: ${escapeHtml(t)}</td></tr>`);
  if (p) rows.push(`<tr><th>SĐT</th><td style="color:#0f172a;">: ${escapeHtml(p)}</td></tr>`);
  if (!rows.length) return "";
  return `<div style="margin-bottom:14px;"><table class="kv dn-kv" style="width:auto;"><tbody>${rows.join("")}</tbody></table></div>`;
}

/** Các <tr> đối tác cho GBTT (Tên KH + địa chỉ/MST/SĐT nếu có). `partnerCellInner` là HTML an toàn (đã escape). */
export function htmlGbttPartnerKvRows(opts: {
  partnerCellInner: string | null;
  address?: string | null;
  phone?: string | null;
  taxCode?: string | null;
}): string {
  const rows: string[] = [];
  if (opts.partnerCellInner?.trim()) {
    rows.push(`<tr><th scope="row">Tên KH</th><td>${opts.partnerCellInner}</td></tr>`);
  }
  const a = opts.address?.trim();
  const ph = opts.phone?.trim();
  const tx = opts.taxCode?.trim();
  if (a) rows.push(`<tr><th scope="row">Địa chỉ</th><td>${escapeHtml(a)}</td></tr>`);
  if (tx) rows.push(`<tr><th scope="row">MST</th><td>${escapeHtml(tx)}</td></tr>`);
  if (ph) rows.push(`<tr><th scope="row">SĐT</th><td>${escapeHtml(ph)}</td></tr>`);
  return rows.join("");
}
