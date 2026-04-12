import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const dbUrl = process.env.DATABASE_URL?.trim();
let supabaseUrl = process.env.SUPABASE_URL?.trim();
if (!supabaseUrl && dbUrl) {
  const m = dbUrl.match(/@db\.([^.]+)\.supabase\.co/i);
  if (m?.[1]) supabaseUrl = `https://${m[1]}.supabase.co`;
}
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

console.log("URL:", supabaseUrl);
console.log("Key:", key ? key.slice(0, 20) + "..." : "MISSING");

const supabase = createClient(supabaseUrl, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Test 1: cash_transactions
console.log("\n--- Test cash_transactions ---");
const cashSelect =
  "id, transaction_date, doc_number, payment_channel, direction, business_category, amount, partner_id, payer_name, description, reference_type, reference_id, created_at, updated_at, partners!cash_transactions_partner_id_fkey(code,name)";

const { data: cashData, error: cashErr, count: cashCount } = await supabase
  .from("cash_transactions")
  .select(cashSelect, { count: "exact" })
  .order("transaction_date", { ascending: false })
  .range(0, 24);

if (cashErr) {
  console.log("CASH ERROR:", cashErr.message);
  console.log("CASH ERROR CODE:", cashErr.code);
  console.log("CASH ERROR DETAILS:", JSON.stringify(cashErr, null, 2));

  // Try without payer_name
  console.log("\n--- Retry cash without payer_name ---");
  const cashSelect2 =
    "id, transaction_date, doc_number, payment_channel, direction, business_category, amount, partner_id, description, reference_type, reference_id, created_at, updated_at, partners!cash_transactions_partner_id_fkey(code,name)";
  const { data: d2, error: e2 } = await supabase
    .from("cash_transactions")
    .select(cashSelect2, { count: "exact" })
    .order("transaction_date", { ascending: false })
    .range(0, 24);
  if (e2) {
    console.log("CASH RETRY ERROR:", e2.message);

    // Try without partner embed
    console.log("\n--- Retry cash without partner embed ---");
    const cashSelect3 =
      "id, transaction_date, doc_number, payment_channel, direction, business_category, amount, partner_id, description, reference_type, reference_id, created_at, updated_at";
    const { data: d3, error: e3 } = await supabase
      .from("cash_transactions")
      .select(cashSelect3, { count: "exact" })
      .order("transaction_date", { ascending: false })
      .range(0, 24);
    if (e3) console.log("CASH MINIMAL ERROR:", e3.message);
    else console.log("CASH MINIMAL OK, count:", d3?.length);
  } else {
    console.log("CASH RETRY OK (no payer_name), count:", d2?.length);
  }
} else {
  console.log("CASH OK, rows:", cashData?.length, "total:", cashCount);
}

// Test 2: lab_orders (sales)
console.log("\n--- Test lab_orders (sales) ---");
const labSelect =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at, order_category, sender_name, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, partners!lab_orders_partner_id_fkey(code,name), doctor_prescriptions!lab_orders_doctor_prescription_id_fkey(slip_code), lab_order_lines!lab_order_lines_order_id_fkey(line_amount)";

const { data: labData, error: labErr, count: labCount } = await supabase
  .from("lab_orders")
  .select(labSelect, { count: "exact" })
  .order("received_at", { ascending: false })
  .range(0, 24);

if (labErr) {
  console.log("LAB ERROR:", labErr.message);
  console.log("LAB ERROR CODE:", labErr.code);
  console.log("LAB ERROR DETAILS:", JSON.stringify(labErr, null, 2));

  // Try the simplest select
  console.log("\n--- Retry lab_orders minimal ---");
  const labSelect2 =
    "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at";
  const { data: d2, error: e2 } = await supabase
    .from("lab_orders")
    .select(labSelect2, { count: "exact" })
    .order("received_at", { ascending: false })
    .range(0, 24);
  if (e2) console.log("LAB MINIMAL ERROR:", e2.message);
  else console.log("LAB MINIMAL OK, count:", d2?.length);
} else {
  console.log("LAB OK, rows:", labData?.length, "total:", labCount);
}

console.log("\nDone.");
