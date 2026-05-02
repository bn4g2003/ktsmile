"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getPriceQuotePayload } from "@/lib/actions/partner-prices";
import {
  buildPriceQuoteBodyHtml,
  priceQuotePrintTitle,
  type PriceQuotePrintPayload,
} from "@/lib/reports/price-quote-html";
import { downloadPriceQuotePdf } from "@/lib/reports/price-quote-pdf";

type PriceQuoteDownloadButtonProps = {
  partnerId: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "sm";
  className?: string;
};

export function PriceQuoteDownloadButton({
  partnerId,
  label = "Tải PDF",
  variant = "secondary",
  size = "default",
  className,
}: PriceQuoteDownloadButtonProps) {
  const [loading, setLoading] = React.useState(false);

  const handleDownload = async () => {
    if (!partnerId) {
      alert("Chưa chọn khách hàng");
      return;
    }
    setLoading(true);
    try {
      const payload: PriceQuotePrintPayload = await getPriceQuotePayload(partnerId);
      const bodyHtml = buildPriceQuoteBodyHtml(payload);
      const title = priceQuotePrintTitle(payload);
      await downloadPriceQuotePdf(bodyHtml, title);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi tải báo giá");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={loading || !partnerId}
      className={className}
    >
      {loading ? "Đang tải..." : label}
    </Button>
  );
}
