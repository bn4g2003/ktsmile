-- Migration: Thêm cột contact_phone vào bảng lab_orders
-- Ngày: 2026-04-21
-- Mô tả: Thêm số điện thoại liên hệ cho đơn hàng

alter table public.lab_orders
  add column if not exists contact_phone text;

comment on column public.lab_orders.contact_phone is 'Số điện thoại liên hệ cho đơn hàng';
