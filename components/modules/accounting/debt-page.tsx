"use client";

import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DetailPreview } from "@/components/ui/detail-preview";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DebtChartsSection } from "@/components/modules/accounting/debt-charts-section";
import { importDebtOpeningFromExcel } from "@/lib/actions/debt-import";
import { listDebtReport, type DebtRow } from "@/lib/actions/debt";

export function DebtPage() {
  const router = useRouter();
  const now = React.useMemo(() => new Date(), []);
  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [showCharts, setShowCharts] = React.useState(false);
  const [gridReload, setGridReload] = React.useState(0);
  const fileImportRef = React.useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = React.useState(false);

  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);

  const prependFilters = React.useMemo(
    () => ({ year, month }),
    [year, month],
  );

  const columns = React.useMemo<ColumnDef<DebtRow, unknown>[]>(
    () => [
      { accessorKey: "partner_code", header: "Mã KH" },
      { accessorKey: "partner_name", header: "Tên KH" },
      { accessorKey: "opening", header: "Nợ đầu kỳ" },
      { accessorKey: "orders_month", header: "PS bán (tháng)" },
      { accessorKey: "receipts_month", header: "Đã thu (tháng)" },
      { accessorKey: "closing", header: "Nợ cuối kỳ" },
    ],
    [],
  );

  const onPickExcel = () => fileImportRef.current?.click();

  const onExcelSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("year", year);
      fd.set("month", month);
      const res = await importDebtOpeningFromExcel(fd);
      if (res.ok) {
        const warn = res.errors?.length
          ? "\n\nCảnh báo:\n" + res.errors.slice(0, 40).join("\n") + (res.errors.length > 40 ? "\n…" : "")
          : "";
        alert((res.message ?? "Nhập xong.") + warn);
        bumpGrid();
      } else {
        const detail = res.errors?.length
          ? "\n\n" + res.errors.slice(0, 40).join("\n") + (res.errors.length > 40 ? "\n…" : "")
          : "";
        alert((res.message ?? "Nhập thất bại.") + detail);
      }
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi nhập file");
    } finally {
      setImportBusy(false);
    }
  };

  const years = React.useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 8 }, (_, i) => String(y - i));
  }, [now]);

  const renderDebtDetail = React.useCallback((row: DebtRow) => {
    return (
      <DetailPreview
        fields={[
          { label: "Mã KH", value: row.partner_code },
          { label: "Tên KH", value: row.partner_name },
          { label: "Nợ đầu kỳ", value: row.opening },
          { label: "PS bán (tháng)", value: row.orders_month },
          { label: "Đã thu (tháng)", value: row.receipts_month },
          { label: "Nợ cuối kỳ", value: row.closing },
          { label: "Partner ID", value: row.partner_id, span: "full" },
        ]}
      />
    );
  }, []);

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-end gap-4 p-5">
        <div className="grid gap-2">
          <Label htmlFor="d-y">Năm</Label>
          <Select id="d-y" value={year} onChange={(e) => setYear(e.target.value)} className="min-w-[7rem]">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="d-m">Tháng</Label>
          <Select id="d-m" value={month} onChange={(e) => setMonth(e.target.value)} className="min-w-[7rem]">
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </Select>
        </div>
        <input
          ref={fileImportRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(ev) => void onExcelSelected(ev)}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-8 self-end"
          disabled={importBusy}
          onClick={onPickExcel}
        >
          {importBusy ? "Đang nhập…" : "Nhập Excel (nợ đầu kỳ)"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-8 self-end"
          onClick={() => setShowCharts((v) => !v)}
        >
          {showCharts ? "Ẩn biểu đồ" : "Hiện biểu đồ công nợ"}
        </Button>
      </Card>
      {showCharts ? <DebtChartsSection year={year} month={month} /> : null}
      <ExcelDataGrid<DebtRow>
        moduleId="debt_report"
        title="Công nợ khách hàng (theo tháng)"
        columns={columns}
        list={listDebtReport}
        prependFilters={prependFilters}
        getRowId={(r) => r.partner_id}
        renderRowDetail={renderDebtDetail}
        rowDetailTitle={(r) => `Công nợ ${r.partner_code} · Tháng ${month}/${year}`}
        reloadSignal={gridReload}
      />
    </div>
  );
}
