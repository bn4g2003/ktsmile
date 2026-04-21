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
          fields={[
            { label: "Mã NV", value: row.code },
            { label: "Họ tên", value: row.full_name },
            { label: "Vai trò", value: row.role },
            { label: "Quyền hạn", value: permissionPresetLabel(row.permissions), span: "full" },
            { label: "SĐT", value: row.phone ?? "—" },
            { label: "Email", value: row.email ?? "—" },
            { label: "Địa chỉ", value: row.address ?? "—", span: "full" },
            { label: "Hoạt động", value: row.is_active ? "Có" : "Không" },
          ]}
        />
      ) : null}
      {tab === "salary" ? (
        <div className="space-y-4">
          <DetailPreview
            fields={[
              {
                label: "Lương cơ bản (tháng)",
                value: fmtMoney(monthly) + " đ",
              },
              {
                label: "Quy đổi năm (×12)",
                value: fmtMoney(yearly) + " đ",
              },
              {
                label: "Ước lương/ngày công (÷22 ngày)",
                value:
                  monthly > 0
                    ? fmtMoney(Math.round(perDay22)) + " đ (làm tròn)"
                    : "—",
              },
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
            fields={[
              {
                label: "Auth user id",
                value: row.auth_user_id ? (
                  <code className="break-all rounded bg-[var(--surface-muted)] px-2 py-1 text-xs">
                    {row.auth_user_id}
                  </code>
                ) : (
                  "— (chưa liên kết)"
                ),
                span: "full",
              },
              { label: "Username nội bộ", value: row.username ?? "—" },
              {
                label: "Mật khẩu lưu DB",
                value: row.password_plain ? (
                  <code className="break-all rounded bg-[var(--surface-muted)] px-2 py-1 text-xs">
                    {row.password_plain}
                  </code>
                ) : (
                  "—"
                ),
                span: "full",
              },
              { label: "Ghi chú", value: row.notes ?? "—", span: "full" },
              { label: "Tạo lúc", value: formatDate(row.created_at) },
              { label: "Cập nhật lần cuối", value: formatDate(row.updated_at) },
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
