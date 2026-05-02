"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { getCashReceiptPrintPayload } from "@/lib/actions/cash";
import {
  buildCashReceiptBodyHtml,
  cashReceiptPrintTitle,
} from "@/lib/reports/cash-receipt-html";
import { downloadCashReceiptPdf } from "@/lib/reports/cash-receipt-pdf";

type CashReceiptDownloadButtonProps = {
  transactionId: string;
  label?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
};

export const CashReceiptDownloadButton = React.forwardRef<HTMLButtonElement, CashReceiptDownloadButtonProps>(
  function CashReceiptDownloadButton(
    {
      transactionId,
      label = "Tải PDF",
      className,
      variant = "secondary",
      size = "sm",
    },
    ref,
  ) {
    const [busy, setBusy] = React.useState(false);

    const handleDownload = async () => {
      if (!transactionId) return;
      setBusy(true);
      try {
        const payload = await getCashReceiptPrintPayload(transactionId);
        const title = cashReceiptPrintTitle(payload);
        const bodyHtml = buildCashReceiptBodyHtml(payload);
        await downloadCashReceiptPdf(bodyHtml, title);
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
