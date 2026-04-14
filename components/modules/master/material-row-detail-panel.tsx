"use client";

import * as React from "react";
import { DetailPreview } from "@/components/ui/detail-preview";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import { MaterialSuppliersPanel } from "@/components/modules/master/material-suppliers-panel";
import type { MaterialRow } from "@/lib/actions/materials";

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
          fields={[
            { label: "Mã NVL", value: row.code },
            { label: "Tên NVL", value: row.name },
            { label: "ĐVT", value: row.unit },
            { label: "Tồn kho", value: row.quantity_on_hand },
            {
              label: "NCC chính",
              value: row.primary_supplier_code ? row.primary_supplier_code + " — " + (row.primary_supplier_name ?? "") : "—",
              span: "full",
            },
            { label: "Hoạt động", value: row.is_active ? "Có" : "Không" },
            { label: "Tạo lúc", value: row.created_at },
            { label: "Cập nhật", value: row.updated_at },
          ]}
        />
      ) : null}
      {tab === "suppliers" ? <MaterialSuppliersPanel materialId={row.id} /> : null}
    </div>
  );
}
