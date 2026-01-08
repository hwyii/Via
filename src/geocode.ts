// src/geocode.ts
import type { Candidate } from "./types";

function normalizeAdmin1(countryIso2: string, address: any): string | null {
  const c = countryIso2.toUpperCase();

  if (c === "US") {
    // 1. 尝试获取 state_code (如果 API 有返回的话)
    const code = (address?.state_code || "").toString().toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) return code;
    
    // 2. 🟢 关键修复：如果没有缩写，就用 state 全名 (例如 "Alabama")
    // App.tsx 里的 normalizeUSStateName 会负责处理这些全名
    const stateName = (address?.state || "").toString().trim();
    if (stateName) return stateName;
    
    return null;
  }

  if (c === "CN") {
    const s = (address?.state || address?.province || "").toString().trim();
    return s || null;
  }

  return null;
}

/** Type guard */
function isCandidate(x: Candidate | null): x is Candidate {
  return x !== null;
}

export async function geocode(q: string): Promise<Candidate[]> {
  const query = q.trim();
  if (!query) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "8");

  // 强制返回英文结果
  url.searchParams.set("accept-language", "en");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("geocode failed");

  const json = await res.json();
  if (!Array.isArray(json)) return [];

  return json
    .map((it: any): Candidate | null => {
      const countryIso2 = (it?.address?.country_code || "")
        .toString()
        .toUpperCase();
      if (!countryIso2) return null;

      const lat = Number(it.lat);
      const lon = Number(it.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

      return {
        displayName: it.display_name,
        lat,
        lon,
        countryIso2,
        admin1: normalizeAdmin1(countryIso2, it.address)
      };
    })
    .filter(isCandidate);
}