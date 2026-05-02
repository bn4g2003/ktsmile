"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getDailyDeliveryNotePayload } from "@/lib/actions/lab-orders";
import { buildDeliveryNoteBodyHtml, deliveryNotePrintTitle } from "@/lib/reports/delivery-note-html";
import { downloadLabOrderListPdf } from "@/lib/reports/lab-order-pdf";

type Props = {
  partnerId: string;
  deliveryDate: string;
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "sm";
};

export function DeliveryNoteDownloadButton({
  partnerId,
  deliveryDate,
  label = "Tải phiếu giao (PDF)",
  className,
  variant = "secondary",
  size = "sm",
}: Props) {
  const [busy, setBusy] = React.useState(false);
  
  const handleDownload = async () => {
    if (!partnerId || !deliveryDate) return;
    setBusy(true);
    try {
      const payload = await getDailyDeliveryNotePayload(partnerId, deliveryDate);
      if (!payload.orders.length) {
        alert("Không có đơn hàng của lab này trong ngày đã chọn.");
        return;
      }
      const title = deliveryNotePrintTitle(payload);
      const html = buildDeliveryNoteBodyHtml(payload);
      const filename = `${title.replace(/[^\w.-]+/g, "_")}.pdf`;
      
      await downloadLabOrderListPdf(html, filename);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Không tải được PDF phiếu giao.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={busy || !partnerId || !deliveryDate}
      onClick={() => void handleDownload()}
    >
      {busy ? "Đang tải…" : label}
    </Button>
  );
}
