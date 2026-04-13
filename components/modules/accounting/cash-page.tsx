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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DetailPreview } from "@/components/ui/detail-preview";
import { Textarea } from "@/components/ui/textarea";
import { listPartnerPicker } from "@/lib/actions/partners";
import { formatCashDirection } from "@/lib/format/labels";
import { CashFlowChartsSection } from "@/components/modules/accounting/cash-flow-charts-section";
import { CashReceiptPrintButton } from "@/components/shared/reports/cash-receipt-print-button";
import {
  createCashTransaction,
  deleteCashTransaction,
  listCashTransactions,
  updateCashTransaction,
  type CashRow,
} from "@/lib/actions/cash";

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
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [tdate, setTdate] = React.useState("");
  const [docNum, setDocNum] = React.useState("");
  const [channel, setChannel] = React.useState("cash");
  const [direction, setDirection] = React.useState<"receipt" | "payment">("receipt");
  const [category, setCategory] = React.useState("");
  const [amount, setAmount] = React.useState("0");
  const [partnerId, setPartnerId] = React.useState("");
  const [payerName, setPayerName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [refType, setRefType] = React.useState("");
  const [refId, setRefId] = React.useState("");
  const [showCharts, setShowCharts] = React.useState(true);

  React.useEffect(() => {
    void listPartnerPicker().then(setPartners).catch(() => {});
  }, []);

  const reset = () => {
    setEditing(null);
    setTdate(new Date().toISOString().slice(0, 10));
    setDocNum("");
    setChannel("cash");
    setDirection("receipt");
    setCategory("");
    setAmount("0");
    setPartnerId("");
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
      const payload = {
        transaction_date: tdate,
        doc_number: docNum.trim(),
        payment_channel: channel.trim(),
        direction,
        business_category: category.trim(),
        amount: Number(amount),
        partner_id: partnerId || null,
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

  const onDelete = async (row: CashRow) => {
    if (!confirm("Xóa chứng từ " + row.doc_number + "?")) return;
    try {
      await deleteCashTransaction(row.id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi");
    }
  };

  const columns = React.useMemo<ColumnDef<CashRow, unknown>[]>(
    () => [
      { accessorKey: "transaction_date", header: "Ngày", meta: { filterKey: "transaction_date_from", filterType: "text" } },
      {
        id: "td_to",
        header: "Đến",
        meta: { filterKey: "transaction_date_to", filterType: "text" },
        cell: () => "",
      },
      { accessorKey: "doc_number", header: "Số CT" },
      { accessorKey: "payment_channel", header: "Kênh", meta: { filterKey: "payment_channel", filterType: "text" } },
      {
        accessorKey: "direction",
        header: "Thu/Chi",
        meta: {
          filterKey: "direction",
          filterType: "select",
          filterOptions: dirOpts,
        },
        cell: ({ getValue }) => formatCashDirection(String(getValue())),
      },
      {
        accessorKey: "business_category",
        header: "Nghiệp vụ",
        meta: { filterKey: "business_category", filterType: "text" },
      },
      { accessorKey: "amount", header: "Số tiền" },
      { accessorKey: "partner_code", header: "Mã ĐT" },
      { accessorKey: "partner_name", header: "Đối tượng" },
      { accessorKey: "payer_name", header: "Người nộp" },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            {row.original.direction === "receipt" ? (
              <DropdownMenuItem asChild>
                <CashReceiptPrintButton
                  transactionId={row.original.id}
                  label="In PT"
                  variant="ghost"
                  className={dataGridPrintMenuItemButtonClassName}
                />
              </DropdownMenuItem>
            ) : null}
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
          { label: "Kênh thanh toán", value: row.payment_channel },
          { label: "Thu / Chi", value: formatCashDirection(row.direction) },
          { label: "Nghiệp vụ", value: row.business_category },
          { label: "Số tiền", value: row.amount },
          { label: "Mã ĐT", value: row.partner_code },
          { label: "Đối tượng", value: row.partner_name },
          { label: "Người nộp", value: row.payer_name },
          { label: "Diễn giải", value: row.description, span: "full" },
          { label: "Reference type", value: row.reference_type },
          { label: "Reference id", value: row.reference_id },
          { label: "ID", value: row.id, span: "full" },
          { label: "Tạo lúc", value: row.created_at },
          { label: "Cập nhật", value: row.updated_at },
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
        renderRowDetail={renderCashDetail}
        rowDetailTitle={(r) => "Chứng từ " + r.doc_number}
        toolbarExtra={
          <Button variant="primary" type="button" size="sm" onClick={openCreate}>
            Thêm chứng từ
          </Button>
        }
        getRowId={(r) => r.id}
      />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa chứng từ" : "Thêm chứng từ"}</DialogTitle>
            <DialogDescription>Tiền mặt / ngân hàng.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2">
              <Label htmlFor="c-d">Ngày</Label>
              <Input id="c-d" type="date" value={tdate} onChange={(e) => setTdate(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-doc">Số chứng từ</Label>
              <Input id="c-doc" value={docNum} onChange={(e) => setDocNum(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-ch">Kênh thanh toán</Label>
              <Input
                id="c-ch"
                placeholder="cash, mbbank, acb…"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-dir">Loại</Label>
              <Select
                id="c-dir"
                value={direction}
                onChange={(e) => setDirection(e.target.value as typeof direction)}
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
              <Input id="c-cat" value={category} onChange={(e) => setCategory(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-amt">Số tiền</Label>
              <Input
                id="c-amt"
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-p">Đối tượng</Label>
              <Select id="c-p" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="">—</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
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
            <div className="grid gap-2">
              <Label htmlFor="c-rt">Reference type</Label>
              <Input id="c-rt" value={refType} onChange={(e) => setRefType(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-ri">Reference id (UUID)</Label>
              <Input id="c-ri" value={refId} onChange={(e) => setRefId(e.target.value)} />
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
    </>
  );
}
