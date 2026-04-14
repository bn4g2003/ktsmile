import { PartnersPage } from "@/components/modules/master/partners-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const raw = sp.tab;
  const tabStr = Array.isArray(raw) ? raw[0] : raw;
  const initialTab = tabStr === "suppliers" ? "suppliers" : "customers";
  return <PartnersPage initialTab={initialTab} />;
}
