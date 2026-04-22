"use client";

import Link from "next/link";
import * as React from "react";
import { DetailPreview } from "@/components/ui/detail-preview";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import { cn } from "@/lib/utils/cn";
import {
  formatCoordReviewStatus,
  formatLabOrderLineWorkType,
  formatOrderStatus,
  orderStatusBadgeClassName,
} from "@/lib/format/labels";
import { formatDate } from "@/lib/format/date";
import { listLabOrderLines, type LabOrderLineRow, type LabOrderRow } from "@/lib/actions/lab-orders";

function OrderLinesBlock({ orderId }: { orderId: string }) {
  const [rows, setRows] = React.useState<LabOrderLineRow[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setRows(null);
    setErr(null);
    void listLabOrderLines(orderId)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Lỗi tải dòng");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (err) return <p className="text-sm text-[#b91c1c]">{err}</p>;
  if (rows === null) return <p className="text-sm text-[var(--on-surface-muted)]">Đang tải dòng đơn…</p>;
  if (rows.length === 0) return <p className="text-sm text-[var(--on-surface-muted)]">Chưa có dòng sản phẩm.</p>;

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
            <th className="px-3 py-2">Mã SP</th>
            <th className="px-3 py-2">Răng / vị trí</th>
            <th className="px-3 py-2 text-center">Số răng</th>
            <th className="px-3 py-2">Loại</th>
            <th className="px-3 py-2 text-right">SL</th>
            <th className="px-3 py-2 text-right">Đơn giá</th>
            <th className="px-3 py-2 text-right">CK %</th>
            <th className="px-3 py-2 text-right">Giảm VNĐ</th>
            <th className="px-3 py-2 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ln) => (
            <tr key={ln.id} className="border-b border-[var(--border-ghost)] last:border-b-0">
              <td className="px-3 py-2 font-medium">{ln.product_code ?? "—"}</td>
              <td className="max-w-[12rem] px-3 py-2">
                <span className="break-words">{ln.tooth_positions}</span>
                {ln.shade ? (
                  <span className="mt-0.5 block text-xs text-[var(--on-surface-muted)]">Màu: {ln.shade}</span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-center tabular-nums">
                {ln.tooth_count != null ? ln.tooth_count : "—"}
              </td>
              <td className="px-3 py-2 text-xs">{formatLabOrderLineWorkType(ln.work_type)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{ln.quantity}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {ln.unit_price.toLocaleString("vi-VN")}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{ln.discount_percent}</td>
              <td className="px-3 py-2 text-right tabular-nums">{ln.discount_amount.toLocaleString("vi-VN")}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">
                {ln.line_amount.toLocaleString("vi-VN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const IconCalendar = <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconClinic = <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5" /></svg>;
const IconUser = <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const IconStatus = <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

export function LabOrderRowDetailPanel({ row }: { row: LabOrderRow }) {
  const [tab, setTab] = React.useState<"info" | "lines">("info");

  React.useEffect(() => {
    setTab("info");
  }, [row.id]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <DetailTabStrip
        items={[
          { id: "info", label: "Thông tin" },
          { id: "lines", label: "Dòng đơn" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />
      {tab === "info" ? (
        <DetailPreview
          groups={[
            {
              title: "Thông tin Chung",
              fields: [
                { label: "SỐ ĐƠN:", value: row.order_number },
                { label: "NGÀY NHẬN:", value: formatDate(row.received_at), icon: IconCalendar },
                {
                  label: "TRẠNG THÁI:",
                  icon: IconStatus,
                  value: (
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold uppercase", orderStatusBadgeClassName(row.status))}>
                      {formatOrderStatus(row.status)}
                    </span>
                  ),
                },
              ],
            },
            {
              title: "Thông tin Đối tác & Bệnh nhân",
              fields: [
                { label: "KHÁCH (LAB):", value: row.partner_name, icon: IconClinic },
                { label: "NHA KHOA:", value: row.clinic_name ?? "—", icon: IconClinic },
                { label: "BỆNH NHÂN:", value: row.patient_name, icon: IconUser },
                { label: "MÃ KH:", value: row.partner_code },
              ],
            },
            {
              title: "Thông tin Tài chính",
              fields: [
                { label: "TỔNG DÒNG:", value: row.total_amount.toLocaleString("vi-VN") + " VND" },
                { label: "PHẢI THU (GBTT):", value: row.grand_total.toLocaleString("vi-VN") + " VND" },
                {
                  label: "ĐỐI CHIẾU:",
                  value: (
                    <span className="px-2 py-0.5 rounded shadow-sm bg-[var(--surface-muted)] text-[11px] font-bold">
                       {formatCoordReviewStatus(row.coord_review_status)}
                    </span>
                  )
                },
                { label: "SỐ GBTT:", value: row.payment_notice_doc_number ?? "—" },
                { label: "PHIẾU BS:", value: row.prescription_slip_code ?? "—" },
              ],
            },
            {
              title: "Thông tin Bổ sung",
              fields: [
                { label: "GHI CHÚ:", value: row.notes || "—", span: "full" },
                {
                  label: "THAO TÁC NHANH:",
                  value: (
                    <Link href={"/orders/" + row.id} className="inline-flex items-center gap-1.5 font-bold text-[var(--primary)] text-xs hover:underline">
                      Sửa chi tiết & In PDF →
                    </Link>
                  ),
                  span: "full",
                },
                { label: "ID HỆ THỐNG:", value: <span className="text-[10px] font-mono opacity-50">{row.id}</span>, span: "full" },
              ],
            },
          ]}
        />
      ) : null}
      {tab === "lines" ? <OrderLinesBlock orderId={row.id} /> : null}
    </div>
  );
}
