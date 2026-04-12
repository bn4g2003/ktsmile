import Link from "next/link";
import { DashboardChartsSection } from "@/components/modules/dashboard/dashboard-charts-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { getDashboardCharts } from "@/lib/actions/dashboard-stats";

const links = [
  { href: "/master/partners", title: "Đối tác", desc: "Khách hàng & nhà cung cấp" },
  { href: "/master/products", title: "Sản phẩm", desc: "Phôi sứ & vật tư" },
  { href: "/orders", title: "Đơn hàng", desc: "Phục hình & theo dõi" },
  { href: "/inventory/stock", title: "Tồn kho", desc: "Xem nhanh tồn theo SP" },
  { href: "/accounting/cash", title: "Sổ quỹ", desc: "Thu / chi" },
  { href: "/accounting/debt", title: "Công nợ", desc: "Theo tháng" },
];

export default async function HomePage() {
  let chartData = null;
  try {
    chartData = await getDashboardCharts();
  } catch {
    chartData = null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--on-surface)] sm:text-4xl">
          Tổng quan
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--on-surface-muted)]">
          Bảng dữ liệu kiểu Excel: lọc, tìm kiếm, cột, xuất file — giao diện đồng nhất theo design system.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Doanh thu " value="—" hint="Kết nối báo cáo sau" />
        <StatCard label="Hóa đơn chờ" value="—" />
        <StatCard label="Đơn đang xử lý" value="—" />
        <StatCard
          label="Tổng hợp nhanh"
          value="Mở module"
          hint="Đối tác, đơn hàng, kho, kế toán"
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
        {links.map((l) => (
          <Card key={l.href} className="p-5 transition hover:brightness-[1.02]">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--on-surface)]">
              {l.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--on-surface-muted)]">{l.desc}</p>
            <Button variant="primary" className="mt-4" asChild>
              <Link href={l.href}>Mở</Link>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
