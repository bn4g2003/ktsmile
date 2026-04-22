-- Add total_inbound and total_outbound columns to stock views

-- Drop dependent views first to allow column changes in underlying views
drop view if exists public.v_products_admin_grid cascade;
drop view if exists public.v_product_stock cascade;
drop view if exists public.v_material_stock cascade;

-- Re-create v_product_stock with flow columns
create view public.v_product_stock as
select
  p.id as product_id,
  p.code as product_code,
  p.name as product_name,
  p.unit,
  p.product_usage,
  coalesce(sum(case when d.movement_type = 'inbound' then sl.quantity else 0 end), 0)::numeric(14, 4) as total_inbound,
  coalesce(sum(case when d.movement_type = 'outbound' then sl.quantity else 0 end), 0)::numeric(14, 4) as total_outbound,
  coalesce(
    sum(
      case
        when d.movement_type = 'inbound' then sl.quantity
        when d.movement_type = 'outbound' then -sl.quantity
      end
    ),
    0
  )::numeric(14, 4) as quantity_on_hand,
  ps.supplier_id as primary_supplier_id,
  s.code as primary_supplier_code,
  s.name as primary_supplier_name
from public.products p
left join public.stock_lines sl on sl.product_id = p.id
left join public.stock_documents d
  on d.id = sl.document_id
  and d.posting_status = 'posted'
left join lateral (
  select ps2.supplier_id
  from public.product_suppliers ps2
  where ps2.product_id = p.id
    and ps2.is_primary
  limit 1
) ps on true
left join public.suppliers s on s.id = ps.supplier_id
group by p.id, p.code, p.name, p.unit, p.product_usage, ps.supplier_id, s.code, s.name;

comment on view public.v_product_stock is
  'Tồn kho = nhập − xuất (chỉ phiếu posting_status = posted); hỗ trợ cột tổng nhập/xuất';

-- Re-create v_products_admin_grid (Lưới danh mục SP/NVL)
create view public.v_products_admin_grid as
select
  p.id,
  p.code,
  p.name,
  p.unit,
  p.unit_price,
  p.warranty_years,
  p.is_active,
  p.product_usage,
  p.created_at,
  p.updated_at,
  coalesce(v.quantity_on_hand, 0)::numeric(14, 4) as quantity_on_hand,
  v.primary_supplier_id,
  v.primary_supplier_code,
  v.primary_supplier_name,
  coalesce(
    (select count(*)::int from public.product_suppliers x where x.product_id = p.id),
    0
  ) as supplier_link_count
from public.products p
left join public.v_product_stock v on v.product_id = p.id;

comment on view public.v_products_admin_grid is
  'Danh sách SP/NVL cho admin: tồn kho, NCC chính, số liên kết NCC';

-- Re-create v_material_stock with flow columns
create view public.v_material_stock as
select
  m.id as material_id,
  m.legacy_product_id as product_id,
  m.code as material_code,
  m.name as material_name,
  m.unit,
  coalesce(sum(case when d.movement_type = 'inbound' then sl.quantity else 0 end), 0)::numeric(14, 4) as total_inbound,
  coalesce(sum(case when d.movement_type = 'outbound' then sl.quantity else 0 end), 0)::numeric(14, 4) as total_outbound,
  coalesce(
    sum(
      case
        when d.movement_type = 'inbound' then sl.quantity
        when d.movement_type = 'outbound' then -sl.quantity
      end
    ),
    0
  )::numeric(14, 4) as quantity_on_hand,
  ms.supplier_id as primary_supplier_id,
  s.code as primary_supplier_code,
  s.name as primary_supplier_name
from public.materials m
left join public.stock_lines sl on sl.product_id = m.legacy_product_id
left join public.stock_documents d on d.id = sl.document_id and d.posting_status = 'posted'
left join lateral (
  select ms2.supplier_id
  from public.material_suppliers ms2
  where ms2.material_id = m.id and ms2.is_primary
  limit 1
) ms on true
left join public.suppliers s on s.id = ms.supplier_id
group by m.id, m.legacy_product_id, m.code, m.name, m.unit, ms.supplier_id, s.code, s.name;

comment on view public.v_material_stock is
  'Tồn kho NVL từ materials (map legacy_product_id -> stock_lines.product_id), hỗ trợ tổng nhập/xuất';
