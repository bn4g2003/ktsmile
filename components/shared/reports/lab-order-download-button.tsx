"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getLabOrderPrintPayload } from "@/lib/actions/lab-orders";
import { buildLabOrderBodyHtml, labOrderPrintTitle } from "@/lib/reports/lab-order-html";
import { downloadLabOrderListPdf } from "@/lib/reports/lab-order-pdf";

type Props = {
  orderId: string;
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "sm";
};

export const LabOrderDownloadButton = React.forwardRef<HTMLButtonElement, Props>(
  function LabOrderDownloadButton(
    {
      orderId,
      label = "Tải PDF",
      className,
      variant = "secondary",
      size = "sm",
    },
    ref,
  ) {
    const [busy, setBusy] = React.useState(false);

    const handleDownload = async () => {
      setBusy(true);
      try {
        const payload = await getLabOrderPrintPayload(orderId);
        const title = labOrderPrintTitle(payload);
        const html = buildLabOrderBodyHtml(payload);
        const filename = `${title.replace(/[^\w.-]+/g, "_")}.pdf`;
        
        await downloadLabOrderListPdf(html, filename);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Không tải được PDF đơn hàng.");
      } finally {
        setBusy(false);
      }
    };

    return (
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={busy}
        onClick={() => void handleDownload()}
      >
        {busy ? "Đang tải…" : label}
      </Button>
    );
  }
);
