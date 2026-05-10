import type { Trip } from "./types";

const KEY = "travel-footprints:trips";
const TAGS_KEY = "travel-footprints:tags";
const PARK_VISITS_KEY = "travel-footprints:park-visits";


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
    if (!raw) return ["Me", "Couple"]; // Default tags
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : ["Me", "Couple"];
  } catch {
    return ["Me", "Couple"];
  }
}

export function saveTags(tags: string[]) {
  localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
}

export function loadParkVisits(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(PARK_VISITS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return typeof data === "object" && data !== null && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

export function saveParkVisits(visits: Record<string, string[]>) {
  localStorage.setItem(PARK_VISITS_KEY, JSON.stringify(visits));
}

// Download trips as JSON.
export function exportData(trips: Trip[]) {
  const dataStr = JSON.stringify(trips, null, 2); // Pretty-print JSON
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `travel-backup-${new Date().toISOString().slice(0, 10)}.json`; // Dated filename
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Parse an imported backup file.
export function importData(file: File): Promise<Trip[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) {
          resolve(parsed);
        } else {
          reject("Invalid data format: Not an array");
        }
      } catch (err) {
        reject("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  });
}
