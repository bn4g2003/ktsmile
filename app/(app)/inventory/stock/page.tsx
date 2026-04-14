import { StockLevelsPage } from "@/components/modules/inventory/stock-levels-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const raw = sp.tab;
  const tabStr = Array.isArray(raw) ? raw[0] : raw;
  const initialTab = tabStr === "sp" ? "sp" : "nvl";
  return <StockLevelsPage initialTab={initialTab} />;
}
