"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getPriceQuotePayload } from "@/lib/actions/partner-prices";
import {
  buildPriceQuoteBodyHtml,
  priceQuotePrintTitle,
  type PriceQuotePrintPayload,
} from "@/lib/reports/price-quote-html";
import { buildPrintShell, openPrintableHtml } from "@/lib/reports/print-html";

type PriceQuotePrintButtonProps = {
  partnerId: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "sm";
  className?: string;
};

export function PriceQuotePrintButton({
  partnerId,
  label = "In báo giá",
  variant = "primary",
  size = "default",
  className,
}: PriceQuotePrintButtonProps) {
  const [loading, setLoading] = React.useState(false);

  const handlePrint = async () => {
    if (!partnerId) {
      alert("Chưa chọn khách hàng");
      return;
    }
    setLoading(true);
    try {
      const payload: PriceQuotePrintPayload = await getPriceQuotePayload(partnerId);
      const bodyHtml = buildPriceQuoteBodyHtml(payload);
      const title = priceQuotePrintTitle(payload);
      const fullHtml = buildPrintShell(title, bodyHtml);
      openPrintableHtml(fullHtml);
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
      onClick={handlePrint}
      disabled={loading || !partnerId}
      className={className}
    >
      {loading ? (
        <>
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
          Đang tải...
        </>
      ) : (
        <>
          <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          {label}
        </>
      )}
    </Button>
  );
}
