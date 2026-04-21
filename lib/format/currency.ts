export function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount);
}

export function amountInWordsVietnamese(amount: number): string {
  const ChuSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  
  function doc3so(so: number): string {
    let tram = Math.floor(so / 100);
    let chuc = Math.floor((so % 100) / 10);
    let donvi = so % 10;
    let res = "";
    if (tram > 0) {
      res += ChuSo[tram] + " trăm ";
      if (chuc === 0 && donvi !== 0) res += "lẻ ";
    }
    if (chuc !== 0 && chuc !== 1) {
      res += ChuSo[chuc] + " mươi ";
    }
    if (chuc === 1) res += "mười ";
    switch (donvi) {
      case 1:
        if (chuc !== 0 && chuc !== 1) res += "mốt";
        else res += ChuSo[donvi];
        break;
      case 5:
        if (chuc === 0) res += ChuSo[donvi];
        else res += "lăm";
        break;
      default:
        if (donvi !== 0 || res === "") res += ChuSo[donvi];
        break;
    }
    return res;
  }

  if (amount === 0) return "Không đồng";
  let res = "";
  let ti = Math.floor(amount / 1000000000);
  amount %= 1000000000;
  let trieu = Math.floor(amount / 1000000);
  amount %= 1000000;
  let nghin = Math.floor(amount / 1000);
  amount %= 1000;
  let dong = amount;

  if (ti > 0) res += doc3so(ti) + " tỷ ";
  if (trieu > 0) res += doc3so(trieu) + " triệu ";
  if (nghin > 0) res += doc3so(nghin) + " nghìn ";
  if (dong > 0) res += doc3so(dong);
  
  res = res.trim();
  if (res.length > 0) {
    res = res.charAt(0).toUpperCase() + res.slice(1) + " đồng";
  }
  return res;
}
