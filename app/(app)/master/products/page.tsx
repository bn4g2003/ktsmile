import { ProductsPage } from "@/components/modules/master/products-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const raw = sp.tab;
  const tabStr = Array.isArray(raw) ? raw[0] : raw;
  const initialTab = tabStr === "inventory" ? "inventory" : "sales";
  return <ProductsPage initialCatalogTab={initialTab} />;
}
