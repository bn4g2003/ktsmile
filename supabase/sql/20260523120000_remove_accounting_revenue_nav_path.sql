-- Gỡ /accounting/revenue khỏi phân quyền menu (trang đã bỏ).
delete from public.app_role_nav_paths where path = '/accounting/revenue';
