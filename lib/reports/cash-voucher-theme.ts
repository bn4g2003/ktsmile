export function cashVoucherThemeCss(): string {
  return `
      .cr-root { color: #0f172a; }
      .cr-title {
        color: #1d4ed8 !important;
        margin: 0 0 14px;
        text-align: center;
        font-size: 20px;
        letter-spacing: 0.04em;
      }
      .cr-meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 20px;
        max-width: 100%;
        margin: 0 auto 16px;
        padding: 12px 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 11px;
      }
      .cr-meta p { margin: 0; display: flex; gap: 10px; align-items: baseline; min-width: 0; }
      .cr-meta-k {
        flex: 0 0 6.6rem;
        color: #64748b;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.03em;
      }
      .cr-meta-v { flex: 1; min-width: 0; word-break: break-word; line-height: 1.35; }

      .cr-kv {
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
        margin: 0 0 16px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        overflow: hidden;
      }
      .cr-kv th, .cr-kv td {
        border: 1px solid #e2e8f0;
        padding: 9px 10px;
        vertical-align: top;
        text-align: left;
      }
      .cr-kv th {
        width: 24%;
        background: #f1f5f9;
        font-size: 10px;
        font-weight: 800;
        color: #334155;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }
      .cr-kv td {
        width: 76%;
        font-size: 12px;
        line-height: 1.45;
        font-weight: 500;
        word-break: break-word;
      }
      .cr-kv .cr-strong { font-weight: 700; font-size: 13px; }
      .cr-kv .cr-amount { font-weight: 800; font-size: 15px; color: #0f172a; }

      .cr-sign {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        text-align: center;
        margin-top: 28px;
      }
      .cr-sign-title {
        font-weight: 800;
        font-size: 11px;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .cr-sign-hint {
        font-size: 10px;
        font-style: italic;
        margin-top: 40px;
        color: #94a3b8;
      }
      .cr-foot {
        margin-top: 40px;
        text-align: right;
        font-size: 10px;
        color: #94a3b8;
      }

      @media print {
        .cr-meta,
        .cr-kv { break-inside: avoid; }
      }
  `;
}
