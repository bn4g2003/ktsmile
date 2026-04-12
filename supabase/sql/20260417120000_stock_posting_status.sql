-- Phiếu kho: nháp (yêu cầu) vs đã ghi nhận tồn. Chỉ phiếu posted mới vào v_product_stock.

alter table public.stock_documents
  add column if not exists posting_status text not null default 'posted';

alter table public.stock_documents
  drop constraint if exists stock_documents_posting_status_check;

alter table public.stock_documents
  add constraint stock_documents_posting_status_check
  check (posting_status in ('draft', 'posted'));

create index if not exists stock_documents_posting_status_idx
  on public.stock_documents (posting_status);

comment on column public.stock_documents.posting_status is
  'draft = yêu cầu/chưa trừ tồn; posted = đã ghi nhận nhập−xuất';

create or replace view public.v_product_stock as
select
  p.id as product_id,
  p.code as product_code,
  p.name as product_name,
  p.unit,
  coalesce(
    sum(
      case
        when d.movement_type = 'inbound' then sl.quantity
        when d.movement_type = 'outbound' then -sl.quantity
      end
    ),
    0
  )::numeric(14, 4) as quantity_on_hand
from public.products p
left join public.stock_lines sl on sl.product_id = p.id
left join public.stock_documents d
  on d.id = sl.document_id
  and d.posting_status = 'posted'
group by p.id, p.code, p.name, p.unit;

comment on view public.v_product_stock is
  'Tồn kho = tổng nhập − tổng xuất (chỉ phiếu posting_status = posted)';
