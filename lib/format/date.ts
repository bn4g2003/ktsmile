/**
 * Format a date string or Date object to dd-mm-yyyy format (Vietnamese)
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  
  const d = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return "—";
  
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  
  return `${day}-${month}-${year}`;
}

/**
 * Format a date string or Date object to dd-mm-yyyy HH:mm format (Vietnamese)
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  
  const d = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return "—";
  
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}