"use client";

import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DetailPreview } from "@/components/ui/detail-preview";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { carryForwardPayablesOpeningToNextMonth, listPayablesReport, type PayableRow } from "@/lib/actions/payables";

export function PayablesPage() {
  const now = React.useMemo(() => new Date(), []);
  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [carryBusy, setCarryBusy] = React.useState(false);
  const [gridReload, setGridReload] = React.useState(0);

  const prependFilters = React.useMemo(() => ({ year, month }), [year, month]);
  const years = React.useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 8 }, (_, i) => String(y - i));
  }, [now]);

  const columns = React.useMemo<ColumnDef<PayableRow, unknown>[]>(
    () => [
      { accessorKey: "supplier_code", header: "Mã NCC" },
      { accessorKey: "supplier_name", header: "Tên NCC" },
      { accessorKey: "opening", header: "Nợ đầu kỳ" },
      { accessorKey: "inbound_month", header: "PS nhập (tháng)" },
      { accessorKey: "payments_month", header: "Đã trả (tháng)" },
      { accessorKey: "closing", header: "Nợ cuối kỳ" },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-end gap-4 p-5">
        <div className="grid gap-2">
          <Label htmlFor="p-y">Năm</Label>
          <Select id="p-y" value={year} onChange={(e) => setYear(e.target.value)} className="min-w-[7rem]">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="p-m">Tháng</Label>
          <Select id="p-m" value={month} onChange={(e) => setMonth(e.target.value)} className="min-w-[7rem]">
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => <option key={m} value={m}>Tháng {m}</option>)}
          </Select>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="min-h-8 self-end"
          disabled={carryBusy}
          onClick={() => {
            if (!confirm("Kết chuyển công nợ NCC sang đầu kỳ tháng sau?")) return;
            setCarryBusy(true);
            void carryForwardPayablesOpeningToNextMonth(Number(year), Number(month))
              .then((r) => {
                alert("Đã cập nhật " + r.upserted + " NCC cho tháng " + r.nextMonth + "/" + r.nextYear + ".");
                setGridReload((n) => n + 1);
              })
              .catch((e) => alert(e instanceof Error ? e.message : "Lỗi"))
              .finally(() => setCarryBusy(false));
          }}
        >
          {carryBusy ? "Đang kết chuyển…" : "Kết chuyển đầu kỳ tháng sau"}
        </Button>
      </Card>

      <ExcelDataGrid<PayableRow>
        moduleId="payables_report"
        title="Công nợ phải trả NCC (theo tháng)"
        columns={columns}
        list={listPayablesReport}
        prependFilters={prependFilters}
        reloadSignal={gridReload}
        getRowId={(r) => r.supplier_id}
        renderRowDetail={(row) => (
          <DetailPreview
            fields={[
              { label: "Mã NCC", value: row.supplier_code },
              { label: "Tên NCC", value: row.supplier_name },
              { label: "Nợ đầu kỳ", value: row.opening },
              { label: "PS nhập (tháng)", value: row.inbound_month },
              { label: "Đã trả (tháng)", value: row.payments_month },
              { label: "Nợ cuối kỳ", value: row.closing },
              { label: "Supplier ID", value: row.supplier_id, span: "full" },
            ]}
          />
        )}
        rowDetailTitle={(r) => `Công nợ NCC ${r.supplier_code} · Tháng ${month}/${year}`}
      />
    </div>
  );
}
