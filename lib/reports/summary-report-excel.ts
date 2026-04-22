import * as XLSX from "xlsx";
import type { SummaryReportData } from "@/lib/actions/summary-report";

export type SummaryReportExcelPayload = {
  year: number;
  month: number;
  data: SummaryReportData;
  filters: { partnerName?: string; productName?: string };
};

export function buildSummaryReportExcelBuffer(payload: SummaryReportExcelPayload): any {
  const { year, month, data, filters } = payload;
  const monthStr = String(month).padStart(2, "0");

  const headerRows = [
    ["BÁO CÁO TỔNG HỢP SẢN LƯỢNG"],
    [`Tháng ${monthStr}/${year}`],
    [""],
    ["TỔNG HỢP CHỈ SỐ"],
    ["Tổng sản lượng (Răng)", data.totalYield],
    ["Hàng mới", data.totalNewYield],
    ["Hàng làm lại", data.totalWarrantyYield],
    ["Khách hàng phát sinh", data.totalCustomers],
    [""],
    ["THÔNG TIN BỘ LỌC"],
    ["Khách hàng", filters.partnerName || "Tất cả"],
    ["Sản phẩm", filters.productName || "Tất cả"],
    [""],
    ["CHI TIẾT SẢN LƯỢNG THEO SẢN PHẨM"],
    ["STT", "Mã sản phẩm", "Tên sản phẩm", "Sản lượng (Răng)"],
  ];

  const dataRows = data.products.map((p, idx) => [
    idx + 1,
    p.product_code,
    p.product_name,
    p.count,
  ]);

  const aoa = [...headerRows, ...dataRows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set column widths
  ws["!cols"] = [
    { wch: 5 },  // STT
    { wch: 15 }, // Mã sản phẩm
    { wch: 35 }, // Tên sản phẩm
    { wch: 15 }, // Sản lượng
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Bao_cao_tong_hop");

  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}
