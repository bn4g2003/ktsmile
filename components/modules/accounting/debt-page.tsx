"use client";

import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import {
  DataGridMenuDeleteItem,
  DataGridMenuEditItem,
} from "@/components/shared/data-grid/data-grid-action-buttons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import { DebtReportRowDetailPanel } from "@/components/modules/accounting/debt-report-row-detail-panel";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DebtChartsSection } from "@/components/modules/accounting/debt-charts-section";
import {
  DebtSettlementModal,
  type DebtSettlementModalState,
} from "@/components/modules/accounting/debt-settlement-modal";
import { importDebtOpeningFromExcel } from "@/lib/actions/debt-import";
import {
  carryForwardOpeningToNextMonth,
  listDebtReport,
  type DebtRow,
} from "@/lib/actions/debt";
import {
  carryForwardPayablesOpeningToNextMonth,
  listPayablesReport,
  type PayableRow,
} from "@/lib/actions/payables";

type DebtTab = "receivables" | "payables";

export function DebtPage({ initialTab = "receivables" }: { initialTab?: DebtTab }) {
  const router = useRouter();
  const now = React.useMemo(() => new Date(), []);
  const [tab, setTab] = React.useState<DebtTab>(initialTab);
  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [showCharts, setShowCharts] = React.useState(false);
  const [gridReceivable, setGridReceivable] = React.useState(0);
  const [gridPayable, setGridPayable] = React.useState(0);
  const fileImportRef = React.useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = React.useState(false);
  const [carryReceivableBusy, setCarryReceivableBusy] = React.useState(false);
  const [carryPayableBusy, setCarryPayableBusy] = React.useState(false);
  const [settlementModal, setSettlementModal] = React.useState<DebtSettlementModalState>(null);

  const bumpReceivable = React.useCallback(() => {
    setGridReceivable((n) => n + 1);
    router.refresh();
  }, [router]);

  const bumpPayable = React.useCallback(() => {
    setGridPayable((n) => n + 1);
    router.refresh();
  }, [router]);

  React.useEffect(() => {
    setGridReceivable((n) => n + 1);
    setGridPayable((n) => n + 1);
  }, [tab]);

  const prependFilters = React.useMemo(() => ({ year, month }), [year, month]);

  const openReceivableSettlement = React.useCallback((row: DebtRow) => {
    setSettlementModal({ kind: "receivable", row });
  }, []);

  const openPayableSettlement = React.useCallback((row: PayableRow) => {
    setSettlementModal({ kind: "payable", row });
  }, []);

  const columnsReceivable = React.useMemo<ColumnDef<DebtRow, unknown>[]>(
    () => [
      { accessorKey: "partner_code", header: "Mã KH", meta: { filterKey: "partner_code", filterType: "text" } },
      { accessorKey: "partner_name", header: "Tên KH", meta: { filterKey: "partner_name", filterType: "text" } },
      { accessorKey: "opening", header: "Nợ đầu kỳ", cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN") },
      { accessorKey: "orders_month", header: "PS bán (tháng)", cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN") },
      { accessorKey: "receipts_month", header: "Đã thu (tháng)", cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN") },
      { accessorKey: "closing", header: "Nợ cuối kỳ", cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN") },
      {
        id: "record_payment",
        header: "Ghi thu",
        size: 108,
        enableHiding: false,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <Button type="button" variant="secondary" size="sm" onClick={() => openReceivableSettlement(row.original)}>
            Thu tiền
          </Button>
        ),
      },
      {
        id: "actions",
        header: "Thao tác",
        size: 80,
        enableHiding: false,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <>
            <DataGridMenuEditItem onSelect={() => openReceivableSettlement(row.original)}>
              ✏️ Sửa chứng từ
            </DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => openReceivableSettlement(row.original)}>
              🗑️ Xóa chứng từ
            </DataGridMenuDeleteItem>
          </>
        ),
      },
    ],
    [openReceivableSettlement],
  );

  const columnsPayable = React.useMemo<ColumnDef<PayableRow, unknown>[]>(
    () => [
      { accessorKey: "supplier_code", header: "Mã NCC", meta: { filterKey: "supplier_code", filterType: "text" } },
      { accessorKey: "supplier_name", header: "Tên NCC", meta: { filterKey: "supplier_name", filterType: "text" } },
      { accessorKey: "opening", header: "Nợ đầu kỳ", cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN") },
      { accessorKey: "inbound_month", header: "PS nhập (tháng)", cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN") },
      { accessorKey: "payments_month", header: "Đã trả (tháng)", cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN") },
      { accessorKey: "closing", header: "Nợ cuối kỳ", cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN") },
      {
        id: "record_payment",
        header: "Ghi chi",
        size: 108,
        enableHiding: false,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <Button type="button" variant="secondary" size="sm" onClick={() => openPayableSettlement(row.original)}>
            Trả NCC
          </Button>
        ),
      },
      {
        id: "actions",
        header: "Thao tác",
        size: 80,
        enableHiding: false,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <>
            <DataGridMenuEditItem onSelect={() => openPayableSettlement(row.original)}>
              ✏️ Sửa chứng từ
            </DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => openPayableSettlement(row.original)}>
              🗑️ Xóa chứng từ
            </DataGridMenuDeleteItem>
          </>
        ),
      },
    ],
    [openPayableSettlement],
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
        bumpReceivable();
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

  const renderDebtDetail = React.useCallback(
    (row: DebtRow) => (
      <DebtReportRowDetailPanel
        variant="receivable"
        row={row}
        year={year}
        month={month}
        onOpenSettlement={() => openReceivableSettlement(row)}
      />
    ),
    [year, month, openReceivableSettlement],
  );

  const renderPayableDetail = React.useCallback(
    (row: PayableRow) => (
      <DebtReportRowDetailPanel
        variant="payable"
        row={row}
        year={year}
        month={month}
        onOpenSettlement={() => openPayableSettlement(row)}
      />
    ),
    [year, month, openPayableSettlement],
  );

  return (
    <div className="space-y-5">
      <DetailTabStrip
        items={[
          { id: "receivables", label: "Phải thu (khách)" },
          { id: "payables", label: "Phải trả (NCC)" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as DebtTab)}
      />

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

        {tab === "receivables" ? (
          <>
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
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="min-h-8 self-end"
              disabled={carryReceivableBusy}
              onClick={() => {
                if (
                  !confirm(
                    "Kết chuyển nợ cuối kỳ tháng " +
                      month +
                      "/" +
                      year +
                      " sang NỢ ĐẦU KỲ tháng sau cho toàn bộ khách? (ghi đè nếu đã có dòng đầu kỳ tháng đích)",
                  )
                )
                  return;
                setCarryReceivableBusy(true);
                void carryForwardOpeningToNextMonth(Number(year), Number(month))
                  .then((r) => {
                    alert(
                      "Đã cập nhật " +
                        r.upserted +
                        " khách — nợ đầu kỳ tháng " +
                        r.nextMonth +
                        "/" +
                        r.nextYear +
                        ".",
                    );
                    bumpReceivable();
                  })
                  .catch((e) => alert(e instanceof Error ? e.message : "Lỗi"))
                  .finally(() => setCarryReceivableBusy(false));
              }}
            >
              {carryReceivableBusy ? "Đang kết chuyển…" : "Kết chuyển phải thu → tháng sau"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="min-h-8 self-end"
            disabled={carryPayableBusy}
            onClick={() => {
              if (!confirm("Kết chuyển công nợ phải trả NCC sang đầu kỳ tháng sau?")) return;
              setCarryPayableBusy(true);
              void carryForwardPayablesOpeningToNextMonth(Number(year), Number(month))
                .then((r) => {
                  alert("Đã cập nhật " + r.upserted + " NCC cho tháng " + r.nextMonth + "/" + r.nextYear + ".");
                  bumpPayable();
                })
                .catch((e) => alert(e instanceof Error ? e.message : "Lỗi"))
                .finally(() => setCarryPayableBusy(false));
            }}
          >
            {carryPayableBusy ? "Đang kết chuyển…" : "Kết chuyển phải trả → tháng sau"}
          </Button>
        )}
      </Card>

      {tab === "receivables" && showCharts ? <DebtChartsSection year={year} month={month} /> : null}

      {tab === "receivables" ? (
        <ExcelDataGrid<DebtRow>
          moduleId="debt_report"
          title="Công nợ phải thu — khách hàng (theo tháng)"
          columns={columnsReceivable}
          list={listDebtReport}
          prependFilters={prependFilters}
          getRowId={(r) => r.partner_id}
          renderRowDetail={renderDebtDetail}
          rowDetailTitle={(r) => `Công nợ ${r.partner_code} · Tháng ${month}/${year}`}
          reloadSignal={gridReceivable}
        />
      ) : (
        <ExcelDataGrid<PayableRow>
          moduleId="payables_report"
          title="Công nợ phải trả — NCC (theo tháng)"
          columns={columnsPayable}
          list={listPayablesReport}
          prependFilters={prependFilters}
          getRowId={(r) => r.supplier_id}
          renderRowDetail={renderPayableDetail}
          rowDetailTitle={(r) => `Công nợ NCC ${r.supplier_code} · Tháng ${month}/${year}`}
          reloadSignal={gridPayable}
        />
      )}

      <DebtSettlementModal
        state={settlementModal}
        onClose={() => setSettlementModal(null)}
        year={year}
        month={month}
        onRecordedReceivable={bumpReceivable}
        onRecordedPayable={bumpPayable}
      />
    </div>
  );
}
