"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getLabOrderPrintPayload } from "@/lib/actions/lab-orders";
import {
  buildPrintShell,
  openBlankPrintTab,
  writeAndPrintToWindow,
} from "@/lib/reports/print-html";
import { buildLabOrderBodyHtml, labOrderPrintTitle } from "@/lib/reports/lab-order-html";

type LabOrderPrintButtonProps = {
  orderId: string;
  label?: string;
  size?: "default" | "sm";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
};

export function LabOrderPrintButton({
  orderId,
  label = "In / lưu PDF",
  size = "sm",
  variant = "secondary",
  className,
}: LabOrderPrintButtonProps) {
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
        const payload = await getLabOrderPrintPayload(orderId);
        const title = labOrderPrintTitle(payload);
        writeAndPrintToWindow(w, buildPrintShell(title, buildLabOrderBodyHtml(payload)));
      } catch (e) {
        w.close();
        window.alert(e instanceof Error ? e.message : "Không in được đơn.");
      } finally {
        setBusy(false);
      }
    })();
  };
  return (
    <Button
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
}
