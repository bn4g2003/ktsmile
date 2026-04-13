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
  const [selectedPartnerId, setSelectedPartnerId] = React.useState<string | null>(null);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPriceMatrix();
      setData(res);
      if (res.partners.length > 0 && !selectedPartnerId) {
        setSelectedPartnerId(res.partners[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [selectedPartnerId]);

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

  const selectedPartner = React.useMemo(() => {
    return data?.partners.find((p) => p.id === selectedPartnerId);
  }, [data, selectedPartnerId]);

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
        if (newPrice.trim() === "" || val <= 0) {
          await deletePartnerPrice(existingId);
        } else {
          await updatePartnerPrice(existingId, {
            partner_id: partnerId,
            product_id: productId,
            unit_price: val,
          });
        }
      } else if (newPrice.trim() !== "" && val > 0) {
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

  if (loading && !data) return <div className="p-8 text-center text-[var(--on-surface-muted)]">Đang tải dữ liệu...</div>;
  if (error) return <div className="p-8 text-rose-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] bg-[var(--surface-canvas)]">
      {/* Sidebar: List of Partners */}
      <div className="flex w-80 flex-col border-r border-[var(--border-ghost)] bg-[var(--surface-sidebar)] shadow-sm">
        <div className="p-4 border-b border-[var(--border-ghost)] space-y-3">
          <h2 className="text-lg font-bold text-[var(--on-surface)]">Khách hàng</h2>
          <Input 
            placeholder="Tìm mã hoặc tên..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {filteredPartners.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPartnerId(p.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-md transition-all group",
                selectedPartnerId === p.id 
                  ? "bg-[var(--primary)] text-white shadow-md" 
                  : "text-[var(--on-surface)] hover:bg-[var(--surface-muted)]"
              )}
            >
              <div className="font-semibold text-sm line-clamp-1">{p.name}</div>
              <div className={cn(
                "text-[10px] uppercase font-bold tracking-tighter",
                selectedPartnerId === p.id ? "text-white/70" : "text-[var(--on-surface-faint)]"
              )}>
                {p.code} — {data.overrides.filter(o => o.partner_id === p.id).length} giá riêng
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Price Grid for Selected Partner */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {selectedPartner ? (
          <>
            <div className="p-4 bg-white border-b border-[var(--border-ghost)] flex items-center justify-between shadow-sm z-10">
              <div>
                <h1 className="text-xl font-bold text-[var(--on-surface)]">
                  Bảng giá: {selectedPartner.name}
                </h1>
                <p className="text-xs text-[var(--on-surface-muted)] flex items-center gap-2">
                  <span className="bg-[var(--surface-muted)] px-1.5 py-0.5 rounded border border-[var(--border-ghost)]">{selectedPartner.code}</span>
                  • Thiết lập giá riêng hoặc % giảm giá so với giá gốc.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchData}>Làm mới</Button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="rounded-[var(--radius-lg)] border border-[var(--border-ghost)] bg-white shadow-[var(--shadow-card)] overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-row-b)] text-left">
                      <th className="px-6 py-4 font-bold text-[var(--on-surface-muted)] uppercase tracking-wider text-[11px]">Sản phẩm</th>
                      <th className="px-6 py-4 font-bold text-[var(--on-surface-muted)] uppercase tracking-wider text-[11px] text-right">Giá gốc</th>
                      <th className="px-6 py-4 font-bold text-[var(--accent-purple)] uppercase tracking-wider text-[11px] text-center w-32 border-x border-[var(--border-ghost)] bg-[color-mix(in_srgb,var(--accent-purple)_5%,transparent)]">% Giảm</th>
                      <th className="px-6 py-4 font-bold text-[var(--primary)] uppercase tracking-wider text-[11px] text-center w-48">Giá riêng (KH)</th>
                      <th className="px-6 py-4 font-bold text-[var(--on-surface-muted)] uppercase tracking-wider text-[11px] text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-ghost)]">
                    {data.products.map((product) => {
                      const override = data.overrides.find(
                        (o) => o.partner_id === selectedPartner.id && o.product_id === product.id
                      );
                      const isUpdating = updatingId === `${selectedPartner.id}-${product.id}`;
                      
                      // Tính % giảm hiện tại nếu có override
                      const currentDiscount = override 
                        ? Math.round((1 - override.unit_price / product.unit_price) * 100) 
                        : 0;

                      return (
                        <tr key={product.id} className="hover:bg-[var(--surface-muted)] transition-colors group">
                          <td className="px-6 py-3">
                            <div className="font-bold text-[var(--on-surface)] group-hover:text-[var(--primary)] transition-colors">{product.name}</div>
                            <div className="text-[10px] text-[var(--on-surface-faint)] uppercase font-medium">{product.code}</div>
                          </td>
                          <td className="px-6 py-3 text-right font-medium tabular-nums text-[var(--on-surface-muted)]">
                            {product.unit_price.toLocaleString("vi-VN")}
                          </td>
                          
                          {/* Percent Discount Column */}
                          <td className="px-6 py-3 border-x border-[var(--border-ghost)] bg-[color-mix(in_srgb,var(--accent-purple)_2%,transparent)]">
                            <div className="flex items-center gap-1.5 focus-within:ring-1 ring-[var(--accent-purple)] rounded-md transition-all">
                              <Input
                                type="number"
                                placeholder="0"
                                className="h-8 text-sm text-center border-none bg-transparent focus:ring-0 tabular-nums font-semibold text-[var(--accent-purple)] placeholder:text-[var(--on-surface-faint)]"
                                defaultValue={override ? currentDiscount : ""}
                                onBlur={(e) => {
                                  const pct = parseFloat(e.target.value);
                                  if (!isNaN(pct)) {
                                    const newPrice = Math.round(product.unit_price * (1 - pct / 100));
                                    if (newPrice !== (override?.unit_price ?? product.unit_price)) {
                                      void handlePriceChange(selectedPartner.id, product.id, newPrice.toString(), override?.id);
                                    }
                                  } else if (e.target.value === "" && override) {
                                    void handlePriceChange(selectedPartner.id, product.id, "", override.id);
                                  }
                                }}
                                disabled={isUpdating}
                              />
                              <span className="text-[10px] font-bold text-[var(--accent-purple)] pr-1">%</span>
                            </div>
                          </td>

                          {/* Price Column */}
                          <td className="px-6 py-3">
                            <Input
                              type="number"
                              defaultValue={override ? override.unit_price : ""}
                              placeholder={product.unit_price.toString()}
                              className={cn(
                                "h-8 text-sm text-center tabular-nums transition-all border-dashed",
                                override 
                                  ? "border-[var(--primary)] font-bold text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]" 
                                  : "border-[var(--border-ghost)]"
                              )}
                              onBlur={(e) => {
                                 const newVal = e.target.value;
                                 const currentVal = override ? override.unit_price.toString() : "";
                                 if (newVal !== currentVal) {
                                   void handlePriceChange(selectedPartner.id, product.id, newVal, override?.id);
                                 }
                              }}
                              disabled={isUpdating}
                            />
                          </td>

                          <td className="px-6 py-3 text-center">
                            {isUpdating ? (
                              <div className="flex justify-center">
                                <span className="h-4 w-4 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
                              </div>
                            ) : override ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase ring-1 ring-emerald-300/30">Giá Riêng</span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 font-bold uppercase ring-1 ring-slate-200">Gốc</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--on-surface-muted)]">
            Chọn một khách hàng ở danh sách bên trái để bắt đầu.
          </div>
        )}
      </div>
    </div>
  );
}
