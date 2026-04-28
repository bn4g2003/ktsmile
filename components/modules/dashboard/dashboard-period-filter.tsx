"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function DashboardPeriodFilter({
  selectedYear,
  selectedMonth,
}: {
  selectedYear: number;
  selectedMonth: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, idx) => now - 3 + idx);
  }, []);

  const updateFilter = (nextYear: number, nextMonth: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(nextYear));
    params.set("month", String(nextMonth));
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedMonth}
        onChange={(e) => updateFilter(selectedYear, Number(e.target.value))}
        className="rounded-md border border-[#dbe2ef] bg-[#f7f9fc] px-2 py-1 text-xs font-medium text-[#5f6f8a]"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {`Tháng ${m}`}
          </option>
        ))}
      </select>
      <select
        value={selectedYear}
        onChange={(e) => updateFilter(Number(e.target.value), selectedMonth)}
        className="rounded-md border border-[#dbe2ef] bg-[#f7f9fc] px-2 py-1 text-xs font-medium text-[#5f6f8a]"
      >
        {yearOptions.map((year) => (
          <option key={year} value={year}>
            {`Năm ${year}`}
          </option>
        ))}
      </select>
    </div>
  );
}
