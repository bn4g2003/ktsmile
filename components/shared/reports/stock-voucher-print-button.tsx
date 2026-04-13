"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getStockDocumentPrintPayload } from "@/lib/actions/stock";
import {
  buildPrintShell,
  openBlankPrintTab,
  writeAndPrintToWindow,
} from "@/lib/reports/print-html";
import {
  buildStockVoucherBodyHtml,
  stockVoucherPrintTitle,
} from "@/lib/reports/stock-voucher-html";

type StockVoucherPrintButtonProps = {
  documentId: string;
  label?: string;
  size?: "default" | "sm";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
};

export const StockVoucherPrintButton = React.forwardRef<HTMLButtonElement, StockVoucherPrintButtonProps>(
  function StockVoucherPrintButton(
    {
      documentId,
      label = "In / lưu PDF",
      size = "sm",
      variant = "secondary",
      className,
    },
    ref,
  ) {
  const [busy, setBusy] = React.useState(false);
  const onClick = () => {
    const w = openBlankPrintTab();
    if (!w) {
      window.alert(
        "Không mở được cửa sổ in. Trình duyệt đã chặn popup — bấm biểu tượng popup trên thanh địa chỉ và chọn “Luôn cho phép” cho trang này, rồi thử lại.",
      );
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        const payload = await getStockDocumentPrintPayload(documentId);
        const title = stockVoucherPrintTitle(payload);
        writeAndPrintToWindow(w, buildPrintShell(title, buildStockVoucherBodyHtml(payload)));
      } catch (e) {
        w.close();
        window.alert(e instanceof Error ? e.message : "Không in được phiếu.");
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
