"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import {
  createAppRole,
  deleteAppRole,
  getAppRoleNavPaths,
  listAppRolesAdmin,
  saveAppRoleNavPaths,
  updateAppRole,
  type AppRoleRow,
} from "@/lib/actions/app-roles";
import { SHELL_NAV_GROUPS_META, SHELL_NAV_STAR } from "@/lib/nav/shell-nav-catalog";

export function EmployeesRolesPanel({ onRolesChanged }: { onRolesChanged: () => void }) {
  const [rows, setRows] = React.useState<AppRoleRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [paths, setPaths] = React.useState<Set<string>>(new Set());
  const [fullAccess, setFullAccess] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const loadList = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await listAppRolesAdmin();
      setRows(list);
      if (selectedId && !list.some((r) => r.id === selectedId)) {
        setSelectedId(null);
        setCreating(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không tải được vai trò");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  React.useEffect(() => {
    void loadList();
  }, []);

  const loadRoleDetail = React.useCallback(async (roleId: string) => {
    setErr(null);
    try {
      const p = await getAppRoleNavPaths(roleId);
      if (p.includes(SHELL_NAV_STAR)) {
        setFullAccess(true);
        setPaths(new Set());
      } else {
        setFullAccess(false);
        setPaths(new Set(p));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không tải phân quyền");
    }
  }, []);

  React.useEffect(() => {
    if (creating || !selectedId) return;
    const row = rows.find((r) => r.id === selectedId);
    if (!row) return;
    setCode(row.code);
    setName(row.name);
    setDescription(row.description ?? "");
    setIsActive(row.is_active);
    void loadRoleDetail(selectedId);
  }, [creating, selectedId, rows, loadRoleDetail]);

  const selectCreate = () => {
    setCreating(true);
    setSelectedId(null);
    setCode("");
    setName("");
    setDescription("");
    setIsActive(true);
    setFullAccess(false);
    setPaths(new Set());
    setErr(null);
  };

  const selectRow = (id: string) => {
    setCreating(false);
    setSelectedId(id);
    setErr(null);
  };

  const togglePath = (href: string) => {
    if (fullAccess) return;
    setPaths((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  const saveMeta = async () => {
    if (creating) {
      setPending(true);
      setErr(null);
      try {
        const id = await createAppRole({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
        });
        setCreating(false);
        setSelectedId(id);
        await loadList();
        onRolesChanged();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Không tạo được");
      } finally {
        setPending(false);
      }
      return;
    }
    if (!selectedId) return;
    setPending(true);
    setErr(null);
    try {
      await updateAppRole(selectedId, {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || null,
        is_active: isActive,
      });
      await loadList();
      onRolesChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không lưu được");
    } finally {
      setPending(false);
    }
  };

  const savePathsOnly = async () => {
    if (!selectedId || creating) return;
    setPending(true);
    setErr(null);
    try {
      const list = fullAccess ? [SHELL_NAV_STAR] : [...paths];
      await saveAppRoleNavPaths(selectedId, list);
      onRolesChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không lưu phân quyền");
    } finally {
      setPending(false);
    }
  };

  const onDelete = async () => {
    if (!selectedId || creating) return;
    if (!confirm("Xóa vai trò này? Nhân viên gán vai trò sẽ mất liên kết (app_role_id = null).")) return;
    setPending(true);
    setErr(null);
    try {
      await deleteAppRole(selectedId);
      setSelectedId(null);
      await loadList();
      onRolesChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không xóa được");
    } finally {
      setPending(false);
    }
  };

  const editorOpen = creating || Boolean(selectedId);

  return (
    <div className="flex min-h-[420px] flex-col gap-4 lg:flex-row">
      <div className="flex w-full flex-col rounded-[var(--radius-lg)] border border-[var(--border-ghost)] bg-[var(--surface-card)] lg:max-w-xs">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-ghost)] p-3">
          <span className="text-sm font-semibold text-[var(--on-surface)]">Vai trò</span>
          <Button type="button" size="sm" variant="secondary" onClick={selectCreate}>
            Thêm
          </Button>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2">
          {loading ? (
            <p className="px-2 py-3 text-sm text-[var(--on-surface-muted)]">Đang tải…</p>
          ) : rows.length === 0 ? (
            <p className="px-2 py-3 text-sm text-[var(--on-surface-muted)]">Chưa có vai trò.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {rows.map((r) => {
                const active = !creating && selectedId === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => selectRow(r.id)}
                      className={cn(
                        "flex w-full flex-col rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition",
                        active
                          ? "bg-[var(--primary-muted)] font-semibold text-[var(--primary)]"
                          : "text-[var(--on-surface)] hover:bg-[var(--surface-muted)]",
                        !r.is_active && "opacity-60",
                      )}
                    >
                      <span>{r.name}</span>
                      <span className="text-xs font-normal text-[var(--on-surface-muted)]">{r.code}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-4 rounded-[var(--radius-lg)] border border-[var(--border-ghost)] bg-[var(--surface-card)] p-4">
        {!editorOpen ? (
          <p className="text-sm text-[var(--on-surface-muted)]">Chọn vai trò bên trái hoặc bấm Thêm.</p>
        ) : (
          <>
            {err ? <p className="text-sm text-[#b91c1c]">{err}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="role-code">Mã (slug)</Label>
                <Input
                  id="role-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="vd: ke_toan_vien"
                  autoComplete="off"
                />
                <p className="text-[11px] text-[var(--on-surface-faint)]">
                  Mã dùng nội bộ (slug); đổi mã sẽ không tự cập nhật mã đã lưu trên nhân viên.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role-name">Tên hiển thị</Label>
                <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="role-desc">Mô tả</Label>
                <Input id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <input
                  type="checkbox"
                  id="role-active"
                  className="h-5 w-5 rounded-[var(--radius-sm)] border border-[var(--border-ghost)]"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <Label htmlFor="role-active" className="normal-case tracking-normal">
                  Đang sử dụng
                </Label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="primary" size="sm" disabled={pending} onClick={() => void saveMeta()}>
                {creating ? "Tạo vai trò" : "Lưu thông tin"}
              </Button>
              {!creating && selectedId ? (
                <>
                  <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => void savePathsOnly()}>
                    Lưu phân quyền menu
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => void onDelete()}>
                    Xóa vai trò
                  </Button>
                </>
              ) : null}
            </div>

            {!creating && selectedId ? (
              <div className="space-y-3 border-t border-[var(--border-ghost)] pt-4">
                <p className="text-sm font-semibold text-[var(--on-surface)]">Menu sidebar</p>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-[var(--border-ghost)]"
                    checked={fullAccess}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setFullAccess(on);
                      if (on) setPaths(new Set());
                    }}
                  />
                  Toàn quyền (tất cả mục)
                </label>
                <div className={cn("space-y-4", fullAccess && "pointer-events-none opacity-50")}>
                  {SHELL_NAV_GROUPS_META.map((g) => (
                    <div key={g.title}>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                        {g.title}
                      </p>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {g.items.map((it) => (
                          <li key={it.href}>
                            <label className="flex cursor-pointer items-start gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--border-ghost)]"
                                checked={paths.has(it.href)}
                                disabled={fullAccess}
                                onChange={() => togglePath(it.href)}
                              />
                              <span>
                                <span className="font-medium text-[var(--on-surface)]">{it.label}</span>
                                <span className="block text-[11px] text-[var(--on-surface-faint)]">{it.href}</span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : creating ? (
              <p className="border-t border-[var(--border-ghost)] pt-4 text-sm text-[var(--on-surface-muted)]">
                Sau khi tạo vai trò, chọn vai trò đó để gán quyền menu.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
