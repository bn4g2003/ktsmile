"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DebtSettlementDetail } from "@/components/modules/accounting/debt-settlement-detail";
import type { DebtRow } from "@/lib/actions/debt";
import type { PayableRow } from "@/lib/actions/payables";

export type DebtSettlementModalState =
  | { kind: "receivable"; row: DebtRow }
  | { kind: "payable"; row: PayableRow }
  | null;

type Props = {
  state: DebtSettlementModalState;
  onClose: () => void;
  year: string;
  month: string;
  onRecordedReceivable: () => void;
  onRecordedPayable: () => void;
};

export function DebtSettlementModal({
  state,
  onClose,
  year,
  month,
  onRecordedReceivable,
  onRecordedPayable,
}: Props) {
  const open = state != null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent size="2xl" className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-5 sm:p-6">
        {state?.kind === "receivable" ? (
          <>
            <DialogHeader className="shrink-0 space-y-1 pb-3">
              <DialogTitle>Ghi thu công nợ — {state.row.partner_code}</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Tháng đang xem trên lưới: {month}/{year}. Chứng từ ghi vào sổ quỹ; có thể in phiếu thu sau mỗi lần lưu.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              <DebtSettlementDetail
                mode="receivable"
                row={state.row}
                year={year}
                month={month}
                onRecorded={() => {
                  onRecordedReceivable();
                }}
              />
            </div>
          </>
        ) : null}
        {state?.kind === "payable" ? (
          <>
            <DialogHeader className="shrink-0 space-y-1 pb-3">
              <DialogTitle>Ghi chi trả NCC — {state.row.supplier_code}</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Tháng đang xem trên lưới: {month}/{year}. Chứng từ ghi vào sổ quỹ; có thể in phiếu chi sau mỗi lần lưu.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              <DebtSettlementDetail
                mode="payable"
                row={state.row}
                year={year}
                month={month}
                onRecorded={() => {
                  onRecordedPayable();
                }}
              />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
