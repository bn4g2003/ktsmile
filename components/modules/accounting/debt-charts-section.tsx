"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { listDebtReport, type DebtRow } from "@/lib/actions/debt";
import { formatVnd } from "@/lib/format/currency";
import { escapeHtml } from "@/lib/reports/escape-html";
import { PrintReportButton } from "@/components/shared/reports/print-report-button";
import { Card } from "@/components/ui/card";

export function DebtChartsSection({ year, month }: { year: string; month: string }) {
  const [rows, setRows] = React.useState<DebtRow[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setErr(null);
    void listDebtReport({
      page: 1,
      pageSize: 3000,
      globalSearch: "",
      filters: { year, month },
    })
      .then((r) => {
        if (!cancelled) setRows(r.rows);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Lỗi tải");
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const chartData = React.useMemo(() => {
    return [...rows]
      .sort((a, b) => b.closing - a.closing)
      .slice(0, 12)
      .map((r) => ({
        code: r.partner_code,
        name: r.partner_name,
        closing: r.closing,
      }));
  }, [rows]);

  const printBody = () => {
    const gen = new Date().toLocaleString("vi-VN");
    const period = `Tháng ${month}/${year}`;
    const body = rows
      .map(
        (r) =>
          `<tr>
            <td>${escapeHtml(r.partner_code)}</td>
            <td>${escapeHtml(r.partner_name)}</td>
            <td class="num">${escapeHtml(formatVnd(r.opening))}</td>
            <td class="num">${escapeHtml(formatVnd(r.orders_month))}</td>
            <td class="num">${escapeHtml(formatVnd(r.receipts_month))}</td>
            <td class="num">${escapeHtml(formatVnd(r.closing))}</td>
          </tr>`,
      )
      .join("");
    return `
      <h1>Báo cáo công nợ khách hàng</h1>
      <p class="muted" style="text-align:center;">${escapeHtml(period)}</p>
      <p class="muted" style="text-align:center;font-size:11px;">In lúc: ${escapeHtml(gen)} · ${rows.length} dòng</p>
      <table>
        <thead>
          <tr>
            <th>Mã KH</th><th>Tên KH</th>
            <th class="num">Nợ đầu kỳ</th><th class="num">PS bán</th><th class="num">Đã thu</th><th class="num">Nợ cuối kỳ</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    `;
  };

  return (
    <Card className="p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--on-surface)]">
            Biểu đồ công nợ
          </h2>
          <p className="text-sm text-[var(--on-surface-muted)]">
            Top khách theo nợ cuối kỳ (kỳ đang chọn ở trên)
          </p>
        </div>
        <PrintReportButton
          title={`Công nợ ${month}/${year} — KT Smile Lab`}
          buildBodyHtml={printBody}
        />
      </div>
      {err ? (
        <p className="text-sm text-[#b91c1c]">{err}</p>
      ) : chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--on-surface-muted)]">Không có dữ liệu kỳ này.</p>
      ) : (
        <div className="h-80 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatVnd(Number(v))} />
              <YAxis
                type="category"
                dataKey="code"
                width={56}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                formatter={(v: number) => [formatVnd(v), "Nợ cuối kỳ"]}
                labelFormatter={(_, p) => {
                  const row = p?.[0]?.payload as { name?: string } | undefined;
                  return row?.name ?? "";
                }}
              />
              <Bar dataKey="closing" fill="#5b4ddb" radius={[0, 6, 6, 0]} name="Nợ cuối kỳ" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
