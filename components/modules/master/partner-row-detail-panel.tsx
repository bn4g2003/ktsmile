"use client";

import Link from "next/link";
import * as React from "react";
import { DetailPreview } from "@/components/ui/detail-preview";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import { formatOrderStatus, formatPartnerType, orderStatusBadgeClassName } from "@/lib/format/labels";
import { formatDate } from "@/lib/format/date";
import { getPartnerDebtSnapshot, type PartnerDebtSnapshot } from "@/lib/actions/debt";
import { listLabOrdersByPartner, type LabOrderRow } from "@/lib/actions/lab-orders";
import type { PartnerRow } from "@/lib/actions/partners";

function isCustomerPartner(t: PartnerRow["partner_type"]) {
  return t === "customer_clinic" || t === "customer_labo";
}

function PartnerOrdersBlock({ partnerId }: { partnerId: string }) {
  const [rows, setRows] = React.useState<LabOrderRow[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setRows(null);
    setErr(null);
    void listLabOrdersByPartner(partnerId, 40)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Lỗi tải đơn");
      });
    return () => {
      cancelled = true;
    };
  }, [partnerId]);

  if (err) {
    return <p className="text-sm text-[#b91c1c]">{err}</p>;
  }
  if (rows === null) {
    return <p className="text-sm text-[var(--on-surface-muted)]">Đang tải đơn hàng…</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--on-surface-muted)]">Chưa có đơn hàng.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
            <th className="px-3 py-2">Số đơn</th>
            <th className="px-3 py-2">Ngày nhận</th>
            <th className="px-3 py-2">BN</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2 text-right">Tiền</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-b border-[var(--border-ghost)] last:border-b-0">
              <td className="px-3 py-2 font-medium">
                <Link
                  href={"/orders/" + o.id}
                  className="text-[var(--primary)] underline-offset-2 hover:underline"
                >
                  {o.order_number}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums text-[var(--on-surface-muted)]">
                {formatDate(o.received_at)}
              </td>
              <td className="max-w-[10rem] truncate px-3 py-2">{o.patient_name}</td>
              <td className="px-3 py-2">
                <span className={orderStatusBadgeClassName(o.status)}>{formatOrderStatus(o.status)}</span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">
                {o.total_amount.toLocaleString("vi-VN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartnerFinanceBlock({
  partnerId,
  partnerType,
}: {
  partnerId: string;
  partnerType: PartnerRow["partner_type"];
}) {
  const [snap, setSnap] = React.useState<PartnerDebtSnapshot | null | "empty">(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isCustomerPartner(partnerType)) return;
    let cancelled = false;
    setSnap(null);
    setErr(null);
    void getPartnerDebtSnapshot(partnerId)
      .then((r) => {
        if (!cancelled) setSnap(r ?? "empty");
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Lỗi");
      });
    return () => {
      cancelled = true;
    };
  }, [partnerId, partnerType]);

  if (!isCustomerPartner(partnerType)) {
    return (
      <p className="text-sm text-[var(--on-surface-muted)]">
        Công nợ / PS bán chỉ áp dụng với khách hàng (phòng khám / labo).
      </p>
    );
  }
  if (err) return <p className="text-sm text-[#b91c1c]">{err}</p>;
  if (snap === null) return <p className="text-sm text-[var(--on-surface-muted)]">Đang tải…</p>;
  if (snap === "empty") {
    return <p className="text-sm text-[var(--on-surface-muted)]">Không lấy được số liệu công nợ.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--on-surface-muted)]">
        Tháng {snap.month}/{snap.year} (theo dữ liệu kỳ — cùng logic trang Công nợ).
      </p>
      <DetailPreview
        fields={[
          { label: "Nợ đầu kỳ", value: snap.opening.toLocaleString("vi-VN") },
          { label: "PS bán trong tháng", value: snap.orders_month.toLocaleString("vi-VN") },
          { label: "Đã thu trong tháng", value: snap.receipts_month.toLocaleString("vi-VN") },
          { label: "Nợ cuối kỳ", value: snap.closing.toLocaleString("vi-VN") },
        ]}
      />
    </div>
  );
}

export function PartnerRowDetailPanel({ row }: { row: PartnerRow }) {
  const customer = isCustomerPartner(row.partner_type);
  const [tab, setTab] = React.useState<"info" | "orders" | "finance">("info");

  React.useEffect(() => {
    setTab("info");
  }, [row.id]);

  const tabItems = customer
    ? [
        { id: "info" as const, label: "Thông tin" },
        { id: "orders" as const, label: "Đơn hàng" },
        { id: "finance" as const, label: "Công nợ & PS" },
      ]
    : [{ id: "info" as const, label: "Thông tin" }];
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <DetailTabStrip
        items={tabItems}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />
      {tab === "info" ? (
        <DetailPreview 
          groups={[
            {
              title: "Hồ sơ đối tác",
              fields: [
                { label: "MÃ ĐỐI TÁC:", value: row.code },
                { label: "TÊN ĐỐI TÁC:", value: row.name },
                { label: "PHÂN LOẠI:", value: formatPartnerType(row.partner_type) },
              ]
            },
            {
              title: "Liên hệ & Pháp lý",
              fields: [
                { label: "NGƯỜI ĐẠI DIỆN:", value: row.representative_name || "—" },
                { label: "SỐ ĐIỆN THOẠI:", value: row.phone || "—" },
                { label: "MÃ SỐ THUẾ:", value: row.tax_id || "—" },
              ]
            },
            {
              title: "Chính sách & Trạng thái",
              fields: [
                { label: "CHIẾT KHẤU MẶC ĐỊNH:", value: row.default_discount_percent ? row.default_discount_percent + "%" : "—" },
                { label: "TRẠNG THÁI:", value: row.is_active ? "Đang hoạt động" : "Ngừng hoạt động" },
              ]
            },
            {
              title: "Thông tin khác",
              fields: [
                { label: "ĐỊA CHỈ:", value: row.address || "—", span: "full" },
                { label: "GHI CHÚ:", value: row.notes || "—", span: "full" },
                { label: "TẠO LÚC:", value: formatDate(row.created_at) },
                { label: "CẬP NHẬT:", value: formatDate(row.updated_at) },
              ]
            }
          ]}
        />
      ) : null}
      {tab === "orders" && customer ? <PartnerOrdersBlock partnerId={row.id} /> : null}
      {tab === "finance" && customer ? (
        <PartnerFinanceBlock partnerId={row.id} partnerType={row.partner_type} />
      ) : null}
    </div>
  );
}
