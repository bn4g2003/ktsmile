"use client";

import * as React from "react";
import { getSummaryReport, SummaryReportData } from "@/lib/actions/summary-report";
import { StatCard } from "@/components/ui/stat-card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { NavIconChart } from "@/components/shared/nav-icons";

export function SummaryReportPage() {
  const [month, setMonth] = React.useState(new Date().getMonth() + 1);
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [data, setData] = React.useState<SummaryReportData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await getSummaryReport(month, year);
        setData(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [month, year]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--on-surface)]">Báo cáo tổng hợp</h1>
          <p className="text-sm text-[var(--on-surface-muted)]">Tổng kết sản lượng và phát sinh theo tháng/năm</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--on-surface-muted)]">Tháng</span>
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-28">
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--on-surface-muted)]">Năm</span>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            <div className="text-sm font-medium text-[var(--on-surface-muted)]">Đang tải dữ liệu...</div>
          </div>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Tổng sản lượng" value={data.totalYield.toLocaleString()} hint="Tổng số răng" accent="purple" />
            <StatCard label="Hàng mới" value={data.totalNewYield.toLocaleString()} hint="Sản lượng làm mới" />
            <StatCard label="Hàng làm lại" value={data.totalWarrantyYield.toLocaleString()} hint="Bảo hành & sửa" />
            <StatCard label="Khách hàng phát sinh" value={data.totalCustomers.toLocaleString()} hint="Số KH có đơn hàng" />
          </div>

          <Card className="p-0 overflow-hidden border border-[var(--border-ghost)]">
            <div className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] px-5 py-4">
              <h2 className="flex items-center gap-2.5 font-bold text-[var(--on-surface)]">
                <NavIconChart className="h-5 w-5 text-[var(--primary)]" />
                Tổng sản lượng theo sản phẩm
              </h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--surface-card)] hover:bg-transparent">
                    <TableHead className="w-[180px] font-bold uppercase tracking-wider text-[11px]">Mã sản phẩm</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[11px]">Tên sản phẩm</TableHead>
                    <TableHead className="text-right font-bold uppercase tracking-wider text-[11px]">Sản lượng (Răng)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center text-[var(--on-surface-muted)]">
                        Không có dữ liệu trong thời gian đã chọn
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.products.map((p) => (
                      <TableRow key={p.product_code}>
                        <TableCell className="font-mono text-sm font-semibold text-[var(--primary)]">{p.product_code}</TableCell>
                        <TableCell className="font-medium text-[var(--on-surface)]">{p.product_name}</TableCell>
                        <TableCell className="text-right font-bold text-[var(--on-surface)] text-base">{p.count.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
