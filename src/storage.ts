import type { Trip } from "./types";

const KEY = "travel-footprints:trips";
const TAGS_KEY = "travel-footprints:tags";


export function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as Trip[]) : [];
  } catch {
    return [];
  }
}

export function saveTrips(trips: Trip[]) {
  localStorage.setItem(KEY, JSON.stringify(trips));
}

export function clearTrips() {
  localStorage.removeItem(KEY);
}

export function loadTags(): string[] {
  try {
    const raw = localStorage.getItem(TAGS_KEY);
    if (!raw) return ["Me", "Couple"]; // 默认标签
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : ["Me", "Couple"];
  } catch {
    return ["Me", "Couple"];
  }
}

export function saveTags(tags: string[]) {
  localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
}


