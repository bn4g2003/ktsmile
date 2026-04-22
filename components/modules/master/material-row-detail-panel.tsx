"use client";

import * as React from "react";
import { DetailPreview } from "@/components/ui/detail-preview";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import { MaterialSuppliersPanel } from "@/components/modules/master/material-suppliers-panel";
import type { MaterialRow } from "@/lib/actions/materials";
import { formatDate } from "@/lib/format/date";

export function MaterialRowDetailPanel({ row }: { row: MaterialRow }) {
  const [tab, setTab] = React.useState<"info" | "suppliers">("info");

  React.useEffect(() => {
    setTab("info");
  }, [row.id]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <DetailTabStrip
        items={[
          { id: "info", label: "Thông tin" },
          { id: "suppliers", label: "NCC & kho" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />
      {tab === "info" ? (
        <DetailPreview
          groups={[
            {
              title: "Thông tin cơ bản",
              fields: [
                { label: "MÃ NVL:", value: row.code },
                { label: "TÊN NVL:", value: row.name },
                { label: "ĐVT:", value: row.unit },
                {
                  label: "ĐƠN GIÁ:",
                  value: row.unit_price.toLocaleString("vi-VN") + " đ",
                },
                { label: "HOẠT ĐỘNG:", value: row.is_active ? "Có" : "Không" },
              ]
            },
            {
              title: "Kho & NCC cung ứng",
              fields: [
                { label: "TỒN KHO:", value: <span className="font-bold text-[var(--primary)]">{row.quantity_on_hand} {row.unit}</span> },
                { label: "NCC CHÍNH:", value: row.primary_supplier_code ? row.primary_supplier_code + " — " + (row.primary_supplier_name ?? "") : "—", span: "full" },
              ]
            },
            {
              title: "Hệ thống",
              fields: [
                { label: "TẠO LÚC:", value: formatDate(row.created_at) },
                { label: "CẬP NHẬT:", value: formatDate(row.updated_at) },
              ]
            }
          ]}
        />
      ) : null}
      {tab === "suppliers" ? <MaterialSuppliersPanel materialId={row.id} /> : null}
    </div>
  );
}
