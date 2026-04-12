import { redirect } from "next/navigation";

/** Breadcrumb và prefetch dùng /accounting làm bước cha — cần route thật để tránh 404. */
export default function AccountingIndexPage() {
  redirect("/accounting/sales");
}
