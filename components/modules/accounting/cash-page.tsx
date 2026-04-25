"use client";

import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import {
  DataGridMenuDeleteItem,
  DataGridMenuEditItem,
  dataGridPrintMenuItemButtonClassName,
} from "@/components/shared/data-grid/data-grid-action-buttons";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DetailPreview } from "@/components/ui/detail-preview";
import { Textarea } from "@/components/ui/textarea";
import { listCustomerPartnerPicker } from "@/lib/actions/partners";
import { listSupplierPicker } from "@/lib/actions/suppliers";
import { formatCashDirection } from "@/lib/format/labels";
import { formatDate } from "@/lib/format/date";
import { CashFlowChartsSection } from "@/components/modules/accounting/cash-flow-charts-section";
import { CashReceiptPrintButton } from "@/components/shared/reports/cash-receipt-print-button";
import {
  createCashTransaction,
  deleteCashTransaction,
  listCashFundChannels,
  listCashTransactions,
  updateCashTransaction,
  upsertCashAccountOpeningBalance,
  listCashAccountOpeningBalances,
  type CashRow,
} from "@/lib/actions/cash";
import { formatCashPaymentChannel } from "@/lib/cash/cash-channel-labels";
import { CASH_BUSINESS_CATEGORIES, defaultCashBusinessCategory } from "@/lib/cash/cash-form-options";
import { cn } from "@/lib/utils/cn";

const dirOpts = [
  { value: "receipt", label: "Thu" },
  { value: "payment", label: "Chi" },
];

