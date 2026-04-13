-- Đơn hàng: thay tuổi bằng năm sinh, bỏ người gửi/địa chỉ

-- Thêm cột năm sinh bệnh nhân
alter table public.lab_orders
  add column if not exists patient_year_of_birth smallint
    check (patient_year_of_birth is null or (patient_year_of_birth >= 1900 and patient_year_of_birth <= extract(year from current_date)));

comment on column public.lab_orders.patient_year_of_birth is 'Năm sinh bệnh nhân (thay cho patient_age)';

-- Copy dữ liệu từ patient_age sang patient_year_of_birth (nếu có)
update public.lab_orders
set patient_year_of_birth = extract(year from current_date) - patient_age
where patient_age is not null and patient_year_of_birth is null;

-- Xóa cột người gửi và địa chỉ (không còn cần thiết)
alter table public.lab_orders
  drop column if exists sender_name;

alter table public.lab_orders
  drop column if exists sender_phone;

alter table public.lab_orders
  drop column if exists delivery_address;

-- Giữ lại cột patient_age để tương thích ngược, sẽ xóa sau khi migration xong
-- (Có thể xóa hẳn sau khi đã cập nhật tất cả code)