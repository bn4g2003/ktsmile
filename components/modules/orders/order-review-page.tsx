"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { bulkVerifyCoordReview } from "@/lib/actions/coord-review";
import { compareDoctorPrescriptionToLabOrder } from "@/lib/actions/doctor-prescriptions";
import { listLabOrders, type LabOrderRow } from "@/lib/actions/lab-orders";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { encodeMultiFilter } from "@/lib/grid/multi-filter";
import { formatCoordReviewStatus } from "@/lib/format/labels";

function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export function OrderReviewPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<LabOrderRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [bulkPending, setBulkPending] = React.useState(false);
  const [receivedFrom, setReceivedFrom] = React.useState("");
  const [receivedTo, setReceivedTo] = React.useState("");
  const [reviewFilter, setReviewFilter] = React.useState<"pending" | "verified" | "all">("pending");
  const [compareHint, setCompareHint] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const coord =
        reviewFilter === "all" ? "" : encodeMultiFilter([reviewFilter === "pending" ? "pending" : "verified"]);
      const res = await listLabOrders({
        page: 1,
        pageSize: 800,
        globalSearch: "",
        filters: {
          received_from: receivedFrom.trim(),
          received_to: receivedTo.trim(),
          coord_review_status: coord,
          received_sort: "asc",
        },
      });
      setRows(res.rows);
      setTotal(res.total);
      setSelected(new Set());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi tải");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [receivedFrom, receivedTo, reviewFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const onBulkVerify = async () => {
    if (!selected.size) return;
    if (!confirm("Xác nhận duyệt đối chiếu cho " + selected.size + " đơn đã chọn?")) return;
    setBulkPending(true);
    try {
      await bulkVerifyCoordReview([...selected]);
      await load();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBulkPending(false);
    }
  };

  const runCompare = async (orderId: string) => {
    setCompareHint(null);
    try {
      const { hasPrescription, result } = await compareDoctorPrescriptionToLabOrder(orderId);
      if (!hasPrescription) {
        setCompareHint("Đơn chưa gắn phiếu BS — thêm phiếu tại trang chi tiết đơn để đối chiếu.");
        return;
      }
      setCompareHint(
        result.ok
          ? "Khớp số lượng theo nhóm (SP + vị trí răng + loại công việc)."
          : result.messages.join("\n"),
      );
    } catch (e) {
      setCompareHint(e instanceof Error ? e.message : "Lỗi");
    }
  };

  let lastDay = "";
  const grouped = rows.map((r) => {
    const d = dayKey(r.received_at);
    const showHeader = d !== lastDay;
    lastDay = d;
    return { row: r, showHeader, day: d };
  });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h1 className="text-lg font-semibold text-[var(--on-surface)]">Kiểm tra đơn hàng (điều phối)</h1>
        <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
          Sắp xếp theo ngày nhận (cũ → mới), đối chiếu với phiếu chỉ định BS nếu đã liên kết, chỉnh sửa trực tiếp trên{" "}
          <Link href="/orders" className="font-medium text-[var(--primary)] underline-offset-2 hover:underline">
            Danh sách đơn
          </Link>{" "}
          hoặc trang chi tiết.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rv-from">Từ ngày</Label>
            <Input id="rv-from" type="date" value={receivedFrom} onChange={(e) => setReceivedFrom(e.target.value)} className="w-[11rem]" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rv-to">Đến ngày</Label>
            <Input id="rv-to" type="date" value={receivedTo} onChange={(e) => setReceivedTo(e.target.value)} className="w-[11rem]" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rv-st">Trạng thái đối chiếu</Label>
            <Select
              id="rv-st"
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value as typeof reviewFilter)}
              className="min-w-[10rem]"
            >
              <option value="pending">Chờ đối chiếu</option>
              <option value="verified">Đã duyệt</option>
              <option value="all">Tất cả</option>
            </Select>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Làm mới
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!selected.size || bulkPending} onClick={() => void onBulkVerify()}>
            {bulkPending ? "Đang lưu…" : "Duyệt đã chọn (" + selected.size + ")"}
          </Button>
        </div>
        {compareHint ? (
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-[var(--surface-muted)] p-3 text-xs text-[var(--on-surface)]">
            {compareHint}
          </pre>
        ) : null}
      </Card>

      {err ? <p className="text-sm text-[#b91c1c]">{err}</p> : null}
      {loading ? <p className="text-sm text-[var(--on-surface-muted)]">Đang tải…</p> : null}

      {!loading && !err ? (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-ghost)]">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={() => toggleAllOnPage()}
                  />
                </th>
                <th className="px-2 py-2">Ngày</th>
                <th className="px-2 py-2">Số đơn</th>
                <th className="px-2 py-2">Khách</th>
                <th className="px-2 py-2">BN / Nha khoa</th>
                <th className="px-2 py-2">Phiếu BS</th>
                <th className="px-2 py-2">Đối chiếu</th>
                <th className="px-2 py-2 text-right">Tổng</th>
                <th className="px-2 py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-[var(--on-surface-muted)]">
                    Không có đơn trong khoảng lọc ({total} tổng hệ thống).
                  </td>
                </tr>
              ) : (
                grouped.map(({ row: r, showHeader, day }) => (
                  <React.Fragment key={r.id}>
                    {showHeader ? (
                      <tr className="bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]">
                        <td colSpan={9} className="px-3 py-2 text-xs font-bold text-[var(--on-surface)]">
                          Ngày {day} ({rows.filter((x) => dayKey(x.received_at) === day).length} đơn)
                        </td>
                      </tr>
                    ) : null}
                    <tr className="border-b border-[var(--border-ghost)] last:border-b-0">
                      <td className="px-2 py-2">
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                      </td>
                      <td className="px-2 py-2 tabular-nums">{r.received_at}</td>
                      <td className="px-2 py-2">
                        <Link href={"/orders/" + r.id} className="font-medium text-[var(--primary)] underline-offset-2 hover:underline">
                          {r.order_number}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        <span className="text-xs text-[var(--on-surface-muted)]">{r.partner_code}</span>
                        <br />
                        {r.partner_name}
                      </td>
                      <td className="max-w-[14rem] px-2 py-2">
                        <div className="font-medium">{r.patient_name}</div>
                        {r.clinic_name ? (
                          <div className="text-xs text-[var(--on-surface-muted)]">{r.clinic_name}</div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-xs">{r.prescription_slip_code ?? (r.doctor_prescription_id ? "—" : "Chưa gắn")}</td>
                      <td className="px-2 py-2 text-xs">{formatCoordReviewStatus(r.coord_review_status)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.total_amount.toLocaleString("vi-VN")}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void runCompare(r.id)}>
                            So khớp
                          </Button>
                          <Link
                            href={"/orders/" + r.id}
                            className="inline-flex h-7 items-center rounded-[var(--radius-sm)] px-2 text-xs font-medium text-[var(--primary)] hover:underline"
                          >
                            Sửa
                          </Link>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
