"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import {
  DataGridAuxLink,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { LabOrderRowDetailPanel } from "@/components/modules/orders/lab-order-row-detail-panel";
import { LabOrderStatusQuickDialog } from "@/components/modules/orders/lab-order-status-quick-dialog";
import { Textarea } from "@/components/ui/textarea";
import { listCustomerPartnerPicker } from "@/lib/actions/partners";
import { listProductPicker } from "@/lib/actions/products";
import {
  allowedLabOrderStatusTargets,
  canChangeLabOrderStatusFrom,
  coordReviewStatusOptions,
  formatCoordReviewStatus,
  formatOrderStatus,
  labOrderLineWorkTypeOptions,
  labOrderStatusOptions,
  orderStatusBadgeClassName,
} from "@/lib/format/labels";
import { LabOrderPrintButton } from "@/components/shared/reports/lab-order-print-button";
import { importLabOrdersFromExcel } from "@/lib/actions/lab-orders-import";
import {
  createLabOrder,
  deleteLabOrder,
  getPartnerDefaultDiscount,
  getSuggestedLinePrice,
  listLabOrders,
  updateLabOrder,
  updateLabOrderStatus,
  type LabOrderRow,
} from "@/lib/actions/lab-orders";

type DraftLine = {
  key: string;
  productId: string;
  tooth_positions: string;
  shade: string;
  tooth_count: string;
  qty: string;
  price: string;
  disc: string;
  disc_vnd: string;
  work_type: "new_work" | "warranty";
  notes: string;
};

function newDraftLine(): DraftLine {
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "k-" + Math.random().toString(36).slice(2);
  return {
    key,
    productId: "",
    tooth_positions: "",
    shade: "",
    tooth_count: "",
    qty: "1",
    price: "0",
    disc: "0",
    disc_vnd: "0",
    work_type: "new_work",
    notes: "",
  };
}

