import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { html?: string; filename?: string; baseUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { html: rawHtml, filename = "document.pdf", baseUrl } = body;
  // Inject <base> tag so Puppeteer can resolve relative URLs (images, fonts...)
  let html = baseUrl
    ? rawHtml?.replace(/<head>/i, `<head><base href="${baseUrl}">`)
    : rawHtml;
  if (!html || !rawHtml) {
    return NextResponse.json({ error: "Missing html field" }, { status: 400 });
  }

  // Tự động nhúng logo vào HTML dưới dạng Base64 để tránh lỗi Vercel Auth hoặc lỗi đường dẫn
  try {
    const logoPath = path.join(
      /* turbopackIgnore: true */ process.cwd(),
      "public",
      "brand-logo.png",
    );
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      // Thay thế tất cả các lần xuất hiện của đường dẫn logo bằng Base64
      html = html.split("/brand-logo.png").join(logoBase64);
    }
  } catch (e) {
    console.warn("[PDF API] Không thể nhúng logo Base64:", e);
  }

  let browser;
  try {
    let executablePath: string;
    let launchArgs: string[];
    /** Cờ tối ưu Lambda — không dùng trên VPS (dễ crash / treo Chrome). */
    let useServerlessChromeFlags: boolean;

    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const chromium = (await import("@sparticuz/chromium")).default;
      executablePath = await chromium.executablePath();
      launchArgs = chromium.args;
      useServerlessChromeFlags = true;
    } else {
      const fromEnv =
        process.env.PUPPETEER_EXECUTABLE_PATH?.trim() ||
        process.env.CHROME_PATH?.trim() ||
        "";
      const possiblePaths = [
        ...(fromEnv && fs.existsSync(fromEnv) ? [fromEnv] : []),
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/opt/google/chrome/chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome-beta",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
        "/var/lib/snapd/snap/bin/chromium",
      ];
      const found = possiblePaths.find((p) => fs.existsSync(p));
      if (!found) {
        console.warn(
          "[PDF API] Không có binary Chrome/Chromium — không gọi Puppeteer (tránh treo/OOM trên Hostinger). Đặt CHROME_PATH.",
        );
        return NextResponse.json(
          {
            error: "PDF unavailable on this server",
            detail:
              "No Chrome/Chromium found. Set CHROME_PATH or PUPPETEER_EXECUTABLE_PATH, or use client PDF fallback.",
          },
          { status: 503 },
        );
      }
      executablePath = found;
      launchArgs = ["--no-sandbox", "--disable-setuid-sandbox"];
      useServerlessChromeFlags = false;
    }

    const puppeteer = (await import("puppeteer-core")).default;
    const extraArgs = useServerlessChromeFlags
      ? ["--disable-dev-shm-usage", "--disable-gpu", "--no-first-run", "--no-zygote", "--single-process"]
      : ["--disable-dev-shm-usage", "--disable-gpu", "--no-first-run"];

    browser = await puppeteer.launch({
      executablePath,
      args: [...launchArgs, ...extraArgs],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      preferCSSPageSize: false,
    });

    const safeFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    // RFC 5987: support Unicode filenames in HTTP headers
    const encodedFilename = encodeURIComponent(safeFilename);

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="document.pdf"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("[PDF API Error]", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: String(err) },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
