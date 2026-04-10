import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    filterKey?: string;
    filterType?: "text" | "select" | "none";
    filterOptions?: { value: string; label: string }[];
  }
}
