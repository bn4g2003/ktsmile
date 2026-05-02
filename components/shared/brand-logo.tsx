"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import {
  BRAND_LOGO_FALLBACK_PUBLIC_PATH,
  BRAND_LOGO_PUBLIC_PATH,
} from "@/lib/brand/logo-public-path";

const PRIMARY_LOGO_SRC = BRAND_LOGO_PUBLIC_PATH;
const FALLBACK_LOGO_SRC = BRAND_LOGO_FALLBACK_PUBLIC_PATH;

type BrandLogoProps = {
  className?: string;
  size?: number;
  priority?: boolean;
};

export function BrandLogo({ className, size = 44, priority }: BrandLogoProps) {
  const [src, setSrc] = React.useState(PRIMARY_LOGO_SRC);

  return (
    <img
      src={src}
      alt="KT Smile Lab"
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      onError={() => {
        if (src !== FALLBACK_LOGO_SRC) setSrc(FALLBACK_LOGO_SRC);
      }}
      className={cn("shrink-0 rounded-[var(--radius-lg)] object-contain bg-white", className)}
    />
  );
}
