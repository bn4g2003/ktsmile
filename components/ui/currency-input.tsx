"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value: string | number;
  onChange: (value: string) => void;
  allowNegative?: boolean;
  allowDecimal?: boolean;
}

/**
 * Input cho số tiền với format tự động (dấu phân cách ngàn)
 * - Hiển thị: 1.000.000
 * - Giá trị thực: "1000000"
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, allowNegative = false, allowDecimal = true, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Format number với dấu phân cách ngàn
    const formatNumber = (num: string): string => {
      if (!num) return "";
      
      // Tách phần nguyên và phần thập phân
      const parts = num.split(".");
      const integerPart = parts[0] || "";
      const decimalPart = parts[1];
      
      // Format phần nguyên với dấu chấm
      const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      
      // Ghép lại với phần thập phân nếu có
      return decimalPart !== undefined ? `${formatted},${decimalPart}` : formatted;
    };

    // Parse từ display value về raw value
    const parseNumber = (formatted: string): string => {
      // Loại bỏ dấu phân cách ngàn (.)
      let cleaned = formatted.replace(/\./g, "");
      // Thay dấu phẩy thập phân thành dấu chấm
      cleaned = cleaned.replace(/,/g, ".");
      return cleaned;
    };

    // Sync display value khi value prop thay đổi
    React.useEffect(() => {
      const numStr = String(value || "");
      if (numStr === "") {
        setDisplayValue("");
        return;
      }
      
      // Nếu có dấu chấm thập phân, giữ nguyên format
      if (numStr.includes(".")) {
        const parts = numStr.split(".");
        const intPart = parts[0] || "";
        const decPart = parts[1] || "";
        setDisplayValue(formatNumber(intPart) + (decPart ? `,${decPart}` : ""));
      } else {
        setDisplayValue(formatNumber(numStr));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;

      // Cho phép rỗng
      if (input === "") {
        setDisplayValue("");
        onChange("");
        return;
      }

      // Loại bỏ ký tự không hợp lệ
      let cleaned = input.replace(/[^\d.,-]/g, "");
      
      // Xử lý dấu âm
      if (!allowNegative) {
        cleaned = cleaned.replace(/-/g, "");
      } else {
        // Chỉ cho phép dấu âm ở đầu
        const hasNegative = cleaned.startsWith("-");
        cleaned = cleaned.replace(/-/g, "");
        if (hasNegative) cleaned = "-" + cleaned;
      }

      // Xử lý dấu thập phân
      if (!allowDecimal) {
        cleaned = cleaned.replace(/[.,]/g, "");
      } else {
        // Chỉ cho phép 1 dấu thập phân (dấu phẩy)
        const commaCount = (cleaned.match(/,/g) || []).length;
        if (commaCount > 1) {
          // Giữ dấu phẩy đầu tiên
          const firstComma = cleaned.indexOf(",");
          cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, "");
        }
      }

      setDisplayValue(cleaned);

      // Parse về raw value và gọi onChange
      const rawValue = parseNumber(cleaned);
      onChange(rawValue);
    };

    const handleBlur = () => {
      // Format lại khi blur
      if (displayValue) {
        const rawValue = parseNumber(displayValue);
        const numValue = parseFloat(rawValue);
        
        if (!isNaN(numValue)) {
          if (allowDecimal) {
            // Giữ tối đa 2 chữ số thập phân
            const formatted = numValue.toFixed(2).replace(/\.?0+$/, "");
            const parts = formatted.split(".");
            const intPart = parts[0] || "";
            const decPart = parts[1];
            setDisplayValue(formatNumber(intPart) + (decPart ? `,${decPart}` : ""));
            onChange(formatted);
          } else {
            const intValue = Math.floor(numValue);
            setDisplayValue(formatNumber(String(intValue)));
            onChange(String(intValue));
          }
        }
      }
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn("text-right tabular-nums", className)}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
