"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { LabOrderRow } from "@/lib/actions/lab-orders";
import { canChangeLabOrderStatusFrom, formatOrderStatus, labOrderStatusOptions } from "@/lib/format/labels";

export type LabOrderStatusQuickDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderLabel: string;
  /** Trạng thái hiện tại trên server. */
  currentStatus: LabOrderRow["status"];
  /** Các giá trị được phép chọn (thường từ allowedLabOrderStatusTargets). */
  allowedStatuses: LabOrderRow["status"][];
  value: LabOrderRow["status"];
  onValueChange: (v: LabOrderRow["status"]) => void;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
  error?: string | null;
};

export function LabOrderStatusQuickDialog({
  open,
  onOpenChange,
  orderLabel,
  currentStatus,
  allowedStatuses,
  value,
  onValueChange,
  onConfirm,
  pending,
  error,
}: LabOrderStatusQuickDialogProps) {
  const allowed = new Set(allowedStatuses);
  const canEdit = canChangeLabOrderStatusFrom(currentStatus);
  const selectOptions = labOrderStatusOptions.filter((o) => allowed.has(o.value));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Đổi trạng thái đơn</DialogTitle>
          <DialogDescription>Đơn {orderLabel}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {error ? <p className="text-sm text-[#b91c1c]">{error}</p> : null}
          {!canEdit ? (
            <p className="text-sm text-[var(--on-surface-muted)]">
              Trạng thái hiện tại: <strong>{formatOrderStatus(currentStatus)}</strong>. Đơn đã giao hoặc đã hủy
              không đổi trạng thái được nữa.
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="lo-quick-st">Trạng thái</Label>
            <Select
              id="lo-quick-st"
              value={value}
              disabled={!canEdit}
              onChange={(e) => onValueChange(e.target.value as LabOrderRow["status"])}
            >
              {selectOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
            {canEdit ? (
              <Button
                type="button"
                variant="primary"
                disabled={pending || value === currentStatus}
                onClick={() => void onConfirm()}
              >
                {pending ? "Đang lưu…" : "Lưu"}
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
