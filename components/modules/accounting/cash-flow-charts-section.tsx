"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getCashFlowTotalsForRange } from "@/lib/actions/cash";
import { formatVnd } from "@/lib/format/currency";
import { escapeHtml } from "@/lib/reports/escape-html";
import { PrintReportButton } from "@/components/shared/reports/print-report-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function firstOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function lastOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

export function CashFlowChartsSection() {
  const now = React.useMemo(() => new Date(), []);
  const [from, setFrom] = React.useState(() => firstOfMonth(now));
  const [to, setTo] = React.useState(() => lastOfMonth(now));
  const [receipt, setReceipt] = React.useState(0);
  const [payment, setPayment] = React.useState(0);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setErr(null);
    void getCashFlowTotalsForRange(from, to)
      .then((t) => {
        if (!cancelled) {
          setReceipt(t.receipt);
          setPayment(t.payment);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Lỗi");
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const chartData = [
    { name: "Thu", value: receipt, fill: "#16a34a" },
    { name: "Chi", value: payment, fill: "#dc2626" },
  ];

  const printBody = () => {
    const gen = new Date().toLocaleString("vi-VN");
    return `
      <h1>Báo cáo sổ quỹ (tổng hợp)</h1>
      <p class="muted">Từ ${escapeHtml(from)} đến ${escapeHtml(to)} · ${escapeHtml(gen)}</p>
      <table>
        <tbody>
          <tr><th>Tổng thu</th><td class="num">${escapeHtml(formatVnd(receipt))}</td></tr>
          <tr><th>Tổng chi</th><td class="num">${escapeHtml(formatVnd(payment))}</td></tr>
          <tr><th>Chênh lệch</th><td class="num">${escapeHtml(formatVnd(receipt - payment))}</td></tr>
        </tbody>
      </table>
      <p class="muted" style="margin-top:14px">Chi tiết từng chứng từ xem trên màn hình Sổ quỹ và xuất Excel.</p>
    `;
  };

  return (
    <Card className="p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cf-from">Từ ngày</Label>
            <Input
              id="cf-from"
              type="date"
              className="min-h-8 w-auto"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cf-to">Đến ngày</Label>
            <Input
              id="cf-to"
              type="date"
              className="min-h-8 w-auto"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <PrintReportButton
          title={`Sổ quỹ tổng hợp ${from} — ${to} — KT Smile Lab`}
          buildBodyHtml={printBody}
        />
      </div>
      {err ? (
        <p className="text-sm text-[#b91c1c]">{err}</p>
      ) : (
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatVnd(Number(v))} />
              <Tooltip formatter={(v: number) => [formatVnd(v), "Số tiền"]} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {chartData.map((e, i) => (
                  <Cell key={i} fill={e.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
