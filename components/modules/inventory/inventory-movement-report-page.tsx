"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  getInventoryMovementReport,
  type InventoryMovementReport,
} from "@/lib/actions/inventory-report";
import { formatVnd } from "@/lib/format/currency";

export function InventoryMovementReportPage() {
  const [fromDate, setFromDate] = React.useState(() => {
    const d = new Date();
    d.setDate(1); // Đầu tháng
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = React.useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [report, setReport] = React.useState<InventoryMovementReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadReport = async () => {
    if (!fromDate || !toDate) {
      setError("Vui lòng chọn khoảng thời gian");
      return;
    }
    if (fromDate > toDate) {
      setError("Từ ngày phải nhỏ hơn đến ngày");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getInventoryMovementReport(fromDate, toDate);
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải báo cáo");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!report || report.rows.length === 0) {
      alert("Không có dữ liệu để xuất");
      return;
    }

    // Tạo CSV content
    const headers = [
      "Tên vật tư",
      "Đơn vị",
      "Tồn đầu kỳ - SL",
      "Tồn đầu kỳ - Thành tiền",
      "Nhập trong kỳ - SL",
      "Nhập trong kỳ - Thành tiền",
      "Xuất trong kỳ - SL",
      "Xuất trong kỳ - Thành tiền",
      "Tồn cuối kỳ - SL",
      "Tồn cuối kỳ - Thành tiền",
    ];

    const rows = report.rows.map((r) => [
      r.product_name,
      r.unit,
      r.opening_qty,
      r.opening_amount,
      r.inbound_qty,
      r.inbound_amount,
      r.outbound_qty,
      r.outbound_amount,
      r.closing_qty,
      r.closing_amount,
    ]);

    const csvContent =
      "\uFEFF" + // BOM for UTF-8
      [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-nhap-xuat-ton-${fromDate}-${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--on-surface)]">
            Báo cáo Nhập Xuất Tồn kho
          </h1>
          <p className="text-sm text-[var(--on-surface-muted)] mt-1">
            Theo dõi tồn kho đầu kỳ, nhập, xuất và tồn cuối kỳ
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="from-date">Từ ngày</Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="to-date">Đến ngày</Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="primary"
              onClick={loadReport}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Đang tải..." : "Xem báo cáo"}
            </Button>
            {report && report.rows.length > 0 && (
              <Button variant="secondary" onClick={exportToExcel}>
                Xuất Excel
              </Button>
            )}
          </div>
        </div>
        {error && (
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        )}
      </Card>

      {report && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-[var(--border-ghost)] bg-[var(--surface-row-b)]">
                  <th
                    rowSpan={2}
                    className="px-4 py-3 text-left font-bold text-[var(--on-surface-muted)] uppercase tracking-wider text-[10px] border-r border-[var(--border-ghost)]"
                  >
                    Tên vật tư
                  </th>
                  <th
                    rowSpan={2}
                    className="px-4 py-3 text-center font-bold text-[var(--on-surface-muted)] uppercase tracking-wider text-[10px] border-r border-[var(--border-ghost)]"
                  >
                    Đơn vị
                  </th>
                  <th
                    colSpan={2}
                    className="px-4 py-2 text-center font-bold text-blue-600 uppercase tracking-wider text-[10px] border-r border-[var(--border-ghost)] bg-blue-50"
                  >
                    Tồn đầu kỳ
                  </th>
                  <th
                    colSpan={2}
                    className="px-4 py-2 text-center font-bold text-green-600 uppercase tracking-wider text-[10px] border-r border-[var(--border-ghost)] bg-green-50"
                  >
                    Nhập trong kỳ
                  </th>
                  <th
                    colSpan={2}
                    className="px-4 py-2 text-center font-bold text-orange-600 uppercase tracking-wider text-[10px] border-r border-[var(--border-ghost)] bg-orange-50"
                  >
                    Xuất trong kỳ
                  </th>
                  <th
                    colSpan={2}
                    className="px-4 py-2 text-center font-bold text-purple-600 uppercase tracking-wider text-[10px] bg-purple-50"
                  >
                    Tồn cuối kỳ
                  </th>
                </tr>
                <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-row-b)]">
                  <th className="px-3 py-2 text-center font-semibold text-[9px] text-blue-600 border-r border-[var(--border-ghost)] bg-blue-50">
                    Số lượng
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-[9px] text-blue-600 border-r border-[var(--border-ghost)] bg-blue-50">
                    Thành tiền
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-[9px] text-green-600 border-r border-[var(--border-ghost)] bg-green-50">
                    Số lượng
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-[9px] text-green-600 border-r border-[var(--border-ghost)] bg-green-50">
                    Thành tiền
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-[9px] text-orange-600 border-r border-[var(--border-ghost)] bg-orange-50">
                    Số lượng
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-[9px] text-orange-600 border-r border-[var(--border-ghost)] bg-orange-50">
                    Thành tiền
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-[9px] text-purple-600 border-r border-[var(--border-ghost)] bg-purple-50">
                    Số lượng
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-[9px] text-purple-600 bg-purple-50">
                    Thành tiền
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-ghost)]">
                {report.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-[var(--on-surface-muted)]"
                    >
                      Không có dữ liệu trong khoảng thời gian này
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row) => (
                    <tr
                      key={row.product_id}
                      className="hover:bg-[var(--surface-muted)] transition-colors"
                    >
                      <td className="px-4 py-3 border-r border-[var(--border-ghost)]">
                        <div className="font-semibold text-[var(--on-surface)]">
                          {row.product_name}
                        </div>
                        <div className="text-[9px] text-[var(--on-surface-faint)] uppercase font-semibold mt-0.5">
                          {row.product_code}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center border-r border-[var(--border-ghost)]">
                        {row.unit}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums border-r border-[var(--border-ghost)] bg-blue-50/30">
                        {row.opening_qty.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold border-r border-[var(--border-ghost)] bg-blue-50/30">
                        {formatVnd(row.opening_amount)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums border-r border-[var(--border-ghost)] bg-green-50/30">
                        {row.inbound_qty.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold border-r border-[var(--border-ghost)] bg-green-50/30">
                        {formatVnd(row.inbound_amount)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums border-r border-[var(--border-ghost)] bg-orange-50/30">
                        {row.outbound_qty.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold border-r border-[var(--border-ghost)] bg-orange-50/30">
                        {formatVnd(row.outbound_amount)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums border-r border-[var(--border-ghost)] bg-purple-50/30">
                        {row.closing_qty.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold bg-purple-50/30">
                        {formatVnd(row.closing_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {report.rows.length > 0 && (
                <tfoot className="border-t-2 border-[var(--border-ghost)] bg-[var(--surface-row-b)]">
                  <tr className="font-bold">
                    <td
                      colSpan={2}
                      className="px-4 py-3 text-right uppercase text-xs border-r border-[var(--border-ghost)]"
                    >
                      Tổng cộng
                    </td>
                    <td className="px-3 py-3 border-r border-[var(--border-ghost)] bg-blue-50/50"></td>
                    <td className="px-3 py-3 text-right tabular-nums text-blue-700 border-r border-[var(--border-ghost)] bg-blue-50/50">
                      {formatVnd(report.totals.opening_amount)}
                    </td>
                    <td className="px-3 py-3 border-r border-[var(--border-ghost)] bg-green-50/50"></td>
                    <td className="px-3 py-3 text-right tabular-nums text-green-700 border-r border-[var(--border-ghost)] bg-green-50/50">
                      {formatVnd(report.totals.inbound_amount)}
                    </td>
                    <td className="px-3 py-3 border-r border-[var(--border-ghost)] bg-orange-50/50"></td>
                    <td className="px-3 py-3 text-right tabular-nums text-orange-700 border-r border-[var(--border-ghost)] bg-orange-50/50">
                      {formatVnd(report.totals.outbound_amount)}
                    </td>
                    <td className="px-3 py-3 border-r border-[var(--border-ghost)] bg-purple-50/50"></td>
                    <td className="px-3 py-3 text-right tabular-nums text-purple-700 bg-purple-50/50">
                      {formatVnd(report.totals.closing_amount)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
