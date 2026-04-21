"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  createPartnerPrice,
  deletePartnerPrice,
  getPriceMatrix,
  updatePartnerPrice,
} from "@/lib/actions/partner-prices";
import { cn } from "@/lib/utils/cn";
import { PriceQuotePrintButton } from "@/components/shared/reports/price-quote-print-button";

type MatrixData = {
  partners: { id: string; code: string; name: string }[];
  products: { id: string; code: string; name: string; unit_price: number }[];
  overrides: { id: string; partner_id: string; product_id: string; unit_price: number }[];
};

type PriceChange = {
  productId: string;
  newPrice: string;
  existingId?: string;
};

export function PricesPage() {
  const router = useRouter();
  const [data, setData] = React.useState<MatrixData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedPartnerId, setSelectedPartnerId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  
  // Track pending changes
  const [pendingChanges, setPendingChanges] = React.useState<Map<string, PriceChange>>(new Map());

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPriceMatrix();
      setData(res);
      setPendingChanges(new Map()); // Clear pending changes after refresh
      // Auto-select first partner on desktop if none selected
      if (res.partners.length > 0 && !selectedPartnerId && window.innerWidth >= 1024) {
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

  const handlePriceInputChange = (
    productId: string,
    newPrice: string,
    existingId?: string,
  ) => {
    const key = `${selectedPartnerId}-${productId}`;
    const newChanges = new Map(pendingChanges);
    
    if (newPrice.trim() === "") {
      // Mark for deletion if there's an existing override
      if (existingId) {
        newChanges.set(key, { productId, newPrice: "", existingId });
      } else {
        newChanges.delete(key);
      }
    } else {
      newChanges.set(key, { productId, newPrice, existingId });
    }
    
    setPendingChanges(newChanges);
  };

  const saveAllChanges = async () => {
    if (!selectedPartnerId || pendingChanges.size === 0) return;
    
    setSaving(true);
    try {
      for (const [, change] of pendingChanges) {
        const val = Number(change.newPrice);
        
        if (change.existingId) {
          if (change.newPrice.trim() === "" || val <= 0) {
            await deletePartnerPrice(change.existingId);
          } else {
            await updatePartnerPrice(change.existingId, {
              partner_id: selectedPartnerId,
              product_id: change.productId,
              unit_price: val,
            });
          }
        } else if (change.newPrice.trim() !== "" && val > 0) {
          await createPartnerPrice({
            partner_id: selectedPartnerId,
            product_id: change.productId,
            unit_price: val,
          });
        }
      }
      
      await fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi lưu thay đổi");
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setPendingChanges(new Map());
    // Force re-render inputs by toggling partner
    const currentId = selectedPartnerId;
    setSelectedPartnerId(null);
    setTimeout(() => setSelectedPartnerId(currentId), 0);
  };

  if (loading && !data) return <div className="p-8 text-center text-[var(--on-surface-muted)]">Đang tải dữ liệu...</div>;
  if (error) return <div className="p-8 text-rose-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-theme(spacing.16))] bg-[var(--surface-canvas)] overflow-hidden">
      {/* Sidebar: List of Partners */}
      <div className={cn(
        "flex w-full lg:w-80 flex-col border-r border-[var(--border-ghost)] bg-[var(--surface-sidebar)] shadow-sm shrink-0",
        selectedPartnerId ? "hidden lg:flex" : "flex"
      )}>
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
              onClick={() => {
                if (pendingChanges.size > 0) {
                  if (!confirm("Có thay đổi chưa lưu. Bỏ qua thay đổi?")) return;
                  setPendingChanges(new Map());
                }
                setSelectedPartnerId(p.id);
              }}
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
      <div className={cn(
        "flex-1 overflow-hidden flex flex-col min-w-0",
        !selectedPartnerId ? "hidden lg:flex" : "flex"
      )}>
        {selectedPartner ? (
          <>
            <div className="p-4 bg-white border-b border-[var(--border-ghost)] flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    if (pendingChanges.size > 0) {
                      if (!confirm("Có thay đổi chưa lưu. Bỏ qua thay đổi?")) return;
                      setPendingChanges(new Map());
                    }
                    setSelectedPartnerId(null);
                  }}
                  className="lg:hidden h-8 w-8 p-0"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-[var(--on-surface)] leading-tight">
                    {selectedPartner.name}
                  </h1>
                  <p className="text-[10px] text-[var(--on-surface-muted)] flex items-center gap-1.5 mt-0.5">
                    <span className="bg-[var(--surface-muted)] px-1 py-0 rounded border border-[var(--border-ghost)] uppercase font-bold">{selectedPartner.code}</span>
                    <span className="hidden sm:inline">• Thiết lập giá riêng hoặc % chiết khấu</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pendingChanges.size > 0 && (
                  <>
                    <span className="text-xs text-amber-600 font-semibold hidden sm:inline">
                      {pendingChanges.size} thay đổi
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={discardChanges}
                      className="h-8 px-2 sm:px-3 text-xs"
                    >
                      Hủy
                    </Button>
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={saveAllChanges}
                      disabled={saving}
                      className="h-8 px-2 sm:px-3 text-xs"
                    >
                      {saving ? "Đang lưu..." : "Lưu thay đổi"}
                    </Button>
                  </>
                )}
                <PriceQuotePrintButton 
                  partnerId={selectedPartner.id} 
                  label="In báo giá"
                  variant="secondary"
                  size="sm"
                />
                <Button variant="secondary" size="sm" onClick={fetchData} className="shrink-0 h-8 px-2 sm:px-3 text-xs sm:text-sm">Làm mới</Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3 sm:p-6">
              <div className="rounded-[var(--radius-lg)] border border-[var(--border-ghost)] bg-white shadow-[var(--shadow-card)] overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-row-b)] text-left">
                      <th className="px-4 py-3 font-bold text-[var(--on-surface-muted)] uppercase tracking-wider text-[10px]">Sản phẩm</th>
                      <th className="px-4 py-3 font-bold text-[var(--on-surface-muted)] uppercase tracking-wider text-[10px] text-right">Gốc</th>
                      <th className="px-4 py-3 font-bold text-[var(--accent-purple)] uppercase tracking-wider text-[10px] text-center w-24 border-x border-[var(--border-ghost)] bg-[color-mix(in_srgb,var(--accent-purple)_5%,transparent)]">% Giảm</th>
                      <th className="px-4 py-3 font-bold text-[var(--primary)] uppercase tracking-wider text-[10px] text-center w-36">Giá riêng</th>
                      <th className="px-4 py-3 font-bold text-[var(--on-surface-muted)] uppercase tracking-wider text-[10px] text-center w-24">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-ghost)]">
                    {data.products.map((product) => {
                      const override = data.overrides.find(
                        (o) => o.partner_id === selectedPartner.id && o.product_id === product.id
                      );
                      const changeKey = `${selectedPartner.id}-${product.id}`;
                      const pendingChange = pendingChanges.get(changeKey);
                      const hasChanges = pendingChange !== undefined;
                      
                      const currentDiscount = override 
                        ? Math.round((1 - override.unit_price / product.unit_price) * 100) 
                        : 0;

                      return (
                        <tr key={product.id} className={cn(
                          "hover:bg-[var(--surface-muted)] transition-colors group",
                          hasChanges && "bg-amber-50"
                        )}>
                          <td className="px-4 py-3">
                            <div className="font-bold text-[var(--on-surface)] group-hover:text-[var(--primary)] transition-colors leading-tight">{product.name}</div>
                            <div className="text-[9px] text-[var(--on-surface-faint)] uppercase font-semibold mt-0.5">{product.code}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--on-surface-muted)]">
                            {product.unit_price.toLocaleString("vi-VN")}
                          </td>
                          
                          <td className="px-3 py-2 border-x border-[var(--border-ghost)] bg-[color-mix(in_srgb,var(--accent-purple)_2%,transparent)]">
                            <div className="flex items-center gap-1 focus-within:ring-1 ring-[var(--accent-purple)] rounded-md transition-all">
                              <Input
                                type="number"
                                placeholder="0"
                                className="h-7 text-xs text-center border-none bg-transparent focus:ring-0 tabular-nums font-semibold text-[var(--accent-purple)] placeholder:text-[var(--on-surface-faint)] px-1"
                                defaultValue={override ? currentDiscount : ""}
                                onChange={(e) => {
                                  const pct = parseFloat(e.target.value);
                                  if (!isNaN(pct)) {
                                    const newPrice = Math.round(product.unit_price * (1 - pct / 100));
                                    handlePriceInputChange(product.id, newPrice.toString(), override?.id);
                                  } else if (e.target.value === "") {
                                    handlePriceInputChange(product.id, "", override?.id);
                                  }
                                }}
                              />
                              <span className="text-[9px] font-bold text-[var(--accent-purple)] pr-0.5">%</span>
                            </div>
                          </td>

                          <td className="px-3 py-2">
                            <CurrencyInput
                              value={override ? override.unit_price.toString() : ""}
                              placeholder={product.unit_price.toString()}
                              className={cn(
                                "h-7 text-xs text-center tabular-nums transition-all border-dashed px-1",
                                override 
                                  ? "border-[var(--primary)] font-bold text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]" 
                                  : "border-[var(--border-ghost)]",
                                hasChanges && "ring-2 ring-amber-400"
                              )}
                              onChange={(val) => {
                                handlePriceInputChange(product.id, val, override?.id);
                              }}
                              allowDecimal={false}
                            />
                          </td>

                          <td className="px-3 py-2 text-center">
                            {hasChanges ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold uppercase ring-1 ring-amber-300/30 whitespace-nowrap">Chưa lưu</span>
                            ) : override ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase ring-1 ring-emerald-300/30 whitespace-nowrap">Riêng</span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 font-bold uppercase ring-1 ring-slate-200 whitespace-nowrap">Gốc</span>
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
          <div className="flex-1 flex items-center justify-center text-[var(--on-surface-muted)] text-sm px-8 text-center">
            Chọn một khách hàng ở danh sách bên trái để xem và thiết lập giá.
          </div>
        )}
      </div>
    </div>
  );
}
