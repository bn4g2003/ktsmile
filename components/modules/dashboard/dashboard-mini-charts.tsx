"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardChartsData } from "@/lib/actions/dashboard-stats";

function fmtMoney(n: number) {
  return `${Math.round(n || 0).toLocaleString("vi-VN")} đ`;
}

type Row = {
  label: string;
  revenue: number;
  expense: number;
  profit: number;
};

export function DashboardMiniCharts({
  monthlyFinance,
  selectedMonth,
}: {
  monthlyFinance: DashboardChartsData["monthlyFinance"];
  selectedMonth: number;
}) {
  const centerMonth = Math.min(12, Math.max(1, selectedMonth));
  const monthSet = new Set([Math.max(1, centerMonth - 1), centerMonth, Math.min(12, centerMonth + 1)]);
  const rows: Row[] = monthlyFinance
    .filter((r) => monthSet.has(r.month))
    .sort((a, b) => a.month - b.month)
    .map((r) => ({
      label: `T${r.month}`,
      revenue: r.revenue,
      expense: r.expense,
      profit: r.profit,
    }));

  const safeRows =
    rows.length > 0
      ? rows
      : [
          { label: "T1", revenue: 0, expense: 0, profit: 0 },
          { label: "T2", revenue: 0, expense: 0, profit: 0 },
          { label: "T3", revenue: 0, expense: 0, profit: 0 },
        ];

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-[#dbe2ef] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#1d2a44]">Doanh thu, chi tiêu, chênh lệch</h3>
        <div className="mt-4 h-40 rounded-lg border border-[#e2e8f6] bg-[#fbfcff] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={safeRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf5" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1_000_000)}tr`} />
              <Tooltip formatter={(v: number) => [fmtMoney(v), ""]} />
              <Bar dataKey="revenue" fill="#111827" name="Doanh thu" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expense" fill="#0f766e" name="Chi tiêu" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="profit" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} name="Chênh lệch" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-[#dbe2ef] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#1d2a44]">Doanh thu theo tháng</h3>
        <div className="mt-4 h-40 rounded-lg border border-[#e2e8f6] bg-[#fbfcff] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={safeRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf5" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1_000_000)}tr`} />
              <Tooltip formatter={(v: number) => [fmtMoney(v), "Doanh thu"]} />
              <Line type="monotone" dataKey="revenue" stroke="#0f172a" strokeWidth={3} dot={{ r: 2 }} name="Doanh thu" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
