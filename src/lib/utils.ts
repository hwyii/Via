// src/lib/utils.ts
import { CN_ZH_TO_EN, US_ABBR_TO_NAME } from "../constants/geoMaps";

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeCNProvinceName(admin1: string | null | undefined): string | null {
  if (!admin1) return null;
  const s = admin1.trim();
  if (!s) return null;
  return CN_ZH_TO_EN[s] ?? null;
}

export function getFlagEmoji(countryCode: string) {
  if (!countryCode) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function normalizeUSStateName(admin1: string | null | undefined): string | null {
  if (!admin1) return null;
  let s = admin1.trim();
  if (!s) return null;

  // 清理常见后缀/前缀
  s = s.replace(/^Commonwealth of\s+/i, "");
  s = s.replace(/\s+State$/i, "");
  s = s.replace(/\s+Commonwealth$/i, "");

  // 去掉国家尾巴
  s = s.replace(/,\s*United States.*$/i, "");
  s = s.replace(/,\s*USA.*$/i, "");

  // DC 特判
  const up = s.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (
    up === "DC" ||
    up === "D C" ||
    up === "DISTRICT OF COLUMBIA" ||
    up === "WASHINGTON DC" ||
    up === "WASHINGTON D C"
  ) {
    return "District of Columbia";
  }

  // 2位缩写
  if (/^[A-Za-z]{2}$/.test(s)) return US_ABBR_TO_NAME[s.toUpperCase()] ?? null;

  // 标准化空格
  s = s.replace(/\s+/g, " ").trim();
  return s || null;
}