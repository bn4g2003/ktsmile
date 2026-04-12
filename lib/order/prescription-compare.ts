/** Chuẩn hóa vị trí răng để so khớp phiếu BS với đơn điều phối. */
export function normToothPositions(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/,/g, " ");
}

export type QtyLine = {
  product_id: string;
  tooth_positions: string;
  work_type: string;
  quantity: number;
};

function aggregateKey(l: QtyLine): string {
  return l.product_id + "|" + normToothPositions(l.tooth_positions) + "|" + l.work_type;
}

/** Gom nhóm theo (SP + răng + loại công việc) và cộng SL. */
export function aggregateQuantities(lines: QtyLine[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lines) {
    const k = aggregateKey(l);
    m.set(k, (m.get(k) ?? 0) + l.quantity);
  }
  return m;
}

export type CompareResult = { ok: boolean; messages: string[] };

/** So sánh tổng SL theo từng nhóm giữa phiếu BS và đơn hàng. */
export function comparePrescriptionToOrderMaps(rx: QtyLine[], ord: QtyLine[]): CompareResult {
  const a = aggregateQuantities(rx);
  const b = aggregateQuantities(ord);
  const messages: string[] = [];
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of keys) {
    const qa = a.get(k) ?? 0;
    const qb = b.get(k) ?? 0;
    if (Math.abs(qa - qb) > 0.0001) {
      messages.push("Lệch SL nhóm «" + k + "»: phiếu BS " + qa + " — đơn điều phối " + qb);
    }
  }
  return { ok: messages.length === 0, messages };
}
