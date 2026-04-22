import * as React from "react";
import { cn } from "@/lib/utils/cn";

const mono = "h-5 w-5 shrink-0 text-[currentColor]";

type SvgProps = React.SVGProps<SVGSVGElement>;

function Svg({ className, children, ...p }: SvgProps) {
  return (
    <svg
      className={cn(mono, className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...p}
    >
      {children}
    </svg>
  );
}

export function NavIconDashboard({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Svg>
  );
}

export function NavIconPartners({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

export function NavIconCatalog({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </Svg>
  );
}

export function NavIconTeam({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-2.24-3.6" />
      <path d="M18 3.4a4 4 0 0 1 0 7.2" />
    </Svg>
  );
}

export function NavIconPriceTag({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2 2 0 0 0 2.828 0l6.172-6.172a2 2 0 0 0 0-2.828z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function NavIconOrders({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </Svg>
  );
}

export function NavIconReview({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

export function NavIconWarehouseDoc({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </Svg>
  );
}

export function NavIconStock({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M21 16V8l-7-4-7 4v8l7 4 7-4z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </Svg>
  );
}

export function NavIconChart({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M3 3v18h18" />
      <path d="M7 16V9M12 16v-5M17 16v-8" />
    </Svg>
  );
}

export function NavIconCash({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </Svg>
  );
}

export function NavIconDebt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 6h16v12H4z" />
      <path d="M8 10h8M8 14h5" />
      <path d="M12 6V4" />
    </Svg>
  );
}

export function NavIconPayroll({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h10M7 13h6M15.5 15.5h.01" />
    </Svg>
  );
}


export function NavIconChevronDown({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function NavIconSidebarCollapse({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m13 15-3-3 3-3" />
      <path d="M4 21V3" />
      <path d="M10 12h10" />
    </Svg>
  );
}

export function NavIconSidebarExpand({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m11 9 3 3-3 3" />
      <path d="M20 21V3" />
      <path d="M4 12h10" />
    </Svg>
  );
}
