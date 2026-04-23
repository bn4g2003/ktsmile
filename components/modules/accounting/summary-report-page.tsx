"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { getSummaryReport, SummaryReportData } from "@/lib/actions/summary-report";
import { listCustomerPartnerPicker } from "@/lib/actions/partners";
import { listProductPicker } from "@/lib/actions/products";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { NavIconChart } from "@/components/shared/nav-icons";

const COLORS = ["#16a34a", "#dc2626"];

export function SummaryReportPage() {
  const [month, setMonth] = React.useState(new Date().getMonth() + 1);
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [partnerId, setPartnerId] = React.useState("");
  const [productId, setProductId] = React.useState("");
  
  const [data, setData] = React.useState<SummaryReportData | null>(null);
  const [loading, setLoading] = React.useState(true);
  
  const [partners, setPartners] = React.useState<{ id: string; code: string; name: string }[]>([]);
  const [products, setProducts] = React.useState<{ id: string; code: string; name: string }[]>([]);

  React.useEffect(() => {
    Promise.all([
      listCustomerPartnerPicker(),
      listProductPicker({ forSales: true })
    ]).then(([pa, pr]) => {
      setPartners(pa);
      setProducts(pr);
    }).catch(console.error);
  }, []);

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await getSummaryReport(month, year, { partnerId, productId });
        setData(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [month, year, partnerId, productId]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const pieData = data ? [
    { name: "Hàng mới", value: data.totalNewYield },
    { name: "Hàng làm lại", value: data.totalWarrantyYield },
  ].filter(d => d.value > 0) : [];

  const topProducts = data ? data.products.slice(0, 10) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--on-surface)]">Báo cáo tổng hợp</h1>
          <p className="text-sm text-[var(--on-surface-muted)]">Phân tích sản lượng và phát sinh sản phẩm/khách hàng</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            className="h-9 gap-2"
            onClick={async () => {
              if (!data) return;
              try {
                const { buildSummaryReportExcelBuffer } = await import("@/lib/reports/summary-report-excel");
                const partnerName = partners.find(p => p.id === partnerId)?.name;
                const productName = products.find(p => p.id === productId)?.name;
                
                const buf = buildSummaryReportExcelBuffer({
                  year,
                  month,
                  data,
                  filters: { partnerName, productName }
                });
                
                const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Bao_cao_tong_hop_${String(month).padStart(2, "0")}_${year}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (err) {
                console.error(err);
                alert("Không thể xuất file Excel");
              }
            }}
            disabled={loading || !data}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Tải Excel
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-[var(--on-surface-muted)]">Tháng</span>
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-9 w-24 text-sm">
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-[var(--on-surface-muted)]">Năm</span>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 w-28 text-sm">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <Card className="p-4 border border-[var(--border-ghost)] bg-[var(--surface-muted)]/30">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[240px]">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">Lọc theo khách hàng</label>
            <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="h-10 text-sm">
              <option value="">-- Tất cả khách hàng --</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">Lọc theo sản phẩm</label>
            <Select value={productId} onChange={(e) => setProductId(e.target.value)} className="h-10 text-sm">
              <option value="">-- Tất cả sản phẩm --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            <div className="text-sm font-semibold text-[var(--on-surface-muted)]">Đang phân tích dữ liệu...</div>
          </div>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Tổng sản lượng" value={data.totalYield.toLocaleString()} hint="Tổng số răng" accent="purple" />
            <StatCard label="Hàng mới" value={data.totalNewYield.toLocaleString()} hint="Sản lượng làm mới" />
            <StatCard label="Hàng làm lại" value={data.totalWarrantyYield.toLocaleString()} hint="Bảo hành & sửa" />
            <StatCard label="Khách hàng phát sinh" value={data.totalCustomers.toLocaleString()} hint="Số KH có đơn hàng" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-0 overflow-hidden border border-[var(--border-ghost)]">
              <div className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] px-5 py-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--on-surface)]">Tỷ lệ hàng mới / bảo hành</h3>
              </div>
              <div className="h-[300px] w-full p-4">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--on-surface-muted)]">Không có dữ liệu biểu đồ</div>
                )}
              </div>
            </Card>

            <Card className="p-0 overflow-hidden border border-[var(--border-ghost)]">
              <div className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] px-5 py-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--on-surface)]">Top 10 sản phẩm sản lượng cao</h3>
              </div>
              <div className="h-[300px] w-full p-4">
                {topProducts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical" margin={{ left: 40, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e6ec" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="product_code" 
                        type="category" 
                        tick={{ fontSize: 11, fontWeight: 600 }}
                        width={80}
                      />
                      <Tooltip 
                        formatter={(v: number | string) => [`${v} Răng`, "Sản lượng"]}
                        labelFormatter={(label) => `Sản phẩm: ${topProducts.find(p => p.product_code === label)?.product_name || label}`}
                      />
                      <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--on-surface-muted)]">Không có dữ liệu biểu đồ</div>
                )}
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden border border-[var(--border-ghost)]">
            <div className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] px-5 py-4">
              <h2 className="flex items-center gap-2.5 font-bold text-[var(--on-surface)]">
                <NavIconChart className="h-5 w-5 text-[var(--primary)]" />
                Chi tiết sản lượng theo toàn bộ sản phẩm
              </h2>
            </div>
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 bg-[var(--surface-card)] hover:bg-transparent">
                    <TableHead className="w-[180px] font-bold uppercase tracking-wider text-[11px]">Mã sản phẩm</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[11px]">Tên sản phẩm</TableHead>
                    <TableHead className="text-right font-bold uppercase tracking-wider text-[11px]">Sản lượng (Răng)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center text-[var(--on-surface-muted)]">
                        Không có dữ liệu trong thời gian đã chọn
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.products.map((p) => (
                      <TableRow key={p.product_code}>
                        <TableCell className="font-mono text-sm font-semibold text-[var(--primary)]">{p.product_code}</TableCell>
                        <TableCell className="font-medium text-[var(--on-surface)]">{p.product_name}</TableCell>
                        <TableCell className="text-right font-bold text-[var(--on-surface)] text-base">{p.count.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

