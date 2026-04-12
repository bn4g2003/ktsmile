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
import { labOrderStatusOptions } from "@/lib/format/labels";

export type LabOrderStatusQuickDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderLabel: string;
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
  value,
  onValueChange,
  onConfirm,
  pending,
  error,
}: LabOrderStatusQuickDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Đổi trạng thái đơn</DialogTitle>
          <DialogDescription>Đơn {orderLabel}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {error ? <p className="text-sm text-[#b91c1c]">{error}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="lo-quick-st">Trạng thái</Label>
            <Select
              id="lo-quick-st"
              value={value}
              onChange={(e) => onValueChange(e.target.value as LabOrderRow["status"])}
            >
              {labOrderStatusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="button" variant="primary" disabled={pending} onClick={() => void onConfirm()}>
              {pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
