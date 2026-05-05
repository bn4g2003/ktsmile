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
    const logoPath = path.join(process.cwd(), "public", "brand-logo.png");
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

    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      // Môi trường Serverless (Vercel, Lambda)
      const chromium = (await import("@sparticuz/chromium")).default;
      executablePath = await chromium.executablePath();
      launchArgs = chromium.args;
    } else {
      // Môi trường local (Windows, macOS, Linux)
      const possiblePaths = [
        // Windows
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        // macOS
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        // Linux
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
      ];
      executablePath =
        possiblePaths.find((p) => fs.existsSync(p)) ?? "google-chrome";
      launchArgs = ["--no-sandbox", "--disable-setuid-sandbox"];
    }

    const puppeteer = (await import("puppeteer-core")).default;
    browser = await puppeteer.launch({
      executablePath,
      args: [
        ...launchArgs,
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
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
