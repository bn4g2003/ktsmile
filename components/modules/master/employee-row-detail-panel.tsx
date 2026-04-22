"use client";

import * as React from "react";
import { DetailPreview } from "@/components/ui/detail-preview";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import { permissionPresetLabel } from "@/lib/auth/permission-presets";
import type { EmployeeRow } from "@/lib/actions/employees";
import { formatDate } from "@/lib/format/date";

function fmtMoney(n: number) {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

export function EmployeeRowDetailPanel({ row }: { row: EmployeeRow }) {
  const [tab, setTab] = React.useState<"info" | "salary" | "system">("info");

  React.useEffect(() => {
    setTab("info");
  }, [row.id]);

  const monthly = Number(row.base_salary) || 0;
  const yearly = monthly * 12;
  const perDay22 = monthly > 0 ? monthly / 22 : 0;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <DetailTabStrip
        items={[
          { id: "info", label: "Thông tin" },
          { id: "salary", label: "Lương & quy đổi" },
          { id: "system", label: "Liên kết & nhật ký" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />
      {tab === "info" ? (
        <DetailPreview
          groups={[
            {
              title: "Hồ sơ nhân sự",
              fields: [
                { label: "MÃ NV:", value: row.code },
                { label: "HỌ TÊN:", value: row.full_name },
                { label: "VAI TRÒ:", value: row.role },
                { label: "QUYỀN HẠN:", value: permissionPresetLabel(row.permissions), span: "full" },
              ]
            },
            {
              title: "Liên hệ & Địa chỉ",
              fields: [
                { label: "SỐ ĐIỆN THOẠI:", value: row.phone ?? "—" },
                { label: "EMAIL:", value: row.email ?? "—" },
                { label: "ĐỊA CHỈ:", value: row.address ?? "—", span: "full" },
                { label: "TRẠNG THÁI:", value: row.is_active ? "Đang hoạt động" : "Ngừng hoạt động" },
              ]
            }
          ]}
        />
      ) : null}
      {tab === "salary" ? (
        <div className="space-y-4">
          <DetailPreview
            groups={[
              {
                title: "Định mức tài chính",
                fields: [
                  {
                    label: "LƯƠNG CƠ BẢN (THÁNG):",
                    value: <span className="font-bold text-[var(--primary)]">{fmtMoney(monthly)} đ</span>,
                  },
                  {
                    label: "QUY ĐỔI NĂM (×12):",
                    value: fmtMoney(yearly) + " đ",
                  },
                  {
                    label: "ƯỚC LƯƠNG/NGÀY CÔNG (÷22 NGÀY):",
                    value: monthly > 0 ? fmtMoney(Math.round(perDay22)) + " đ" : "—",
                  },
                ]
              }
            ]}
          />
          <p className="text-xs leading-relaxed text-[var(--on-surface-muted)]">
            Quy đổi ngày chỉ mang tính tham khảo (giả định 22 ngày công/tháng). Không thay thế bảng
            lương / chấm công chính thức.
          </p>
        </div>
      ) : null}
      {tab === "system" ? (
        <div className="space-y-4">
          <DetailPreview
            groups={[
              {
                title: "Tài khoản & Liên kết Auth",
                fields: [
                  {
                    label: "AUTH USER ID:",
                    value: row.auth_user_id ? (
                      <code className="break-all rounded bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-mono">
                        {row.auth_user_id}
                      </code>
                    ) : (
                      "— (chưa liên kết)"
                    ),
                    span: "full",
                  },
                  { label: "USERNAME NỘI BỘ:", value: row.username ?? "—" },
                  {
                    label: "MẬT KHẨU LƯU DB:",
                    value: row.password_plain ? (
                      <code className="break-all rounded bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-mono">
                        {row.password_plain}
                      </code>
                    ) : (
                      "—"
                    ),
                    span: "full",
                  },
                ]
              },
              {
                title: "Nhật ký hệ thống",
                fields: [
                  { label: "TẠO LÚC:", value: formatDate(row.created_at) },
                  { label: "CẬP NHẬT LẦN CUỐI:", value: formatDate(row.updated_at) },
                  { label: "GHI CHÚ:", value: row.notes ?? "—", span: "full" },
                ]
              }
            ]}
          />
          <p className="text-xs leading-relaxed text-[var(--on-surface-muted)]">
            Liên kết tài khoản đăng nhập (Supabase Auth) có thể bổ sung sau để phân quyền theo vai trò.
            Khi có bảng phát sinh theo nhân viên (đơn hàng, sổ quỹ…), có thể thêm tab tại đây.
          </p>
        </div>
      ) : null}
    </div>
  );
}
