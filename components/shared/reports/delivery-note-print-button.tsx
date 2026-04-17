"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getDailyDeliveryNotePayload } from "@/lib/actions/lab-orders";
import { buildPrintShell, openBlankPrintTab, writeAndPrintToWindow } from "@/lib/reports/print-html";
import { buildDeliveryNoteBodyHtml, deliveryNotePrintTitle } from "@/lib/reports/delivery-note-html";

type Props = {
  partnerId: string;
  deliveryDate: string;
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "sm";
};

export function DeliveryNotePrintButton({
  partnerId,
  deliveryDate,
  label = "In phiếu giao (PDF)",
  className,
  variant = "secondary",
  size = "sm",
}: Props) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={busy || !partnerId || !deliveryDate}
      onClick={() => {
        const w = openBlankPrintTab();
        if (!w) {
          alert("Trình duyệt đang chặn popup in. Hãy cho phép popup rồi thử lại.");
          return;
        }
        setBusy(true);
        void (async () => {
          try {
            const payload = await getDailyDeliveryNotePayload(partnerId, deliveryDate);
            const title = deliveryNotePrintTitle(payload);
            writeAndPrintToWindow(w, buildPrintShell(title, buildDeliveryNoteBodyHtml(payload)));
          } catch (e) {
            w.close();
            alert(e instanceof Error ? e.message : "Không in được phiếu giao.");
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      {busy ? "Đang tải…" : label}
    </Button>
  );
}
