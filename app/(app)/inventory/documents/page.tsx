import { InventoryDocumentsPage } from "@/components/modules/inventory/inventory-documents-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const raw = sp.tab;
  const tabStr = Array.isArray(raw) ? raw[0] : raw;
  const initialTab = tabStr === "outbound" ? "outbound" : "inbound";
  return <InventoryDocumentsPage initialTab={initialTab} />;
}
