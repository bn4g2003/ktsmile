"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  issuePaymentNoticeForLabOrder,
  updateLabOrderBilling,
} from "@/lib/actions/billing";
import { listLabOrders, type LabOrderRow } from "@/lib/actions/lab-orders";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import {
  DataGridRowActionsMenu,
} from "@/components/shared/data-grid/data-grid-action-buttons";
import { PaymentNoticePrintButton } from "@/components/shared/reports/payment-notice-print-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SalesBillingPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);

  const [billOpen, setBillOpen] = React.useState(false);
  const [billRow, setBillRow] = React.useState<LabOrderRow | null>(null);
  const [bPct, setBPct] = React.useState("0");
  const [bAmt, setBAmt] = React.useState("0");
  const [bFees, setBFees] = React.useState("0");
  const [billPending, setBillPending] = React.useState(false);
  const [billErr, setBillErr] = React.useState<string | null>(null);
  const [issuePending, setIssuePending] = React.useState<string | null>(null);

  const openBilling = (r: LabOrderRow) => {
    setBillRow(r);
    setBPct(String(r.billing_order_discount_percent));
    setBAmt(String(r.billing_order_discount_amount));
    setBFees(String(r.billing_other_fees));
    setBillErr(null);
    setBillOpen(true);
  };

  const saveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billRow) return;
    setBillPending(true);
    setBillErr(null);
    try {
      await updateLabOrderBilling(billRow.id, {
        billing_order_discount_percent: Number(bPct) || 0,
        billing_order_discount_amount: Number(bAmt) || 0,
        billing_other_fees: Number(bFees) || 0,
      });
      setBillOpen(false);
      setBillRow(null);
      bumpGrid();
    } catch (e2) {
      setBillErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setBillPending(false);
    }
  };

  const issueNotice = async (orderId: string) => {
    setIssuePending(orderId);
    try {
      await issuePaymentNoticeForLabOrder(orderId);
      bumpGrid();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setIssuePending(null);
    }
  };

  const columns = React.useMemo<ColumnDef<LabOrderRow, unknown>[]>(
    () => [
      {
        accessorKey: "order_number",
        header: "Số đơn",
        meta: { filterKey: "order_number", filterType: "text" },
        cell: ({ row, getValue }) => (
          <Link
            className="font-medium text-[color-mix(in_srgb,var(--primary)_55%,var(--on-surface))] underline-offset-2 hover:underline"
            href={"/orders/" + row.original.id}
          >
            {String(getValue())}
          </Link>
        ),
      },
      { accessorKey: "received_at", header: "Ngày nhận", meta: { filterKey: "received_from", filterType: "text" } },
      { accessorKey: "partner_code", header: "Mã KH", meta: { filterKey: "partner_code", filterType: "text" } },
      { accessorKey: "partner_name", header: "Khách", meta: { filterKey: "partner_name", filterType: "text" } },
      { accessorKey: "patient_name", header: "Bệnh nhân", meta: { filterKey: "patient_name", filterType: "text" } },
      {
        accessorKey: "total_amount",
        header: "Cộng dòng",
        cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN"),
      },
      {
        accessorKey: "grand_total",
        header: "Phải thu (sau CK)",
        cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN"),
      },
      {
        accessorKey: "payment_notice_doc_number",
        header: "Số GBTT",
        cell: ({ getValue }) => (getValue() ? String(getValue()) : "—"),
      },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <DataGridRowActionsMenu>
            <DropdownMenuItem onSelect={() => openBilling(row.original)}>
              CK / phí
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={issuePending === row.original.id}
              onSelect={() => void issueNotice(row.original.id)}
            >
              {issuePending === row.original.id ? "…" : "Cấp số GBTT"}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <PaymentNoticePrintButton
                orderId={row.original.id}
                label="In GBTT"
                variant="ghost"
                className="w-full justify-start rounded-none px-2 py-1.5 text-xs font-normal h-auto ring-0 shadow-none hover:bg-transparent"
              />
            </DropdownMenuItem>
          </DataGridRowActionsMenu>
        ),
      },
    ],
    [issuePending],
  );

  return (
    <>
      <ExcelDataGrid<LabOrderRow>
        moduleId="sales_billing_orders"
        title="Doanh số — Giấy báo thanh toán"
        columns={columns}
        list={listLabOrders}
        reloadSignal={gridReload}
        getRowId={(r) => r.id}
      />
      <Dialog open={billOpen} onOpenChange={(v) => { setBillOpen(v); if (!v) setBillRow(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Điều chỉnh chiết khấu / phí</DialogTitle>
            <DialogDescription>
              Đơn {billRow?.order_number}: áp dụng trước khi in giấy báo thanh toán. Công thức: (cộng dòng × (1 − CK%)) − CK VNĐ + chi phí khác.
            </DialogDescription>
          </DialogHeader>
          {billErr ? <p className="text-sm text-[#b91c1c]">{billErr}</p> : null}
          <form onSubmit={(e) => void saveBilling(e)} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sb-pct">Chiết khấu tổng (%)</Label>
              <Input id="sb-pct" value={bPct} onChange={(e) => setBPct(e.target.value)} inputMode="decimal" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sb-amt">Giảm giá tổng (VNĐ)</Label>
              <Input id="sb-amt" value={bAmt} onChange={(e) => setBAmt(e.target.value)} inputMode="decimal" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sb-fees">Chi phí khác (+)</Label>
              <Input id="sb-fees" value={bFees} onChange={(e) => setBFees(e.target.value)} inputMode="decimal" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setBillOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" disabled={billPending}>
                {billPending ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
