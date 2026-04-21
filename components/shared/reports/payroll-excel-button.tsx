"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { getPayrollExcelPayload } from "@/lib/actions/payroll-excel";

type PayrollExcelButtonProps = {
  year: number;
  month: number;
  label?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  companyName?: string;
};

export function PayrollExcelButton({
  year,
  month,
  label = "Xuất Excel",
  className,
  variant = "secondary",
  size = "sm",
}: PayrollExcelButtonProps) {
  const [busy, setBusy] = React.useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const payload = await getPayrollExcelPayload(year, month);
      if (payload.rows.length === 0) {
        window.alert("Không có dữ liệu bảng lương.");
        return;
      }

      // Dynamic import to avoid SSR issues
      const { buildPayrollExcelBuffer } = await import("@/lib/reports/payroll-excel");
      const buf = buildPayrollExcelBuffer({
        year: payload.year,
        month: payload.month,
        standardWorkDays: payload.standardWorkDays,
        overtimeRatePerHour: payload.overtimeRatePerHour,
        rows: payload.rows,
      });
      
      // Create blob and download
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BangLuong_${String(month).padStart(2, "0")}_${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không xuất được.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      disabled={busy}
    >
      {busy ? "Đang xuất…" : label}
    </Button>
  );
}