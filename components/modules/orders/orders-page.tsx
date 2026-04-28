"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import {
  DataGridMenuDeleteItem,
  DataGridMenuEditItem,
  DataGridMenuLinkItem,
  dataGridPrintMenuItemButtonClassName,
} from "@/components/shared/data-grid/data-grid-action-buttons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Combobox } from "@/components/ui/combobox";
import { LabOrderRowDetailPanel } from "@/components/modules/orders/lab-order-row-detail-panel";
import { LabOrderStatusQuickDialog } from "@/components/modules/orders/lab-order-status-quick-dialog";
import { OrdersPrintHub } from "@/components/modules/orders/orders-print-hub";
import { Textarea } from "@/components/ui/textarea";
import {
  listCustomerPartnerPicker,
  type CustomerPartnerPickerRow,
} from "@/lib/actions/partners";
import { listProductPicker } from "@/lib/actions/products";
import {
  allowedLabOrderStatusTargets,
  canChangeLabOrderStatusFrom,
  coordReviewStatusOptions,
  formatCoordReviewStatus,
  formatOrderStatus,
  labOrderCategoryOptions,
  labOrderLineWorkTypeOptions,
  labOrderStatusOptions,
  formatPatientGender,
  orderStatusBadgeClassName,
} from "@/lib/format/labels";
import type { LabAccessoryKey } from "@/lib/lab/order-accessories";
import { LAB_ORDER_ACCESSORY_DEFS, parseAccessoriesJson } from "@/lib/lab/order-accessories";
import { LabToothPicker } from "@/components/modules/orders/lab-tooth-picker";
import { LabOrderPrintButton } from "@/components/shared/reports/lab-order-print-button";
import { DeliveryNotePrintButton } from "@/components/shared/reports/delivery-note-print-button";
import { cn } from "@/lib/utils/cn";
import { importLabOrdersFromExcel } from "@/lib/actions/lab-orders-import";
import { parseToothPositionsToSet, detectArchConnection } from "@/lib/dental/fdi-teeth";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  createLabOrder,
  deleteLabOrder,
  fetchLabOrderLinesForExport,
  getDailyDeliveryNotePayload,
  getLabOrder,
  getSuggestedLinePricing,
  listLabOrderFilterSuggestions,
  listLabOrders,
  updateLabOrder,
  updateLabOrderStatus,
  type LabOrderFilterSuggestions,
  type LabOrderRow,
} from "@/lib/actions/lab-orders";
import { listCashFundChannels } from "@/lib/actions/cash";
import {
  buildLabOrderListReportHtml,
} from "@/lib/reports/lab-order-list-html";
import { buildDeliveryNoteExcelAoa } from "@/lib/reports/delivery-note-excel";
import { buildPrintShell, openBlankPrintTab, writeAndPrintToWindow } from "@/lib/reports/print-html";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { decodeMultiFilter, encodeMultiFilter } from "@/lib/grid/multi-filter";

const DENTAL_SHADES = [
  "A1", "A2", "A3", "A3.5", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D2", "D3", "D4",
  "1M1", "1M2", "2M1", "2M2", "2M3", "3M1", "3M2", "3M3", "4M1", "4M2", "4M3", "5M1", "5M2", "5M3",
  "OM1", "OM2", "OM3",
];

function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

