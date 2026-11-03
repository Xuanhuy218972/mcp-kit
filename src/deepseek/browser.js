// src/deepseek/browser.js
import puppeteer from "puppeteer-core";
import { URL_HOME } from "./selectors.js";

let browser;
export async function getBrowser() {
  if (browser?.connected) return browser;
  try {
    browser = await puppeteer.connect({
      browserURL: "http://127.0.0.1:9222",
      defaultViewport: null,
    });
    return browser;
  } catch (error) {
    throw new Error("LỖI KẾT NỐI: Không tìm thấy Chrome. Hãy chạy script khởi động Chrome Debug ở cổng 9222 trước khi gọi AI.");
  }
}

export async function getPage(url = null, { newChat = false } = {}) {
  const b = await getBrowser();
  const pages = await b.pages();
  const homeUrl = process.env.DEEPSEEK_URL || URL_HOME;
  const expectedHost = new URL(homeUrl).hostname;

  let page = pages.find((p) => {
    try {
      const h = new URL(p.url()).hostname;
      return h === expectedHost || h.endsWith('.' + expectedHost);
    } catch { return false; }
  });
  if (!page) page = await b.newPage();

  if (newChat) {
    await page.goto(homeUrl, { waitUntil: "networkidle2" });
  } else if (url && page.url() !== url) {
    await page.goto(url, { waitUntil: "networkidle2" });
  } else if (!page.url().includes(expectedHost)) {
    await page.goto(homeUrl, { waitUntil: "networkidle2" });
  }
  await page.bringToFront();
  return page;
}