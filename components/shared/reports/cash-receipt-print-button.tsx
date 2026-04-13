"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { getCashReceiptPrintPayload } from "@/lib/actions/cash";
import {
  buildPrintShell,
  openBlankPrintTab,
  writeAndPrintToWindow,
} from "@/lib/reports/print-html";
import { buildCashReceiptBodyHtml, cashReceiptPrintTitle } from "@/lib/reports/cash-receipt-html";

type CashReceiptPrintButtonProps = {
  transactionId: string;
  label?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
};

export const CashReceiptPrintButton = React.forwardRef<HTMLButtonElement, CashReceiptPrintButtonProps>(
  function CashReceiptPrintButton(
    {
      transactionId,
      label = "In phiếu thu",
      className,
      variant = "secondary",
      size = "sm",
    },
    ref,
  ) {
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
        const payload = await getCashReceiptPrintPayload(transactionId);
        const title = cashReceiptPrintTitle(payload);
        writeAndPrintToWindow(w, buildPrintShell(title, buildCashReceiptBodyHtml(payload)));
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
      ref={ref}
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={busy}
      onClick={onClick}
    >
      {busy ? "Đang tải…" : label}
    </Button>
  );
  },
);
