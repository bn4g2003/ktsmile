"use client";

import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { DetailPreview } from "@/components/ui/detail-preview";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import { CashReceiptPrintButton } from "@/components/shared/reports/cash-receipt-print-button";
import {
  DataGridMenuDeleteItem,
  DataGridMenuEditItem,
  DataGridRowActionsMenu,
} from "@/components/shared/data-grid/data-grid-action-buttons";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { DebtRow } from "@/lib/actions/debt";
import type { PayableRow } from "@/lib/actions/payables";
import {
  deleteDebtSettlementFromDebtPage,
  listPartnerReceiptsInMonth,
  listSupplierPaymentsInMonth,
  updateDebtSettlementFromDebtPage,
  type DebtSettlementLine,
} from "@/lib/actions/debt-settlements";

const channelOpts = [
  { value: "cash", label: "Tiền mặt" },
  { value: "chuyen_khoan", label: "Chuyển khoản" },
  { value: "mbbank", label: "MB Bank" },
  { value: "acb", label: "ACB" },
  { value: "vietcombank", label: "Vietcombank" },
  { value: "other", label: "Khác" },
];

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
  const [editingLineId, setEditingLineId] = React.useState<string | null>(null);
  const [editDate, setEditDate] = React.useState("");
  const [editAmount, setEditAmount] = React.useState("");
  const [editChannel, setEditChannel] = React.useState("cash");
  const [editPayerName, setEditPayerName] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [editPending, setEditPending] = React.useState(false);
  const [deletePendingId, setDeletePendingId] = React.useState<string | null>(null);

  const reloadLines = React.useCallback(() => {
    setLines(null);
    setErr(null);
    void listPartnerReceiptsInMonth(partnerId, year, month)
      .then((r) => setLines(r))
      .catch((e) => setErr(e instanceof Error ? e.message : "Lỗi tải lịch sử"));
  }, [month, partnerId, year]);

  React.useEffect(() => {
    reloadLines();
  }, [reloadLines]);

  const beginEditLine = React.useCallback((ln: DebtSettlementLine) => {
    setEditingLineId(ln.id);
    setEditDate(ln.transaction_date);
    setEditAmount(String(ln.amount));
    setEditChannel(ln.payment_channel || "cash");
    setEditPayerName(ln.payer_name ?? "");
    setEditDesc(ln.description ?? "");
    setErr(null);
  }, []);

  const cancelEditLine = React.useCallback(() => {
    setEditingLineId(null);
    setEditDate("");
    setEditAmount("");
    setEditChannel("cash");
    setEditPayerName("");
    setEditDesc("");
    setEditPending(false);
  }, []);

  const saveEditedLine = React.useCallback(async () => {
    if (!editingLineId) return;
    const amt = Number(editAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Số tiền sửa không hợp lệ.");
      return;
    }
    setErr(null);
    setEditPending(true);
    try {
      await updateDebtSettlementFromDebtPage({
        id: editingLineId,
        mode: "receivable",
        owner_id: partnerId,
        transaction_date: editDate,
        amount: amt,
        payment_channel: editChannel,
        payer_name: editPayerName.trim() || null,
        description: editDesc.trim() || null,
      });
      cancelEditLine();
      reloadLines();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi sửa chứng từ");
    } finally {
      setEditPending(false);
    }
  }, [cancelEditLine, editAmount, editChannel, editDate, editDesc, editPayerName, editingLineId, partnerId, reloadLines]);

  const removeLine = React.useCallback(
    async (ln: DebtSettlementLine) => {
      if (!confirm("Xóa chứng từ " + ln.doc_number + "?")) return;
      setDeletePendingId(ln.id);
      setErr(null);
      try {
        await deleteDebtSettlementFromDebtPage({
          id: ln.id,
          mode: "receivable",
          owner_id: partnerId,
        });
        if (editingLineId === ln.id) cancelEditLine();
        reloadLines();
      } catch (e2) {
        setErr(e2 instanceof Error ? e2.message : "Lỗi xóa chứng từ");
      } finally {
        setDeletePendingId(null);
      }
    },
    [cancelEditLine, editingLineId, partnerId, reloadLines],
  );

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
            <th className="px-3 py-2 text-right">Thao tác</th>
            <th className="px-3 py-2 text-right">In</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((ln) => (
            <tr key={ln.id} className="border-b border-[var(--border-ghost)] last:border-b-0">
              <td className="px-3 py-2 tabular-nums text-[var(--on-surface-muted)]">
                {editingLineId === ln.id ? (
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-8 w-[9rem]" />
                ) : (
                  ln.transaction_date
                )}
              </td>
              <td className="px-3 py-2 font-medium">{ln.doc_number}</td>
              <td className="px-3 py-2">
                {editingLineId === ln.id ? (
                  <Select value={editChannel} onChange={(e) => setEditChannel(e.target.value)} className="h-8 min-w-[8rem]">
                    {channelOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    {!channelOpts.some((o) => o.value === editChannel) ? <option value={editChannel}>{editChannel}</option> : null}
                  </Select>
                ) : (
                  ln.payment_channel
                )}
              </td>
              <td className="max-w-[8rem] truncate px-3 py-2">
                {editingLineId === ln.id ? (
                  <Input value={editPayerName} onChange={(e) => setEditPayerName(e.target.value)} placeholder="Người nộp" className="h-8" />
                ) : (
                  ln.payer_name ?? "—"
                )}
              </td>
              <td className="max-w-[12rem] truncate px-3 py-2 text-[var(--on-surface-muted)]">
                {editingLineId === ln.id ? (
                  <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Diễn giải" className="h-8" />
                ) : (
                  ln.description ?? "—"
                )}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {editingLineId === ln.id ? (
                  <CurrencyInput value={editAmount} onChange={setEditAmount} allowDecimal={false} className="h-8 w-[9rem] ml-auto" />
                ) : (
                  ln.amount.toLocaleString("vi-VN")
                )}
              </td>
              <td className="px-3 py-2 text-right">
                {editingLineId === ln.id ? (
                  <div className="inline-flex items-center gap-1">
                    <Button type="button" size="sm" variant="primary" onClick={() => void saveEditedLine()} disabled={editPending}>
                      {editPending ? "Đang lưu…" : "Lưu"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={cancelEditLine} disabled={editPending}>
                      Hủy
                    </Button>
                  </div>
                ) : (
                  <DataGridRowActionsMenu>
                    <DataGridMenuEditItem
                      onSelect={() => {
                        if (deletePendingId === ln.id) return;
                        beginEditLine(ln);
                      }}
                    >
                      Sửa
                    </DataGridMenuEditItem>
                    <DataGridMenuDeleteItem
                      onSelect={() => {
                        if (deletePendingId === ln.id) return;
                        void removeLine(ln);
                      }}
                    >
                      {deletePendingId === ln.id ? "Đang xóa…" : "Xóa"}
                    </DataGridMenuDeleteItem>
                  </DataGridRowActionsMenu>
                )}
              </td>
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
  const [editingLineId, setEditingLineId] = React.useState<string | null>(null);
  const [editDate, setEditDate] = React.useState("");
  const [editAmount, setEditAmount] = React.useState("");
  const [editChannel, setEditChannel] = React.useState("cash");
  const [editDesc, setEditDesc] = React.useState("");
  const [editPending, setEditPending] = React.useState(false);
  const [deletePendingId, setDeletePendingId] = React.useState<string | null>(null);

  const reloadLines = React.useCallback(() => {
    setLines(null);
    setErr(null);
    void listSupplierPaymentsInMonth(supplierId, year, month)
      .then((r) => setLines(r))
      .catch((e) => setErr(e instanceof Error ? e.message : "Lỗi tải lịch sử"));
  }, [month, supplierId, year]);

  React.useEffect(() => {
    reloadLines();
  }, [reloadLines]);

  const beginEditLine = React.useCallback((ln: DebtSettlementLine) => {
    setEditingLineId(ln.id);
    setEditDate(ln.transaction_date);
    setEditAmount(String(ln.amount));
    setEditChannel(ln.payment_channel || "cash");
    setEditDesc(ln.description ?? "");
    setErr(null);
  }, []);

  const cancelEditLine = React.useCallback(() => {
    setEditingLineId(null);
    setEditDate("");
    setEditAmount("");
    setEditChannel("cash");
    setEditDesc("");
    setEditPending(false);
  }, []);

  const saveEditedLine = React.useCallback(async () => {
    if (!editingLineId) return;
    const amt = Number(editAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Số tiền sửa không hợp lệ.");
      return;
    }
    setErr(null);
    setEditPending(true);
    try {
      await updateDebtSettlementFromDebtPage({
        id: editingLineId,
        mode: "payable",
        owner_id: supplierId,
        transaction_date: editDate,
        amount: amt,
        payment_channel: editChannel,
        payer_name: null,
        description: editDesc.trim() || null,
      });
      cancelEditLine();
      reloadLines();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi sửa chứng từ");
    } finally {
      setEditPending(false);
    }
  }, [cancelEditLine, editAmount, editChannel, editDate, editDesc, editingLineId, reloadLines, supplierId]);

  const removeLine = React.useCallback(
    async (ln: DebtSettlementLine) => {
      if (!confirm("Xóa chứng từ " + ln.doc_number + "?")) return;
      setDeletePendingId(ln.id);
      setErr(null);
      try {
        await deleteDebtSettlementFromDebtPage({
          id: ln.id,
          mode: "payable",
          owner_id: supplierId,
        });
        if (editingLineId === ln.id) cancelEditLine();
        reloadLines();
      } catch (e2) {
        setErr(e2 instanceof Error ? e2.message : "Lỗi xóa chứng từ");
      } finally {
        setDeletePendingId(null);
      }
    },
    [cancelEditLine, editingLineId, reloadLines, supplierId],
  );

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
            <th className="px-3 py-2 text-right">Thao tác</th>
            <th className="px-3 py-2 text-right">In</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((ln) => (
            <tr key={ln.id} className="border-b border-[var(--border-ghost)] last:border-b-0">
              <td className="px-3 py-2 tabular-nums text-[var(--on-surface-muted)]">
                {editingLineId === ln.id ? (
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-8 w-[9rem]" />
                ) : (
                  ln.transaction_date
                )}
              </td>
              <td className="px-3 py-2 font-medium">{ln.doc_number}</td>
              <td className="px-3 py-2">
                {editingLineId === ln.id ? (
                  <Select value={editChannel} onChange={(e) => setEditChannel(e.target.value)} className="h-8 min-w-[8rem]">
                    {channelOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    {!channelOpts.some((o) => o.value === editChannel) ? <option value={editChannel}>{editChannel}</option> : null}
                  </Select>
                ) : (
                  ln.payment_channel
                )}
              </td>
              <td className="max-w-[14rem] truncate px-3 py-2 text-[var(--on-surface-muted)]">
                {editingLineId === ln.id ? (
                  <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Diễn giải" className="h-8" />
                ) : (
                  ln.description ?? "—"
                )}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {editingLineId === ln.id ? (
                  <CurrencyInput value={editAmount} onChange={setEditAmount} allowDecimal={false} className="h-8 w-[9rem] ml-auto" />
                ) : (
                  ln.amount.toLocaleString("vi-VN")
                )}
              </td>
              <td className="px-3 py-2 text-right">
                {editingLineId === ln.id ? (
                  <div className="inline-flex items-center gap-1">
                    <Button type="button" size="sm" variant="primary" onClick={() => void saveEditedLine()} disabled={editPending}>
                      {editPending ? "Đang lưu…" : "Lưu"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={cancelEditLine} disabled={editPending}>
                      Hủy
                    </Button>
                  </div>
                ) : (
                  <DataGridRowActionsMenu>
                    <DataGridMenuEditItem
                      onSelect={() => {
                        if (deletePendingId === ln.id) return;
                        beginEditLine(ln);
                      }}
                    >
                      Sửa
                    </DataGridMenuEditItem>
                    <DataGridMenuDeleteItem
                      onSelect={() => {
                        if (deletePendingId === ln.id) return;
                        void removeLine(ln);
                      }}
                    >
                      {deletePendingId === ln.id ? "Đang xóa…" : "Xóa"}
                    </DataGridMenuDeleteItem>
                  </DataGridRowActionsMenu>
                )}
              </td>
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
              groups={[
                {
                  title: "Thông tin đối tác & Kỳ báo cáo",
                  fields: [
                    { label: "KỲ BÁO CÁO:", value: "THÁNG " + props.month + " / " + props.year },
                    { label: "MÃ KHÁCH HÀNG:", value: row.partner_code },
                    { label: "TÊN KHÁCH HÀNG:", value: row.partner_name },
                  ]
                },
                {
                  title: "Biến động công nợ (tháng)",
                  fields: [
                    {
                      label: "NỢ ĐẦU KỲ:",
                      value: <span className="font-bold">{row.opening.toLocaleString("vi-VN")} đ</span>,
                    },
                    {
                      label: "PHÁT SINH BÁN:",
                      value: <span className="font-bold text-[var(--primary)]">+{row.orders_month.toLocaleString("vi-VN")} đ</span>,
                    },
                    {
                      label: "ĐÃ THU TRONG THÁNG:",
                      value: <span className="font-bold text-[#059669]">−{row.receipts_month.toLocaleString("vi-VN")} đ</span>,
                    },
                    {
                      label: "NỢ CUỐI KỲ:",
                      value: <span className="text-[15px] font-bold text-[var(--primary)]">{row.closing.toLocaleString("vi-VN")} đ</span>,
                    },
                  ]
                },
                {
                  title: "Giải trình & Hệ thống",
                  fields: [
                    { label: "DIỄN GIẢI:", value: closingExplain, span: "full" },
                    { label: "ID NỘI BỘ (PARTNER_ID):", value: <span className="text-[10px] font-mono opacity-50">{row.partner_id}</span>, span: "full" },
                  ]
                }
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
            groups={[
              {
                title: "Thông tin NCC & Kỳ báo cáo",
                fields: [
                  { label: "KỲ BÁO CÁO:", value: "THÁNG " + props.month + " / " + props.year },
                  { label: "MÃ NCC:", value: row.supplier_code },
                  { label: "TÊN NCC:", value: row.supplier_name },
                ]
              },
              {
                title: "Biến động công nợ (tháng)",
                fields: [
                  {
                    label: "NỢ ĐẦU KỲ:",
                    value: <span className="font-bold">{row.opening.toLocaleString("vi-VN")} đ</span>,
                  },
                  {
                    label: "PHÁT SINH NHẬP:",
                    value: <span className="font-bold text-[var(--primary)]">+{row.inbound_month.toLocaleString("vi-VN")} đ</span>,
                  },
                  {
                    label: "ĐÃ TRẢ TRONG THÁNG:",
                    value: <span className="font-bold text-[#b91c1c]">−{row.payments_month.toLocaleString("vi-VN")} đ</span>,
                  },
                  {
                    label: "NỢ CUỐI KỲ:",
                    value: <span className="text-[15px] font-bold text-[var(--primary)]">{row.closing.toLocaleString("vi-VN")} đ</span>,
                  },
                ]
              },
              {
                title: "Giải trình & Hệ thống",
                fields: [
                  { label: "DIỄN GIẢI:", value: closingExplain, span: "full" },
                  { label: "ID NỘI BỘ (SUPPLIER_ID):", value: <span className="text-[10px] font-mono opacity-50">{row.supplier_id}</span>, span: "full" },
                ]
              }
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
