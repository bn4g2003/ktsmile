"use client";

import Link from "next/link";
import * as React from "react";
import { DetailPreview } from "@/components/ui/detail-preview";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import {
  formatLabOrderLineWorkType,
  formatOrderStatus,
  orderStatusBadgeClassName,
} from "@/lib/format/labels";
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
          fields={[
            { label: "Số đơn", value: row.order_number },
            { label: "Ngày nhận", value: row.received_at },
            { label: "Mã KH", value: row.partner_code },
            { label: "Khách", value: row.partner_name },
            { label: "Nha khoa", value: row.clinic_name ?? "—" },
            { label: "Bệnh nhân", value: row.patient_name },
            {
              label: "Trạng thái",
              value: (
                <span className={orderStatusBadgeClassName(row.status)}>{formatOrderStatus(row.status)}</span>
              ),
            },
            { label: "Tổng tiền", value: row.total_amount.toLocaleString("vi-VN") },
            { label: "Ghi chú", value: row.notes, span: "full" },
            {
              label: "Mở trang đơn",
              value: (
                <Link href={"/orders/" + row.id} className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline">
                  Sửa dòng & in PDF →
                </Link>
              ),
              span: "full",
            },
            { label: "ID", value: row.id, span: "full" },
            { label: "Tạo lúc", value: row.created_at },
            { label: "Cập nhật", value: row.updated_at },
          ]}
        />
      ) : null}
      {tab === "lines" ? <OrderLinesBlock orderId={row.id} /> : null}
    </div>
  );
}
