"use client";

import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import { DetailPreview } from "@/components/ui/detail-preview";
import { listProductStock, type ProductStockRow } from "@/lib/actions/stock";

export function StockLevelsPage() {
  const renderStockDetail = React.useCallback((row: ProductStockRow) => {
    return (
      <DetailPreview
        fields={[
          { label: "Mã SP", value: row.product_code },
          { label: "Tên SP", value: row.product_name },
          { label: "ĐVT", value: row.unit },
          { label: "Tồn", value: row.quantity_on_hand },
          { label: "Product ID", value: row.product_id, span: "full" },
        ]}
      />
    );
  }, []);

  const columns = React.useMemo<ColumnDef<ProductStockRow, unknown>[]>(
    () => [
      { accessorKey: "product_code", header: "Mã SP", meta: { filterKey: "product_code", filterType: "text" } },
      { accessorKey: "product_name", header: "Tên SP" },
      { accessorKey: "unit", header: "ĐVT" },
      { accessorKey: "quantity_on_hand", header: "Tồn" },
    ],
    [],
  );

  return (
    <ExcelDataGrid<ProductStockRow>
      moduleId="v_product_stock"
      title="Tồn kho (Nhập − Xuất)"
      columns={columns}
      list={listProductStock}
      getRowId={(r) => r.product_id}
      renderRowDetail={renderStockDetail}
      rowDetailTitle={(r) => "Tồn " + r.product_code}
    />
  );
}
