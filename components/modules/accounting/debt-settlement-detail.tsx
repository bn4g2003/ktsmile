"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DetailPreview } from "@/components/ui/detail-preview";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CashReceiptPrintButton } from "@/components/shared/reports/cash-receipt-print-button";
import {
  DataGridMenuDeleteItem,
  DataGridMenuEditItem,
  DataGridRowActionsMenu,
} from "@/components/shared/data-grid/data-grid-action-buttons";
import type { DebtRow } from "@/lib/actions/debt";
import type { PayableRow } from "@/lib/actions/payables";
import {
  deleteDebtSettlementFromDebtPage,
  listPartnerReceiptsInMonth,
  listSupplierPaymentsInMonth,
  recordPayablePaymentFromDebtPage,
  recordReceivableReceiptFromDebtPage,
  upsertPayableOpeningFromDebtPage,
  upsertReceivableOpeningFromDebtPage,
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

type Props =
  | {
      mode: "receivable";
      row: DebtRow;
      year: string;
      month: string;
      onRecorded: () => void;
    }
  | {
      mode: "payable";
      row: PayableRow;
      year: string;
      month: string;
      onRecorded: () => void;
    };

export function DebtSettlementDetail(props: Props) {
  const y = Number(props.year);
  const m = Number(props.month);
  const [lines, setLines] = React.useState<DebtSettlementLine[] | null>(null);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);

  const [tDate, setTDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = React.useState("");
  const [channel, setChannel] = React.useState("cash");
  const [payerName, setPayerName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);
  const [lastPrintId, setLastPrintId] = React.useState<string | null>(null);
  const [openingAmount, setOpeningAmount] = React.useState(() => String(props.row.opening));
  const [openingPending, setOpeningPending] = React.useState(false);
  const [editingLineId, setEditingLineId] = React.useState<string | null>(null);
  const [editDate, setEditDate] = React.useState("");
  const [editAmount, setEditAmount] = React.useState("");
  const [editChannel, setEditChannel] = React.useState("cash");
  const [editPayerName, setEditPayerName] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [editPending, setEditPending] = React.useState(false);
  const [deletePendingId, setDeletePendingId] = React.useState<string | null>(null);

  const reloadLines = React.useCallback(() => {
    if (!Number.isFinite(y) || m < 1 || m > 12) return;
    setLoadErr(null);
    setLines(null);
    const q =
      props.mode === "receivable"
        ? listPartnerReceiptsInMonth(props.row.partner_id, y, m)
        : listSupplierPaymentsInMonth(props.row.supplier_id, y, m);
    void q
      .then(setLines)
      .catch((e) => setLoadErr(e instanceof Error ? e.message : "Lỗi tải lịch sử"));
  }, [props, y, m]);

  React.useEffect(() => {
    reloadLines();
  }, [reloadLines]);

  React.useEffect(() => {
    setOpeningAmount(String(props.row.opening));
  }, [props.row.opening]);

  const beginEditLine = React.useCallback((ln: DebtSettlementLine) => {
    setEditingLineId(ln.id);
    setEditDate(ln.transaction_date);
    setEditAmount(String(ln.amount));
    setEditChannel(ln.payment_channel || "cash");
    setEditPayerName(ln.payer_name ?? "");
    setEditDesc(ln.description ?? "");
    setFormErr(null);
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
      setFormErr("Số tiền sửa không hợp lệ.");
      return;
    }
    setFormErr(null);
    setEditPending(true);
    try {
      await updateDebtSettlementFromDebtPage({
        id: editingLineId,
        mode: props.mode,
        owner_id: props.mode === "receivable" ? props.row.partner_id : props.row.supplier_id,
        transaction_date: editDate,
        amount: amt,
        payment_channel: editChannel,
        payer_name: props.mode === "receivable" ? editPayerName.trim() || null : null,
        description: editDesc.trim() || null,
      });
      cancelEditLine();
      props.onRecorded();
      reloadLines();
    } catch (e2) {
      setFormErr(e2 instanceof Error ? e2.message : "Lỗi sửa chứng từ");
    } finally {
      setEditPending(false);
    }
  }, [
    cancelEditLine,
    editAmount,
    editChannel,
    editDate,
    editDesc,
    editPayerName,
    editingLineId,
    props,
    reloadLines,
  ]);

  const removeLine = React.useCallback(
    async (ln: DebtSettlementLine) => {
      if (!confirm("Xóa chứng từ " + ln.doc_number + "?")) return;
      setDeletePendingId(ln.id);
      setFormErr(null);
      try {
        await deleteDebtSettlementFromDebtPage({
          id: ln.id,
          mode: props.mode,
          owner_id: props.mode === "receivable" ? props.row.partner_id : props.row.supplier_id,
        });
        if (editingLineId === ln.id) cancelEditLine();
        props.onRecorded();
        reloadLines();
      } catch (e2) {
        setFormErr(e2 instanceof Error ? e2.message : "Lỗi xóa chứng từ");
      } finally {
        setDeletePendingId(null);
      }
    },
    [cancelEditLine, editingLineId, props, reloadLines],
  );

  const summaryFields =
    props.mode === "receivable"
      ? [
          { label: "Mã KH", value: props.row.partner_code },
          { label: "Tên KH", value: props.row.partner_name },
          { label: "Nợ đầu kỳ", value: props.row.opening.toLocaleString("vi-VN") },
          { label: "PS bán (tháng)", value: props.row.orders_month.toLocaleString("vi-VN") },
          { label: "Đã thu (tháng)", value: props.row.receipts_month.toLocaleString("vi-VN") },
          { label: "Nợ cuối kỳ", value: props.row.closing.toLocaleString("vi-VN") },
        ]
      : [
          { label: "Mã NCC", value: props.row.supplier_code },
          { label: "Tên NCC", value: props.row.supplier_name },
          { label: "Nợ đầu kỳ", value: props.row.opening.toLocaleString("vi-VN") },
          { label: "PS nhập (tháng)", value: props.row.inbound_month.toLocaleString("vi-VN") },
          { label: "Đã trả (tháng)", value: props.row.payments_month.toLocaleString("vi-VN") },
          { label: "Nợ cuối kỳ", value: props.row.closing.toLocaleString("vi-VN") },
        ];

  const onSaveOpening = async () => {
    setFormErr(null);
    const opening = Number(openingAmount);
    if (!Number.isFinite(opening)) {
      setFormErr("Nhập tồn đầu hợp lệ.");
      return;
    }
    setOpeningPending(true);
    try {
      if (props.mode === "receivable") {
        await upsertReceivableOpeningFromDebtPage({
          partner_id: props.row.partner_id,
          year: y,
          month: m,
          opening_balance: opening,
        });
      } else {
        await upsertPayableOpeningFromDebtPage({
          supplier_id: props.row.supplier_id,
          year: y,
          month: m,
          opening_balance: opening,
        });
      }
      props.onRecorded();
    } catch (e2) {
      setFormErr(e2 instanceof Error ? e2.message : "Lỗi cập nhật tồn đầu");
    } finally {
      setOpeningPending(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    setPending(true);
    try {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setFormErr("Nhập số tiền hợp lệ.");
        return;
      }
      if (props.mode === "receivable") {
        const { id } = await recordReceivableReceiptFromDebtPage({
          partner_id: props.row.partner_id,
          transaction_date: tDate,
          amount: amt,
          payment_channel: channel,
          payer_name: payerName.trim() || null,
          description: desc.trim() || null,
        });
        setLastPrintId(id);
        setAmount("");
        setDesc("");
        props.onRecorded();
        reloadLines();
      } else {
        const { id } = await recordPayablePaymentFromDebtPage({
          supplier_id: props.row.supplier_id,
          transaction_date: tDate,
          amount: amt,
          payment_channel: channel,
          description: desc.trim() || null,
        });
        setLastPrintId(id);
        setAmount("");
        setDesc("");
        props.onRecorded();
        reloadLines();
      }
    } catch (e2) {
      setFormErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <DetailPreview fields={summaryFields} />

      <div className="rounded-[var(--radius-md)] border border-[var(--border-ghost)] bg-[var(--surface-muted)]/40 p-4">
        <p className="mb-2 text-sm font-semibold text-[var(--on-surface)]">Điều chỉnh tồn đầu / nợ đầu kỳ</p>
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ds-opening">Tồn đầu tháng {props.month}/{props.year}</Label>
            <CurrencyInput
              id="ds-opening"
              value={openingAmount}
              onChange={setOpeningAmount}
              allowDecimal={false}
              className="h-10 min-w-[14rem]"
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void onSaveOpening()} disabled={openingPending}>
            {openingPending ? "Đang lưu tồn đầu…" : "Lưu tồn đầu"}
          </Button>
        </div>

        <p className="mb-3 text-sm font-semibold text-[var(--on-surface)]">
          {props.mode === "receivable" ? "Ghi thu công nợ (khách)" : "Ghi chi trả NCC"}
        </p>
        <p className="mb-3 text-xs text-[var(--on-surface-muted)]">
          Dữ liệu ghi vào <strong>Sổ quỹ</strong> và tự động vào cột «Đã thu / Đã trả» của tháng chứa{" "}
          <strong>ngày chứng từ</strong> (có thể khác tháng đang xem trên lưới). Mỗi lần lưu có thể{" "}
          <strong>in phiếu</strong> ngay bên dưới.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-3 sm:grid-cols-2">
          {formErr ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{formErr}</p> : null}
          <div className="grid gap-1.5">
            <Label htmlFor="ds-date">Ngày chứng từ</Label>
            <Input id="ds-date" type="date" value={tDate} onChange={(e) => setTDate(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ds-amt">Số tiền</Label>
            <CurrencyInput
              id="ds-amt"
              value={amount}
              onChange={(val) => setAmount(val)}
              placeholder="VD: 1.500.000"
              required
              allowDecimal={false}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ds-ch">Kênh thanh toán</Label>
            <Select id="ds-ch" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {channelOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {props.mode === "receivable" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="ds-payer">Người nộp (ghi trên phiếu thu)</Label>
              <Input
                id="ds-payer"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Tuỳ chọn"
              />
            </div>
          ) : (
            <div className="hidden sm:block" aria-hidden />
          )}
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="ds-desc">Diễn giải</Label>
            <Textarea id="ds-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Tuỳ chọn" />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? "Đang lưu…" : props.mode === "receivable" ? "Lưu phiếu thu" : "Lưu phiếu chi"}
            </Button>
            {lastPrintId ? (
              <CashReceiptPrintButton transactionId={lastPrintId} label="In phiếu vừa lưu" size="sm" />
            ) : null}
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href="/accounting/cash">Mở sổ quỹ</Link>
            </Button>
          </div>
        </form>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-[var(--on-surface)]">
          Lịch sử trong tháng {props.month}/{props.year}
          {props.mode === "receivable" ? " (thu)" : " (chi trả)"}
        </p>
        {loadErr ? <p className="text-sm text-[#b91c1c]">{loadErr}</p> : null}
        {lines === null ? (
          <p className="text-sm text-[var(--on-surface-muted)]">Đang tải…</p>
        ) : lines.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-muted)]">Chưa có chứng từ trong tháng này.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
                  <th className="px-3 py-2">Ngày</th>
                  <th className="px-3 py-2">Số CT</th>
                  <th className="px-3 py-2">Kênh</th>
                  {props.mode === "receivable" ? <th className="px-3 py-2">Người nộp</th> : null}
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
                          {!channelOpts.some((o) => o.value === editChannel) ? (
                            <option value={editChannel}>{editChannel}</option>
                          ) : null}
                        </Select>
                      ) : (
                        ln.payment_channel
                      )}
                    </td>
                    {props.mode === "receivable" ? (
                      <td className="max-w-[10rem] truncate px-3 py-2">
                        {editingLineId === ln.id ? (
                          <Input
                            value={editPayerName}
                            onChange={(e) => setEditPayerName(e.target.value)}
                            placeholder="Người nộp"
                            className="h-8"
                          />
                        ) : (
                          ln.payer_name ?? "—"
                        )}
                      </td>
                    ) : null}
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
        )}
      </div>
    </div>
  );
}
