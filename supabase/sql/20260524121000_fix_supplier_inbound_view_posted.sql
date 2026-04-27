-- Fix v_supplier_inbound_by_month: chỉ cộng phiếu nhập đã ghi sổ
-- (posting_status = 'posted'). Trước đây view cộng mọi phiếu inbound, kể cả
-- bản nháp/đang chờ → công nợ NCC bị đẩy lên sớm và sai lệch.
--
-- Dùng coalesce(posting_status, 'posted') để vẫn tương thích DB cũ chưa có
-- cột (mặc định coi như đã ghi sổ).

create or replace view public.v_supplier_inbound_by_month as
select
  d.supplier_id,
  date_trunc('month', d.document_date::timestamp)::date as month,
  sum(coalesce(sl.line_amount, round(sl.quantity * sl.unit_price, 2)))::numeric(14, 2) as inbound_amount
from public.stock_documents d
join public.stock_lines sl on sl.document_id = d.id
where d.movement_type = 'inbound'
  and d.supplier_id is not null
  and coalesce(d.posting_status, 'posted') = 'posted'
group by d.supplier_id, date_trunc('month', d.document_date::timestamp)::date;

comment on view public.v_supplier_inbound_by_month is
  'PS tăng công nợ NCC theo tháng từ phiếu nhập kho — chỉ tính phiếu posting_status=posted (coalesce mặc định posted cho DB cũ).';
