import { Suspense } from "react";
import { OrderReviewPage } from "@/components/modules/orders/order-review-page";

export default function Page() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <OrderReviewPage />
    </Suspense>
  );
}
