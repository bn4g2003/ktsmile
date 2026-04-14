import { DebtPage } from "@/components/modules/accounting/debt-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const raw = sp.tab;
  const tabStr = Array.isArray(raw) ? raw[0] : raw;
  const initialTab = tabStr === "payables" ? "payables" : "receivables";
  return <DebtPage initialTab={initialTab} />;
}
