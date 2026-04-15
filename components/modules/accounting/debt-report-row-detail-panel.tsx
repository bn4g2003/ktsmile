"use client";

import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { DetailPreview } from "@/components/ui/detail-preview";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import { CashReceiptPrintButton } from "@/components/shared/reports/cash-receipt-print-button";
import type { DebtRow } from "@/lib/actions/debt";
import type { PayableRow } from "@/lib/actions/payables";
import {
  listPartnerReceiptsInMonth,
  listSupplierPaymentsInMonth,
  type DebtSettlementLine,
} from "@/lib/actions/debt-settlements";

function ReceivableHistoryBlock({
  partnerId,
  year,
  month,
}: {
  partnerId: string;
  year: number;
  month: number;
}) {
  const [lines, setLines] = React.useState<DebtSettlementLine[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLines(null);
    setErr(null);
    void listPartnerReceiptsInMonth(partnerId, year, month)
      .then((r) => {
        if (!cancelled) setLines(r);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Lỗi tải lịch sử");
      });
    return () => {
      cancelled = true;
    };
  }, [partnerId, year, month]);

  if (err) return <p className="text-sm text-[#b91c1c]">{err}</p>;
  if (lines === null) return <p className="text-sm text-[var(--on-surface-muted)]">Đang tải lịch sử…</p>;
  if (lines.length === 0) {
    return <p className="text-sm text-[var(--on-surface-muted)]">Chưa có phiếu thu trong tháng này.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
            <th className="px-3 py-2">Ngày CT</th>
            <th className="px-3 py-2">Số chứng từ</th>
            <th className="px-3 py-2">Kênh</th>
            <th className="px-3 py-2">Người nộp</th>
            <th className="px-3 py-2">Diễn giải</th>
            <th className="px-3 py-2 text-right">Số tiền</th>
            <th className="px-3 py-2 text-right">In</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((ln) => (
            <tr key={ln.id} className="border-b border-[var(--border-ghost)] last:border-b-0">
              <td className="px-3 py-2 tabular-nums text-[var(--on-surface-muted)]">{ln.transaction_date}</td>
              <td className="px-3 py-2 font-medium">{ln.doc_number}</td>
              <td className="px-3 py-2">{ln.payment_channel}</td>
              <td className="max-w-[8rem] truncate px-3 py-2">{ln.payer_name ?? "—"}</td>
              <td className="max-w-[12rem] truncate px-3 py-2 text-[var(--on-surface-muted)]">
                {ln.description ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{ln.amount.toLocaleString("vi-VN")}</td>
              <td className="px-3 py-2 text-right">
                <CashReceiptPrintButton transactionId={ln.id} label="PDF" variant="ghost" size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PayableHistoryBlock({
  supplierId,
  year,
  month,
}: {
  supplierId: string;
  year: number;
  month: number;
}) {
  const [lines, setLines] = React.useState<DebtSettlementLine[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLines(null);
    setErr(null);
    void listSupplierPaymentsInMonth(supplierId, year, month)
      .then((r) => {
        if (!cancelled) setLines(r);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Lỗi tải lịch sử");
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId, year, month]);

  if (err) return <p className="text-sm text-[#b91c1c]">{err}</p>;
  if (lines === null) return <p className="text-sm text-[var(--on-surface-muted)]">Đang tải lịch sử…</p>;
  if (lines.length === 0) {
    return <p className="text-sm text-[var(--on-surface-muted)]">Chưa có phiếu chi trả NCC trong tháng này.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
      <table className="w-full min-w-[30rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
            <th className="px-3 py-2">Ngày CT</th>
            <th className="px-3 py-2">Số chứng từ</th>
            <th className="px-3 py-2">Kênh</th>
            <th className="px-3 py-2">Diễn giải</th>
            <th className="px-3 py-2 text-right">Số tiền</th>
            <th className="px-3 py-2 text-right">In</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((ln) => (
            <tr key={ln.id} className="border-b border-[var(--border-ghost)] last:border-b-0">
              <td className="px-3 py-2 tabular-nums text-[var(--on-surface-muted)]">{ln.transaction_date}</td>
              <td className="px-3 py-2 font-medium">{ln.doc_number}</td>
              <td className="px-3 py-2">{ln.payment_channel}</td>
              <td className="max-w-[14rem] truncate px-3 py-2 text-[var(--on-surface-muted)]">
                {ln.description ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{ln.amount.toLocaleString("vi-VN")}</td>
              <td className="px-3 py-2 text-right">
                <CashReceiptPrintButton transactionId={ln.id} label="PDF" variant="ghost" size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Props =
  | {
      variant: "receivable";
      row: DebtRow;
      year: string;
      month: string;
      onOpenSettlement: () => void;
    }
  | {
      variant: "payable";
      row: PayableRow;
      year: string;
      month: string;
      onOpenSettlement: () => void;
    };

export function DebtReportRowDetailPanel(props: Props) {
  const [tab, setTab] = React.useState<"info" | "history">("info");
  const y = Number(props.year);
  const m = Number(props.month);
  const periodOk = Number.isFinite(y) && m >= 1 && m <= 12;

  React.useEffect(() => {
    setTab("info");
  }, [props.variant, props.variant === "receivable" ? props.row.partner_id : props.row.supplier_id]);

  if (props.variant === "receivable") {
    const row = props.row;
    const closingExplain =
      "Nợ cuối kỳ = Nợ đầu kỳ + PS bán trong tháng − Đã thu trong tháng (theo ngày chứng từ trên sổ quỹ).";
    return (
      <div className="flex min-h-0 flex-col gap-3">
        <DetailTabStrip
          items={[
            { id: "info", label: "Thông tin" },
            { id: "history", label: "Lịch sử" },
          ]}
          value={tab}
          onChange={(id) => setTab(id as typeof tab)}
        />
        {tab === "info" ? (
          <div className="space-y-4">
            <DetailPreview
              fields={[
                { label: "Kỳ báo cáo", value: "Tháng " + props.month + " / " + props.year },
                { label: "Mã khách hàng", value: row.partner_code },
                { label: "Tên khách hàng", value: row.partner_name },
                {
                  label: "Nợ đầu kỳ",
                  value: row.opening.toLocaleString("vi-VN") + " đ",
                  span: "full",
                },
                {
                  label: "Phát sinh bán (tháng)",
                  value: row.orders_month.toLocaleString("vi-VN") + " đ",
                  span: "full",
                },
                {
                  label: "Đã thu trong tháng",
                  value: row.receipts_month.toLocaleString("vi-VN") + " đ",
                  span: "full",
                },
                {
                  label: "Nợ cuối kỳ",
                  value: row.closing.toLocaleString("vi-VN") + " đ",
                  span: "full",
                },
                { label: "Diễn giải công thức", value: closingExplain, span: "full" },
                {
                  label: "Mã nội bộ (partner_id)",
                  value: row.partner_id,
                  span: "full",
                },
              ]}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="primary" size="sm" onClick={props.onOpenSettlement}>
                Ghi thu / phiếu / thêm chứng từ
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/master/partners">Mở danh mục KH và NCC</Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/accounting/cash">Mở sổ quỹ</Link>
              </Button>
            </div>
          </div>
        ) : periodOk ? (
          <div className="space-y-2">
            <p className="text-xs text-[var(--on-surface-muted)]">
              Các chứng từ <strong>thu</strong> từ khách trong tháng {props.month}/{props.year} (theo ngày chứng từ).
            </p>
            <ReceivableHistoryBlock partnerId={row.partner_id} year={y} month={m} />
          </div>
        ) : (
          <p className="text-sm text-[#b91c1c]">Tháng/năm không hợp lệ.</p>
        )}
      </div>
    );
  }

  const row = props.row;
  const closingExplain =
    "Nợ cuối kỳ = Nợ đầu kỳ + PS nhập trong tháng − Đã trả trong tháng (theo ngày chứng từ trên sổ quỹ).";
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <DetailTabStrip
        items={[
          { id: "info", label: "Thông tin" },
          { id: "history", label: "Lịch sử" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />
      {tab === "info" ? (
        <div className="space-y-4">
          <DetailPreview
            fields={[
              { label: "Kỳ báo cáo", value: "Tháng " + props.month + " / " + props.year },
              { label: "Mã NCC", value: row.supplier_code },
              { label: "Tên NCC", value: row.supplier_name },
              {
                label: "Nợ đầu kỳ",
                value: row.opening.toLocaleString("vi-VN") + " đ",
                span: "full",
              },
              {
                label: "PS nhập (tháng)",
                value: row.inbound_month.toLocaleString("vi-VN") + " đ",
                span: "full",
              },
              {
                label: "Đã trả trong tháng",
                value: row.payments_month.toLocaleString("vi-VN") + " đ",
                span: "full",
              },
              {
                label: "Nợ cuối kỳ",
                value: row.closing.toLocaleString("vi-VN") + " đ",
                span: "full",
              },
              { label: "Diễn giải công thức", value: closingExplain, span: "full" },
              {
                label: "Mã nội bộ (supplier_id)",
                value: row.supplier_id,
                span: "full",
              },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="primary" size="sm" onClick={props.onOpenSettlement}>
              Ghi chi trả NCC / phiếu
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href="/master/partners">Mở danh mục (tab NCC)</Link>
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href="/accounting/cash">Mở sổ quỹ</Link>
            </Button>
          </div>
        </div>
      ) : periodOk ? (
        <div className="space-y-2">
          <p className="text-xs text-[var(--on-surface-muted)]">
            Các chứng từ <strong>chi</strong> trả NCC trong tháng {props.month}/{props.year} (theo ngày chứng từ).
          </p>
          <PayableHistoryBlock supplierId={row.supplier_id} year={y} month={m} />
        </div>
      ) : (
        <p className="text-sm text-[#b91c1c]">Tháng/năm không hợp lệ.</p>
      )}
    </div>
  );
}
