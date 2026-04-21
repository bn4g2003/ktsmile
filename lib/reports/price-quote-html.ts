import { formatVnd } from "@/lib/format/currency";
import { escapeHtml } from "@/lib/reports/escape-html";

export type PriceQuoteProduct = {
  product_code: string;
  product_name: string;
  unit: string;
  base_price: number;
  partner_price: number | null;
  discount_percent: number;
};

export type PriceQuotePrintPayload = {
  partner_code: string;
  partner_name: string;
  generated_at: string;
  products: PriceQuoteProduct[];
};

export function priceQuotePrintTitle(p: PriceQuotePrintPayload): string {
  return `Báo giá · ${p.partner_code} — KT Smile Lab`;
}

export function buildPriceQuoteBodyHtml(p: PriceQuotePrintPayload): string {
  const rows = p.products
    .map(
      (prod, i) => {
        const finalPrice = prod.partner_price ?? prod.base_price;
        const hasCustomPrice = prod.partner_price !== null;
        
        return `<tr>
          <td class="num">${i + 1}</td>
          <td><strong>${escapeHtml(prod.product_code)}</strong></td>
          <td>${escapeHtml(prod.product_name)}</td>
          <td>${escapeHtml(prod.unit || "—")}</td>
          <td class="num" style="color:#888;">${escapeHtml(formatVnd(prod.base_price))}</td>
          <td class="num" style="color:#7c3aed;">${prod.discount_percent > 0 ? escapeHtml(String(prod.discount_percent)) + "%" : "—"}</td>
          <td class="num" style="font-weight:bold;color:${hasCustomPrice ? "#0066cc" : "#333"};">${escapeHtml(formatVnd(finalPrice))}</td>
        </tr>`;
      },
    )
    .join("");

  return `
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="margin:0;font-size:28px;color:#0066cc;">BẢNG BÁO GIÁ</h1>
      <p style="margin:8px 0 0 0;font-size:14px;color:#666;">KT Smile Lab — Trung tâm Kỹ thuật Răng</p>
    </div>
    
    <table class="kv" style="margin-bottom:20px;">
      <tbody>
        <tr>
          <th style="width:140px;">Khách hàng</th>
          <td><strong style="font-size:16px;">${escapeHtml(p.partner_name)}</strong></td>
        </tr>
        <tr>
          <th>Mã khách hàng</th>
          <td><span style="background:#f0f0f0;padding:2px 8px;border-radius:4px;font-family:monospace;font-weight:bold;">${escapeHtml(p.partner_code)}</span></td>
        </tr>
        <tr>
          <th>Ngày xuất báo giá</th>
          <td>${escapeHtml(p.generated_at)}</td>
        </tr>
      </tbody>
    </table>

    <h2 style="margin-top:24px;margin-bottom:12px;font-size:18px;color:#333;">Bảng giá sản phẩm</h2>
    <table style="font-size:13px;">
      <thead>
        <tr style="background:#0066cc;color:white;">
          <th class="num" style="width:50px;">STT</th>
          <th style="width:100px;">Mã SP</th>
          <th>Tên sản phẩm</th>
          <th style="width:80px;">ĐVT</th>
          <th class="num" style="width:120px;">Giá gốc</th>
          <th class="num" style="width:80px;">CK %</th>
          <th class="num" style="width:140px;background:#0052a3;">Giá áp dụng</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="7" style="text-align:center;padding:20px;color:#999;">Chưa có sản phẩm</td></tr>`}</tbody>
    </table>

    <div style="margin-top:32px;padding:16px;background:#f8f9fa;border-left:4px solid #0066cc;border-radius:4px;">
      <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">
        <strong>Ghi chú:</strong><br/>
        • Giá áp dụng là giá đã bao gồm chiết khấu (nếu có)<br/>
        • Giá có thể thay đổi tùy theo số lượng và điều kiện đặt hàng<br/>
        • Báo giá có hiệu lực trong 30 ngày kể từ ngày xuất<br/>
        • Mọi thắc mắc vui lòng liên hệ bộ phận kinh doanh
      </p>
    </div>

    <div style="margin-top:40px;text-align:center;padding-top:20px;border-top:2px solid #e0e0e0;">
      <p style="margin:0;font-size:12px;color:#888;">
        KT Smile Lab | Hotline: [Số điện thoại] | Email: [Email liên hệ]<br/>
        Địa chỉ: [Địa chỉ công ty]
      </p>
    </div>
  `;
}
