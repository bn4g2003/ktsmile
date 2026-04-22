"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  buildBatchPaymentNoticePrintDocument,
  buildMonthlyGbttExcelAoa,
  buildSingleGbttExcelAoa,
  getPaymentNoticePrintPayload,
} from "@/lib/actions/billing";
import {
  findLabOrderIdByOrderNumber,
  getMonthlyDeliveryNotePayload,
  getSingleOrderDeliveryNotePayload,
} from "@/lib/actions/lab-orders";
import { buildPrintShell, openBlankPrintTab, writeAndPrintToWindow } from "@/lib/reports/print-html";
import { buildDeliveryNoteBodyHtml, deliveryNotePrintTitle } from "@/lib/reports/delivery-note-html";
import { buildPaymentNoticeBodyHtml, paymentNoticePrintTitle } from "@/lib/reports/payment-notice-html";
import { buildDeliveryNoteExcelAoa } from "@/lib/reports/delivery-note-excel";

type Partner = { id: string; code: string; name: string };

function monthYearDefaults() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function OrdersPrintHub({ partners }: { partners: Partner[] }) {
  const def = monthYearDefaults();
  const [gbttYear, setGbttYear] = React.useState(String(def.year));
  const [gbttMonth, setGbttMonth] = React.useState(String(def.month));
  const [gbttPartnerId, setGbttPartnerId] = React.useState("");
  const [gbttBusy, setGbttBusy] = React.useState(false);

  const [shipYear, setShipYear] = React.useState(String(def.year));
  const [shipMonth, setShipMonth] = React.useState(String(def.month));
  const [shipPartnerId, setShipPartnerId] = React.useState("");
  const [shipBusy, setShipBusy] = React.useState(false);

  const [orderCode, setOrderCode] = React.useState("");
  const [oneGbttBusy, setOneGbttBusy] = React.useState(false);
  const [oneShipBusy, setOneShipBusy] = React.useState(false);

  const years = React.useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(y - 2 + i));
  }, []);

  const writeXlsx = async (aoa: (string | number | null)[][], sheetName: string, fileName: string) => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
  };

  const exportMonthlyGbttExcel = async () => {
    const y = Number(gbttYear);
    const m = Number(gbttMonth);
    setGbttBusy(true);
    try {
      const aoa = await buildMonthlyGbttExcelAoa(y, m, gbttPartnerId.trim() || null);
      await writeXlsx(aoa, "GBTT", `GBTT_thang_${m}_${y}.xlsx`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không xuất được Excel.");
    } finally {
      setGbttBusy(false);
    }
  };

  const printMonthlyGbtt = async () => {
    const y = Number(gbttYear);
    const m = Number(gbttMonth);
    setGbttBusy(true);
    const win = openBlankPrintTab();
    if (!win) {
      setGbttBusy(false);
      return;
    }
    try {
      const { title, innerHtml, count } = await buildBatchPaymentNoticePrintDocument(
        y,
        m,
        gbttPartnerId.trim() || null,
      );
      writeAndPrintToWindow(
        win,
        buildPrintShell(`${title} (${count} đơn)`, innerHtml),
      );
    } catch (e) {
      win.close();
      window.alert(e instanceof Error ? e.message : "Không in được.");
    } finally {
      setGbttBusy(false);
    }
  };

  const printMonthlyDelivery = async () => {
    if (!shipPartnerId.trim()) {
      window.alert("Chọn lab / khách hàng.");
      return;
    }
    const y = Number(shipYear);
    const m = Number(shipMonth);
    setShipBusy(true);
    const win = openBlankPrintTab();
    if (!win) {
      setShipBusy(false);
      return;
    }
    try {
      const payload = await getMonthlyDeliveryNotePayload(shipPartnerId.trim(), y, m);
      if (!payload.orders.length) {
        win.close();
        window.alert("Không có đơn nào của lab này trong tháng đã chọn (theo ngày nhận).");
        return;
      }
      const title = deliveryNotePrintTitle(payload);
      writeAndPrintToWindow(win, buildPrintShell(title, buildDeliveryNoteBodyHtml(payload)));
    } catch (e) {
      win.close();
      window.alert(e instanceof Error ? e.message : "Không in được phiếu giao.");
    } finally {
      setShipBusy(false);
    }
  };

  const exportMonthlyDeliveryExcel = async () => {
    if (!shipPartnerId.trim()) {
      window.alert("Chọn lab / khách hàng.");
      return;
    }
    const y = Number(shipYear);
    const m = Number(shipMonth);
    setShipBusy(true);
    try {
      const payload = await getMonthlyDeliveryNotePayload(shipPartnerId.trim(), y, m);
      if (!payload.orders.length) {
        window.alert("Không có đơn nào của lab này trong tháng đã chọn (theo ngày nhận).");
        return;
      }
      const aoa = buildDeliveryNoteExcelAoa(payload);
      const slug = `${payload.partner_code ?? "giao"}_thang${m}_${y}`.replace(/[^\w.-]+/g, "_");
      await writeXlsx(aoa, "PhieuGiao", `PhieuGiaoThang_${slug}.xlsx`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không xuất được Excel.");
    } finally {
      setShipBusy(false);
    }
  };

  const resolveOrderId = async (): Promise<string | null> => {
    const code = orderCode.trim();
    if (!code) {
      window.alert("Nhập mã số đơn hàng.");
      return null;
    }
    const id = await findLabOrderIdByOrderNumber(code);
    if (!id) {
      window.alert("Không tìm thấy đơn với mã đã nhập.");
      return null;
    }
    return id;
  };

  const printOneGbtt = async () => {
    setOneGbttBusy(true);
    const win = openBlankPrintTab();
    if (!win) {
      setOneGbttBusy(false);
      return;
    }
    try {
      const id = await resolveOrderId();
      if (!id) {
        win.close();
        return;
      }
      const payload = await getPaymentNoticePrintPayload(id);
      const title = paymentNoticePrintTitle(payload);
      writeAndPrintToWindow(win, buildPrintShell(title, buildPaymentNoticeBodyHtml(payload)));
    } catch (e) {
      win.close();
      window.alert(e instanceof Error ? e.message : "Không in được GBTT.");
    } finally {
      setOneGbttBusy(false);
    }
  };

  const exportOneGbttExcel = async () => {
    setOneGbttBusy(true);
    try {
      const id = await resolveOrderId();
      if (!id) return;
      const aoa = await buildSingleGbttExcelAoa(id);
      const code = orderCode.trim().replace(/[^\w.-]+/g, "_");
      await writeXlsx(aoa, "GBTT", `GBTT_don_${code}.xlsx`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không xuất được Excel.");
    } finally {
      setOneGbttBusy(false);
    }
  };

  const printOneDelivery = async () => {
    setOneShipBusy(true);
    const win = openBlankPrintTab();
    if (!win) {
      setOneShipBusy(false);
      return;
    }
    try {
      const id = await resolveOrderId();
      if (!id) {
        win.close();
        return;
      }
      const payload = await getSingleOrderDeliveryNotePayload(id);
      const title = deliveryNotePrintTitle(payload);
      writeAndPrintToWindow(win, buildPrintShell(title, buildDeliveryNoteBodyHtml(payload)));
    } catch (e) {
      win.close();
      window.alert(e instanceof Error ? e.message : "Không in được phiếu giao.");
    } finally {
      setOneShipBusy(false);
    }
  };

  const exportOneDeliveryExcel = async () => {
    setOneShipBusy(true);
    try {
      const id = await resolveOrderId();
      if (!id) return;
      const payload = await getSingleOrderDeliveryNotePayload(id);
      const aoa = buildDeliveryNoteExcelAoa(payload);
      const code = orderCode.trim().replace(/[^\w.-]+/g, "_");
      await writeXlsx(aoa, "PhieuGiao", `PhieuGiao_don_${code}.xlsx`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không xuất được Excel.");
    } finally {
      setOneShipBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--on-surface)] sm:text-2xl">
          In giấy báo thanh toán &amp; phiếu giao hàng
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--on-surface-muted)]">
          In hoặc <strong>xuất Excel</strong>: GBTT theo tháng, phiếu giao theo tháng từng lab, hoặc theo từng mã đơn.
          Lọc theo <strong>ngày nhận đơn</strong>.
        </p>
      </div>
      <Card className="p-5">
        <h2 className="text-base font-semibold text-[var(--on-surface)]">Giấy báo thanh toán (GBTT) theo tháng</h2>
        <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
          Gom tất cả đơn có <strong>ngày nhận</strong> trong tháng, in lần lượt từng GBTT (ưu tiên đúng số GBTT đã cấp trên đơn).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ph-gbtt-y">Năm</Label>
            <Select id="ph-gbtt-y" value={gbttYear} onChange={(e) => setGbttYear(e.target.value)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ph-gbtt-m">Tháng</Label>
            <Select id="ph-gbtt-m" value={gbttMonth} onChange={(e) => setGbttMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
            <Label htmlFor="ph-gbtt-p">Lab (để trống = tất cả)</Label>
            <Select id="ph-gbtt-p" value={gbttPartnerId} onChange={(e) => setGbttPartnerId(e.target.value)}>
              <option value="">Tất cả lab</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="primary" size="sm" disabled={gbttBusy} onClick={() => void printMonthlyGbtt()}>
            {gbttBusy ? "Đang xử lý…" : "In GBTT theo tháng (PDF)"}
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={gbttBusy} onClick={() => void exportMonthlyGbttExcel()}>
            {gbttBusy ? "Đang xử lý…" : "Xuất Excel GBTT theo tháng"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-[var(--on-surface)]">Phiếu giao hàng theo tháng (từng lab)</h2>
        <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
          Một phiếu gộp mọi đơn của lab trong tháng (theo ngày nhận), giống phiếu giao theo ngày nhưng cả tháng.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ph-ship-y">Năm</Label>
            <Select id="ph-ship-y" value={shipYear} onChange={(e) => setShipYear(e.target.value)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ph-ship-m">Tháng</Label>
            <Select id="ph-ship-m" value={shipMonth} onChange={(e) => setShipMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="ph-ship-p">Lab / khách hàng</Label>
            <Select id="ph-ship-p" value={shipPartnerId} onChange={(e) => setShipPartnerId(e.target.value)}>
              <option value="">Chọn lab…</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="ring-1 ring-[color-mix(in_srgb,var(--primary)_28%,transparent)]"
            disabled={shipBusy}
            onClick={() => void printMonthlyDelivery()}
          >
            {shipBusy ? "Đang xử lý…" : "In phiếu giao theo tháng (PDF)"}
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={shipBusy} onClick={() => void exportMonthlyDeliveryExcel()}>
            {shipBusy ? "Đang xử lý…" : "Xuất Excel phiếu giao theo tháng"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-[var(--on-surface)]">Theo từng mã đơn hàng</h2>
        <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
          Nhập đúng <strong>số đơn</strong> (mã hiển thị trên lưới), in GBTT hoặc phiếu giao riêng lẻ.
        </p>
        <div className="mt-4 flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="ph-ord">Mã đơn hàng</Label>
            <Input
              id="ph-ord"
              value={orderCode}
              onChange={(e) => setOrderCode(e.target.value)}
              placeholder="VD: ABC-250422-001"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={oneGbttBusy} onClick={() => void printOneGbtt()}>
            {oneGbttBusy ? "Đang tải…" : "In GBTT (PDF)"}
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={oneGbttBusy} onClick={() => void exportOneGbttExcel()}>
            {oneGbttBusy ? "Đang tải…" : "Xuất Excel GBTT"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="ring-1 ring-[color-mix(in_srgb,var(--primary)_28%,transparent)]"
            disabled={oneShipBusy}
            onClick={() => void printOneDelivery()}
          >
            {oneShipBusy ? "Đang tải…" : "In phiếu giao (PDF)"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={oneShipBusy}
            onClick={() => void exportOneDeliveryExcel()}
          >
            {oneShipBusy ? "Đang tải…" : "Xuất Excel phiếu giao"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
