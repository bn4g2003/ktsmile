"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import {
  DataGridMenuDeleteItem,
  DataGridMenuEditItem,
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
import { Textarea } from "@/components/ui/textarea";
import { LabOrderStatusQuickDialog } from "@/components/modules/orders/lab-order-status-quick-dialog";
import { LabOrderPrintButton } from "@/components/shared/reports/lab-order-print-button";
import { PaymentNoticePrintButton } from "@/components/shared/reports/payment-notice-print-button";
import { Card } from "@/components/ui/card";
import { DetailPreview } from "@/components/ui/detail-preview";
import {
  issuePaymentNoticeForLabOrder,
  updateLabOrderBilling,
  getLabOrderBillingTotals,
} from "@/lib/actions/billing";
import {
  compareDoctorPrescriptionToLabOrder,
  createDoctorPrescriptionFromLabOrder,
  linkLabOrderToDoctorPrescription,
  listDoctorPrescriptionsByPartner,
} from "@/lib/actions/doctor-prescriptions";
import { listProductPicker } from "@/lib/actions/products";
import {
  createLabOrderLine,
  deleteLabOrderLine,
  getLabOrder,
  getPartnerDefaultDiscount,
  getSuggestedLinePrice,
  listLabOrderLines,
  updateLabOrderLine,
  updateLabOrderStatus,
  type LabOrderLineRow,
  type LabOrderRow,
} from "@/lib/actions/lab-orders";
import { LabToothPicker } from "@/components/modules/orders/lab-tooth-picker";
import { parseToothPositionsToSet, detectArchConnection } from "@/lib/dental/fdi-teeth";
import {
  allowedLabOrderStatusTargets,
  canChangeLabOrderStatusFrom,
  formatArchConnection,
  formatCoordReviewStatus,
  formatLabOrderCategory,
  formatLabOrderLineWorkType,
  formatOrderStatus,
  formatPatientGender,
  labOrderLineWorkTypeOptions,
  orderStatusBadgeClassName,
} from "@/lib/format/labels";

