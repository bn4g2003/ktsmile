-- Dữ liệu mẫu demo (mã DEMO-*). Chạy qua npm run db:seed với DATABASE_URL.

begin;

delete from public.partner_opening_balances
where partner_id in (select id from public.partners where code like 'DEMO-%');

delete from public.cash_transactions where doc_number like 'DEMO.%';

delete from public.partner_contracts where contract_number like 'DEMO-%';

delete from public.stock_lines
where document_id in (select id from public.stock_documents where document_number like 'DEMO-%');

delete from public.stock_documents where document_number like 'DEMO-%';

delete from public.lab_order_lines
where order_id in (select id from public.lab_orders where order_number like 'DEMO-%');

delete from public.lab_orders where order_number like 'DEMO-%';

delete from public.partner_product_prices
where partner_id in (select id from public.partners where code like 'DEMO-%');

delete from public.employees where code like 'DEMO-%';

delete from public.products where code like 'DEMO-%';

delete from public.partners where code like 'DEMO-%';

insert into public.partners (id, code, name, partner_type, representative_name, phone, address, tax_id, default_discount_percent, notes)
values
  ('a1000000-0000-4000-8000-000000000001', 'DEMO-PK01', N'Nha khoa Demo Smile', 'customer_clinic', N'BS. Nguyễn A', '0901000001', N'Q1 TP.HCM', '0311111111', 10, N'Dữ liệu mẫu'),
  ('a1000000-0000-4000-8000-000000000002', 'DEMO-LAB01', N'Labo Demo Ceramic', 'customer_labo', N'Lab Owner B', '0901000002', N'Q3 TP.HCM', '0311111112', 15, N'Dữ liệu mẫu'),
  ('a1000000-0000-4000-8000-000000000003', 'DEMO-NCC01', N'NCC Vật tư Demo', 'supplier', N'NV Kinh doanh', '0901000003', N'Bình Thạnh', '0311111113', 0, N'Nhập phôi');

insert into public.products (id, code, name, unit, unit_price, warranty_years)
values
  ('b2000000-0000-4000-8000-000000000001', 'DEMO-ZIR', N'Phôi sứ Zirconia HT', N'Cái', 850000.00, 3),
  ('b2000000-0000-4000-8000-000000000002', 'DEMO-CER', N'Sườn Cercon HT', N'Cái', 1200000.00, 2),
  ('b2000000-0000-4000-8000-000000000003', 'DEMO-3DP', N'In mẫu 3D', N'Cái', 150000.00, null);

insert into public.partner_product_prices (partner_id, product_id, unit_price)
values
  ('a1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 800000.00),
  ('a1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002', 1100000.00);

insert into public.employees (id, code, full_name, role, base_salary)
values
  ('c3000000-0000-4000-8000-000000000001', 'DEMO-NV01', N'Trần Kỹ thuật', N'KTV chạy máy', 12000000.00),
  ('c3000000-0000-4000-8000-000000000002', 'DEMO-NV02', N'Lê Thiết kế', N'KTV thiết kế', 11500000.00);

insert into public.partner_contracts (id, partner_id, contract_number, title, signed_date, valid_from, status, notes)
values
  ('g9000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'DEMO-HD-2025-01',
   N'Hợp đồng khung cung cấp phục hình', current_date - 30, current_date - 30, 'active', N'Dữ liệu mẫu');

insert into public.lab_orders (id, order_number, received_at, partner_id, patient_name, status, notes)
values
  ('d4000000-0000-4000-8000-000000000001', 'DEMO-ORD-001', current_date - 2,
   'a1000000-0000-4000-8000-000000000001', N'Nguyễn Văn Bệnh nhân', 'in_progress', N'Răng sứ thẩm mỹ');

insert into public.lab_order_lines (id, order_id, product_id, tooth_positions, shade, quantity, unit_price, discount_percent)
values
  ('e5000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001',
   'b2000000-0000-4000-8000-000000000001', '11-21', 'A2', 2, 800000.00, 10),
  ('e5000000-0000-4000-8000-000000000002', 'd4000000-0000-4000-8000-000000000001',
   'b2000000-0000-4000-8000-000000000003', '36', '3M2', 1, 150000.00, 10);

insert into public.stock_documents (id, document_number, document_date, movement_type, partner_id, reason, notes)
values
  ('f6000000-0000-4000-8000-000000000001', 'DEMO-PNK-001', current_date - 5, 'inbound',
   'a1000000-0000-4000-8000-000000000003', N'Nhập phôi', N'Phiếu nhập mẫu');

insert into public.stock_lines (id, document_id, product_id, quantity, unit_price)
values
  ('f7000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000001',
   'b2000000-0000-4000-8000-000000000001', 50, 600000.00),
  ('f7000000-0000-4000-8000-000000000002', 'f6000000-0000-4000-8000-000000000001',
   'b2000000-0000-4000-8000-000000000002', 20, 900000.00);

insert into public.stock_documents (id, document_number, document_date, movement_type, partner_id, reason)
values
  ('f6000000-0000-4000-8000-000000000002', 'DEMO-PXK-001', current_date - 1, 'outbound', null, N'Xuất sản xuất đơn DEMO');

insert into public.stock_lines (id, document_id, product_id, quantity, unit_price)
values
  ('f7000000-0000-4000-8000-000000000003', 'f6000000-0000-4000-8000-000000000002',
   'b2000000-0000-4000-8000-000000000001', 2, 600000.00);

insert into public.cash_transactions (id, transaction_date, doc_number, payment_channel, direction, business_category, amount, partner_id, description, contract_id)
values
  ('a8000000-0000-4000-8000-000000000001', current_date - 1, 'DEMO.T.001', 'mbbank', 'receipt', N'Thu bán hàng', 5000000.00,
   'a1000000-0000-4000-8000-000000000001', N'Ứng tiền đơn', 'g9000000-0000-4000-8000-000000000001'),
  ('a8000000-0000-4000-8000-000000000002', current_date - 1, 'DEMO.C.001', 'cash', 'payment', N'Chi mua hàng', 3000000.00,
   'a1000000-0000-4000-8000-000000000003', N'Thanh toán NCC', null);

insert into public.partner_opening_balances (partner_id, year, month, opening_balance, notes)
values
  ('a1000000-0000-4000-8000-000000000001', extract(year from current_date)::smallint, extract(month from current_date)::smallint, 1000000.00, N'Dư nợ đầu kỳ mẫu'),
  ('a1000000-0000-4000-8000-000000000002', extract(year from current_date)::smallint, extract(month from current_date)::smallint, 0, null);

commit;
