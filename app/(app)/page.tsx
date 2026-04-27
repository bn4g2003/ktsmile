import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { DashboardChartsSection } from "@/components/modules/dashboard/dashboard-charts-section";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils/cn";
import { getDashboardCharts } from "@/lib/actions/dashboard-stats";

type IconProps = SVGProps<SVGSVGElement>;

function IconPartners({ className, ...p }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden {...p}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}

function IconProducts({ className, ...p }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden {...p}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25m0-9v9m0 0l9 5.25M3 7.5v9l9 5.25"
      />
    </svg>
  );
}

function IconOrders({ className, ...p }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden {...p}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664v.75h-1.5V6.108c0-.231.035-.454.1-.664M6.75 7.5H18v11.25c0 .621-.504 1.125-1.125 1.125H7.125A1.125 1.125 0 016.75 18.75V7.5zM12 3.75h.008v.008H12V3.75z"
      />
    </svg>
  );
}

function IconStock({ className, ...p }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden {...p}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
    </svg>
  );
}

function IconCash({ className, ...p }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden {...p}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m0 0H3.375m1.5-.75H21m-4.5 0H9.375m1.5 0H12m8.25-9.75H3.375c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125H21"
      />
    </svg>
  );
}

function IconDebt({ className, ...p }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden {...p}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
      />
    </svg>
  );
}

const quickLinks: {
  href: string;
  title: string;
  desc: string;
  Icon: ComponentType<IconProps>;
  /** Nền thẻ (toàn khối); icon & chữ luôn trắng */
  panelClass: string;
}[] = [
  {
    href: "/master/partners",
    title: "Khách & NCC",
    desc: "Danh mục khách hàng và nhà cung cấp",
    Icon: IconPartners,
    panelClass: "bg-[#0f766e] hover:brightness-110",
  },
  {
    href: "/master/products",
    title: "SP & NVL",
    desc: "Phôi sứ & vật tư",
    Icon: IconProducts,
    panelClass: "bg-[#b45309] hover:brightness-110",
  },
  {
    href: "/orders",
    title: "Đơn hàng",
    desc: "Phục hình & theo dõi",
    Icon: IconOrders,
    panelClass: "bg-[var(--primary)] hover:bg-[var(--primary-hover)]",
  },
  {
    href: "/inventory/stock",
    title: "Tồn kho",
    desc: "Xem nhanh tồn theo SP",
    Icon: IconStock,
    panelClass: "bg-[#5b21b6] hover:brightness-110",
  },
  {
    href: "/accounting/cash",
    title: "Sổ quỹ",
    desc: "Thu / chi",
    Icon: IconCash,
    panelClass: "bg-[#047857] hover:brightness-110",
  },
  {
    href: "/accounting/debt",
    title: "Công nợ",
    desc: "Phải thu khách & phải trả NCC",
    Icon: IconDebt,
    panelClass: "bg-[#be123c] hover:brightness-110",
  },
];

export default async function HomePage() {
  let chartData = null;
  try {
    chartData = await getDashboardCharts();
  } catch {
    chartData = null;
  }
  const fmtMoney = (n: number) => Math.round(n || 0).toLocaleString("vi-VN");
  const waitingInvoiceCount = chartData
    ? chartData.orderByStatus
        .filter((s) => s.status === "draft" || s.status === "in_progress")
        .reduce((sum, s) => sum + s.count, 0)
    : 0;
  const processingOrderCount = chartData
    ? chartData.orderByStatus
        .filter((s) => s.status === "in_progress")
        .reduce((sum, s) => sum + s.count, 0)
    : 0;
  const quickDebt = chartData
    ? Math.max(0, chartData.financial.receivable) + Math.max(0, chartData.financial.payable)
    : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--on-surface)] sm:text-4xl">
          Tổng quan
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--on-surface-muted)] sm:text-base">
          Bảng dữ liệu kiểu Excel: lọc, tìm kiếm, cột, xuất file — giao diện đồng nhất theo design system.
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Doanh thu năm"
          value={chartData ? `${fmtMoney(chartData.financial.revenue_year)} đ` : "—"}
          hint={chartData ? `Lợi nhuận: ${fmtMoney(chartData.financial.profit_year)} đ` : "Kết nối báo cáo sau"}
        />
        <StatCard
          label="Chứng từ chờ xử lý"
          value={chartData ? waitingInvoiceCount.toLocaleString("vi-VN") : "—"}
          hint="Trạng thái draft + in_progress"
        />
        <StatCard
          label="Đơn đang xử lý"
          value={chartData ? processingOrderCount.toLocaleString("vi-VN") : "—"}
          hint="Riêng trạng thái in_progress"
        />
        <StatCard
          label="Tổng hợp nhanh"
          value={chartData ? `${fmtMoney(quickDebt)} đ` : "Mở module"}
          hint={chartData ? "Phải thu + phải trả hiện tại" : "Đối tác, đơn hàng, kho, kế toán"}
          accent="purple"
        />
      </div>

      {chartData ? (
        <DashboardChartsSection data={chartData} />
      ) : (
        <Card className="p-5 text-sm text-[var(--on-surface-muted)]">
          Biểu đồ tổng quan cần kết nối Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Các trang
          module vẫn hoạt động nếu đã cấu hình.
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((l) => {
          const Icon = l.Icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "group block min-h-[8rem] sm:min-h-[9.5rem] rounded-[var(--radius-xl)] p-4 sm:p-5 text-white shadow-[var(--shadow-card)] ring-1 ring-black/10 outline-none",
                "transition [transition-property:transform,filter,background-color] duration-200",
                "hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)] active:scale-[0.99]",
                "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-canvas)]",
                l.panelClass,
              )}
            >
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex gap-3 sm:gap-4">
                  <Icon className="mt-0.5 h-7 w-7 sm:h-8 sm:w-8 shrink-0 text-white" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white">{l.title}</h2>
                    <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm leading-snug text-white/90">{l.desc}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-white/20 pt-3 sm:pt-4 text-xs sm:text-sm font-bold text-white">
                  <span>Mở</span>
                  <svg
                    className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-white transition group-hover:translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
