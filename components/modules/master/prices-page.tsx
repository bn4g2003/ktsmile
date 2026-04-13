"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createPartnerPrice,
  deletePartnerPrice,
  getPriceMatrix,
  updatePartnerPrice,
} from "@/lib/actions/partner-prices";
import { cn } from "@/lib/utils/cn";

type MatrixData = {
  partners: { id: string; code: string; name: string }[];
  products: { id: string; code: string; name: string; unit_price: number }[];
  overrides: { id: string; partner_id: string; product_id: string; unit_price: number }[];
};

export function PricesPage() {
  const router = useRouter();
  const [data, setData] = React.useState<MatrixData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPriceMatrix();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredPartners = React.useMemo(() => {
    if (!data) return [];
    const s = searchTerm.toLowerCase();
    return data.partners.filter(
      (p) => p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s),
    );
  }, [data, searchTerm]);

  const handlePriceChange = async (
    partnerId: string,
    productId: string,
    newPrice: string,
    existingId?: string,
  ) => {
    const val = Number(newPrice);
    if (Number.isNaN(val)) return;

    const key = `${partnerId}-${productId}`;
    setUpdatingId(key);
    try {
      if (existingId) {
        if (newPrice.trim() === "") {
          await deletePartnerPrice(existingId);
        } else {
          await updatePartnerPrice(existingId, {
            partner_id: partnerId,
            product_id: productId,
            unit_price: val,
          });
        }
      } else if (newPrice.trim() !== "") {
        await createPartnerPrice({
          partner_id: partnerId,
          product_id: productId,
          unit_price: val,
        });
      }
      const res = await getPriceMatrix();
      setData(res);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi cập nhật giá");
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading && !data) return <div className="p-8 text-center">Đang tải bảng giá…</div>;
  if (error) return <div className="p-8 text-rose-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--on-surface)]">Bảng giá theo khách hàng</h1>
          <p className="text-sm text-[var(--on-surface-muted)]">
            Chọn một khách hàng bên dưới để thiết lập bảng giá chi tiết.
          </p>
        </div>
        <div className="flex items-center gap-2">
           <Input 
             placeholder="Tìm khách hàng..." 
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
             className="w-64"
           />
           <Button variant="secondary" onClick={fetchData}>Làm mới</Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filteredPartners.map((partner) => {
          const isExpanded = expandedId === partner.id;
          const overrideCount = data.overrides.filter(o => o.partner_id === partner.id).length;

          return (
            <div 
              key={partner.id} 
              className={cn(
                "rounded-[var(--radius-md)] border transition-all overflow-hidden",
                isExpanded 
                  ? "border-[var(--primary)] ring-1 ring-[var(--primary)] shadow-[var(--shadow-card)]" 
                  : "border-[var(--border-ghost)] bg-white hover:border-[var(--on-surface-faint)]"
              )}
            >
              <div 
                className={cn(
                  "px-4 py-3 cursor-pointer flex items-center justify-between group",
                  isExpanded ? "bg-[var(--primary-muted)]" : "bg-white"
                )}
                onClick={() => toggleExpand(partner.id)}
              >
                <div className="flex items-center gap-4">
                   <div className={cn(
                     "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors",
                     isExpanded ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-muted)] text-[var(--on-surface-muted)] group-hover:bg-[var(--border-ghost)]"
                   )}>
                     {partner.code.slice(0, 2)}
                   </div>
                   <div>
                      <div className="font-bold text-[var(--on-surface)]">{partner.name}</div>
                      <div className="text-xs text-[var(--on-surface-faint)]">{partner.code}</div>
                   </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">
                      {overrideCount} giá riêng
                    </div>
                    <div className="text-[10px] text-[var(--on-surface-faint)]">
                      {data.products.length} sản phẩm tổng
                    </div>
                  </div>
                  <svg
                    className={cn("h-5 w-5 text-[var(--on-surface-faint)] transition-transform duration-200", isExpanded && "rotate-180")}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              
              {isExpanded && (
                <div className="border-t border-[var(--border-ghost)] animate-in slide-in-from-top-2 duration-200">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-row-b)] text-left">
                          <th className="px-5 py-3 font-semibold text-[var(--on-surface-muted)]">Sản phẩm</th>
                          <th className="px-5 py-3 font-semibold text-[var(--on-surface-muted)] w-32">Giá mặc định</th>
                          <th className="px-5 py-3 font-semibold text-[var(--primary)] w-48">Giá riêng (KH)</th>
                          <th className="px-5 py-3 font-semibold text-[var(--on-surface-muted)] w-24">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-ghost)]">
                        {data.products.map((product) => {
                          const override = data.overrides.find(
                            (o) => o.partner_id === partner.id && o.product_id === product.id
                          );
                          const isUpdating = updatingId === `${partner.id}-${product.id}`;

                          return (
                            <tr key={product.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                              <td className="px-5 py-2.5">
                                <div className="font-medium text-[var(--on-surface)]">{product.name}</div>
                                <div className="text-[11px] text-[var(--on-surface-faint)] lowercase">{product.code}</div>
                              </td>
                              <td className="px-5 py-2.5 text-[var(--on-surface-muted)]">
                                {product.unit_price.toLocaleString("vi-VN")}
                              </td>
                              <td className="px-5 py-2.5">
                                <Input
                                  type="number"
                                  defaultValue={override ? override.unit_price : ""}
                                  placeholder={product.unit_price.toString()}
                                  className={cn(
                                    "h-9 text-sm focus:ring-2",
                                    override && "border-[var(--primary)] font-semibold text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]"
                                  )}
                                  onBlur={(e) => {
                                     const newVal = e.target.value;
                                     const currentVal = override ? override.unit_price.toString() : "";
                                     if (newVal !== currentVal) {
                                       void handlePriceChange(partner.id, product.id, newVal, override?.id);
                                     }
                                  }}
                                  disabled={isUpdating}
                                />
                              </td>
                              <td className="px-5 py-2.5">
                                {isUpdating ? (
                                  <span className="text-[10px] animate-pulse text-[var(--primary)] font-bold">Lưu...</span>
                                ) : override ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase ring-1 ring-emerald-200">Ưu tiên</span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium uppercase ring-1 ring-slate-200">Mặc định</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