export function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const [gridReload, setGridReload] = React.useState(0);
  const [header, setHeader] = React.useState<Record<string, unknown> | null>(null);
  const [products, setProducts] = React.useState<
    { id: string; code: string; name: string; unit_price: number }[]
  >([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LabOrderLineRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [productId, setProductId] = React.useState("");
  const [tooth, setTooth] = React.useState("");
  const [shade, setShade] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [price, setPrice] = React.useState("0");
  const [disc, setDisc] = React.useState("0");
  const [discVnd, setDiscVnd] = React.useState("0");
  const [notes, setNotes] = React.useState("");
  const [toothCount, setToothCount] = React.useState("");
  const [workType, setWorkType] = React.useState<"new_work" | "warranty">("new_work");
  const [archConnection, setArchConnection] = React.useState<"unit" | "bridge">("unit");
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [quickStatus, setQuickStatus] = React.useState<LabOrderRow["status"]>("draft");
  const [quickPending, setQuickPending] = React.useState(false);
  const [quickErr, setQuickErr] = React.useState<string | null>(null);

  const [rxList, setRxList] = React.useState<{ id: string; slip_code: string | null; slip_date: string; patient_name: string }[]>([]);
  const [rxSelect, setRxSelect] = React.useState("");
  const [slipCodeNew, setSlipCodeNew] = React.useState("");
  const [rxBusy, setRxBusy] = React.useState(false);
  const [rxMsg, setRxMsg] = React.useState<string | null>(null);
  const [compareMsg, setCompareMsg] = React.useState<string | null>(null);

  const [bPct, setBPct] = React.useState("0");
  const [bAmt, setBAmt] = React.useState("0");
  const [bFees, setBFees] = React.useState("0");
  const [billTotals, setBillTotals] = React.useState<{ subtotal_lines: number; grand_total: number } | null>(null);
  const [billBusy, setBillBusy] = React.useState(false);
  const [issueBusy, setIssueBusy] = React.useState(false);

  const loadHeader = React.useCallback(async () => {
    const h = await getLabOrder(id);
    setHeader(h);
  }, [id]);

  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    void loadHeader();
    router.refresh();
  }, [router, loadHeader]);

  React.useEffect(() => {
    void loadHeader();
    void listProductPicker().then(setProducts).catch(() => {});
  }, [loadHeader]);

  const partnerIdHdr = (header?.partner_id as string) ?? "";

  React.useEffect(() => {
    if (!partnerIdHdr) return;
    void listDoctorPrescriptionsByPartner(partnerIdHdr).then(setRxList).catch(() => setRxList([]));
  }, [partnerIdHdr, gridReload]);

  React.useEffect(() => {
    if (!header) {
      setBillTotals(null);
      return;
    }
    setBPct(String(header.billing_order_discount_percent ?? 0));
    setBAmt(String(header.billing_order_discount_amount ?? 0));
    setBFees(String(header.billing_other_fees ?? 0));
    setRxSelect(String(header.doctor_prescription_id ?? ""));
    void getLabOrderBillingTotals(id)
      .then((t) => (t ? setBillTotals({ subtotal_lines: t.subtotal_lines, grand_total: t.grand_total }) : setBillTotals(null)))
      .catch(() => setBillTotals(null));
  }, [header, id, gridReload]);

  const partnerId = (header?.partner_id as string) ?? "";

  const suggestPrice = React.useCallback(async () => {
    if (!partnerId || !productId) return;
    const [p, d] = await Promise.all([
      getSuggestedLinePrice(partnerId, productId),
      getPartnerDefaultDiscount(partnerId),
    ]);
    setPrice(String(p));
    setDisc(String(d));
  }, [partnerId, productId]);

  React.useEffect(() => {
    void suggestPrice();
  }, [suggestPrice]);

  const listLines = React.useCallback(
    async (args: import("@/components/shared/data-grid/excel-data-grid").ListArgs) => {
      const rows = await listLabOrderLines(id);
      let filtered = rows;
      const g = args.globalSearch.trim().toLowerCase();
      if (g) {
        filtered = filtered.filter(
          (r) =>
            r.tooth_positions.toLowerCase().includes(g) ||
            (r.shade ?? "").toLowerCase().includes(g) ||
            (r.product_code ?? "").toLowerCase().includes(g) ||
            formatLabOrderLineWorkType(r.work_type).toLowerCase().includes(g),
        );
      }
      const total = filtered.length;
      const from = (args.page - 1) * args.pageSize;
      return { rows: filtered.slice(from, from + args.pageSize), total };
    },
    [id],
  );

  const reset = () => {
    setEditing(null);
    setProductId(products[0]?.id ?? "");
    setTooth("");
    setShade("");
    setQty("1");
    setPrice("0");
    setDisc("0");
    setDiscVnd("0");
    setNotes("");
    setToothCount("");
    setWorkType("new_work");
    setArchConnection("unit");
    setErr(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (row: LabOrderLineRow) => {
    setEditing(row);
    setProductId(row.product_id);
    setTooth(row.tooth_positions);
    setShade(row.shade ?? "");
    setToothCount(row.tooth_count != null ? String(row.tooth_count) : "");
    setWorkType(row.work_type);
    setArchConnection(row.arch_connection ?? "unit");
    setQty(String(row.quantity));
    setPrice(String(row.unit_price));
    setDisc(String(row.discount_percent));
    setDiscVnd(String(row.discount_amount ?? 0));
    setNotes(row.notes ?? "");
    setErr(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (toothCount.trim() !== "" && Number.isNaN(Number.parseInt(toothCount, 10))) {
      setErr("Số răng phải là số nguyên.");
      return;
    }
    setPending(true);
    setErr(null);
    try {
      const payload = {
        order_id: id,
        product_id: productId,
        tooth_positions: tooth.trim(),
        shade: shade.trim() || null,
        tooth_count: toothCount.trim() === "" ? null : Number.parseInt(toothCount, 10),
        quantity: Number(qty),
        unit_price: Number(price),
        discount_percent: Number(disc) || 0,
        discount_amount: Number(discVnd) || 0,
        work_type: workType,
        arch_connection: archConnection,
        notes: notes.trim() || null,
      };
      if (editing) await updateLabOrderLine(editing.id, payload);
      else await createLabOrderLine(payload);
      setOpen(false);
      reset();
      bumpGrid();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const onDelete = async (row: LabOrderLineRow) => {
    if (!confirm("Xóa dòng này?")) return;
    try {
      await deleteLabOrderLine(row.id, id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi");
    }
  };

  const columns = React.useMemo<ColumnDef<LabOrderLineRow, unknown>[]>(
    () => [
      { accessorKey: "product_code", header: "Mã SP" },
      { accessorKey: "product_name", header: "Tên SP" },
      { accessorKey: "tooth_positions", header: "Vị trí răng" },
      { accessorKey: "shade", header: "Màu" },
      {
        accessorKey: "tooth_count",
        header: "Số răng",
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return v != null ? String(v) : "—";
        },
      },
      {
        accessorKey: "work_type",
        header: "Loại",
        cell: ({ getValue }) => formatLabOrderLineWorkType(String(getValue())),
      },
      {
        accessorKey: "arch_connection",
        header: "Rời/Cầu",
        cell: ({ getValue }) => formatArchConnection(String(getValue() ?? "unit")),
      },
      { accessorKey: "quantity", header: "SL" },
      { accessorKey: "unit_price", header: "Đơn giá" },
      { accessorKey: "discount_percent", header: "CK %" },
      {
        accessorKey: "discount_amount",
        header: "Giảm VNĐ",
        cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN"),
      },
      { accessorKey: "line_amount", header: "Thành tiền" },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            <DataGridMenuEditItem onSelect={() => openEdit(row.original)}>Sửa</DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => void onDelete(row.original)}>Xóa</DataGridMenuDeleteItem>
          </>
        ),
      },
    ],
    [],
  );

  const renderLineDetail = React.useCallback((row: LabOrderLineRow) => {
    return (
      <DetailPreview
        fields={[
          { label: "Mã SP", value: row.product_code },
          { label: "Tên SP", value: row.product_name },
          { label: "Vị trí răng", value: row.tooth_positions },
          { label: "Màu", value: row.shade },
          { label: "Số răng", value: row.tooth_count != null ? row.tooth_count : "—" },
          { label: "Loại", value: formatLabOrderLineWorkType(row.work_type) },
          { label: "Rời/Cầu", value: formatArchConnection(row.arch_connection ?? "unit") },
          { label: "Số lượng", value: row.quantity },
          { label: "Đơn giá", value: row.unit_price },
          { label: "CK %", value: row.discount_percent },
          { label: "Giảm VNĐ", value: row.discount_amount },
          { label: "Thành tiền", value: row.line_amount },
          { label: "Ghi chú", value: row.notes, span: "full" },
          { label: "ID dòng", value: row.id, span: "full" },
          { label: "Tạo lúc", value: row.created_at },
        ]}
      />
    );
  }, []);

  const partners = header?.partners as { code?: string; name?: string } | null;
  const orderStatus = (header?.status as LabOrderRow["status"] | undefined) ?? "draft";
  const orderNumberStr = header ? String(header.order_number) : "";

  const openQuickStatus = () => {
    setQuickStatus(orderStatus);
    setQuickErr(null);
    setQuickOpen(true);
  };

  const saveQuickStatus = async () => {
    setQuickPending(true);
    setQuickErr(null);
    try {
      await updateLabOrderStatus(id, quickStatus);
      setQuickOpen(false);
      await loadHeader();
      bumpGrid();
      router.refresh();
    } catch (e2) {
      setQuickErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setQuickPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" asChild>
          <Link href="/orders">← Danh sách đơn</Link>
        </Button>
      </div>
      {header ? (
        <Card className="space-y-2 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--on-surface)]">
                Đơn {String(header.order_number)}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className={orderStatusBadgeClassName(orderStatus)} title={formatOrderStatus(orderStatus)}>
                  {formatOrderStatus(orderStatus)}
                </span>
                {canChangeLabOrderStatusFrom(orderStatus) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={openQuickStatus}
                  >
                    Đổi trạng thái
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-[var(--on-surface-muted)]">
                Khách: {partners?.code} — {partners?.name}
                {header.clinic_name ? (
                  <>
                    {" "}
                    · Nha khoa: {String(header.clinic_name)}
                  </>
                ) : null}{" "}
                · BN: {String(header.patient_name)} · Ngày nhận: {String(header.received_at)}
              </p>
              {header.order_category ? (
                <p className="text-xs text-[var(--on-surface-muted)]">
                  Loại hàng: {formatLabOrderCategory(String(header.order_category))}
                </p>
              ) : null}
              {header.patient_year_of_birth != null || header.patient_gender ? (
                <p className="text-xs text-[var(--on-surface-muted)]">
                  {header.patient_year_of_birth != null ? `Năm sinh: ${String(header.patient_year_of_birth)}` : null}
                  {header.patient_year_of_birth != null && header.patient_gender ? " · " : null}
                  {header.patient_gender
                    ? formatPatientGender(String(header.patient_gender))
                    : null}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <LabOrderPrintButton orderId={id} label="In / lưu PDF (trình duyệt)" />
              <PaymentNoticePrintButton orderId={id} label="In GBTT" />
            </div>
          </div>
          <p className="text-xs text-[var(--on-surface-muted)]">
            Đối chiếu điều phối:{" "}
            <strong>{formatCoordReviewStatus(String(header.coord_review_status ?? "pending"))}</strong>
            {header.coord_reviewed_at ? " · " + String(header.coord_reviewed_at) : null} ·{" "}
            <Link href="/orders/review" className="text-[var(--primary)] underline-offset-2 hover:underline">
              Mở trang kiểm tra đơn
            </Link>
          </p>
        </Card>
      ) : (
        <p className="text-[var(--on-surface-muted)]">Đang tải…</p>
      )}

      {header ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-[var(--on-surface)]">Phiếu chỉ định bác sĩ</h2>
            <p className="text-xs text-[var(--on-surface-muted)]">
              Liên kết phiếu gốc để so khớp số lượng với đơn điều phối. Có thể tạo phiếu từ dòng đơn hiện tại làm mốc.
            </p>
            {rxMsg ? <p className="text-xs text-[#b91c1c]">{rxMsg}</p> : null}
            {compareMsg ? (
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-[var(--surface-muted)] p-2 text-xs">{compareMsg}</pre>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="rx-link">Gắn phiếu có sẵn</Label>
              <Select
                id="rx-link"
                value={rxSelect}
                onChange={(e) => setRxSelect(e.target.value)}
              >
                <option value="">— Không chọn —</option>
                {rxList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {(r.slip_code ?? r.id.slice(0, 8)) + " · " + r.slip_date + " · " + r.patient_name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={rxBusy}
                onClick={() => {
                  setRxBusy(true);
                  setRxMsg(null);
                  void linkLabOrderToDoctorPrescription({ order_id: id, prescription_id: rxSelect || null })
                    .then(() => {
                      bumpGrid();
                      void loadHeader();
                    })
                    .catch((e) => setRxMsg(e instanceof Error ? e.message : "Lỗi"))
                    .finally(() => setRxBusy(false));
                }}
              >
                Lưu liên kết
              </Button>
            </div>
            <div className="grid gap-2 border-t border-[var(--border-ghost)] pt-3">
              <Label htmlFor="rx-slip">Mã phiếu BS mới (tuỳ chọn)</Label>
              <Input id="rx-slip" value={slipCodeNew} onChange={(e) => setSlipCodeNew(e.target.value)} placeholder="VD: BS-2026-001" />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={rxBusy}
                  onClick={() => {
                    setRxBusy(true);
                    setRxMsg(null);
                    void createDoctorPrescriptionFromLabOrder(id, slipCodeNew.trim() || null)
                      .then(() => {
                        setSlipCodeNew("");
                        bumpGrid();
                        void loadHeader();
                      })
                      .catch((e) => setRxMsg(e instanceof Error ? e.message : "Lỗi"))
                      .finally(() => setRxBusy(false));
                  }}
                >
                  Tạo phiếu từ đơn này
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={rxBusy}
                  onClick={() => {
                    setCompareMsg(null);
                    void compareDoctorPrescriptionToLabOrder(id)
                      .then(({ hasPrescription, result }) => {
                        if (!hasPrescription) {
                          setCompareMsg("Chưa gắn phiếu BS.");
                          return;
                        }
                        setCompareMsg(result.ok ? "Khớp nhóm SL." : result.messages.join("\n"));
                      })
                      .catch((e) => setCompareMsg(e instanceof Error ? e.message : "Lỗi"));
                  }}
                >
                  So khớp nhanh
                </Button>
              </div>
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-[var(--on-surface)]">Giấy báo thanh toán</h2>
            {billTotals ? (
              <p className="text-xs text-[var(--on-surface-muted)]">
                Cộng dòng: <strong>{billTotals.subtotal_lines.toLocaleString("vi-VN")}</strong> · Phải thu:{" "}
                <strong>{billTotals.grand_total.toLocaleString("vi-VN")}</strong>
                {header.payment_notice_doc_number ? (
                  <>
                    <br />
                    Số GBTT: <strong>{String(header.payment_notice_doc_number)}</strong>
                  </>
                ) : null}
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-1">
                <Label htmlFor="bill-pct">CK tổng %</Label>
                <Input id="bill-pct" value={bPct} onChange={(e) => setBPct(e.target.value)} inputMode="decimal" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="bill-amt">CK tổng VNĐ</Label>
                <Input id="bill-amt" value={bAmt} onChange={(e) => setBAmt(e.target.value)} inputMode="decimal" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="bill-fees">Phí khác (+)</Label>
                <Input id="bill-fees" value={bFees} onChange={(e) => setBFees(e.target.value)} inputMode="decimal" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={billBusy}
                onClick={() => {
                  setBillBusy(true);
                  void updateLabOrderBilling(id, {
                    billing_order_discount_percent: Number(bPct) || 0,
                    billing_order_discount_amount: Number(bAmt) || 0,
                    billing_other_fees: Number(bFees) || 0,
                  })
                    .then(() => {
                      bumpGrid();
                      void loadHeader();
                    })
                    .catch((e) => alert(e instanceof Error ? e.message : "Lỗi"))
                    .finally(() => setBillBusy(false));
                }}
              >
                {billBusy ? "Đang lưu…" : "Lưu điều chỉnh"}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={issueBusy}
                onClick={() => {
                  setIssueBusy(true);
                  void issuePaymentNoticeForLabOrder(id)
                    .then(() => {
                      bumpGrid();
                      void loadHeader();
                    })
                    .catch((e) => alert(e instanceof Error ? e.message : "Lỗi"))
                    .finally(() => setIssueBusy(false));
                }}
              >
                {issueBusy ? "…" : "Cấp số GBTT"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <ExcelDataGrid<LabOrderLineRow>
        moduleId={"lab_order_lines_" + id}
        title="Dòng đơn hàng"
        columns={columns}
        list={listLines}
        reloadSignal={gridReload}
        renderRowDetail={renderLineDetail}
        rowDetailTitle={(r) => "Dòng " + (r.product_code ?? r.id.slice(0, 8))}
        toolbarExtra={
          <Button variant="primary" type="button" onClick={openCreate}>
            Thêm dòng
          </Button>
        }
        getRowId={(r) => r.id}
      />

      <LabOrderStatusQuickDialog
        open={quickOpen}
        onOpenChange={(v) => {
          setQuickOpen(v);
          if (!v) setQuickErr(null);
        }}
        orderLabel={orderNumberStr}
        currentStatus={orderStatus}
        allowedStatuses={allowedLabOrderStatusTargets(orderStatus)}
        value={quickStatus}
        onValueChange={setQuickStatus}
        onConfirm={saveQuickStatus}
        pending={quickPending}
        error={quickErr}
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa dòng" : "Thêm dòng"}</DialogTitle>
            <DialogDescription>Giá gợi ý theo bảng giá KH / giá SP.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ln-p">Sản phẩm</Label>
              <Select id="ln-p" value={productId} onChange={(e) => setProductId(e.target.value)} required>
                <option value="">Chọn…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ln-tooth">Vị trí răng (FDI)</Label>
              <LabToothPicker 
                value={tooth} 
                onChange={(v) => {
                  setTooth(v);
                  const teethSet = parseToothPositionsToSet(v);
                  const archConn = detectArchConnection(teethSet);
                  setArchConnection(archConn);
                  const count = teethSet.size;
                  if (count > 0) {
                    setToothCount(String(count));
                    setQty(String(count));
                  }
                }}
              />
              <Input
                id="ln-tooth"
                className="font-mono text-xs"
                value={tooth}
                onChange={(e) => {
                  const v = e.target.value;
                  setTooth(v);
                  const teethSet = parseToothPositionsToSet(v);
                  const archConn = detectArchConnection(teethSet);
                  setArchConnection(archConn);
                  const count = teethSet.size;
                  if (count > 0) {
                    setToothCount(String(count));
                    setQty(String(count));
                  }
                }}
                placeholder="Hoặc nhập tay"
                required
              />
              <p className="text-[11px] text-[var(--on-surface-muted)]">
                Tự động phát hiện: <strong className="text-[var(--on-surface)]">
                  {archConnection === "bridge" ? "Cầu răng" : "Răng rời"}
                </strong>
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln-shade">Màu</Label>
              <Input id="ln-shade" value={shade} onChange={(e) => setShade(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln-toothcnt">Số răng</Label>
              <Input
                id="ln-toothcnt"
                type="number"
                min={0}
                step={1}
                value={toothCount}
                onChange={(e) => setToothCount(e.target.value)}
                placeholder="Tuỳ chọn"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln-work">Làm mới / bảo hành</Label>
              <Select
                id="ln-work"
                value={workType}
                onChange={(e) => {
                  const newWorkType = e.target.value as "new_work" | "warranty";
                  setWorkType(newWorkType);
                  if (newWorkType === "warranty") {
                    setPrice("0");
                    setDisc("0");
                    setDiscVnd("0");
                  }
                }}
              >
                {labOrderLineWorkTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln-qty">Số lượng</Label>
              <Input
                id="ln-qty"
                type="number"
                min={0.01}
                step={0.01}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln-price">Đơn giá</Label>
              <Input
                id="ln-price"
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln-disc">Chiết khấu %</Label>
              <Input
                id="ln-disc"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={disc}
                onChange={(e) => setDisc(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln-disc-vnd">Giảm VNĐ (dòng)</Label>
              <Input
                id="ln-disc-vnd"
                type="number"
                min={0}
                step={0.01}
                value={discVnd}
                onChange={(e) => setDiscVnd(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ln-notes">Ghi chú</Label>
              <Textarea id="ln-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
    </div>
  );
}
