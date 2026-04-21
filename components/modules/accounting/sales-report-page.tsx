"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { listSalesReport, getSalesOrdersByPartner, type SalesReportRow, type SalesOrderDetail } from "@/lib/actions/sales-report";
import { formatDate } from "@/lib/format/date";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function SalesReportPage() {
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailPartner, setDetailPartner] = React.useState<SalesReportRow | null>(null);
  const [detailOrders, setDetailOrders] = React.useState<SalesOrderDetail[]>([]);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [dateRange, setDateRange] = React.useState({ from: "", to: "" });

  // Khởi tạo ngày mặc định: đầu tháng đến hôm nay
  const defaultFromDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const defaultToDate = new Date().toISOString().split('T')[0];

  const openDetail = async (row: SalesReportRow, fromDate: string, toDate: string) => {
    setDetailPartner(row);
    setDateRange({ from: fromDate, to: toDate });
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const orders = await getSalesOrdersByPartner(row.partner_id, fromDate, toDate);
      setDetailOrders(orders);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = React.useMemo<ColumnDef<SalesReportRow, unknown>[]>(
    () => [
      {
        accessorKey: "partner_code",
        header: "Mã KH",
        meta: { filterKey: "partner_code", filterType: "text" },
      },
      {
        accessorKey: "partner_name",
        header: "Tên khách hàng",
        meta: { filterKey: "partner_name", filterType: "text" },
      },
      {
        accessorKey: "order_count",
        header: "Số đơn",
        cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN"),
      },
      {
        accessorKey: "total_sales",
        header: "Tổng doanh số",
        cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN"),
      },
      {
        id: "actions",
        header: "Chi tiết",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row, table }) => {
          const filters = (table.options.meta as { filters?: Record<string, string> })?.filters ?? {};
          const fromDate = filters.from_date || defaultFromDate;
          const toDate = filters.to_date || defaultToDate;
          
          return (
            <button
              type="button"
              className="text-sm text-[color-mix(in_srgb,var(--primary)_55%,var(--on-surface))] underline-offset-2 hover:underline"
              onClick={() => void openDetail(row.original, fromDate, toDate)}
            >
              Xem đơn
            </button>
          );
        },
      },
    ],
    [defaultFromDate, defaultToDate],
  );

  const totalSales = detailOrders.reduce((sum, o) => sum + o.grand_total, 0);

  const dateFilterToolbar = React.useMemo(
    () => (
      <div className="flex items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="from_date" className="text-xs">Từ ngày</Label>
          <Input
            id="from_date"
            type="date"
            defaultValue={defaultFromDate}
            className="h-9 w-40"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to_date" className="text-xs">Đến ngày</Label>
          <Input
            id="to_date"
            type="date"
            defaultValue={defaultToDate}
            className="h-9 w-40"
          />
        </div>
      </div>
    ),
    [defaultFromDate, defaultToDate],
  );

  return (
    <>
      <ExcelDataGrid<SalesReportRow>
        moduleId="sales_report_by_partner"
        title="Báo cáo doanh số theo khách hàng"
        columns={columns}
        list={listSalesReport}
        getRowId={(r) => r.partner_id}
        prependFilters={
          <div className="flex items-center gap-2">
            <Label htmlFor="from_date_filter" className="text-sm">Từ ngày:</Label>
            <Input
              id="from_date_filter"
              type="date"
              defaultValue={defaultFromDate}
              className="h-9 w-40"
              data-filter-key="from_date"
            />
            <Label htmlFor="to_date_filter" className="text-sm">Đến ngày:</Label>
            <Input
              id="to_date_filter"
              type="date"
              defaultValue={defaultToDate}
              className="h-9 w-40"
              data-filter-key="to_date"
            />
          </div>
        }
      />

      <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) setDetailPartner(null); }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Chi tiết đơn hàng — {detailPartner?.partner_name} ({detailPartner?.partner_code})
            </DialogTitle>
            <DialogDescription>
              Từ {dateRange.from} đến {dateRange.to}
            </DialogDescription>
          </DialogHeader>
          
          {detailLoading ? (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Số đơn</TableHead>
                    <TableHead>Ngày nhận</TableHead>
                    <TableHead>Bệnh nhân</TableHead>
                    <TableHead className="text-right">Thành tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailOrders.map((order) => (
                    <TableRow key={order.order_id}>
                      <TableCell>
                        <Link
                          href={`/orders/${order.order_id}`}
                          className="text-[color-mix(in_srgb,var(--primary)_55%,var(--on-surface))] underline-offset-2 hover:underline"
                        >
                          {order.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(order.received_at)}</TableCell>
                      <TableCell>{order.patient_name}</TableCell>
                      <TableCell className="text-right">
                        {order.grand_total.toLocaleString("vi-VN")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="flex justify-end gap-4 pt-4 border-t">
                <div className="text-sm">
                  <span className="font-medium">Tổng số đơn:</span>{" "}
                  <span>{detailOrders.length}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium">Tổng doanh số:</span>{" "}
                  <span className="font-semibold">{totalSales.toLocaleString("vi-VN")}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
