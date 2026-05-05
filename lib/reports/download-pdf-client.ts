/**
 * @deprecated Dùng trực tiếp `downloadPDFFromServer` từ `@/lib/reports/download-pdf-server`.
 * Giữ export này để các module cũ (vd orders-print-hub) không đổi import.
 */
export { downloadPDFFromServer as downloadPdfFromServer } from "@/lib/reports/download-pdf-server";
