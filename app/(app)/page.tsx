import Link from "next/link";
import { getDashboardCharts } from "@/lib/actions/dashboard-stats";
import { DashboardMiniCharts } from "@/components/modules/dashboard/dashboard-mini-charts";
import { DashboardPeriodFilter } from "@/components/modules/dashboard/dashboard-period-filter";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { resolvePermissionPreset, NAV_PERMISSION_RULES } from "@/lib/auth/permission-presets";

function formatMoney(value: number) {
  return `${Math.round(value || 0).toLocaleString("vi-VN")} đ`;
}

function KpiCard({
  title,
  value,
  hint,
  tone = "light",
}: {
  title: string;
  value: string;
  hint: string;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={
        tone === "dark"
          ? "rounded-xl bg-[#0f8f5b] p-4 text-white shadow-sm"
          : "rounded-xl border border-[#d9dfec] bg-white p-4 shadow-sm"
      }
    >
      <p className={tone === "dark" ? "text-[11px] uppercase tracking-wide text-white/80" : "text-[11px] uppercase tracking-wide text-[#6a7892]"}>{title}</p>
      <p className={tone === "dark" ? "mt-2 text-2xl font-bold text-white" : "mt-2 text-2xl font-bold text-[#16233a]"}>{value}</p>
      <p className={tone === "dark" ? "mt-2 text-xs text-white/85" : "mt-2 text-xs text-[#6a7892]"}>{hint}</p>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  
  // 1. Kiểm tra quyền Server-side
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const navPermission = resolvePermissionPreset(user.permissions);
  const allowedPaths = user.nav_allowed_paths ?? (NAV_PERMISSION_RULES[navPermission] ?? []);
  const canSeeDashboard = allowedPaths.includes("*") || allowedPaths.includes("/");

  if (!canSeeDashboard) {
    // Nếu không có quyền xem Dashboard, đẩy sang trang đầu tiên được phép
    const firstPath = allowedPaths.find(p => p !== "*" && p !== "/");
    redirect(firstPath || "/login");
  }

  const monthParam = Number(Array.isArray(params.month) ? params.month[0] : params.month);
  const yearParam = Number(Array.isArray(params.year) ? params.year[0] : params.year);
  const now = new Date();
  const selectedMonth = Number.isFinite(monthParam) ? Math.min(12, Math.max(1, Math.trunc(monthParam))) : now.getMonth() + 1;
  const selectedYear = Number.isFinite(yearParam) ? Math.trunc(yearParam) : now.getFullYear();

  let chartData = null;
  try {
    chartData = await getDashboardCharts({ year: selectedYear, month: selectedMonth });
  } catch {
    chartData = null;
  }
  const monthNames = ["tháng 1", "tháng 2", "tháng 3", "tháng 4", "tháng 5", "tháng 6", "tháng 7", "tháng 8", "tháng 9", "tháng 10", "tháng 11", "tháng 12"];
  const waitingInvoiceCount = chartData
    ? chartData.orderByStatus.filter((s) => s.status === "draft" || s.status === "in_progress").reduce((sum, s) => sum + s.count, 0)
    : 0;
  const processingOrderCount = chartData
    ? chartData.orderByStatus.filter((s) => s.status === "in_progress").reduce((sum, s) => sum + s.count, 0)
    : 0;
  const monthlyRows = chartData?.monthlyFinance ?? [];
  const monthRow = monthlyRows.find((row) => row.month === selectedMonth) ?? monthlyRows[monthlyRows.length - 1];
  const revenueThisMonth = monthRow?.revenue ?? 0;
  const expenseThisMonth = monthRow?.expense ?? 0;
  const profitThisMonth = monthRow?.profit ?? 0;
  const soldRows = chartData?.topSold?.slice(0, 6) ?? [];

  return (
    <div className="relative space-y-4 rounded-2xl bg-[#f1f4f9] p-4">
      <section className="rounded-xl border border-[#dbe2ef] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#16233a]">Tổng quan</h1>
            <p className="text-xs text-[#6a7892]">Theo dõi hoạt động kinh doanh mỗi ngày</p>
          </div>
          <div className="flex items-center gap-2">
            <DashboardPeriodFilter selectedMonth={selectedMonth} selectedYear={selectedYear} />
            <Link href="/accounting/cash" className="rounded-md bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white">
              Xuất báo cáo
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <KpiCard title="Doanh thu tháng này" value={formatMoney(revenueThisMonth)} hint={monthNames[(monthRow?.month ?? selectedMonth) - 1] ?? ""} />
        <KpiCard title="Chứng từ chờ duyệt" value={waitingInvoiceCount.toLocaleString("vi-VN")} hint="Draft + đang xử lý" />
        <KpiCard title="Đơn hàng chờ" value={processingOrderCount.toLocaleString("vi-VN")} hint="Đơn trạng thái in_progress" />
        <KpiCard title="Dòng tiền hiện có" value={formatMoney(chartData?.financial.total_money ?? 0)} hint="Tiền mặt + ngân hàng" tone="dark" />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-[#dbe2ef] bg-white p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1d2a44]">Sức khỏe tài chính</h2>
            <Link href="/accounting/debt" className="text-xs font-medium text-[#72839f] hover:text-[#1d2a44]">
              Xem tất cả
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-[#e3e9f5] bg-[#fbfcff] p-3 text-sm">
              <p className="flex items-center justify-between"><span className="text-[#64748b]">Tồn đầu</span><span className="font-semibold text-[#1e293b]">{formatMoney(chartData?.financial.total_money ?? 0)}</span></p>
              <p className="flex items-center justify-between"><span className="text-[#64748b]">Tổng giá trị nhập</span><span className="font-semibold text-[#0ea5a4]">{formatMoney(chartData?.financial.revenue_year ?? 0)}</span></p>
              <p className="flex items-center justify-between"><span className="text-[#64748b]">Phải thu khách hàng</span><span className="font-semibold text-[#0284c7]">{formatMoney(Math.max(0, chartData?.financial.receivable ?? 0))}</span></p>
            </div>
            <div className="space-y-3 rounded-lg border border-[#e3e9f5] bg-[#fbfcff] p-3 text-sm">
              <p className="flex items-center justify-between"><span className="text-[#64748b]">Lợi nhuận gộp</span><span className="font-semibold text-[#1e293b]">{formatMoney(profitThisMonth)}</span></p>
              <p className="flex items-center justify-between"><span className="text-[#64748b]">Chi phí hoạt động</span><span className="font-semibold text-[#f97316]">{formatMoney(expenseThisMonth)}</span></p>
              <p className="flex items-center justify-between"><span className="text-[#64748b]">Chi phí lương</span><span className="font-semibold text-[#ef4444]">{formatMoney(Math.max(0, chartData?.financial.payable ?? 0))}</span></p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#dbe2ef] bg-white p-4">
          <h2 className="text-sm font-semibold text-[#1d2a44]">Hàng tồn kho</h2>
          <div className="mt-3 space-y-2 text-sm">
            {(chartData?.topStock ?? []).slice(0, 5).map((item) => (
              <p key={item.product_code} className="flex items-center justify-between gap-3 rounded-md bg-[#f9fbff] px-2 py-1.5">
                <span className="line-clamp-1 text-[#334155]">{item.product_name || item.product_code}</span>
                <span className="font-semibold text-[#1e293b]">{item.quantity_on_hand.toLocaleString("vi-VN")}</span>
              </p>
            ))}
            {chartData?.topStock?.length ? null : <p className="text-xs text-[#6a7892]">Chưa có dữ liệu tồn kho.</p>}
          </div>
        </div>
      </section>

      <DashboardMiniCharts monthlyFinance={monthlyRows} selectedMonth={selectedMonth} />

      <section className="rounded-xl border border-[#dbe2ef] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#1d2a44]">Mặt hàng bán chạy nhất</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#e3e9f5] text-left text-xs uppercase tracking-wide text-[#6a7892]">
                <th className="px-2 py-2">Sản phẩm</th>
                <th className="px-2 py-2">Số lượng</th>
                <th className="px-2 py-2">Doanh thu</th>
                <th className="px-2 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {soldRows.map((item, idx) => (
                <tr key={item.product_code} className="border-b border-[#eef2f9] text-[#1f2c45]">
                  <td className="px-2 py-2">{item.product_name || item.product_code}</td>
                  <td className="px-2 py-2">{item.quantity_sold.toLocaleString("vi-VN")}</td>
                  <td className="px-2 py-2 font-medium">{formatMoney(item.revenue)}</td>
                  <td className="px-2 py-2">
                    <span className={idx < 2 ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700" : "rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"}>
                      {idx < 2 ? "Đang tăng" : "Ổn định"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!soldRows.length ? <p className="px-2 py-3 text-xs text-[#6a7892]">Chưa có dữ liệu bán chạy.</p> : null}
        </div>
      </section>

    </div>
  );
}