export function CashPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CashRow | null>(null);
  const [partners, setPartners] = React.useState<{ id: string; code: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = React.useState<{ id: string; code: string; name: string }[]>([]);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [tdate, setTdate] = React.useState("");
  const [docNum, setDocNum] = React.useState("");
  const [channel, setChannel] = React.useState("cash");
  const [direction, setDirection] = React.useState<"receipt" | "payment">("receipt");
  const [category, setCategory] = React.useState("");
  const [amount, setAmount] = React.useState("0");
  const [partnerId, setPartnerId] = React.useState("");
  const [supplierId, setSupplierId] = React.useState("");
  const [payerName, setPayerName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [refType, setRefType] = React.useState("");
  const [refId, setRefId] = React.useState("");
  const [showCharts, setShowCharts] = React.useState(true);
  const [openOpening, setOpenOpening] = React.useState(false);
  const [openingYear, setOpeningYear] = React.useState(String(new Date().getFullYear()));
  const [openingMonth, setOpeningMonth] = React.useState(String(new Date().getMonth() + 1));
  const [openingBalances, setOpeningBalances] = React.useState<{ channel: string; amount: string }[]>([
    { channel: "cash", amount: "0" },
    { channel: "mbbank", amount: "0" },
    { channel: "acb", amount: "0" },
  ]);
  const [savingOpening, setSavingOpening] = React.useState(false);
  const [gridFilters, setGridFilters] = React.useState<Record<string, string>>({});
  const [fundChannels, setFundChannels] = React.useState<{ value: string; label: string }[]>([]);

  const patchGridFilter = React.useCallback((key: string, val: string) => {
    setGridFilters((prev) => {
      const next = { ...prev };
      if (val.trim()) next[key] = val.trim();
      else delete next[key];
      return next;
    });
  }, []);

  React.useEffect(() => {
    void listCustomerPartnerPicker().then(setPartners).catch(() => {});
    void listSupplierPicker().then(setSuppliers).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!open) return;
    void listCashFundChannels().then(setFundChannels).catch(() => {});
  }, [open]);

  const reset = () => {
    setEditing(null);
    setTdate(new Date().toISOString().slice(0, 10));
    setDocNum("");
    setChannel("cash");
    setDirection("receipt");
    setCategory(defaultCashBusinessCategory("receipt"));
    setAmount("0");
    setPartnerId("");
    setSupplierId("");
    setPayerName("");
    setDesc("");
    setRefType("");
    setRefId("");
    setErr(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (row: CashRow) => {
    setEditing(row);
    setTdate(row.transaction_date);
    setDocNum(row.doc_number);
    setChannel(row.payment_channel);
    setDirection(row.direction);
    setCategory(row.business_category);
    setAmount(String(row.amount));
    setPartnerId(row.partner_id ?? "");
    setSupplierId(row.supplier_id ?? "");
    setPayerName(row.payer_name ?? "");
    setDesc(row.description ?? "");
    setRefType(row.reference_type ?? "");
    setRefId(row.reference_id ?? "");
    setErr(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErr(null);
    try {
      const rawAmt = String(amount).trim();
      const amtParsed = rawAmt === "" ? NaN : Number(rawAmt.replace(",", "."));
      const payload = {
        transaction_date: tdate,
        doc_number: editing ? docNum.trim() : "",
        payment_channel: channel.trim(),
        direction,
        business_category: category.trim(),
        amount: Number.isFinite(amtParsed) ? amtParsed : NaN,
        partner_id: partnerId || null,
        supplier_id: supplierId || null,
        payer_name: payerName.trim() || null,
        description: desc.trim() || null,
        reference_type: refType.trim() || null,
        reference_id: refId.trim() || null,
      };
      if (editing) await updateCashTransaction(editing.id, payload);
      else await createCashTransaction(payload);
      setOpen(false);
      reset();
      bumpGrid();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const catForDir = CASH_BUSINESS_CATEGORIES.filter((c) => c.direction === direction);
  const legacyCat =
    Boolean(editing) &&
    Boolean(category.trim()) &&
    !catForDir.some((c) => c.value === category);
  const legacyChannel =
    Boolean(channel.trim()) && !fundChannels.some((c) => c.value === channel);

  const onDirectionChange = (next: "receipt" | "payment") => {
    setDirection(next);
    setCategory((prev) => {
      const allowed = CASH_BUSINESS_CATEGORIES.filter((c) => c.direction === next);
      if (allowed.some((c) => c.value === prev)) return prev;
      if (CASH_BUSINESS_CATEGORIES.some((c) => c.value === prev)) return allowed[0]?.value ?? "";
      return allowed[0]?.value ?? "";
    });
  };

  const onDelete = async (row: CashRow) => {
    if (!confirm("Xóa chứng từ " + row.doc_number + "?")) return;
    try {
      await deleteCashTransaction(row.id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi");
    }
  };

  const openOpeningDialog = async () => {
    const y = Number(openingYear);
    const m = Number(openingMonth);
    try {
      const bals = await listCashAccountOpeningBalances(y, m);
      if (bals.length > 0) {
        setOpeningBalances(
          bals.map((b) => ({
            channel: b.payment_channel,
            amount: String(b.opening_balance),
          })),
        );
      } else {
        setOpeningBalances([
          { channel: "cash", amount: "0" },
          { channel: "mbbank", amount: "0" },
          { channel: "acb", amount: "0" },
        ]);
      }
    } catch {
      setOpeningBalances([
        { channel: "cash", amount: "0" },
        { channel: "mbbank", amount: "0" },
        { channel: "acb", amount: "0" },
      ]);
    }
    setOpenOpening(true);
  };

  const saveOpeningBalances = async () => {
    setSavingOpening(true);
    try {
      const y = Number(openingYear);
      const m = Number(openingMonth);
      for (const b of openingBalances) {
        if (b.channel.trim()) {
          await upsertCashAccountOpeningBalance({
            payment_channel: b.channel.trim(),
            year: y,
            month: m,
            opening_balance: Number(b.amount) || 0,
            notes: null,
          });
        }
      }
      setOpenOpening(false);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setSavingOpening(false);
    }
  };

  const columns = React.useMemo<ColumnDef<CashRow, unknown>[]>(
    () => [
      {
        accessorKey: "transaction_date",
        header: "Ngày",
        meta: { filterKey: "transaction_date_eq", filterType: "date" },
      },
      { accessorKey: "doc_number", header: "Số CT", meta: { filterKey: "doc_number", filterType: "text" } },
      { accessorKey: "payment_channel", header: "Kênh", meta: { filterKey: "payment_channel", filterType: "text" } },
      {
        accessorKey: "direction",
        header: "Thu/Chi",
        meta: {
          filterKey: "direction",
          filterType: "select",
          filterOptions: dirOpts,
        },
        cell: ({ row, getValue }) => {
          const isReceipt = row.original.direction === "receipt";
          return (
            <span
              className={cn(
                "inline-flex rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                isReceipt
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-100"
                  : "bg-rose-100 text-rose-900 dark:bg-rose-950/55 dark:text-rose-100",
              )}
            >
              {formatCashDirection(String(getValue()))}
            </span>
          );
        },
      },
      {
        accessorKey: "business_category",
        header: "Nghiệp vụ",
        meta: { filterKey: "business_category", filterType: "text" },
      },
      {
        accessorKey: "amount",
        header: "Số tiền",
        cell: ({ row, getValue }) => (
          <span
            className={cn(
              "block text-right tabular-nums font-semibold",
              row.original.direction === "receipt"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400",
            )}
          >
            {Number(getValue()).toLocaleString("vi-VN")}
          </span>
        ),
      },
      { accessorKey: "partner_code", header: "Mã KH", meta: { filterKey: "partner_code", filterType: "text" } },
      { accessorKey: "partner_name", header: "Khách hàng", meta: { filterKey: "partner_name", filterType: "text" } },
      { accessorKey: "supplier_code", header: "Mã NCC", meta: { filterKey: "supplier_code", filterType: "text" } },
      { accessorKey: "supplier_name", header: "Nhà cung cấp", meta: { filterKey: "supplier_name", filterType: "text" } },
      { accessorKey: "payer_name", header: "Người nộp", meta: { filterKey: "payer_name", filterType: "text" } },
      { accessorKey: "description", header: "Diễn giải", meta: { filterKey: "description", filterType: "text" } },
      {
        accessorKey: "created_at",
        header: "Tạo lúc",
        size: 160,
        cell: ({ getValue }) => formatDate(String(getValue())),
      },
      {
        accessorKey: "updated_at",
        header: "Cập nhật",
        size: 160,
        cell: ({ getValue }) => formatDate(String(getValue())),
      },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            <DropdownMenuItem asChild>
              <CashReceiptPrintButton
                transactionId={row.original.id}
                label={row.original.direction === "payment" ? "In PC" : "In PT"}
                variant="ghost"
                className={dataGridPrintMenuItemButtonClassName}
              />
            </DropdownMenuItem>
            <DataGridMenuEditItem onSelect={() => openEdit(row.original)}>Sửa</DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => void onDelete(row.original)}>Xóa</DataGridMenuDeleteItem>
          </>
        ),
      },
    ],
    [],
  );

  const renderCashDetail = React.useCallback((row: CashRow) => {
    return (
      <DetailPreview
        fields={[
          { label: "Ngày", value: row.transaction_date },
          { label: "Số chứng từ", value: row.doc_number },
          { label: "Kênh thanh toán", value: formatCashPaymentChannel(row.payment_channel) },
          {
            label: "Thu / Chi",
            value: (
              <span
                className={cn(
                  "inline-flex rounded px-2 py-0.5 text-xs font-semibold",
                  row.direction === "receipt"
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-100"
                    : "bg-rose-100 text-rose-900 dark:bg-rose-950/55 dark:text-rose-100",
                )}
              >
                {formatCashDirection(row.direction)}
              </span>
            ),
          },
          { label: "Nghiệp vụ", value: row.business_category },
          { label: "Số tiền", value: Number(row.amount).toLocaleString("vi-VN") },
          { label: "Mã KH", value: row.partner_code },
          { label: "Khách hàng", value: row.partner_name },
          { label: "Mã NCC", value: row.supplier_code },
          { label: "Nhà cung cấp", value: row.supplier_name },
          { label: "Người nộp", value: row.payer_name },
          { label: "Diễn giải", value: row.description, span: "full" },
          { label: "ID", value: row.id, span: "full" },
          { label: "Tạo lúc", value: formatDate(row.created_at) },
          { label: "Cập nhật", value: formatDate(row.updated_at) },
        ]}
      />
    );
  }, []);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-fit"
          onClick={() => setShowCharts((v) => !v)}
        >
          {showCharts ? "Ẩn báo cáo thu / chi / tồn" : "Hiện báo cáo thu / chi / tồn"}
        </Button>
        {showCharts ? <CashFlowChartsSection /> : null}
      </div>
      <ExcelDataGrid<CashRow>
        moduleId="cash_transactions"
        title="Sổ quỹ thu / chi"
        columns={columns}
        list={listCashTransactions}
        reloadSignal={gridReload}
        filters={gridFilters}
        onFiltersChange={setGridFilters}
        renderRowDetail={renderCashDetail}
        rowDetailTitle={(r) => "Chứng từ " + r.doc_number}
        toolbarExtra={
          <>
            <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius-md)] border border-[var(--border-ghost)] bg-[var(--surface-muted)] px-2 py-2">
              <div className="grid gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
                  Từ ngày
                </span>
                <Input
                  type="date"
                  value={gridFilters.transaction_date_from ?? ""}
                  onChange={(e) => patchGridFilter("transaction_date_from", e.target.value)}
                  className="h-9 w-[9.5rem] py-1 text-xs"
                />
              </div>
              <div className="grid gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
                  Đến ngày
                </span>
                <Input
                  type="date"
                  value={gridFilters.transaction_date_to ?? ""}
                  onChange={(e) => patchGridFilter("transaction_date_to", e.target.value)}
                  className="h-9 w-[9.5rem] py-1 text-xs"
                />
              </div>
            </div>
            <Button variant="secondary" type="button" size="sm" onClick={openOpeningDialog} className="mr-2">
              Số dư đầu kỳ
            </Button>
            <Button variant="primary" type="button" size="sm" onClick={openCreate}>
              Thêm chứng từ
            </Button>
          </>
        }
        getRowId={(r) => r.id}
        getRowClassName={(r) =>
          r.direction === "receipt"
            ? "border-l-[3px] border-l-emerald-600"
            : "border-l-[3px] border-l-rose-600"
        }
      />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa chứng từ" : "Thêm chứng từ"}</DialogTitle>
            <DialogDescription>
              Tiền mặt / ngân hàng. Liên kết tham chiếu (đơn hàng, phiếu kho…) do hệ thống tự ghi khi thu/chi từ
              các màn hình tương ứng — không cần nhập tay trên form này.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2">
              <Label htmlFor="c-d">Ngày</Label>
              <Input id="c-d" type="date" value={tdate} onChange={(e) => setTdate(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-doc">Số chứng từ</Label>
              {editing ? (
                <Input id="c-doc" value={docNum} onChange={(e) => setDocNum(e.target.value)} required />
              ) : (
                <Input
                  id="c-doc"
                  readOnly
                  value=""
                  placeholder="Tự động khi lưu (PT-… / PC-…)"
                  className="bg-[var(--surface-muted)]"
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-ch">Kênh thanh toán</Label>
              <Select
                id="c-ch"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                required
              >
                {legacyChannel ? (
                  <option value={channel}>
                    {channel}
                  </option>
                ) : null}
                {fundChannels.map((ch) => (
                  <option key={ch.value} value={ch.value}>
                    {ch.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-dir">Loại</Label>
              <Select
                id="c-dir"
                value={direction}
                onChange={(e) => onDirectionChange(e.target.value as "receipt" | "payment")}
              >
                {dirOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="c-cat">Nghiệp vụ</Label>
              <Select
                id="c-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                {legacyCat ? <option value={category}>{category}</option> : null}
                {catForDir.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-amt">Số tiền</Label>
              <CurrencyInput
                id="c-amt"
                value={amount}
                onChange={setAmount}
                placeholder="0"
                required
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-p">Khách hàng (phiếu thu)</Label>
              <Select id="c-p" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="">—</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-s">NCC (phiếu chi)</Label>
              <Select id="c-s" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="c-payer">Người nộp (phiếu thu)</Label>
              <Input
                id="c-payer"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Họ tên người nộp tiền"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="c-desc">Diễn giải</Label>
              <Textarea id="c-desc" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button variant="primary" type="submit" disabled={pending}>
                {pending ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={openOpening} onOpenChange={setOpenOpening}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Số dư đầu kỳ</DialogTitle>
            <DialogDescription>Nhập số dư đầu kỳ cho các tài khoản quỹ</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex gap-4">
              <div className="grid gap-2">
                <Label htmlFor="op-year">Năm</Label>
                <Input
                  id="op-year"
                  type="number"
                  min={1900}
                  max={2100}
                  value={openingYear}
                  onChange={(e) => setOpeningYear(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="op-month">Tháng</Label>
                <Input
                  id="op-month"
                  type="number"
                  min={1}
                  max={12}
                  value={openingMonth}
                  onChange={(e) => setOpeningMonth(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              {openingBalances.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <div className="grid gap-2 flex-1">
                    <Label htmlFor={`op-chan-${i}`}>Tài khoản</Label>
                    <Input
                      id={`op-chan-${i}`}
                      value={b.channel}
                      onChange={(e) => {
                        const nb = [...openingBalances];
                        nb[i]!.channel = e.target.value;
                        setOpeningBalances(nb);
                      }}
                      placeholder="cash, mbbank, acb, ..."
                    />
                  </div>
                  <div className="grid gap-2 flex-1">
                    <Label htmlFor={`op-amt-${i}`}>Số dư</Label>
                    <Input
                      id={`op-amt-${i}`}
                      type="number"
                      value={b.amount}
                      onChange={(e) => {
                        const nb = [...openingBalances];
                        nb[i]!.amount = e.target.value;
                        setOpeningBalances(nb);
                      }}
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpeningBalances([...openingBalances, { channel: "", amount: "0" }])}
              >
                + Thêm tài khoản
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpenOpening(false)}>
                Hủy
              </Button>
              <Button variant="primary" onClick={saveOpeningBalances} disabled={savingOpening}>
                {savingOpening ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
