"use client";

import { Button } from "@/components/ui/button";
import { buildPrintShell, openPrintableHtml } from "@/lib/reports/print-html";

type PrintReportButtonProps = {
  title: string;
  /** HTML phần thân (đã escape nội dung động). */
  buildBodyHtml: () => string;
  label?: string;
  className?: string;
};

export function PrintReportButton({
  title,
  buildBodyHtml,
  label = "In / lưu PDF (trình duyệt)",
  className,
}: PrintReportButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={className}
      onClick={() => openPrintableHtml(buildPrintShell(title, buildBodyHtml()))}
    >
      {label}
    </Button>
  );
}
