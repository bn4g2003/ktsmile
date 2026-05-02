"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { downloadReportPdf } from "@/lib/reports/generic-report-pdf";

type DownloadReportPdfButtonProps = {
  title: string;
  /** HTML phần thân (đã escape nội dung động). */
  buildBodyHtml: () => string;
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export function DownloadReportPdfButton({
  title,
  buildBodyHtml,
  label = "Tải PDF",
  className,
  variant = "secondary",
}: DownloadReportPdfButtonProps) {
  const [busy, setBusy] = React.useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const html = buildBodyHtml();
      await downloadReportPdf(html, title);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không tải được PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={className}
      disabled={busy}
      onClick={handleDownload}
    >
      {busy ? "Đang tải…" : label}
    </Button>
  );
}
