"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getPaymentNoticePrintPayload } from "@/lib/actions/billing";
import {
  buildPrintShell,
  openBlankPrintTab,
  writeAndPrintToWindow,
} from "@/lib/reports/print-html";
import {
  buildPaymentNoticeBodyHtml,
  paymentNoticePrintTitle,
} from "@/lib/reports/payment-notice-html";

type PaymentNoticePrintButtonProps = {
  orderId: string;
  label?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
};

export function PaymentNoticePrintButton({
  orderId,
  label = "In GBTT",
  className,
  variant,
}: PaymentNoticePrintButtonProps) {
  const [busy, setBusy] = React.useState(false);
  const onClick = () => {
    const w = openBlankPrintTab();
    if (!w) {
      window.alert(
        "Không mở được cửa sổ in. Trình duyệt đã chặn popup — cho phép popup cho trang này rồi thử lại.",
      );
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        const payload = await getPaymentNoticePrintPayload(orderId);
        const title = paymentNoticePrintTitle(payload);
        writeAndPrintToWindow(w, buildPrintShell(title, buildPaymentNoticeBodyHtml(payload)));
      } catch (e) {
        w.close();
        window.alert(e instanceof Error ? e.message : "Không in được.");
      } finally {
        setBusy(false);
      }
    })();
  };
  return (
    <Button
      type="button"
      variant={variant || "secondary"}
      size="sm"
      className={className}
      disabled={busy}
      onClick={onClick}
    >
      {busy ? "Đang tải…" : label}
    </Button>
  );
}
