-- Cải thiện mã phiếu kho: ngắn gọn hơn, có mã NCC và số thứ tự
-- Format mới:
--   Phiếu nhập: PN-{MÃ_NCC}-{YYMMDD}-{STT}  (ví dụ: PN-SUP01-260421-001)
--   Phiếu xuất: PX-{YYMMDD}-{STT}           (ví dụ: PX-260421-001)

-- Bảng lưu số thứ tự phiếu theo ngày và loại
create table if not exists public.stock_document_sequences (
  sequence_date date not null,
  movement_type public.stock_movement_type not null,
  supplier_code text,
  last_number integer not null default 0,
  primary key (sequence_date, movement_type, supplier_code)
);

comment on table public.stock_document_sequences is 
  'Lưu số thứ tự phiếu kho theo ngày, loại phiếu và NCC để tạo mã phiếu ngắn gọn';

-- Function tạo mã phiếu tự động
create or replace function public.generate_stock_document_number(
  p_movement_type public.stock_movement_type,
  p_document_date date,
  p_supplier_id uuid default null
)
returns text
language plpgsql
as $$
declare
  v_supplier_code text;
  v_date_str text;
  v_next_number integer;
  v_number_str text;
  v_document_number text;
begin
  -- Lấy mã NCC nếu có
  v_supplier_code := null;
  if p_supplier_id is not null then
    select code into v_supplier_code
    from public.partners
    where id = p_supplier_id
    limit 1;
    
    -- Nếu không tìm thấy trong partners, thử suppliers (bảng cũ)
    if v_supplier_code is null then
      select code into v_supplier_code
      from public.suppliers
      where id = p_supplier_id
      limit 1;
    end if;
  end if;

  -- Format ngày: YYMMDD
  v_date_str := to_char(p_document_date, 'YYMMDD');

  -- Lấy và tăng số thứ tự
  insert into public.stock_document_sequences (sequence_date, movement_type, supplier_code, last_number)
  values (p_document_date, p_movement_type, coalesce(v_supplier_code, ''), 1)
  on conflict (sequence_date, movement_type, supplier_code)
  do update set last_number = stock_document_sequences.last_number + 1
  returning last_number into v_next_number;

  -- Format số thứ tự: 001, 002, ...
  v_number_str := lpad(v_next_number::text, 3, '0');

  -- Tạo mã phiếu
  if p_movement_type = 'inbound' then
    if v_supplier_code is not null and v_supplier_code <> '' then
      v_document_number := 'PN-' || v_supplier_code || '-' || v_date_str || '-' || v_number_str;
    else
      v_document_number := 'PN-' || v_date_str || '-' || v_number_str;
    end if;
  else -- outbound
    v_document_number := 'PX-' || v_date_str || '-' || v_number_str;
  end if;

  return v_document_number;
end;
$$;

comment on function public.generate_stock_document_number is
  'Tạo mã phiếu kho tự động theo format: PN-{MÃ_NCC}-{YYMMDD}-{STT} hoặc PX-{YYMMDD}-{STT}';

-- Ví dụ sử dụng:
-- SELECT generate_stock_document_number('inbound', '2026-04-21', 'uuid-of-supplier');
-- => PN-SUP01-260421-001
-- SELECT generate_stock_document_number('outbound', '2026-04-21', null);
-- => PX-260421-001
