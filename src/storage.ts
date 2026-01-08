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

// 🟢 导出功能：把数据变成文件下载
export function exportData(trips: Trip[]) {
  const dataStr = JSON.stringify(trips, null, 2); // 格式化，好看一点
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `travel-backup-${new Date().toISOString().slice(0, 10)}.json`; // 文件名带日期
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 🟢 导入功能：解析文件内容
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