export function OrdersPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LabOrderRow | null>(null);
  const [partners, setPartners] = React.useState<{ id: string; code: string; name: string }[]>([]);
  const [products, setProducts] = React.useState<
    { id: string; code: string; name: string; unit_price: number }[]
  >([]);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [orderNumber, setOrderNumber] = React.useState("");
  const [receivedAt, setReceivedAt] = React.useState("");
  const [partnerId, setPartnerId] = React.useState("");
  const [clinicName, setClinicName] = React.useState("");
  const [patientName, setPatientName] = React.useState("");
  const [status, setStatus] = React.useState<LabOrderRow["status"]>("delivered");
  const [notes, setNotes] = React.useState("");
  const [draftLines, setDraftLines] = React.useState<DraftLine[]>([newDraftLine()]);
  const fileImportRef = React.useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = React.useState(false);
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [quickRow, setQuickRow] = React.useState<LabOrderRow | null>(null);
  const [quickStatus, setQuickStatus] = React.useState<LabOrderRow["status"]>("draft");
  const [quickPending, setQuickPending] = React.useState(false);
  const [quickErr, setQuickErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    void listCustomerPartnerPicker().then(setPartners).catch(() => {});
    void listProductPicker().then(setProducts).catch(() => {});
  }, []);

  const hydrateDraftPrices = React.useCallback(async (key: string, productIdFor: string) => {
    if (!partnerId.trim() || !productIdFor) return;
    try {
      const [p, d] = await Promise.all([
        getSuggestedLinePrice(partnerId, productIdFor),
        getPartnerDefaultDiscount(partnerId),
      ]);
      setDraftLines((prev) =>
        prev.map((l) => (l.key === key ? { ...l, price: String(p), disc: String(d) } : l)),
      );
    } catch {
      /* ignore */
    }
  }, [partnerId]);

  const reset = () => {
    setEditing(null);
    setOrderNumber("");
    setReceivedAt(new Date().toISOString().slice(0, 10));
    setPartnerId(partners[0]?.id ?? "");
    setClinicName("");
    setPatientName("");
    setStatus("delivered");
    setNotes("");
    setDraftLines([newDraftLine()]);
    setErr(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (row: LabOrderRow) => {
    setEditing(row);
    setOrderNumber(row.order_number);
    setReceivedAt(row.received_at);
    setPartnerId(row.partner_id);
    setClinicName(row.clinic_name ?? "");
    setPatientName(row.patient_name);
    setStatus(row.status);
    setNotes(row.notes ?? "");
    setErr(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId.trim()) {
      setErr("Chọn khách hàng.");
      return;
    }
    setPending(true);
    setErr(null);
    try {
      if (editing) {
        const base = {
          order_number: orderNumber.trim(),
          received_at: receivedAt,
          partner_id: partnerId,
          patient_name: patientName.trim(),
          clinic_name: clinicName.trim() || null,
          notes: notes.trim() || null,
          status,
        };
        await updateLabOrder(editing.id, base);
        setOpen(false);
        reset();
        bumpGrid();
      } else {
        const incomplete = draftLines.filter(
          (l) =>
            (l.productId && !l.tooth_positions.trim()) ||
            (!l.productId && l.tooth_positions.trim()),
        );
        if (incomplete.length) {
          setErr("Mỗi dòng hàng cần đủ loại SP (sản phẩm) và vị trí răng.");
          return;
        }
        for (const l of draftLines) {
          if (!l.productId || !l.tooth_positions.trim()) continue;
          if (l.tooth_count.trim() !== "" && Number.isNaN(Number.parseInt(l.tooth_count, 10))) {
            setErr("Số răng phải là số nguyên.");
            return;
          }
          if (!(Number(l.qty) > 0)) {
            setErr("Số lượng mỗi dòng hàng phải lớn hơn 0.");
            return;
          }
        }
        const linesPayload = draftLines
          .filter((l) => l.productId && l.tooth_positions.trim())
          .map((l) => ({
            product_id: l.productId,
            tooth_positions: l.tooth_positions.trim(),
            shade: l.shade.trim() || null,
            tooth_count:
              l.tooth_count.trim() === "" ? null : Number.parseInt(l.tooth_count, 10),
            quantity: Number(l.qty),
            unit_price: Number(l.price),
            discount_percent: Number(l.disc) || 0,
            discount_amount: Number(l.disc_vnd) || 0,
            work_type: l.work_type,
            notes: l.notes.trim() || null,
          }));
        const { id } = await createLabOrder(
          {
            received_at: receivedAt,
            partner_id: partnerId,
            patient_name: patientName.trim(),
            clinic_name: clinicName.trim() || null,
            status,
            notes: notes.trim() || null,
          },
          linesPayload,
        );
        setOpen(false);
        reset();
        bumpGrid();
        router.push("/orders/" + id);
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const onPickExcel = () => fileImportRef.current?.click();

  const onExcelSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await importLabOrdersFromExcel(fd);
      if (res.ok) {
        const warn = res.errors?.length
          ? "\n\nCảnh báo (dòng bỏ qua):\n" +
            res.errors.slice(0, 35).join("\n") +
            (res.errors.length > 35 ? "\n…" : "")
          : "";
        alert((res.message ?? "Nhập xong.") + warn);
        bumpGrid();
      } else {
        const detail = res.errors?.length
          ? "\n\n" + res.errors.slice(0, 30).join("\n") + (res.errors.length > 30 ? "\n…" : "")
          : "";
        alert((res.message ?? "Nhập thất bại.") + detail);
      }
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi nhập file");
    } finally {
      setImportBusy(false);
    }
  };

  const onDelete = async (row: LabOrderRow) => {
    if (!confirm("Xóa đơn " + row.order_number + "? (cả dòng chi tiết)")) return;
    try {
      await deleteLabOrder(row.id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Không xóa được");
    }
  };

  const openQuickStatus = React.useCallback((row: LabOrderRow) => {
    setQuickRow(row);
    setQuickStatus(row.status);
    setQuickErr(null);
    setQuickOpen(true);
  }, []);

  const saveQuickStatus = React.useCallback(async () => {
    if (!quickRow) return;
    setQuickPending(true);
    setQuickErr(null);
    try {
      await updateLabOrderStatus(quickRow.id, quickStatus);
      setQuickOpen(false);
      setQuickRow(null);
      bumpGrid();
    } catch (e2) {
      setQuickErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setQuickPending(false);
    }
  }, [quickRow, quickStatus, bumpGrid]);

  const columns = React.useMemo<ColumnDef<LabOrderRow, unknown>[]>(
    () => [
      {
        accessorKey: "order_number",
        header: "Số đơn",
        meta: { filterKey: "order_number", filterType: "text" },
        cell: ({ row, getValue }) => (
          <Link
            className="font-medium text-[color-mix(in_srgb,var(--primary)_55%,var(--on-surface))] underline-offset-2 hover:underline"
            href={"/orders/" + row.original.id}
          >
            {String(getValue())}
          </Link>
        ),
      },
      {
        accessorKey: "received_at",
        header: "Ngày nhận",
        meta: { filterKey: "received_from", filterType: "text" },
      },
      {
        id: "received_to",
        header: "Đến",
        meta: { filterKey: "received_to", filterType: "text" },
        cell: () => "",
      },
      { accessorKey: "partner_code", header: "Mã KH" },
      { accessorKey: "partner_name", header: "Khách" },
      { accessorKey: "clinic_name", header: "Nha khoa" },
      { accessorKey: "patient_name", header: "Bệnh nhân" },
      {
        accessorKey: "coord_review_status",
        header: "Đối chiếu",
        meta: {
          filterKey: "coord_review_status",
          filterType: "select",
          filterOptions: [...coordReviewStatusOptions],
        },
        cell: ({ getValue }) => formatCoordReviewStatus(String(getValue())),
      },
      {
        accessorKey: "prescription_slip_code",
        header: "Phiếu BS",
        cell: ({ getValue }) => (getValue() ? String(getValue()) : "—"),
      },
      {
        accessorKey: "status",
        header: "Trạng thái",
        meta: {
          filterKey: "status",
          filterType: "select",
          filterOptions: [...labOrderStatusOptions],
        },
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={orderStatusBadgeClassName(row.original.status)}
              title={formatOrderStatus(row.original.status)}
            >
              {formatOrderStatus(row.original.status)}
            </span>
            {canChangeLabOrderStatusFrom(row.original.status) ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={() => openQuickStatus(row.original)}
              >
                Đổi
              </Button>
            ) : null}
          </div>
        ),
      },
      { accessorKey: "total_amount", header: "Tổng tiền" },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            <LabOrderPrintButton orderId={row.original.id} label="PDF" />
            <DataGridEditButton type="button" onClick={() => openEdit(row.original)} />
            <DataGridDeleteButton type="button" onClick={() => void onDelete(row.original)} />
            <DataGridAuxLink href={"/orders/" + row.original.id}>Dòng SP</DataGridAuxLink>
          </>
        ),
      },
    ],
    [openQuickStatus],
  );

  return (
    <>
      <ExcelDataGrid<LabOrderRow>
        moduleId="lab_orders"
        title="Đơn hàng phục hình"
        columns={columns}
        list={listLabOrders}
        reloadSignal={gridReload}
        renderRowDetail={(row) => <LabOrderRowDetailPanel row={row} />}
        rowDetailTitle={(r) => "Đơn " + r.order_number}
        toolbarExtra={
          <>
            <input
              ref={fileImportRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(ev) => void onExcelSelected(ev)}
            />
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={importBusy}
              onClick={onPickExcel}
            >
              {importBusy ? "Đang nhập…" : "Nhập Excel"}
            </Button>
            <Button variant="primary" size="sm" type="button" onClick={openCreate}>
              Thêm đơn
            </Button>
          </>
        }
        getRowId={(r) => r.id}
      />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa đơn" : "Thêm đơn"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Sửa thông tin đơn. Dòng sản phẩm chi tiết có thể sửa tại trang chi tiết đơn."
                : "Khách hàng chọn từ danh mục; nha khoa và bệnh nhân nhập tay. Số đơn được cấp tự động khi lưu."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2">
              <Label htmlFor="lo-num">Số đơn (mã đơn)</Label>
              {editing ? (
                <Input id="lo-num" value={orderNumber} readOnly className="bg-[var(--surface-muted)]" />
              ) : (
                <p
                  id="lo-num"
                  className="rounded-[var(--radius-sm)] border border-[var(--border-ghost)] bg-[var(--surface-muted)] px-3.5 py-2 text-sm text-[var(--on-surface-muted)]"
                >
                  Tự động theo ngày nhận (LO-YYYYMMDD-xxx) khi bấm Lưu
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lo-date">Ngày nhận</Label>
              <Input
                id="lo-date"
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="lo-p">Khách hàng (danh mục)</Label>
              <Select id="lo-p" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>
                <option value="">Chọn khách hàng…</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="lo-clinic">Nha khoa</Label>
              <Input
                id="lo-clinic"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="Tên phòng khám / nha khoa trên đơn"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="lo-pat">Bệnh nhân</Label>
              <Input
                id="lo-pat"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Họ tên bệnh nhân"
                required
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="lo-st">Trạng thái</Label>
              <Select
                id="lo-st"
                value={status}
                onChange={(e) => setStatus(e.target.value as LabOrderRow["status"])}
              >
                {(editing
                  ? labOrderStatusOptions.filter((o) =>
                      allowedLabOrderStatusTargets(editing.status).includes(o.value),
                    )
                  : labOrderStatusOptions
                ).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              {!editing ? (
                <p className="text-xs text-[var(--on-surface-muted)]">
                  Mặc định <strong>Đã giao</strong> cho hàng làm qua đêm giao sáng; có thể đổi trước khi lưu.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="lo-notes">Ghi chú đơn</Label>
              <Textarea id="lo-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {!editing ? (
              <div className="space-y-3 border-t border-[var(--border-ghost)] pt-4 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-base">Dòng hàng (sản phẩm trên đơn)</Label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setDraftLines((prev) => [...prev, newDraftLine()])}
                  >
                    + Thêm dòng
                  </Button>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)]">
                  Chọn <strong>loại SP</strong> từ danh mục, nhập <strong>vị trí răng</strong>,{" "}
                  <strong>màu</strong>, <strong>số răng</strong>, <strong>làm mới / bảo hành</strong>. Có thể
                  để trống toàn bộ dòng nếu chỉ tạo khung đơn, rồi bổ sung sau tại trang chi tiết.
                </p>
                <div className="space-y-4">
                  {draftLines.map((line, idx) => (
                    <div
                      key={line.key}
                      className="grid gap-3 rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3 sm:grid-cols-2 lg:grid-cols-3"
                    >
                      <div className="flex items-center justify-between sm:col-span-2 lg:col-span-3">
                        <span className="text-xs font-semibold text-[var(--on-surface-muted)]">
                          Dòng {idx + 1}
                        </span>
                        {draftLines.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-rose-600"
                            onClick={() =>
                              setDraftLines((prev) => prev.filter((x) => x.key !== line.key))
                            }
                          >
                            Xóa dòng
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                        <Label>Loại SP (sản phẩm)</Label>
                        <Select
                          value={line.productId}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftLines((prev) =>
                              prev.map((l) => (l.key === line.key ? { ...l, productId: v } : l)),
                            );
                            void hydrateDraftPrices(line.key, v);
                          }}
                        >
                          <option value="">Chọn sản phẩm…</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} — {p.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Vị trí răng</Label>
                        <Input
                          value={line.tooth_positions}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key ? { ...l, tooth_positions: e.target.value } : l,
                              ),
                            )
                          }
                          placeholder="VD: 11-21, 36"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Màu sắc</Label>
                        <Input
                          value={line.shade}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l) => (l.key === line.key ? { ...l, shade: e.target.value } : l)),
                            )
                          }
                          placeholder="VD: A2, 3M2"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Số răng</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={line.tooth_count}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key ? { ...l, tooth_count: e.target.value } : l,
                              ),
                            )
                          }
                          placeholder="Tuỳ chọn"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Loại (làm mới / bảo hành)</Label>
                        <Select
                          value={line.work_type}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? { ...l, work_type: e.target.value as DraftLine["work_type"] }
                                  : l,
                              ),
                            )
                          }
                        >
                          {labOrderLineWorkTypeOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Số lượng (SL hàng)</Label>
                        <Input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={line.qty}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l) => (l.key === line.key ? { ...l, qty: e.target.value } : l)),
                            )
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Đơn giá</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.price}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l) => (l.key === line.key ? { ...l, price: e.target.value } : l)),
                            )
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Chiết khấu %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={line.disc}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l) => (l.key === line.key ? { ...l, disc: e.target.value } : l)),
                            )
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Giảm VNĐ (dòng)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.disc_vnd}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key ? { ...l, disc_vnd: e.target.value } : l,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                        <Label>Ghi chú dòng</Label>
                        <Input
                          value={line.notes}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l) => (l.key === line.key ? { ...l, notes: e.target.value } : l)),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

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
      <LabOrderStatusQuickDialog
        open={quickOpen}
        onOpenChange={(v) => {
          setQuickOpen(v);
          if (!v) {
            setQuickRow(null);
            setQuickErr(null);
          }
        }}
        orderLabel={quickRow?.order_number ?? ""}
        currentStatus={quickRow?.status ?? "draft"}
        allowedStatuses={
          quickRow ? allowedLabOrderStatusTargets(quickRow.status) : ["draft"]
        }
        value={quickStatus}
        onValueChange={setQuickStatus}
        onConfirm={saveQuickStatus}
        pending={quickPending}
        error={quickErr}
      />
    </>
  );
}
