"use client";

import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import {
  DataGridDeleteButton,
  DataGridEditButton,
} from "@/components/shared/data-grid/data-grid-action-buttons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailPreview } from "@/components/ui/detail-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createContract,
  deleteContract,
  listContracts,
  updateContract,
  type ContractRow,
} from "@/lib/actions/contracts";
import { listPartnerPicker } from "@/lib/actions/partners";

const statusOpts = [
  { value: "draft", label: "Nháp" },
  { value: "active", label: "Hiệu lực" },
  { value: "closed", label: "Đã đóng" },
  { value: "cancelled", label: "Đã hủy" },
];

function formatContractStatus(s: string) {
  return statusOpts.find((o) => o.value === s)?.label ?? s;
}

export function ContractsPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [partners, setPartners] = React.useState<{ id: string; code: string; name: string }[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContractRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [partnerId, setPartnerId] = React.useState("");
  const [contractNum, setContractNum] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [signedDate, setSignedDate] = React.useState("");
  const [validFrom, setValidFrom] = React.useState("");
  const [validTo, setValidTo] = React.useState("");
  const [status, setStatus] = React.useState<ContractRow["status"]>("active");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    void listPartnerPicker().then(setPartners).catch(() => {});
  }, []);

  const reset = () => {
    setEditing(null);
    setPartnerId(partners[0]?.id ?? "");
    setContractNum("");
    setTitle("");
    setSignedDate("");
    setValidFrom(new Date().toISOString().slice(0, 10));
    setValidTo("");
    setStatus("active");
    setNotes("");
    setErr(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (row: ContractRow) => {
    setEditing(row);
    setPartnerId(row.partner_id);
    setContractNum(row.contract_number);
    setTitle(row.title);
    setSignedDate(row.signed_date ?? "");
    setValidFrom(row.valid_from);
    setValidTo(row.valid_to ?? "");
    setStatus(row.status);
    setNotes(row.notes ?? "");
    setErr(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErr(null);
    try {
      const payload = {
        partner_id: partnerId,
        contract_number: contractNum.trim(),
        title: title.trim(),
        signed_date: signedDate.trim() || null,
        valid_from: validFrom,
        valid_to: validTo.trim() || null,
        status,
        notes: notes.trim() || null,
      };
      if (editing) await updateContract(editing.id, payload);
      else await createContract(payload);
      setOpen(false);
      reset();
      bumpGrid();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const onDelete = async (row: ContractRow) => {
    if (!confirm("Xóa hợp đồng " + row.contract_number + "?")) return;
    try {
      await deleteContract(row.id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Không xóa được");
    }
  };

  const columns = React.useMemo<ColumnDef<ContractRow, unknown>[]>(
    () => [
      {
        accessorKey: "contract_number",
        header: "Số HĐ",
        meta: { filterKey: "contract_number", filterType: "text" },
      },
      { accessorKey: "title", header: "Tiêu đề" },
      { accessorKey: "partner_code", header: "Mã ĐT" },
      { accessorKey: "partner_name", header: "Đối tác" },
      { accessorKey: "valid_from", header: "Từ ngày" },
      { accessorKey: "valid_to", header: "Đến ngày" },
      {
        accessorKey: "status",
        header: "Trạng thái",
        meta: {
          filterKey: "status",
          filterType: "select",
          filterOptions: statusOpts,
        },
        cell: ({ getValue }) => formatContractStatus(String(getValue())),
      },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            <DataGridEditButton type="button" onClick={() => openEdit(row.original)} />
            <DataGridDeleteButton type="button" onClick={() => void onDelete(row.original)} />
          </>
        ),
      },
    ],
    [],
  );

  const renderDetail = React.useCallback((row: ContractRow) => {
    return (
      <DetailPreview
        fields={[
          { label: "Số HĐ", value: row.contract_number },
          { label: "Tiêu đề", value: row.title },
          { label: "Mã ĐT", value: row.partner_code },
          { label: "Đối tác", value: row.partner_name },
          { label: "Ngày ký", value: row.signed_date ?? "—" },
          { label: "Hiệu lực từ", value: row.valid_from },
          { label: "Hiệu lực đến", value: row.valid_to ?? "—" },
          { label: "Trạng thái", value: formatContractStatus(row.status) },
          { label: "Ghi chú", value: row.notes, span: "full" },
          { label: "ID", value: row.id, span: "full" },
        ]}
      />
    );
  }, []);

  return (
    <>
      <ExcelDataGrid<ContractRow>
        moduleId="partner_contracts"
        title="Hợp đồng đối tác"
        columns={columns}
        list={listContracts}
        reloadSignal={gridReload}
        renderRowDetail={renderDetail}
        rowDetailTitle={(r) => "HĐ " + r.contract_number}
        toolbarExtra={
          <Button variant="primary" type="button" size="sm" onClick={openCreate}>
            Thêm hợp đồng
          </Button>
        }
        getRowId={(r) => r.id}
      />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa hợp đồng" : "Thêm hợp đồng"}</DialogTitle>
            <DialogDescription>Phiếu thu ở sổ quỹ có thể chọn hợp đồng cùng đối tác.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ct-p">Đối tác</Label>
              <Select id="ct-p" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>
                <option value="">Chọn…</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ct-num">Số hợp đồng</Label>
              <Input id="ct-num" value={contractNum} onChange={(e) => setContractNum(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ct-st">Trạng thái</Label>
              <Select id="ct-st" value={status} onChange={(e) => setStatus(e.target.value as ContractRow["status"])}>
                {statusOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ct-title">Tiêu đề / nội dung ngắn</Label>
              <Input id="ct-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ct-signed">Ngày ký</Label>
              <Input id="ct-signed" type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ct-vf">Hiệu lực từ</Label>
              <Input id="ct-vf" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ct-vt">Hiệu lực đến (tuỳ chọn)</Label>
              <Input id="ct-vt" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ct-notes">Ghi chú</Label>
              <Textarea id="ct-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
