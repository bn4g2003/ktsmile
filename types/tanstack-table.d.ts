import type { ReactNode } from "react";
import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    filterKey?: string;
    filterType?: "text" | "select" | "date" | "date_range" | "none";
    filterOptions?: { value: string; label: string }[];
    renderFilterOption?: (option: { value: string; label: string }) => ReactNode;
  }
}
