-- Fix v_orders_by_partner_month: cộng dồn theo "GRAND TOTAL" của giấy báo
-- thanh toán (đơn) thay vì chỉ tổng dòng. Trước đây view chỉ sum(line_amount)
-- nên không phản ánh chiết khấu cấp đơn (billing_order_discount_*) và phí
-- khác (billing_other_fees) → công nợ KH lệch với GBTT in ra.
--
-- Công thức mới:
--   grand_total(order) = max(0,
--     sum_lines * (1 - billing_order_discount_percent/100)
--     - billing_order_discount_amount
--     + billing_other_fees
--   )
--
-- View vẫn giữ tên cột (partner_id, month, order_amount) để các trang đang
-- dùng không phải đổi.

create or replace view public.v_orders_by_partner_month as
with line_sums as (
  select
    lo.id as order_id,
    lo.partner_id,
    date_trunc('month', lo.received_at) as month,
    coalesce(sum(lol.line_amount), 0) as sum_lines
  from public.lab_orders lo
  left join public.lab_order_lines lol on lol.order_id = lo.id
  where lo.status <> 'cancelled'
  group by lo.id, lo.partner_id, date_trunc('month', lo.received_at)
)
select
  ls.partner_id,
  ls.month,
  sum(
    greatest(
      round(
        (ls.sum_lines
         * (1 - coalesce(lo.billing_order_discount_percent, 0) / 100.0)
         - coalesce(lo.billing_order_discount_amount, 0)
         + coalesce(lo.billing_other_fees, 0))::numeric,
        2
      ),
      0
    )
  ) as order_amount
from line_sums ls
join public.lab_orders lo on lo.id = ls.order_id
group by ls.partner_id, ls.month;

comment on view public.v_orders_by_partner_month is
  'Giá trị đơn theo partner và tháng (received_at) — đã trừ chiết khấu cấp đơn và cộng phí khác';