function CoordReviewStatusBadge({ status }: { status: string }) {
  const label = formatCoordReviewStatus(status);
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (status === "pending") {
    return <span className={cn(base, "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>{label}</span>;
  }
  if (status === "verified") {
    return <span className={cn(base, "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400")}>{label}</span>;
  }
  return <span>{label}</span>;
}

function LabOrderCategoryBadge({ category }: { category: string }) {
  const label = labOrderCategoryOptions.find((o) => o.value === category)?.label ?? category;
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (category === "new_work") {
    return <span className={cn(base, "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400")}>{label}</span>;
  }
  if (category === "warranty" || category === "repair") {
    return <span className={cn(base, "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>{label}</span>;
  }
  return <span>{label}</span>;
}

function fromDateTimeLocal(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function nextMorningDeliveryFromReceived(receivedAt: string): string | null {
  const base = receivedAt?.trim();
  if (!base) return null;
  const d = new Date(base + "T08:30:00");
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function emptyAccessoryQty(): Record<LabAccessoryKey, string> {
  return Object.fromEntries(LAB_ORDER_ACCESSORY_DEFS.map((d) => [d.key, ""])) as Record<
    LabAccessoryKey,
    string
  >;
}

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
  arch_connection: "unit" | "bridge";
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
    arch_connection: "unit",
    notes: "",
  };
}

function OrderFiltersPopover({
  filters,
  setFilters,
  partners,
  suggestions,
}: {
  filters: Record<string, string>;
  setFilters: (f: Record<string, string>) => void;
  partners: CustomerPartnerPickerRow[];
  suggestions: LabOrderFilterSuggestions;
}) {
  const [open, setOpen] = React.useState(false);
  const [clinicSearch, setClinicSearch] = React.useState("");
  const [patientSearch, setPatientSearch] = React.useState("");
  const activeCount = Object.keys(filters).filter((k) => !!filters[k]).length;

  const setFilter = (key: string, val: string) => {
    const next = { ...filters, [key]: val };
    if (!val) delete next[key];
    setFilters(next);
  };

  const selectedStatus = React.useMemo(() => new Set(decodeMultiFilter(filters["status"])), [filters]);
  const selectedClinic = React.useMemo(() => new Set(decodeMultiFilter(filters["clinic_name"])), [filters]);
  const selectedPatient = React.useMemo(() => new Set(decodeMultiFilter(filters["patient_name"])), [filters]);

  const toggleMulti = (key: string, current: Set<string>, value: string, checked: boolean) => {
    const next = new Set(current);
    if (checked) next.add(value);
    else next.delete(value);
    setFilter(key, encodeMultiFilter([...next]));
  };

  const clinicOptions = React.useMemo(() => {
    const q = clinicSearch.trim().toLowerCase();
    const base = suggestions.clinics;
    if (!q) return base.slice(0, 30);
    return base.filter((v) => v.toLowerCase().includes(q)).slice(0, 30);
  }, [clinicSearch, suggestions.clinics]);

  const patientOptions = React.useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    const base = suggestions.patients;
    if (!q) return base.slice(0, 30);
    return base.filter((v) => v.toLowerCase().includes(q)).slice(0, 30);
  }, [patientSearch, suggestions.patients]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="relative ring-1 ring-[color-mix(in_srgb,var(--primary)_28%,transparent)]"
        >
          {activeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] text-[var(--on-primary)] shadow-sm">
              {activeCount}
            </span>
          )}
          <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Bộ lọc đơn
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 p-4 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="grid gap-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">Thời gian nhận</Label>
            <p className="text-[10px] leading-snug text-[var(--on-surface-faint)]">
              Khoảng từ–đến ở đây; lọc đúng một ngày dùng ô lọc trên cột &quot;Ngày nhận&quot;.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-[var(--on-surface-faint)]">Từ ngày</span>
                <Input
                  type="date"
                  value={filters["received_from"] ?? ""}
                  onChange={(e) => setFilter("received_from", e.target.value)}
                  className="h-8 py-1 text-xs"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-[var(--on-surface-faint)]">Đến ngày</span>
                <Input
                  type="date"
                  value={filters["received_to"] ?? ""}
                  onChange={(e) => setFilter("received_to", e.target.value)}
                  className="h-8 py-1 text-xs"
                />
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">Khách hàng</Label>
            <Select
              value={filters["partner_id"] ?? ""}
              onChange={(e) => setFilter("partner_id", e.target.value)}
              className="h-9 text-xs"
            >
              <option value="">Tất cả khách hàng</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">Trạng thái</Label>
            <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-[var(--border-ghost)] bg-[var(--surface-card)] p-1.5">
              {labOrderStatusOptions.map((o) => (
                <label key={o.value} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-[var(--surface-muted)]">
                  <input
                    type="checkbox"
                    checked={selectedStatus.has(o.value)}
                    onChange={(e) => toggleMulti("status", selectedStatus, o.value, e.target.checked)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">Nha khoa / Bệnh nhân</Label>
            <div className="grid gap-2">
              <div className="space-y-1 rounded-md border border-[var(--border-ghost)] bg-[var(--surface-card)] p-1.5">
                <Input
                  placeholder="Gõ tìm nha khoa..."
                  value={clinicSearch}
                  onChange={(e) => setClinicSearch(e.target.value)}
                  className="h-8 py-1 text-xs"
                />
                <div className="max-h-28 space-y-1 overflow-y-auto">
                  {clinicOptions.map((name) => (
                    <label key={name} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-[var(--surface-muted)]">
                      <input
                        type="checkbox"
                        checked={selectedClinic.has(name)}
                        onChange={(e) => toggleMulti("clinic_name", selectedClinic, name, e.target.checked)}
                      />
                      <span className="truncate">{name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1 rounded-md border border-[var(--border-ghost)] bg-[var(--surface-card)] p-1.5">
                <Input
                  placeholder="Gõ tìm bệnh nhân..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="h-8 py-1 text-xs"
                />
                <div className="max-h-28 space-y-1 overflow-y-auto">
                  {patientOptions.map((name) => (
                    <label key={name} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-[var(--surface-muted)]">
                      <input
                        type="checkbox"
                        checked={selectedPatient.has(name)}
                        onChange={(e) => toggleMulti("patient_name", selectedPatient, name, e.target.checked)}
                      />
                      <span className="truncate">{name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="pt-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full h-8 text-[11px]"
              onClick={() => {
                setFilters({});
                setOpen(false);
              }}
            >
              Đặt lại mặc định
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OrdersPrintExportMenu({
  filters,
  globalSearch,
  partners,
  onOpenDailyDelivery,
}: {
  filters: Record<string, string>;
  globalSearch: string;
  partners: CustomerPartnerPickerRow[];
  onOpenDailyDelivery: () => void;
}) {
  const [busy, setBusy] = React.useState<null | "list-pdf" | "list-xlsx">(null);

  const printFilteredListPdf = async () => {
    setBusy("list-pdf");
    const win = openBlankPrintTab();
    if (!win) {
      setBusy(null);
      return;
    }
    try {
      const res = await listLabOrders({
        page: 1,
        pageSize: 5000,
        globalSearch,
        filters,
      });

      let filtersDesc = "Tất cả đơn hàng";
      const parts: string[] = [];
      if (filters["received_from"]) parts.push("Từ " + formatDate(filters["received_from"]));
      if (filters["received_to"]) parts.push("Đến " + formatDate(filters["received_to"]));
      if (parts.length) filtersDesc = "THÁNG / KỲ: " + parts.join(" — ");

      const partner = partners.find((p) => p.id === filters["partner_id"]);
      const customerHeader = partner
        ? {
            name: partner.name?.trim() || partner.code?.trim() || undefined,
            address: partner.address?.trim() || undefined,
            phone: partner.phone?.trim() || undefined,
            taxCode: partner.tax_id?.trim() || undefined,
          }
        : undefined;

      const html = buildLabOrderListReportHtml({
        filtersDesc,
        rows: res.rows,
        generatedAt: new Date().toLocaleString("vi-VN"),
        customerHeader,
      });

      writeAndPrintToWindow(win, buildPrintShell("Hoá đơn báo phí", html));
    } catch (e) {
      win.close();
      alert(e instanceof Error ? e.message : "Lỗi in danh sách");
    } finally {
      setBusy(null);
    }
  };

  const exportFilteredListExcel = async () => {
    setBusy("list-xlsx");
    try {
      const XLSX = await import("xlsx");
      const res = await listLabOrders({
        page: 1,
        pageSize: 5000,
        globalSearch,
        filters,
      });

      const linesByOrder = await fetchLabOrderLinesForExport(res.rows.map((r) => r.id));

      const productCell = (code: string | null, name: string | null) => {
        const c = code?.trim() ?? "";
        const n = name?.trim() ?? "";
        if (c && n) return `${c} — ${n}`;
        return c || n || "";
      };
      const lineDiscountCell = (pct: number, vnd: number) => {
        const out: string[] = [];
        if (pct > 0) out.push(`${pct}%`);
        if (vnd > 0) out.push(vnd.toLocaleString("vi-VN"));
        return out.join(" + ");
      };
      const lineNetUnitPrice = (qty: number, amount: number, fallbackUnitPrice: number) => {
        if (qty > 0) return amount / qty;
        return fallbackUnitPrice;
      };

      const aoa: (string | number | null)[][] = [
        [
          "STT",
          "Số đơn",
          "Mã KH",
          "Khách hàng",
          "Ngày nhận",
          "Bệnh nhân",
          "Nha khoa",
          "Số điện thoại",
          "Trạng thái",
          "Sản phẩm",
          "Vị trí răng",
          "Số lượng",
          "Đơn giá gốc",
          "CK dòng",
          "Đơn giá sau CK",
          "Thành tiền",
          "Cộng tiền hàng",
          "Phải thu",
          "Ghi chú",
        ],
      ];

      let stt = 0;
      for (const r of res.rows) {
        const lines = linesByOrder[r.id] ?? [];
        const base = [
          r.order_number,
          r.partner_code ?? "",
          r.partner_name ?? "",
          formatDate(r.received_at),
          r.patient_name,
          r.clinic_name ?? "",
          r.contact_phone ?? "",
          formatOrderStatus(r.status),
        ] as const;
        if (!lines.length) {
          stt += 1;
          aoa.push([
            stt,
            ...base,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            r.total_amount,
            r.grand_total,
            r.notes ?? "",
          ]);
        } else {
          for (const ln of lines) {
            stt += 1;
            aoa.push([
              stt,
              ...base,
              productCell(ln.product_code, ln.product_name),
              ln.tooth_positions,
              ln.quantity,
              ln.unit_price,
              lineDiscountCell(ln.discount_percent, ln.discount_amount),
              lineNetUnitPrice(ln.quantity, ln.line_amount, ln.unit_price),
              ln.line_amount,
              r.total_amount,
              r.grand_total,
              r.notes ?? "",
            ]);
          }
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DanhSachDonHang");
      XLSX.writeFile(wb, `DanhSachDonHang_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi xuất Excel");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          className="ring-1 ring-[color-mix(in_srgb,var(--primary)_28%,transparent)]"
          disabled={!!busy}
        >
          <svg className="mr-1.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          {busy === "list-pdf" ? "Đang in…" : busy === "list-xlsx" ? "Đang xuất…" : "In / xuất"}
          <svg className="ml-1 h-3.5 w-3.5 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[15rem]">
        <DropdownMenuItem disabled={!!busy} onSelect={() => void printFilteredListPdf()}>
          In danh sách (PDF)
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!!busy} onSelect={() => void exportFilteredListExcel()}>
          Xuất danh sách (Excel)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!!busy}
          onSelect={() => {
            onOpenDailyDelivery();
          }}
        >
          Phiếu giao theo ngày (PDF hoặc Excel)…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  const [partners, setPartners] = React.useState<CustomerPartnerPickerRow[]>([]);
  const [filterSuggestions, setFilterSuggestions] = React.useState<LabOrderFilterSuggestions>({
    clinics: [],
    patients: [],
  });
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
  const [contactPhone, setContactPhone] = React.useState("");
  const [status, setStatus] = React.useState<LabOrderRow["status"]>("delivered");
  const [notes, setNotes] = React.useState("");
  const [orderCategory, setOrderCategory] = React.useState<
    "new_work" | "warranty" | "repair"
  >("new_work");
  const [patientYearOfBirth, setPatientYearOfBirth] = React.useState("");
  const [patientGender, setPatientGender] = React.useState<"" | "male" | "female" | "unspecified">(
    "",
  );
  const [dueCompletionLocal, setDueCompletionLocal] = React.useState("");
  const [dueDeliveryLocal, setDueDeliveryLocal] = React.useState("");
  const [clinicalIndication, setClinicalIndication] = React.useState("");
  const [marginAbove, setMarginAbove] = React.useState(false);
  const [marginAt, setMarginAt] = React.useState(false);
  const [marginSub, setMarginSub] = React.useState(false);
  const [marginShoulder, setMarginShoulder] = React.useState(false);
  const [notesAccounting, setNotesAccounting] = React.useState("");
  const [notesCoordination, setNotesCoordination] = React.useState("");
  const [accessoryQty, setAccessoryQty] = React.useState<Record<LabAccessoryKey, string>>(
    emptyAccessoryQty,
  );
  const [draftLines, setDraftLines] = React.useState<DraftLine[]>([newDraftLine()]);
  const fileImportRef = React.useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = React.useState(false);
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [quickRow, setQuickRow] = React.useState<LabOrderRow | null>(null);
  const [quickStatus, setQuickStatus] = React.useState<LabOrderRow["status"]>("draft");
  const [quickPending, setQuickPending] = React.useState(false);
  const [quickErr, setQuickErr] = React.useState<string | null>(null);
  const [deliveryOpen, setDeliveryOpen] = React.useState(false);
  const [deliveryPartnerId, setDeliveryPartnerId] = React.useState("");
  const [deliveryPartnerSearch, setDeliveryPartnerSearch] = React.useState("");
  const [deliveryDate, setDeliveryDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [deliveryExcelBusy, setDeliveryExcelBusy] = React.useState(false);

  const [payNow, setPayNow] = React.useState(false);
  const [payChannel, setPayChannel] = React.useState("cash");
  const [payAmount, setPayAmount] = React.useState("");
  const [payChannels, setPayChannels] = React.useState<{ value: string; label: string }[]>([]);

  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [globalSearch, setGlobalSearch] = React.useState("");
  const [mainTab, setMainTab] = React.useState<"list" | "prints">("list");
  const [selectedOrderIds, setSelectedOrderIds] = React.useState<Set<string>>(new Set());

  const deliveryPartnerOptions = React.useMemo(
    () => partners.map((p) => ({ id: p.id, label: `${p.code} — ${p.name}` })),
    [partners],
  );
  const deliveryPartnerLabelById = React.useMemo(
    () => new Map(deliveryPartnerOptions.map((o) => [o.id, o.label])),
    [deliveryPartnerOptions],
  );
  const filteredDeliveryPartners = React.useMemo(() => {
    const q = deliveryPartnerSearch.trim().toLowerCase();
    if (!q) return deliveryPartnerOptions;
    return deliveryPartnerOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [deliveryPartnerOptions, deliveryPartnerSearch]);

  React.useEffect(() => {
    void listCustomerPartnerPicker().then(setPartners).catch(() => {});
    void listProductPicker({ forSales: true }).then(setProducts).catch(() => {});
    void listLabOrderFilterSuggestions().then(setFilterSuggestions).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!open || editing) return;
    void listCashFundChannels()
      .then((rows) => {
        setPayChannels(rows);
        setPayChannel((prev) => {
          if (prev && rows.some((r) => r.value === prev)) return prev;
          return rows.find((r) => r.value === "cash")?.value ?? rows[0]?.value ?? "cash";
        });
      })
      .catch(() => {});
  }, [open, editing]);

  const hydrateDraftPrices = React.useCallback(async (key: string, productIdFor: string) => {
    if (!partnerId.trim() || !productIdFor) return;
    try {
      const s = await getSuggestedLinePricing(partnerId, productIdFor);
      setDraftLines((prev) =>
        prev.map((l) =>
          l.key === key
            ? { ...l, price: String(s.unit_price), disc: String(s.discount_percent) }
            : l,
        ),
      );
    } catch {
      /* ignore */
    }
  }, [partnerId]);

  const resetProductionFields = React.useCallback(() => {
    setOrderCategory("new_work");
    setPatientYearOfBirth("");
    setPatientGender("");
    setDueCompletionLocal("");
    setDueDeliveryLocal("");
    setClinicalIndication("");
    setMarginAbove(false);
    setMarginAt(false);
    setMarginSub(false);
    setMarginShoulder(false);
    setNotesAccounting("");
    setNotesCoordination("");
    setAccessoryQty(emptyAccessoryQty());
  }, []);

  const reset = () => {
    setEditing(null);
    setOrderNumber("");
    setReceivedAt(new Date().toISOString().slice(0, 10));
    setPartnerId(partners[0]?.id ?? "");
    setClinicName("");
    setPatientName("");
    setContactPhone("");
    setStatus("delivered");
    setNotes("");
    resetProductionFields();
    setDraftLines([newDraftLine()]);
    setErr(null);
    setPayNow(false);
    setPayAmount("");
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };
  const exportDailyDeliveryExcel = React.useCallback(async () => {
    if (!deliveryPartnerId?.trim() || !deliveryDate?.trim()) return;
    setDeliveryExcelBusy(true);
    try {
      const payload = await getDailyDeliveryNotePayload(deliveryPartnerId, deliveryDate);
      if (!payload.orders.length) {
        alert("Không có đơn hàng của lab này trong ngày đã chọn.");
        return;
      }
      const XLSX = await import("xlsx");
      const aoa = buildDeliveryNoteExcelAoa(payload);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PhieuGiao");
      const slug = `${payload.partner_code ?? "giao"}_${payload.delivery_date}`.replace(/[^\w.-]+/g, "_");
      XLSX.writeFile(wb, `PhieuGiaoNgay_${slug}.xlsx`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi xuất Excel phiếu giao");
    } finally {
      setDeliveryExcelBusy(false);
    }
  }, [deliveryPartnerId, deliveryDate]);

  const openDeliveryPrint = React.useCallback(() => {
    setDeliveryPartnerId(partners[0]?.id ?? "");
    setDeliveryDate(new Date().toISOString().slice(0, 10));
    setDeliveryOpen(true);
  }, [partners]);

  const openEdit = (row: LabOrderRow) => {
    setEditing(row);
    setOrderNumber(row.order_number);
    setReceivedAt(row.received_at);
    setPartnerId(row.partner_id);
    setClinicName(row.clinic_name ?? "");
    setPatientName(row.patient_name);
    setContactPhone(row.contact_phone ?? "");
    setStatus(row.status);
    setNotes(row.notes ?? "");
    resetProductionFields();
    setErr(null);
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open || !editing?.id) return;
    let cancelled = false;
    void getLabOrder(editing.id)
      .then((full) => {
        if (cancelled) return;
        const r = full as Record<string, unknown>;
        const cat = r["order_category"] as string | undefined;
        setOrderCategory(
          cat === "warranty" || cat === "repair" || cat === "new_work" ? cat : "new_work",
        );
        const pyob = r["patient_year_of_birth"];
        setPatientYearOfBirth(pyob === null || pyob === undefined ? "" : String(pyob));
        const pg = r["patient_gender"] as string | null | undefined;
        setPatientGender(
          pg === "male" || pg === "female" || pg === "unspecified" ? pg : "",
        );
        setDueCompletionLocal(toDateTimeLocal(r["due_completion_at"] as string | null));
        setDueDeliveryLocal(toDateTimeLocal(r["due_delivery_at"] as string | null));
        setClinicalIndication(String(r["clinical_indication"] ?? ""));
        setMarginAbove(Boolean(r["margin_above_gingiva"]));
        setMarginAt(Boolean(r["margin_at_gingiva"]));
        setMarginSub(Boolean(r["margin_subgingival"]));
        setMarginShoulder(Boolean(r["margin_shoulder"]));
        setNotesAccounting(String(r["notes_accounting"] ?? ""));
        setNotesCoordination(String(r["notes_coordination"] ?? ""));
        const acc = parseAccessoriesJson(r["accessories"]);
        setAccessoryQty(
          Object.fromEntries(
            LAB_ORDER_ACCESSORY_DEFS.map((d) => [d.key, acc[d.key] ? String(acc[d.key]) : ""]),
          ) as Record<LabAccessoryKey, string>,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, editing?.id]);

  const buildProductionHeader = React.useCallback(() => {
    const acc: Record<string, number> = {};
    for (const d of LAB_ORDER_ACCESSORY_DEFS) {
      const n = Number(accessoryQty[d.key]);
      if (Number.isFinite(n) && n > 0) acc[d.key] = Math.floor(n);
    }
    let patient_year_of_birth: number | null | undefined = undefined;
    if (patientYearOfBirth.trim() !== "") {
      const y = Number.parseInt(patientYearOfBirth.trim(), 10);
      patient_year_of_birth = Number.isNaN(y) ? null : y;
    }
    // Tự động set ngày hẹn giao = 8h30 sáng ngày nhận + 1 ngày
    let due_delivery_at: string | null = null;
    if (receivedAt) {
      const d = new Date(receivedAt + "T08:30:00");
      if (!Number.isNaN(d.getTime())) {
        d.setDate(d.getDate() + 1);
        due_delivery_at = d.toISOString();
      }
    }
    return {
      order_category: orderCategory,
      patient_year_of_birth,
      patient_gender: patientGender === "" ? null : patientGender,
      due_completion_at: fromDateTimeLocal(dueCompletionLocal),
      due_delivery_at: due_delivery_at,
      clinical_indication: clinicalIndication.trim() || null,
      margin_above_gingiva: marginAbove,
      margin_at_gingiva: marginAt,
      margin_subgingival: marginSub,
      margin_shoulder: marginShoulder,
      notes_accounting: notesAccounting.trim() || null,
      notes_coordination: notesCoordination.trim() || null,
      accessories: Object.keys(acc).length ? acc : undefined,
    };
  }, [
    orderCategory,
    patientYearOfBirth,
    patientGender,
    dueCompletionLocal,
    dueDeliveryLocal,
    clinicalIndication,
    marginAbove,
    marginAt,
    marginSub,
    marginShoulder,
    notesAccounting,
    notesCoordination,
    accessoryQty,
  ]);

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
          contact_phone: contactPhone.trim() || null,
          notes: notes.trim() || null,
          status,
          ...buildProductionHeader(),
        };
        if (base.patient_year_of_birth === null && patientYearOfBirth.trim() !== "") {
          setErr("Năm sinh bệnh nhân không hợp lệ.");
          setPending(false);
          return;
        }
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
        const ph = buildProductionHeader();
        if (ph.patient_year_of_birth === null && patientYearOfBirth.trim() !== "") {
          setErr("Năm sinh bệnh nhân không hợp lệ.");
          setPending(false);
          return;
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
            arch_connection: l.arch_connection,
            notes: l.notes.trim() || null,
          }));
        const autoPaymentArg = payNow
          ? {
              payment_channel: payChannel.trim() || "cash",
              transaction_date: receivedAt,
              amount:
                payAmount.trim() === ""
                  ? undefined
                  : Number(payAmount.replace(/\./g, "").replace(/,/g, ".")) || undefined,
            }
          : null;
        const result = await createLabOrder(
          {
            received_at: receivedAt,
            partner_id: partnerId,
            patient_name: patientName.trim(),
            clinic_name: clinicName.trim() || null,
            contact_phone: contactPhone.trim() || null,
            status,
            notes: notes.trim() || null,
            ...ph,
          },
          linesPayload,
          autoPaymentArg,
        );
        const { id } = result;
        if (payNow && result.autoPayment && !result.autoPayment.ok) {
          alert(
            "Đơn đã tạo nhưng không tạo được phiếu thu: " +
              (result.autoPayment.message ?? "Lỗi không xác định") +
              "\nVui lòng tạo phiếu thu thủ công ở Sổ quỹ.",
          );
        }
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

  const toggleSelectOrder = React.useCallback((id: string, checked: boolean) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const clearSelectedOrders = React.useCallback(() => {
    setSelectedOrderIds(new Set());
  }, []);

  const deleteSelectedOrders = React.useCallback(async () => {
    const ids = [...selectedOrderIds];
    if (!ids.length) return;
    if (!confirm(`Xóa ${ids.length} đơn đã chọn? (xóa cả dòng chi tiết)`)) return;
    try {
      for (const id of ids) {
        await deleteLabOrder(id);
      }
      clearSelectedOrders();
      bumpGrid();
      alert(`Đã xóa ${ids.length} đơn.`);
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Không xóa được hàng loạt");
    }
  }, [selectedOrderIds, clearSelectedOrders, bumpGrid]);

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
        id: "bulk_tick",
        header: "Tick xóa",
        size: 70,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={"Chọn đơn " + row.original.order_number}
            checked={selectedOrderIds.has(row.original.id)}
            onChange={(e) => toggleSelectOrder(row.original.id, e.target.checked)}
          />
        ),
      },
      {
        accessorKey: "order_number",
        header: "Số đơn",
        size: 200,
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
        accessorKey: "partner_code",
        header: "Mã KH",
        size: 100,
        meta: { filterKey: "partner_code", filterType: "text" },
      },
      {
        accessorKey: "partner_name",
        header: "Khách hàng",
        size: 180,
        meta: { filterKey: "partner_name", filterType: "text" },
      },
      {
        accessorKey: "received_at",
        header: "Ngày nhận",
        size: 160,
        meta: { filterKey: "received_day", filterType: "date" },
        cell: ({ row }) => formatDate(row.original.received_at),
      },
      {
        id: "received_to",
        header: "Thời gian hẹn",
        cell: ({ row }) => {
          const explicitDue = (row.original as unknown as { due_delivery_at?: string | null }).due_delivery_at;
          const due = explicitDue ?? nextMorningDeliveryFromReceived(row.original.received_at);
          return formatDateTime(due);
        },
      },
      { accessorKey: "clinic_name", header: "Nha khoa", size: 180, meta: { filterKey: "clinic_name", filterType: "text" } },
      { accessorKey: "patient_name", header: "Bệnh nhân", size: 150, meta: { filterKey: "patient_name", filterType: "text" } },
      {
        accessorKey: "coord_review_status",
        header: "Đối chiếu",
        size: 120,
        meta: {
          filterKey: "coord_review_status",
          filterType: "select",
          filterOptions: [...coordReviewStatusOptions],
          renderFilterOption: (o: { value: string; label: string }) => (
            <div className="flex items-center gap-2">
              <span className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                o.value === "pending" ? "bg-red-500" : o.value === "verified" ? "bg-green-500" : "bg-slate-300"
              )} />
              <span className={cn(
                "font-medium",
                o.value === "pending" ? "text-red-600" : o.value === "verified" ? "text-green-600" : ""
              )}>{o.label}</span>
            </div>
          ),
        },
        cell: ({ getValue }) => <CoordReviewStatusBadge status={String(getValue())} />,
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
      { accessorKey: "contact_phone", header: "SĐT", meta: { filterKey: "contact_phone", filterType: "text" } },
      {
        accessorKey: "order_category",
        header: "Loại đơn",
        size: 100,
        meta: {
          filterKey: "order_category",
          filterType: "select",
          filterOptions: [...labOrderCategoryOptions],
          renderFilterOption: (o: { value: string; label: string }) => (
            <div className="flex items-center gap-2">
              <span className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                o.value === "new_work" ? "bg-green-500" : "bg-red-500"
              )} />
              <span className={cn(
                "font-medium",
                o.value === "new_work" ? "text-green-600" : "text-red-600"
              )}>{o.label}</span>
            </div>
          ),
        },
        cell: ({ getValue }) => <LabOrderCategoryBadge category={String(getValue())} />,
      },
      {
        accessorKey: "patient_year_of_birth",
        header: "Năm sinh",
        size: 90,
        cell: ({ getValue }) => getValue() ?? "—",
      },
      {
        accessorKey: "patient_gender",
        header: "Phái",
        size: 80,
        cell: ({ getValue }) => formatPatientGender(String(getValue() ?? "")),
      },
      {
        accessorKey: "products_summary",
        header: "Sản phẩm",
        size: 240,
        meta: { filterType: "none" },
        cell: ({ getValue }) => {
          const s = getValue() as string | null | undefined;
          return s?.trim() ? (
            <span className="line-clamp-2 text-[13px] leading-snug" title={s}>
              {s}
            </span>
          ) : (
            "—"
          );
        },
      },
      {
        id: "avg_unit_price",
        header: "Đơn giá TB",
        size: 110,
        meta: { filterType: "none" },
        cell: ({ row }) => {
          const r = row.original;
          const sub = r.total_amount;
          const q = r.line_quantity_total && r.line_quantity_total > 0 ? r.line_quantity_total : null;
          const teeth = r.tooth_count_total && r.tooth_count_total > 0 ? r.tooth_count_total : null;
          const div = q ?? teeth;
          if (div == null || div <= 0 || !Number.isFinite(sub) || sub <= 0) {
            return <span className="text-right text-[var(--on-surface-muted)]">—</span>;
          }
          const avg = sub / div;
          const basis = q != null ? "theo SL dòng" : "theo SL răng";
          return (
            <div
              className="text-right tabular-nums text-[13px]"
              title={`Trung bình ${basis}: cộng tiền hàng ÷ ${div}`}
            >
              {Math.round(avg).toLocaleString("vi-VN")}
            </div>
          );
        },
      },
      {
        accessorKey: "total_amount",
        header: "Cộng tiền hàng",
        size: 130,
        meta: { filterType: "none" },
        cell: ({ getValue }) => (
          <div
            className="text-right font-semibold tabular-nums"
            title="Tổng thành tiền các dòng SP (trước chiết khấu %, CK VNĐ và phí khác)"
          >
            {Number(getValue() ?? 0).toLocaleString("vi-VN")}
          </div>
        ),
      },
      {
        accessorKey: "grand_total",
        header: "Phải thu",
        size: 120,
        meta: { filterType: "none" },
        cell: ({ getValue }) => (
          <div
            className="text-right font-bold text-[color-mix(in_srgb,var(--primary)_60%,var(--on-surface))] tabular-nums"
            title="Số tiền sau CK đơn và phí khác (công thức GBTT)"
          >
            {Number(getValue() ?? 0).toLocaleString("vi-VN")}
          </div>
        ),
      },
      { accessorKey: "tooth_positions_summary", header: "Răng", size: 140 },
      { accessorKey: "tooth_count_total", header: "SL Răng", size: 90, cell: ({ getValue }) => getValue() ?? "—" },
      { accessorKey: "notes", header: "Ghi chú", size: 200 },
      {
        accessorKey: "payment_notice_doc_number",
        header: "GBTT",
        size: 120,
        cell: ({ getValue }) => (getValue() ? String(getValue()) : "—"),
      },
      {
        accessorKey: "payment_notice_issued_at",
        header: "GBTT lúc",
        size: 160,
        cell: ({ getValue }) => (getValue() ? formatDateTime(String(getValue())) : "—"),
      },
      {
        accessorKey: "created_at",
        header: "Tạo lúc",
        size: 160,
        cell: ({ getValue }) => formatDateTime(String(getValue())),
      },
      {
        accessorKey: "updated_at",
        header: "Cập nhật",
        size: 160,
        cell: ({ getValue }) => formatDateTime(String(getValue())),
      },
      {
        id: "actions",
        header: "Thao tác",
        size: 120,
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            <DropdownMenuItem asChild>
              <LabOrderPrintButton
                orderId={row.original.id}
                label="PDF"
                variant="ghost"
                className={dataGridPrintMenuItemButtonClassName}
              />
            </DropdownMenuItem>
            <DataGridMenuEditItem onSelect={() => openEdit(row.original)}>Sửa</DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => void onDelete(row.original)}>Xóa</DataGridMenuDeleteItem>
            <DataGridMenuLinkItem href={"/orders/" + row.original.id}>Dòng SP</DataGridMenuLinkItem>
          </>
        ),
      },
    ],
    [openQuickStatus, selectedOrderIds, toggleSelectOrder],
  );

  React.useEffect(() => {
    clearSelectedOrders();
  }, [gridReload, clearSelectedOrders]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-ghost)] pb-3">
        <Button
          type="button"
          variant={mainTab === "list" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMainTab("list")}
        >
          Danh sách đơn
        </Button>
        <Button
          type="button"
          variant={mainTab === "prints" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMainTab("prints")}
        >
          In phiếu (GBTT &amp; giao hàng)
        </Button>
      </div>
      {mainTab === "list" ? (
      <ExcelDataGrid<LabOrderRow>
        moduleId="lab_orders"
        title="Đơn hàng phục hình"
        columns={columns}
        list={listLabOrders}
        reloadSignal={gridReload}
        filters={filters}
        onFiltersChange={setFilters}
        globalSearch={globalSearch}
        onGlobalSearchChange={setGlobalSearch}
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
            <OrderFiltersPopover
              filters={filters}
              setFilters={setFilters}
              partners={partners}
              suggestions={filterSuggestions}
            />
            <OrdersPrintExportMenu
              filters={filters}
              globalSearch={globalSearch}
              partners={partners}
              onOpenDailyDelivery={openDeliveryPrint}
            />
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={selectedOrderIds.size === 0}
              onClick={() => void deleteSelectedOrders()}
            >
              {selectedOrderIds.size > 0 ? `Xóa đã chọn (${selectedOrderIds.size})` : "Xóa đã chọn"}
            </Button>
            <Button variant="primary" size="sm" type="button" onClick={openCreate}>
              Thêm đơn
            </Button>
          </>
        }
        getRowId={(r) => r.id}
      />
      ) : (
        <OrdersPrintHub partners={partners} />
      )}
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
                  Tự động theo mã KH + ngày (MãKH-YYMMDD-xxx) khi bấm Lưu
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
              <Label htmlFor="lo-phone">Số điện thoại</Label>
              <Input
                id="lo-phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Số điện thoại liên hệ"
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

            <div className="space-y-4 border-t border-[var(--border-ghost)] pt-4 sm:col-span-2">
              <p className="text-sm font-semibold text-[var(--on-surface)]">Thông tin bệnh nhân</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="lo-cat">Loại hàng</Label>
                  <Select
                    id="lo-cat"
                    value={orderCategory}
                    onChange={(e) =>
                      setOrderCategory(e.target.value as "new_work" | "warranty" | "repair")
                    }
                  >
                    {labOrderCategoryOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lo-gender">Giới tính (bệnh nhân)</Label>
                  <Select
                    id="lo-gender"
                    value={patientGender}
                    onChange={(e) =>
                      setPatientGender(e.target.value as "" | "male" | "female" | "unspecified")
                    }
                  >
                    <option value="">—</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="unspecified">Không ghi</option>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lo-yob">Năm sinh</Label>
                  <Input
                    id="lo-yob"
                    type="number"
                    min={1900}
                    max={new Date().getFullYear()}
                    step={1}
                    value={patientYearOfBirth}
                    onChange={(e) => setPatientYearOfBirth(e.target.value)}
                    placeholder="Tuỳ chọn"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lo-due-done">Hẹn hoàn thành</Label>
                  <Input
                    id="lo-due-done"
                    type="datetime-local"
                    value={dueCompletionLocal}
                    onChange={(e) => setDueCompletionLocal(e.target.value)}
                  />
                  <p className="text-[11px] text-[var(--on-surface-faint)]">
                    Ngày hẹn giao sẽ được tự động thiết lập là 8:30 sáng của ngày hôm sau ngày nhận đơn.
                  </p>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="lo-ind">Chỉ định lâm sàng</Label>
                  <Textarea
                    id="lo-ind"
                    value={clinicalIndication}
                    onChange={(e) => setClinicalIndication(e.target.value)}
                    rows={3}
                    placeholder="Mô tả chỉ định cho lab…"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Viền margin</Label>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={marginAbove}
                        onChange={(e) => setMarginAbove(e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--border-ghost)]"
                      />
                      Trên nướu
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={marginAt}
                        onChange={(e) => setMarginAt(e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--border-ghost)]"
                      />
                      Ngang nướu
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={marginSub}
                        onChange={(e) => setMarginSub(e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--border-ghost)]"
                      />
                      Dưới nướu
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={marginShoulder}
                        onChange={(e) => setMarginShoulder(e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--border-ghost)]"
                      />
                      Bờ vai
                    </label>
                  </div>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="lo-note-acc">Ghi chú cho kế toán</Label>
                  <Textarea
                    id="lo-note-acc"
                    value={notesAccounting}
                    onChange={(e) => setNotesAccounting(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="lo-note-coord">Ghi chú cho điều phối</Label>
                  <Textarea
                    id="lo-note-coord"
                    value={notesCoordination}
                    onChange={(e) => setNotesCoordination(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Phụ kiện kèm</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {LAB_ORDER_ACCESSORY_DEFS.map((d) => (
                      <div key={d.key} className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 text-sm">{d.label}</span>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="w-20"
                          value={accessoryQty[d.key]}
                          onChange={(e) =>
                            setAccessoryQty((prev) => ({ ...prev, [d.key]: e.target.value }))
                          }
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
                      <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                        <Label>Vị trí răng (FDI)</Label>
                        <LabToothPicker
                          value={line.tooth_positions}
                          onChange={(v) => {
                            const teethSet = parseToothPositionsToSet(v);
                            const c = teethSet.size;
                            const cs = c > 0 ? String(c) : "";
                            const archConn = detectArchConnection(teethSet);
                            setDraftLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? { ...l, tooth_positions: v, tooth_count: cs, qty: cs || "1", arch_connection: archConn }
                                  : l,
                              ),
                            );
                          }}
                        />
                        <Input
                          className="mt-1 font-mono text-xs"
                          value={line.tooth_positions}
                          onChange={(e) => {
                            const v = e.target.value;
                            const teethSet = parseToothPositionsToSet(v);
                            const c = teethSet.size;
                            const cs = c > 0 ? String(c) : "";
                            const archConn = detectArchConnection(teethSet);
                            setDraftLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? { ...l, tooth_positions: v, tooth_count: cs, qty: cs || "1", arch_connection: archConn }
                                  : l,
                              ),
                            );
                          }}
                          placeholder="Hoặc nhập tay: 11, 21, 36"
                        />
                        <p className="text-[11px] text-[var(--on-surface-muted)]">
                          Tự động phát hiện: <strong className="text-[var(--on-surface)]">
                            {line.arch_connection === "bridge" ? "Cầu răng" : "Răng rời"}
                          </strong>
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <Label>Màu sắc</Label>
                        <Combobox
                          options={DENTAL_SHADES}
                          value={line.shade}
                          onChange={(v) =>
                            setDraftLines((prev) =>
                              prev.map((l) => (l.key === line.key ? { ...l, shade: v } : l)),
                            )
                          }
                          placeholder="Chọn/Nhập màu…"
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
                          placeholder="Tự động"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Loại (làm mới / bảo hành)</Label>
                        <Select
                          value={line.work_type}
                          onChange={(e) => {
                            const newWorkType = e.target.value as DraftLine["work_type"];
                            setDraftLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? { 
                                      ...l, 
                                      work_type: newWorkType,
                                      price: newWorkType === "warranty" ? "0" : l.price,
                                      disc: newWorkType === "warranty" ? "0" : l.disc,
                                      disc_vnd: newWorkType === "warranty" ? "0" : l.disc_vnd,
                                    }
                                  : l,
                              ),
                            );
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
                        <Label>Đơn giá</Label>
                        <CurrencyInput
                          value={line.price}
                          onChange={(val) =>
                            setDraftLines((prev) =>
                              prev.map((l) => (l.key === line.key ? { ...l, price: val } : l)),
                            )
                          }
                          allowDecimal={false}
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
                        <CurrencyInput
                          value={line.disc_vnd}
                          onChange={(val) =>
                            setDraftLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key ? { ...l, disc_vnd: val } : l,
                              ),
                            )
                          }
                          allowDecimal={false}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!editing ? (
              <div className="space-y-3 border-t border-[var(--border-ghost)] pt-4 sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--on-surface)]">
                  <input
                    type="checkbox"
                    checked={payNow}
                    onChange={(e) => setPayNow(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border-ghost)]"
                  />
                  Thanh toán ngay (tự động tạo phiếu thu khớp đơn)
                </label>
                {payNow ? (
                  <div className="grid gap-3 rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="lo-pay-channel">Kênh thanh toán</Label>
                      <Select
                        id="lo-pay-channel"
                        value={payChannel}
                        onChange={(e) => setPayChannel(e.target.value)}
                      >
                        {payChannels.length === 0 ? (
                          <option value="cash">Tiền mặt</option>
                        ) : (
                          payChannels.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))
                        )}
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="lo-pay-amount">Số tiền (để trống = tổng tiền hàng)</Label>
                      <CurrencyInput
                        value={payAmount}
                        onChange={setPayAmount}
                        allowDecimal={false}
                      />
                      <p className="text-[11px] text-[var(--on-surface-muted)]">
                        Phiếu thu (PT) sẽ được sinh tự động và liên kết tới đơn vừa tạo.
                      </p>
                    </div>
                  </div>
                ) : null}
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
      <Dialog open={deliveryOpen} onOpenChange={setDeliveryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>In phiếu giao hàng theo ngày hẹn</DialogTitle>
            <DialogDescription>
              Gộp nhiều đơn / nhiều bệnh nhân của cùng một lab trong ngày thành một phiếu giao.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="dg-partner">Lab / Khách hàng</Label>
              <Input
                value={deliveryPartnerSearch}
                onChange={(e) => setDeliveryPartnerSearch(e.target.value)}
                placeholder="Gõ để tìm lab..."
              />
              <Select
                id="dg-partner"
                value={deliveryPartnerId}
                onChange={(e) => setDeliveryPartnerId(e.target.value)}
              >
                <option value="">Chọn lab…</option>
                {filteredDeliveryPartners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
              <p className="text-[11px] text-[var(--on-surface-muted)]">
                {deliveryPartnerId ? `Đã chọn: ${deliveryPartnerLabelById.get(deliveryPartnerId) ?? ""}` : "Chưa chọn lab hợp lệ"}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dg-date">Ngày hẹn</Label>
              <Input
                id="dg-date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={
                  deliveryExcelBusy || !deliveryPartnerId.trim() || !deliveryDate.trim()
                }
                onClick={() => void exportDailyDeliveryExcel()}
              >
                {deliveryExcelBusy ? "Đang xuất…" : "Xuất Excel giao ngày"}
              </Button>
              <DeliveryNotePrintButton partnerId={deliveryPartnerId} deliveryDate={deliveryDate} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
