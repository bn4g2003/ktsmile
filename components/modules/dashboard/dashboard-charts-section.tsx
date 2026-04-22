"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardChartsData } from "@/lib/actions/dashboard-stats";
import { formatOrderStatus } from "@/lib/format/labels";
import { escapeHtml } from "@/lib/reports/escape-html";
import { PrintReportButton } from "@/components/shared/reports/print-report-button";
import { Card } from "@/components/ui/card";

const PIE_COLORS = ["#0f4c81", "#d97706", "#16a34a", "#7c3aed", "#0891b2", "#64748b", "#db2777"];

export function DashboardChartsSection({ data }: { data: DashboardChartsData }) {
  const pieRows = data.orderByStatus.map((d) => ({
    name: formatOrderStatus(d.status),
    value: d.count,
  }));

  const stockRows = data.topStock.map((r) => ({
    name: r.product_code,
    label: r.product_name,
    qty: r.quantity_on_hand,
  }));

  const printBody = () => {
    const gen = new Date().toLocaleString("vi-VN");
    const orderRows = data.orderByStatus
      .map(
        (d) =>
          `<tr><td>${escapeHtml(formatOrderStatus(d.status))}</td><td class="num">${d.count}</td></tr>`,
      )
      .join("");
    const stockTable = data.topStock
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.product_code)}</td><td>${escapeHtml(r.product_name)}</td><td class="num">${escapeHtml(String(r.quantity_on_hand))}</td></tr>`,
      )
      .join("");
    return `
      <h1>Báo cáo tổng quan</h1>
      <p class="muted" style="text-align:center;font-size:11px;">In lúc: ${escapeHtml(gen)}</p>
      <h2>Đơn hàng theo trạng thái</h2>
      <table><thead><tr><th>Trạng thái</th><th class="num">Số đơn</th></tr></thead><tbody>${orderRows}</tbody></table>
      <h2>Tồn kho (top)</h2>
      <table><thead><tr><th>Mã SP</th><th>Tên</th><th class="num">Tồn</th></tr></thead><tbody>${stockTable}</tbody></table>
    `;
  };

  return (
    <Card className="p-3.5 sm:p-5 shadow-[var(--shadow-card)] overflow-hidden">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--on-surface)]">
            Biểu đồ nhanh
          </h2>
          <p className="text-sm text-[var(--on-surface-muted)]">
            Đơn theo trạng thái · Sản phẩm tồn cao
          </p>
        </div>
        <PrintReportButton title="Báo cáo tổng quan — KT Smile Lab" buildBodyHtml={printBody} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 sm:h-72 w-full min-w-0">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">
            Đơn hàng theo trạng thái
          </p>
          {pieRows.length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--on-surface-muted)]">Chưa có đơn.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieRows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  label={({ name, percent }) =>
                    `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {pieRows.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Số đơn"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="h-64 sm:h-72 w-full min-w-0">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">
            Tồn kho (top)
          </p>
          {stockRows.length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--on-surface-muted)]">Chưa có dữ liệu tồn.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockRows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--on-surface) 12%, transparent)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => [
                    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(v),
                    "Tồn",
                  ]}
                  labelFormatter={(_, p) => {
                    const row = p?.[0]?.payload as { label?: string } | undefined;
                    return row?.label ?? "";
                  }}
                />
                <Bar dataKey="qty" fill="#0f4c81" radius={[6, 6, 0, 0]} name="Tồn" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Card>
  );
}
