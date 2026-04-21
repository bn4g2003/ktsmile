import Image from "next/image";
import { cn } from "@/lib/utils/cn";

const LOGO_SRC = "/logobaocao.png";

type BrandLogoProps = {
  className?: string;
  size?: number;
  priority?: boolean;
};

export function BrandLogo({ className, size = 44, priority }: BrandLogoProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt="KT Smile Lab"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-[var(--radius-lg)] object-cover", className)}
      priority={priority}
    />
  );
}
