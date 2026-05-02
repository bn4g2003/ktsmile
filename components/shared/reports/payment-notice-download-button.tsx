"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getPaymentNoticePrintPayload } from "@/lib/actions/billing";
import {
  buildPaymentNoticeBodyHtml,
  paymentNoticePrintTitle,
} from "@/lib/reports/payment-notice-html";
import { downloadPaymentNoticePdf } from "@/lib/reports/payment-notice-pdf";

type PaymentNoticeDownloadButtonProps = {
  orderId: string;
  label?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
};

export function PaymentNoticeDownloadButton({
  orderId,
  label = "Tải PDF GBTT",
  className,
  variant,
}: PaymentNoticeDownloadButtonProps) {
  const [busy, setBusy] = React.useState(false);

  const handleDownload = async () => {
    if (!orderId) return;
    setBusy(true);
    try {
      const payload = await getPaymentNoticePrintPayload(orderId);
      const title = paymentNoticePrintTitle(payload);
      const bodyHtml = buildPaymentNoticeBodyHtml(payload);
      await downloadPaymentNoticePdf(bodyHtml, title);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không tải được.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant || "secondary"}
      size="sm"
      className={className}
      disabled={busy}
      onClick={handleDownload}
    >
      {busy ? "Đang tải…" : label}
    </Button>
  );
}
