"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getStockDocumentPrintPayload } from "@/lib/actions/stock";
import {
  buildStockVoucherBodyHtml,
  stockVoucherPrintTitle,
} from "@/lib/reports/stock-voucher-html";
import { downloadStockVoucherPdf } from "@/lib/reports/stock-voucher-pdf";

type StockVoucherDownloadButtonProps = {
  documentId: string;
  label?: string;
  size?: "default" | "sm";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
};

export const StockVoucherDownloadButton = React.forwardRef<HTMLButtonElement, StockVoucherDownloadButtonProps>(
  function StockVoucherDownloadButton(
    {
      documentId,
      label = "Tải PDF",
      size = "sm",
      variant = "secondary",
      className,
    },
    ref,
  ) {
    const [busy, setBusy] = React.useState(false);

    const handleDownload = async () => {
      if (!documentId) return;
      setBusy(true);
      try {
        const payload = await getStockDocumentPrintPayload(documentId);
        const title = stockVoucherPrintTitle(payload);
        const bodyHtml = buildStockVoucherBodyHtml(payload);
        await downloadStockVoucherPdf(bodyHtml, title);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Không tải được phiếu.");
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
        onClick={handleDownload}
      >
        {busy ? "Đang tải…" : label}
      </Button>
    );
  },
);
