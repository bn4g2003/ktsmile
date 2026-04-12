"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/** Đánh dấu đã đối chiếu / duyệt cho nhiều đơn (bộ phận điều phối). */
export async function bulkVerifyCoordReview(orderIds: string[]): Promise<{ updated: number }> {
  const ids = [...new Set(orderIds.map((x) => x.trim()).filter(Boolean))];
  if (!ids.length) return { updated: 0 };
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("lab_orders")
    .update({
      coord_review_status: "verified",
      coord_reviewed_at: new Date().toISOString(),
    })
    .in("id", ids)
    .select("id");
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  revalidatePath("/orders/review");
  return { updated: data?.length ?? 0 };
}
