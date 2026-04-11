"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-[color-mix(in_srgb,var(--surface-canvas)_88%,#fff)] px-6 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-[min(100%,112rem)] flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <div className="relative min-w-0 w-full max-w-md flex-1 sm:min-w-[12rem]">
          <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[var(--on-surface-faint)]">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <Input
            variant="search"
            className="w-full pl-11"
            placeholder="Tìm kiếm đơn hàng, đối tác…"
            aria-label="Tìm kiếm toàn cục"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" type="button" className="min-h-11 min-w-11 px-0" aria-label="Thông báo">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </Button>
          <Button variant="secondary" type="button" className="hidden sm:inline-flex" asChild>
            <Link href="/orders">Đơn hàng</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
