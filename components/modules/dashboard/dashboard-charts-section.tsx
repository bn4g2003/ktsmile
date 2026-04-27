"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardChartsData } from "@/lib/actions/dashboard-stats";
import { escapeHtml } from "@/lib/reports/escape-html";
import { PrintReportButton } from "@/components/shared/reports/print-report-button";
import { Card } from "@/components/ui/card";

function money(n: number) {
  return Math.round(n || 0).toLocaleString("vi-VN");
}

function moneyM(n: number) {
  return `${Math.round((n || 0) / 1_000_000).toLocaleString("vi-VN")} triệu`;
}

export function DashboardChartsSection({ data }: { data: DashboardChartsData }) {
  const monthRows = data.monthlyFinance.map((r) => ({
    label: "Th " + r.month,
    revenue: r.revenue,
    expense: r.expense,
    profit: r.profit,
  }));
  const currentMonthIdx = new Date().getUTCMonth();
  const currentMonth = data.monthlyFinance[currentMonthIdx] ?? { revenue: 0, expense: 0, profit: 0 };

  const printBody = () => {
    const gen = new Date().toLocaleString("vi-VN");
    const orderRows = data.monthlyFinance
      .map(
        (d) =>
          `<tr><td>Tháng ${d.month}</td><td class="num">${money(d.revenue)}</td><td class="num">${money(d.expense)}</td><td class="num">${money(d.profit)}</td></tr>`,
      )
      .join("");
    const stockTable = data.topStock
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.product_code)}</td><td>${escapeHtml(r.product_name)}</td><td class="num">${escapeHtml(String(r.quantity_on_hand))}</td><td class="num">${money(r.stock_value)}</td></tr>`,
      )
      .join("");
    return `
      <h1>Báo cáo tổng quan</h1>
      <p class="muted" style="text-align:center;font-size:11px;">In lúc: ${escapeHtml(gen)}</p>
      <h2>Doanh thu / Chi phí / Lợi nhuận theo tháng</h2>
      <table><thead><tr><th>Tháng</th><th class="num">Doanh thu</th><th class="num">Chi phí</th><th class="num">Lợi nhuận</th></tr></thead><tbody>${orderRows}</tbody></table>
      <h2>Tồn kho (top)</h2>
      <table><thead><tr><th>Mã SP</th><th>Tên</th><th class="num">Tồn</th><th class="num">Giá trị</th></tr></thead><tbody>${stockTable}</tbody></table>
    `;
  };

  return (
    <div className="space-y-4">
      <Card className="p-3.5 sm:p-5 shadow-[var(--shadow-card)] overflow-hidden">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--on-surface)]">Tổng quan</h2>
            <p className="text-sm text-[var(--on-surface-muted)]">
              Tổng tiền, công nợ, tồn kho và hiệu quả tài chính theo năm.
            </p>
          </div>
          <PrintReportButton title="Báo cáo tổng quan — KT Smile Lab" buildBodyHtml={printBody} />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-md border border-[var(--border-ghost)] p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">Tình hình tài chính</h3>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <div>Tổng tiền</div><div className="text-right font-semibold">{money(data.financial.total_money)}</div>
              <div>Tiền mặt</div><div className="text-right">{money(data.financial.cash_on_hand)}</div>
              <div>Tiền gửi</div><div className="text-right">{money(data.financial.bank_deposit)}</div>
              <div>Phải thu</div><div className="text-right">{money(data.financial.receivable)}</div>
              <div>Phải trả</div><div className="text-right">{money(data.financial.payable)}</div>
              <div>Doanh thu</div><div className="text-right">{money(data.financial.revenue_year)}</div>
              <div>Chi phí</div><div className="text-right">{money(data.financial.expense_year)}</div>
              <div>Lợi nhuận</div><div className="text-right font-semibold">{money(data.financial.profit_year)}</div>
              <div>Hàng tồn kho</div><div className="text-right">{money(data.financial.inventory_value)}</div>
            </div>
          </div>
          <div className="rounded-md border border-[var(--border-ghost)] p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">Nợ phải thu theo hạn nợ</h3>
            <div className="mt-2 text-xl font-bold">{moneyM(data.receivableDue.total)}</div>
            <div className="mt-2 h-3 rounded bg-[var(--surface-muted)]">
              <div
                className="h-full rounded bg-[#f59e0b]"
                style={{ width: `${data.receivableDue.total > 0 ? (data.receivableDue.overdue / data.receivableDue.total) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-[var(--on-surface-muted)]">
              <span>Quá hạn: {moneyM(data.receivableDue.overdue)}</span>
              <span>Trong hạn: {moneyM(data.receivableDue.in_due)}</span>
            </div>
          </div>
          <div className="rounded-md border border-[var(--border-ghost)] p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">Nợ phải trả theo hạn nợ</h3>
            <div className="mt-2 text-xl font-bold">{moneyM(data.payableDue.total)}</div>
            <div className="mt-2 h-3 rounded bg-[var(--surface-muted)]">
              <div
                className="h-full rounded bg-[#f59e0b]"
                style={{ width: `${data.payableDue.total > 0 ? (data.payableDue.overdue / data.payableDue.total) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-[var(--on-surface-muted)]">
              <span>Quá hạn: {moneyM(data.payableDue.overdue)}</span>
              <span>Trong hạn: {moneyM(data.payableDue.in_due)}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-3.5 sm:p-4">
          <h3 className="text-sm font-semibold text-[var(--on-surface)]">Doanh thu, chi phí, lợi nhuận ({data.year})</h3>
          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
            <div><div className="font-semibold">{moneyM(currentMonth.revenue)}</div><div className="text-[var(--on-surface-muted)]">Doanh thu tháng</div></div>
            <div><div className="font-semibold">{moneyM(currentMonth.expense)}</div><div className="text-[var(--on-surface-muted)]">Chi phí tháng</div></div>
            <div><div className="font-semibold">{moneyM(currentMonth.profit)}</div><div className="text-[var(--on-surface-muted)]">Lợi nhuận tháng</div></div>
          </div>
          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--on-surface) 12%, transparent)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [money(v), ""]} />
                <Bar dataKey="revenue" fill="#22c55e" name="Doanh thu" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#f59e0b" name="Chi phí" radius={[4, 4, 0, 0]} />
                <Line dataKey="profit" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} name="Lợi nhuận" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4">
          <h3 className="text-sm font-semibold text-[var(--on-surface)]">Hàng hóa tồn kho</h3>
          <div className="text-2xl font-bold mt-1">{moneyM(data.financial.inventory_value)}</div>
          <div className="text-xs text-[var(--on-surface-muted)] mb-2">Tổng giá trị tồn kho</div>
          <div className="space-y-1 text-sm">
            {data.topStock.slice(0, 6).map((r) => (
              <div key={r.product_code} className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-[var(--border-ghost)] py-1">
                <span className="truncate">{r.product_name}</span>
                <span className="tabular-nums text-right">{r.quantity_on_hand.toLocaleString("vi-VN")}</span>
                <span className="tabular-nums text-right">{money(r.stock_value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-3.5 sm:p-4">
          <h3 className="text-sm font-semibold text-[var(--on-surface)]">Doanh thu ({data.year})</h3>
          <div className="text-2xl font-bold mt-1">{moneyM(data.financial.revenue_year)}</div>
          <div className="h-52 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--on-surface) 12%, transparent)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [money(v), "Doanh thu"]} />
                <Bar dataKey="revenue" fill="#14b8a6" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4">
          <h3 className="text-sm font-semibold text-[var(--on-surface)]">Mặt hàng bán chạy</h3>
          <div className="text-2xl font-bold mt-1">
            {moneyM(data.topSold.reduce((s, r) => s + r.revenue, 0))}
          </div>
          <div className="text-xs text-[var(--on-surface-muted)] mb-2">Doanh thu top mặt hàng</div>
          <div className="space-y-1 text-sm">
            {data.topSold.slice(0, 6).map((r) => (
              <div key={r.product_code} className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-[var(--border-ghost)] py-1">
                <span className="truncate">{r.product_name}</span>
                <span className="tabular-nums text-right">{r.quantity_sold.toLocaleString("vi-VN")}</span>
                <span className="tabular-nums text-right">{money(r.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
