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
import {
  getCashLedgerSummary,
  type CashLedgerChannelRow,
  type CashLedgerSummary,
} from "@/lib/actions/cash";
import { formatVnd } from "@/lib/format/currency";
import { escapeHtml } from "@/lib/reports/escape-html";
import { PrintReportButton } from "@/components/shared/reports/print-report-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LEDGER_COMPANY_NAME = "CÔNG TY TNHH KTSMILE";
const LEDGER_COMPANY_ADDRESS = "447/10 Tân Sơn, Phường An Hội Tây, TP.HCM";

function formatDateVi(iso: string) {
  const p = iso.split("-");
  if (p.length !== 3) return iso;
  return p[2] + "/" + p[1] + "/" + p[0];
}

function ledgerTableRowHtml(r: CashLedgerChannelRow) {
  return (
    "<tr>" +
    "<td>" +
    escapeHtml(r.label) +
    "</td>" +
    '<td class="num">' +
    escapeHtml(formatVnd(r.openingBook)) +
    "</td>" +
    '<td class="num">' +
    escapeHtml(formatVnd(r.openingPeriod)) +
    "</td>" +
    '<td class="num">' +
    escapeHtml(formatVnd(r.receiptInPeriod)) +
    "</td>" +
    '<td class="num">' +
    escapeHtml(formatVnd(r.paymentInPeriod)) +
    "</td>" +
    '<td class="num">' +
    escapeHtml(formatVnd(r.closing)) +
    "</td>" +
    "</tr>"
  );
}

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
  const [ledger, setLedger] = React.useState<CashLedgerSummary | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setErr(null);
    setLoading(true);
    void getCashLedgerSummary(from, to)
      .then((s) => {
        if (!cancelled) setLedger(s);
      })
      .catch((e) => {
        if (!cancelled) {
          setLedger(null);
          setErr(e instanceof Error ? e.message : "Lỗi");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const receipt = ledger?.totals.receiptInPeriod ?? 0;
  const payment = ledger?.totals.paymentInPeriod ?? 0;

  const chartData = [
    { name: "Thu", value: receipt, fill: "#16a34a" },
    { name: "Chi", value: payment, fill: "#dc2626" },
  ];

  const printBody = () => {
    const gen = new Date().toLocaleString("vi-VN");
    const s = ledger;
    const head =
      "<p style=\"font-weight:600;margin:0 0 2px\">" +
      escapeHtml(LEDGER_COMPANY_NAME) +
      "</p>" +
      "<p class=\"muted\" style=\"margin:0 0 12px\">" +
      escapeHtml(LEDGER_COMPANY_ADDRESS) +
      "</p>" +
      "<h1>THU CHI VÀ TỒN QUỸ</h1>" +
      "<p class=\"muted\">Từ ngày " +
      escapeHtml(formatDateVi(from)) +
      " &nbsp; Đến ngày " +
      escapeHtml(formatDateVi(to)) +
      " · " +
      escapeHtml(gen) +
      "</p>";

    if (!s) {
      return head + "<p>Không có dữ liệu.</p>";
    }

    const thead =
      "<thead><tr>" +
      "<th>Loại tiền</th>" +
      "<th class=\"num\">Tồn khi mở sổ</th>" +
      "<th class=\"num\">Tồn đầu kỳ</th>" +
      "<th class=\"num\">Thu trong kỳ</th>" +
      "<th class=\"num\">Chi trong kỳ</th>" +
      "<th class=\"num\">Tồn cuối kỳ</th>" +
      "</tr></thead>";

    const bodyRows = s.rows.map(ledgerTableRowHtml).join("");
    const foot =
      "<tr style=\"font-weight:700\">" +
      "<td>" +
      escapeHtml("TỔNG CỘNG") +
      "</td>" +
      '<td class="num">' +
      escapeHtml(formatVnd(s.totals.openingBook)) +
      "</td>" +
      '<td class="num">' +
      escapeHtml(formatVnd(s.totals.openingPeriod)) +
      "</td>" +
      '<td class="num">' +
      escapeHtml(formatVnd(s.totals.receiptInPeriod)) +
      "</td>" +
      '<td class="num">' +
      escapeHtml(formatVnd(s.totals.paymentInPeriod)) +
      "</td>" +
      '<td class="num">' +
      escapeHtml(formatVnd(s.totals.closing)) +
      "</td>" +
      "</tr>";

    return (
      head +
      "<table>" +
      thead +
      "<tbody>" +
      bodyRows +
      foot +
      "</tbody></table>" +
      "<p class=\"muted\" style=\"margin-top:14px\">Tồn đầu kỳ = thu trừ chi trước ngày kỳ báo cáo. " +
      "Tồn khi mở sổ hiển thị cùng giá trị (chưa có số khai sổ riêng). " +
      "Chi tiết chứng từ xem lưới Sổ quỹ.</p>"
    );
  };

  return (
    <Card className="p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 text-center">
        <p className="text-sm font-semibold text-[var(--on-surface)]">{LEDGER_COMPANY_NAME}</p>
        <p className="text-xs text-[var(--on-surface-muted)]">{LEDGER_COMPANY_ADDRESS}</p>
        <h2 className="mt-3 text-base font-bold tracking-tight text-[var(--on-surface)]">
          THU CHI VÀ TỒN QUỸ
        </h2>
        <p className="text-xs text-[var(--on-surface-muted)]">
          Từ ngày {formatDateVi(from)} · Đến ngày {formatDateVi(to)}
        </p>
      </div>
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
      ) : loading ? (
        <p className="text-sm text-[var(--on-surface-muted)]">Đang tải…</p>
      ) : (
        <>
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

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)]">
                  <th className="px-2 py-2 font-semibold">Loại tiền</th>
                  <th className="px-2 py-2 text-right font-semibold tabular-nums">Tồn khi mở sổ</th>
                  <th className="px-2 py-2 text-right font-semibold tabular-nums">Tồn đầu kỳ</th>
                  <th className="px-2 py-2 text-right font-semibold tabular-nums">Thu trong kỳ</th>
                  <th className="px-2 py-2 text-right font-semibold tabular-nums">Chi trong kỳ</th>
                  <th className="px-2 py-2 text-right font-semibold tabular-nums">Tồn cuối kỳ</th>
                </tr>
              </thead>
              <tbody>
                {(ledger?.rows ?? []).map((r) => (
                  <tr key={r.channelKey} className="border-b border-[var(--border-ghost)]">
                    <td className="px-2 py-2">{r.label}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatVnd(r.openingBook)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatVnd(r.openingPeriod)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatVnd(r.receiptInPeriod)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatVnd(r.paymentInPeriod)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatVnd(r.closing)}</td>
                  </tr>
                ))}
                {ledger ? (
                  <tr className="border-t-2 border-[var(--border-ghost)] font-semibold">
                    <td className="px-2 py-2">TỔNG CỘNG</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatVnd(ledger.totals.openingBook)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatVnd(ledger.totals.openingPeriod)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatVnd(ledger.totals.receiptInPeriod)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatVnd(ledger.totals.paymentInPeriod)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatVnd(ledger.totals.closing)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[var(--on-surface-muted)]">
            Tồn đầu kỳ = thu trừ chi trước ngày bắt đầu kỳ. Cột «Tồn khi mở sổ» hiện dùng cùng giá trị (chưa có
            số khai sổ tách). Kênh <span className="font-medium">cash</span> hiển thị «Tất cả Tiền mặt».
          </p>
        </>
      )}
    </Card>
  );
}
