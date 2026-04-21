# Cải thiện mã phiếu kho

## Vấn đề
Mã phiếu kho hiện tại quá dài và khó nhìn:
- `PN-NVL-20260421-A1B2C3D4` (quá dài, UUID ngẫu nhiên)
- `YCXK-20260421-E5F6G7H8` (không có thông tin NCC)

## Giải pháp
Format mới ngắn gọn và có ý nghĩa:
- Phiếu nhập: `PN-{MÃ_NCC}-{YYMMDD}-{STT}` 
  - Ví dụ: `PN-SUP01-260421-001`
- Phiếu xuất: `PX-{YYMMDD}-{STT}`
  - Ví dụ: `PX-260421-001`

Trong đó:
- `MÃ_NCC`: Mã nhà cung cấp (từ bảng partners/suppliers)
- `YYMMDD`: Ngày tạo phiếu (năm 2 số, tháng, ngày)
- `STT`: Số thứ tự tự động tăng theo ngày (001, 002, 003...)

## Cách chạy migration

### 1. Chạy migration SQL
```bash
# Nếu dùng Supabase CLI
supabase db push

# Hoặc chạy trực tiếp file SQL
psql -h your-db-host -U postgres -d postgres -f supabase/sql/20260421010000_improve_stock_document_numbering.sql
```

### 2. Kiểm tra
Sau khi chạy migration, tạo phiếu mới sẽ tự động có mã ngắn gọn:

```sql
-- Test tạo mã phiếu nhập
SELECT generate_stock_document_number('inbound', '2026-04-21', 'uuid-of-supplier');
-- Kết quả: PN-SUP01-260421-001

-- Test tạo mã phiếu xuất
SELECT generate_stock_document_number('outbound', '2026-04-21', null);
-- Kết quả: PX-260421-001
```

## Lưu ý
- Code đã có fallback: nếu migration chưa chạy, vẫn dùng format cũ
- Các phiếu cũ giữ nguyên mã, không bị ảnh hưởng
- Số thứ tự reset về 001 mỗi ngày mới
- Mỗi NCC có dãy số riêng trong cùng một ngày
