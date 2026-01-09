import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { geocode } from "./geocode";
import { loadTrips, saveTrips, loadTags, saveTags, exportData, importData } from "./storage";
import { Pill } from "./components/UI/Pill";
import { 
  uniq, 
  uid, 
  today,  
  normalizeUSStateName,
  getFlagEmoji 
} from "./lib/utils";
import { CN_EN_TO_ZH } from "./constants/geoMaps";
import type { TagId, Trip, Candidate } from "./types";
import { HOT_CITIES } from "./constants/hotCities";

type ViewMode = "world" | "cn" | "us";

// 🎨 颜色配置
const THEME = {
  hiFill: "#45769c",    // 亮蓝色填充
  hiOutline: "#729bb9", // 青色边框
  hiOpacity: 1.0,       // 透明度
  pointColor: "#29dff2" // 足迹点颜色
};

export default function App() {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // const [exportScope, setExportScope] = useState<"all" | "current">("all");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  // ====== Tag 状态管理 ======
  const [tags, setTagsState] = useState<string[]>(() => loadTags());
  const [tag, setTag] = useState<TagId>(() => tags.length > 0 ? tags[0] : "Me");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagVal, setNewTagVal] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editTagVal, setEditTagVal] = useState("");

  const [view, setView] = useState<ViewMode>("world");
  const [trips, setTrips] = useState<Trip[]>(() => loadTrips());

  const [modalOpen, setModalOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // ====== 统计与国旗 ======
  const stats = useMemo(() => {
    const current = trips.filter((t) => t.tag === tag);
    const countryCodes = uniq(current.map((t) => (t.place.countryIso2 || "").toUpperCase()).filter(Boolean));
    return {
      countries: countryCodes.length,
      footprints: current.length,
      codes: countryCodes
    };
  }, [trips, tag]);

  // ====== Tag 操作逻辑 ======
  function confirmAddTag() {
    const val = newTagVal.trim();
    if (val && !tags.includes(val)) {
      const next = [...tags, val];
      setTagsState(next);
      saveTags(next);
      setTag(val);
    }
    setIsAddingTag(false);
    setNewTagVal("");
  }

  function deleteTag(tToDelete: string) {
    if (!confirm(`Delete tag "${tToDelete}"?`)) return;
    const next = tags.filter(t => t !== tToDelete);
    if (next.length === 0) next.push("Me");
    setTagsState(next);
    saveTags(next);
    if (tag === tToDelete) setTag(next[0]);
  }

  function startEditTag(t: string) {
    setEditingTag(t);
    setEditTagVal(t);
  }

  function confirmEditTag() {
    if (!editingTag) return;
    const val = editTagVal.trim();
    if (val && val !== editingTag && !tags.includes(val)) {
      const next = tags.map(t => t === editingTag ? val : t);
      setTagsState(next);
      saveTags(next);
      if (tag === editingTag) setTag(val);
    }
    setEditingTag(null);
    setEditTagVal("");
  }

  // ====== 地图初始化 ======
  useEffect(() => {
    if (!mapElRef.current) return;

    try {
      const minimalStyle: any = {
        version: 8,
        sources: {},
        layers: [{ id: "bg", type: "background", paint: { "background-color": "#0b1220" } }]
      };

      const map = new maplibregl.Map({
        container: mapElRef.current,
        style: minimalStyle,
        center: [0, 20],
        zoom: 1.4,
        attributionControl: false
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.doubleClickZoom.disable();

      mapRef.current = map;

      map.on("load", () => {
        map.resize();

        map.addSource("countries", { type: "geojson", data: "/geo/countries.geojson" });
        map.addSource("cn-provinces", { type: "geojson", data: "/geo/cn-provinces.geojson" });
        map.addSource("us-states", { type: "geojson", data: "/geo/us-states.geojson" });

        // === Base Layers ===
        const baseFill = "#152238";
        const baseLine = "#2b3a55";

        // World Base
        map.addLayer({ id: "countries-base-fill", type: "fill", source: "countries", paint: { "fill-color": baseFill } });
        map.addLayer({ id: "countries-base-line", type: "line", source: "countries", paint: { "line-color": baseLine } });

        // CN Base
        map.addLayer({ id: "cn-base-fill", type: "fill", source: "cn-provinces", paint: { "fill-color": baseFill } });
        map.addLayer({ id: "cn-base-line", type: "line", source: "cn-provinces", paint: { "line-color": baseLine } });

        // US Base
        map.addLayer({ id: "us-base-fill", type: "fill", source: "us-states", paint: { "fill-color": baseFill } });
        map.addLayer({ id: "us-base-line", type: "line", source: "us-states", paint: { "line-color": baseLine } });


        // === Highlight Layers (明确写出 ID，防止报错) ===
        const hiPaint = { "fill-color": THEME.hiFill, "fill-opacity": THEME.hiOpacity };
        const hiLinePaint = { "line-color": THEME.hiOutline, "line-width": 1.5 };
        const emptyFilter: any = ["in", "id", ""]; // 初始不显示

        // 1. World Hi
        map.addLayer({ id: "countries-hi", type: "fill", source: "countries", paint: hiPaint, filter: emptyFilter });
        map.addLayer({ id: "countries-hi-line", type: "line", source: "countries", paint: hiLinePaint, filter: emptyFilter });

        // 2. CN Hi (注意 source 是 cn-provinces)
        map.addLayer({ id: "cn-hi", type: "fill", source: "cn-provinces", paint: hiPaint, filter: emptyFilter });
        map.addLayer({ id: "cn-hi-line", type: "line", source: "cn-provinces", paint: hiLinePaint, filter: emptyFilter });

        // 3. US Hi (注意 source 是 us-states)
        map.addLayer({ id: "us-hi", type: "fill", source: "us-states", paint: hiPaint, filter: emptyFilter });
        map.addLayer({ id: "us-hi-line", type: "line", source: "us-states", paint: hiLinePaint, filter: emptyFilter });


        // === Trip Points ===
        map.addSource("trip-points", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "trip-points-layer", type: "circle", source: "trip-points",
          paint: {
            "circle-color": THEME.pointColor,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2, 6, 4],
            "circle-opacity": 1,
            "circle-stroke-width": 0
          }
        });

        setMapReady(true);
      });

      map.on("error", (e) => setMapError(String((e as any)?.error?.message || e)));

      return () => {
        map.remove();
        mapRef.current = null;
      };
    } catch (err: any) {
      setMapError(String(err));
    }
  }, []);

  // ====== 搜索 ======
  useEffect(() => {
    const t = setTimeout(async () => {
      const s = q.trim();
      if (s.length < 2) { setItems([]); return; }
      setLoading(true);
      try {
        const res = await geocode(s);
        setItems(res);
      } catch { setItems([]); } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function flyToLonLat(lon: number, lat: number, zoom = 6) {
    mapRef.current?.easeTo({ center: [lon, lat], zoom, duration: 800 });
  }

  function addTrip(it: Candidate) {
    let finalIso = it.countryIso2;
    let finalAdmin1 = it.admin1;
    let finalName = it.displayName;
    // 如果是香港 (HK) 或 澳门 (MO)，强制归为 CN，并手动修正 admin1
    if (it.countryIso2 === "HK") {
      finalIso = "CN";
      finalAdmin1 = "Hong Kong"; 
    } else if (it.countryIso2 === "MO") {
      finalIso = "CN";
      finalAdmin1 = "Macau";
    }
    // 检查当前 tag 下，是否已经有 相同名字 且 相同国家 的记录
    const exists = trips.find(t => 
      t.tag === tag && 
      t.place.name === finalName && 
      t.place.countryIso2 === finalIso // 检查 CN 而不是 HK
    );

    if (exists) {
      alert("⚠️ This place is already in your list!");
      // 如果存在，直接飞过去，不添加
      flyToLonLat(exists.place.lon, exists.place.lat, 4);
      return;
    }
    const t: Trip = {
      id: uid(),
      date: today(),
      tag,
      place: {
        name: finalName, lat: it.lat, lon: it.lon,
        countryIso2: finalIso, admin1: finalAdmin1
      }
    };
    const next = [t, ...trips];
    setTrips(next);
    saveTrips(next);

    // 1. 判断目标国家，自动切换 View
    if (it.countryIso2 === "CN") {
      setView("cn");
    } else if (it.countryIso2 === "US") {
      setView("us");
    } else {
      setView("world");
    }

    // 2. 延迟飞行
    // 因为 setView 会触发 useEffect 去设置 maxBounds 和 easeTo (飞到国家中心)
    // 我们需要等 view 切换完，再精细飞行到城市
    setTimeout(() => {
      flyToLonLat(it.lon, it.lat, 4);
    }, 800); // 稍微延迟一点，让视图切换动画先走

    setQ("");
    setItems([]);
    setModalOpen(false);
  }


  function resetAll() {
    // 加一个双重确认，防止手滑把整个旅行记录删没了
    if (!confirm(`DANGER: Are you sure you want to delete ALL ${filteredTrips.length} footprints for "${tag}"?`)) return;
    
    // 逻辑：只保留其他 Tag 的数据，把当前 Tag 的全删掉
    const keep = trips.filter(t => t.tag !== tag);
    setTrips(keep);
    saveTrips(keep);
  }

  // 🟢 新增：删除单条记录
  function deleteSingleTrip(id: string, e: React.MouseEvent) {
    e.stopPropagation(); // 阻止冒泡！防止触发行的点击跳转事件
    
    if (!confirm("Remove this footprint?")) return;

    const next = trips.filter(t => t.id !== id);
    setTrips(next);
    saveTrips(next);
  }

  // 🟢 处理文件上传
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Importing will overwrite current data. Continue?")) return;

    importData(file)
      .then((newTrips) => {
        // 1. 更新足迹数据
        setTrips(newTrips);
        saveTrips(newTrips);

        // 从导入的数据里提取所有 tag 名字
        
        const importedTags = newTrips.map(t => t.tag);
        const uniqueImportedTags = Array.from(new Set(importedTags));
        // 合并现有 tags 和 导入的 tags，并去重 (Set)
        const mergedTags = Array.from(new Set([...tags, ...importedTags]));
        
        // 如果发现了新 Tag，就保存
        if (mergedTags.length > tags.length) {
           setTagsState(mergedTags);
           saveTags(mergedTags);
        }
        if (uniqueImportedTags.length > 0) {
          // 只有当导入了新 Tag 时，才自动切换过去，让用户立马看到变化
          setTag(uniqueImportedTags[0]); 
        }

        alert(`Success! Loaded ${newTrips.length} footprints.`);
      })
      .catch((err) => alert("Failed to import: " + err));
    
    e.target.value = ""; 
  }

  const filteredTrips = useMemo(
    () => trips.filter((t) => t.tag === tag).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [trips, tag]
  );

  // ====== 核心：更新高亮 (含台湾修复) =====
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const current = trips.filter((t) => t.tag === tag);

    if (view === "world") {
      let countries = uniq(current.map((t) => (t.place.countryIso2 || "").toUpperCase()).filter(Boolean));
      
      // 🟢 修复：含 CN 则强制含 TWN
      if (countries.includes("CN") && !countries.includes("CN-TW")) {
        countries = [...countries, "CN-TW"];
      }

      const filter: any = ["in", ["get", "ISO3166-1-Alpha-2"], ["literal", countries.length ? countries : [""]]];
      map.setFilter("countries-hi", filter);
      map.setFilter("countries-hi-line", filter);
    } 
    else if (view === "cn") {
      const cnKeys = uniq(
        current
          .filter((t) => (t.place.countryIso2 || "").toUpperCase() === "CN") 
          .flatMap((t) => {
            const raw = (t.place.admin1 || "").trim();
            
            const clean = raw.replace(/( Province| City| Autonomous Region| AR| SAR)/gi, "").trim();
            const zhName = CN_EN_TO_ZH[clean];

            // 🟢 特殊处理：如果是香港/澳门，可能 GeoJSON 里只有中文名，所以一定要确保 zhName 被传进去了
            return [raw, clean, zhName].filter(Boolean);
          })
      );
      const filter: any = ["in", ["get", "name"], ["literal", cnKeys.length ? cnKeys : [""]]];
      map.setFilter("cn-hi", filter);
      map.setFilter("cn-hi-line", filter);
    } 
    else if (view === "us") {
      const usStates = uniq(
        current
          .filter((t) => (t.place.countryIso2 || "").toUpperCase() === "US" && t.place.admin1)
          .flatMap((t) => {
            const raw = (t.place.admin1 || "").trim();
            const norm = normalizeUSStateName(raw);
            return [raw, norm].filter(Boolean);
          })
      );
      const filter: any = ["in", ["get", "name"], ["literal", usStates.length ? usStates : [""]]];
      map.setFilter("us-hi", filter);
      map.setFilter("us-hi-line", filter);
    }
  }, [trips, tag, view, mapReady]);

  // ====== 更新足迹点 =====
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const current = trips.filter((t) => t.tag === tag);
    const fc = {
      type: "FeatureCollection",
      features: current.map((t) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [t.place.lon, t.place.lat] },
        properties: { 
          ...t,         // 这样地图才能 get 到 "tag"
          ...t.place    // 这样地图才能 get 到 "countryIso2"
        }
      }))
    };
    (map.getSource("trip-points") as maplibregl.GeoJSONSource)?.setData(fc as any);
  }, [trips, tag, mapReady]);

  // ====== 视图切换 ======
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // 先隐藏所有可能用到的图层
    const allLayers = [
      "countries-base-fill", "countries-base-line", "countries-hi", "countries-hi-line",
      "cn-base-fill", "cn-base-line", "cn-hi", "cn-hi-line",
      "us-base-fill", "us-base-line", "us-hi", "us-hi-line"
    ];
    allLayers.forEach(id => {
       if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
    });

    map.setMaxBounds(null);

    // 显示指定前缀的图层
    const setVisible = (prefix: string) => {
      [`${prefix}-base-fill`, `${prefix}-base-line`, `${prefix}-hi`, `${prefix}-hi-line`].forEach(id => {
         if(map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
      });
    };

    if (view === "world") {
      setVisible("countries");
      map.setMinZoom(1); map.setMaxZoom(5);
      map.easeTo({ center: [0, 20], zoom: 1.5 });
    } else if (view === "cn") {
      setVisible("cn");
      map.setMaxBounds([[60, -10], [160, 60]]);
      map.setMinZoom(2); map.setMaxZoom(6);
      map.easeTo({ center: [104, 28], zoom: 1.0 });
    } else if (view === "us") {
      setVisible("us");
      map.setMaxBounds([[-180, 10], [-50, 75]]);
      map.setMinZoom(2); map.setMaxZoom(7);
      map.easeTo({ center: [-98, 38], zoom: 3.0 });
    }
    // 1. 基础过滤：只显示当前选中的 Tag
    const tagFilter = ["==", ["get", "tag"], tag];

    // 2. 区域过滤：根据 View 决定只显示哪个国家的点
    let regionFilter: any = null;

    if (view === "cn") {
      regionFilter = ["==", ["get", "countryIso2"], "CN"];
    } else if (view === "us") {
      regionFilter = ["==", ["get", "countryIso2"], "US"];
    }

    // 3. 组合过滤器 (Tag + Region)
    let finalFilter: any;
    if (regionFilter) {
      // 必须同时满足：是这个Tag 并且 是这个国家
      finalFilter = ["all", tagFilter, regionFilter];
    } else {
      // 世界视图：只满足 Tag 即可
      finalFilter = tagFilter;
    }

    // 4. 🔴 关键修正：图层名字必须和你 addLayer 时的一样！
    // 你的代码里 addLayer 叫 "trip-points-layer"
    if (map.getLayer("trip-points-layer")) {
      map.setFilter("trip-points-layer", finalFilter);
    }
  }, [view, mapReady, tag]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#0b1220", overflow: "hidden" }}>
      <div ref={mapElRef} style={{ position: "absolute", inset: 0 }} />

      {/* Stats Card */}
      <div style={{
        position: "absolute", top: 14, left: 14, padding: 16, borderRadius: 20,
        background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.1)",
        color: "#f8fafc", backdropFilter: "blur(12px)", minWidth: 240, boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
      }}>
        <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "0.02em" }}>Travel Footprints</div>
        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
          {stats.countries} Countries · {stats.footprints} Footprints
        </div>
        {mapError && <div style={{ color: "red", fontSize: 12 }}>{mapError}</div>}

        {/* Tag List */}
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tags.map(t => {
            const isEditing = editingTag === t;
            const isActive = tag === t;
            return (
              <div key={t} style={{ position: "relative" }}>
                 {isEditing ? (
                   <input 
                      autoFocus
                      value={editTagVal}
                      onChange={e => setEditTagVal(e.target.value)}
                      onBlur={confirmEditTag}
                      onKeyDown={e => e.key === "Enter" && confirmEditTag()}
                      style={{ width: 60, padding: "4px 8px", borderRadius: 99, border: "none", outline: "none", fontSize: 12 }}
                   />
                 ) : (
                  <Pill active={isActive} onClick={() => setTag(t)}>
                    <span onDoubleClick={() => startEditTag(t)} title="Double click to rename">{t}</span>
                    {tags.length > 1 && (
                      <span 
                        onClick={(e) => { e.stopPropagation(); deleteTag(t); }}
                        style={{ marginLeft: 6, opacity: 0.6, cursor: "pointer", fontSize: 14, lineHeight: 1 }}
                      >×</span>
                    )}
                  </Pill>
                 )}
              </div>
            );
          })}


          
          {/* Add Tag Inline */}
          {isAddingTag ? (
            <input 
              autoFocus
              value={newTagVal}
              placeholder="New..."
              onChange={e => setNewTagVal(e.target.value)}
              onBlur={confirmAddTag}
              onKeyDown={e => e.key === "Enter" && confirmAddTag()}
              style={{ width: 60, padding: "6px 10px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.5)", color: "#fff", outline: "none", fontSize: 12 }}
            />
          ) : (
            <button onClick={() => setIsAddingTag(true)} style={{
               padding: "4px 10px", borderRadius: 99, border: "1px dashed rgba(255,255,255,0.3)",
               background: "transparent", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 14
            }}>+</button>
          )}
        </div>
        {/* 🟢 修改后的：数据备份区 (带筛选) */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", gap: 10, position: "relative" }}>
            
            {/* 1. 备份按钮 (点击切换菜单) */}
            <button 
              onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
              style={{ flex: 1, padding: "6px", fontSize: 12, background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
            >
              ⬇️ Backup
            </button>

            {/* 2. 悬浮下拉菜单 (仅当开关打开时显示) */}
            {downloadMenuOpen && (
              <div style={{
                position: "absolute",
                top: "100%", // 在按钮正下方
                left: 0,
                marginTop: 8,
                width: 140,
                background: "#1e293b", // 深色背景
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                zIndex: 10,
                overflow: "hidden",
                display: "flex", 
                flexDirection: "column"
              }}>
                {/* 选项 A: 全部 */}
                <button
                  onClick={() => {
                    exportData(trips); // 导出全部
                    setDownloadMenuOpen(false); // 关闭菜单
                  }}
                  style={{ padding: "10px 12px", textAlign: "left", background: "transparent", border: "none", color: "#e2e8f0", fontSize: 12, cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  Download All
                </button>
                
                {/* 选项 B: 仅当前 */}
                <button
                  onClick={() => {
                    exportData(trips.filter(t => t.tag === tag)); // 仅导出当前 Tag
                    setDownloadMenuOpen(false);
                  }}
                  style={{ padding: "10px 12px", textAlign: "left", background: "transparent", border: "none", color: "#3b82f6", fontSize: 12, cursor: "pointer" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  Download "{tag}"
                </button>
              </div>
            )}

            {/* 3. 恢复按钮 (保持不变) */}
            <label style={{ flex: 1, padding: "6px", fontSize: 12, background: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: 6, cursor: "pointer", textAlign: "center" }}>
              ⬆️ Restore
              <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
            </label>
         </div>
      </div>

      {/* Flag Bar (底部国旗条 - 无背景) */}
      <div style={{
        position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 12, padding: "0 16px",
        maxWidth: "80vw", overflowX: "auto", scrollbarWidth: "none", pointerEvents: "none"
      }}>
         {stats.codes.map(code => (
           <span key={code} title={code} style={{ fontSize: 20, cursor: "default", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
             {getFlagEmoji(code)}
           </span>
         ))}
      </div>

      {/* View Switch */}
      <div style={{ position: "absolute", left: 14, bottom: 20, display: "flex", gap: 8 }}>
        <Pill active={view === "world"} onClick={() => setView("world")}>World</Pill>
        <Pill active={view === "cn"} onClick={() => setView("cn")}>China</Pill>
        <Pill active={view === "us"} onClick={() => setView("us")}>USA</Pill>
      </div>

      {/* Add Button */}
      <button onClick={() => setModalOpen(true)} style={{
          position: "absolute", right: 20, bottom: 20, width: 52, height: 52,
          borderRadius: 20, border: "none",
          background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
          color: "white", fontSize: 28, cursor: "pointer", boxShadow: "0 8px 20px rgba(59,130,246,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}
      >＋</button>

      {/* Modal */}
      {modalOpen && (
        <div onClick={() => setModalOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
            width: 600, maxWidth: "90vw", maxHeight: "80vh",
            borderRadius: 20, background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)",
            padding: 24, display: "flex", flexDirection: "column", color: "#fff", boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Add to <span style={{color: THEME.pointColor}}>{tag}</span></h2>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                
                {/* 🟢 恢复 Clear All 按钮 (只有当有数据时才显示) */}
                {filteredTrips.length > 0 && (
                  <button 
                    onClick={resetAll}
                    style={{ 
                      background: "transparent", 
                      border: "none", 
                      color: "#ef4444", // 红色
                      fontSize: 13, 
                      cursor: "pointer", 
                      textDecoration: "underline", // 下划线样式
                      fontWeight: 500
                    }}
                  >
                    Clear All
                  </button>
                )}

                {/* 原来的关闭按钮 */}
                <button 
                  onClick={() => setModalOpen(false)} 
                  style={{ border: "none", background: "transparent", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            </div>
            
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search city (e.g. Kyoto)..." autoFocus
              style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #334155", background: "#0f172a", color: "#fff", outline: "none", fontSize: 15 }}
            />
            
            <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8", height: 20 }}>
              {loading && "Searching..."}
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              
              {/* 🟢 1. 搜索结果 (优先级最高) */}
              {items.map((it, idx) => (
                <div key={idx} style={{ padding: "10px 14px", background: "#334155", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{it.displayName}</div>
                    <div style={{ fontSize: 12, color: "#cbd5e1" }}>{it.countryIso2} {it.admin1}</div>
                  </div>
                  <button onClick={() => addTrip(it)} style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>Add</button>
                </div>
              ))}

              {/* 🟢 2. 热门城市 (仅当没搜索、没结果时显示) */}
              {!loading && items.length === 0 && q.length === 0 && (
                <div style={{ marginBottom: 20 }}>
                   <div style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", marginBottom: 10, letterSpacing: "0.05em" }}>🔥 HOT DESTINATIONS</div>
                   <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {HOT_CITIES.map((city) => (
                        <button
                          key={city.displayName}
                          onClick={() => addTrip(city)}
                          style={{
                            padding: "6px 12px", borderRadius: 99,
                            border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.1)",
                            color: "#93c5fd", fontSize: 13, cursor: "pointer"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(59,130,246,0.2)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(59,130,246,0.1)"}
                        >
                          {city.displayName.split(",")[0]}
                        </button>
                      ))}
                   </div>
                </div>
              )}

              {/* 🟢 3. 历史记录 (永远显示在最下方，方便删除) */}
              {!loading && items.length === 0 && (
                <>
                  <div style={{ 
                    marginTop: 10, fontSize: 12, fontWeight: 700, color: "#94a3b8", 
                    borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16 
                  }}>
                    HISTORY ({filteredTrips.length})
                  </div>
                  
                  {filteredTrips.map(t => (
                    <div 
                      key={t.id} 
                      onClick={() => { flyToLonLat(t.place.lon, t.place.lat, 4); setModalOpen(false); }}
                      style={{ 
                        padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", 
                        display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" 
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 14 }}>{t.place.name}</span>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{t.date}</span>
                      </div>
                      <button 
                        onClick={(e) => deleteSingleTrip(t.id, e)}
                        style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 18, padding: "4px 8px", cursor: "pointer", opacity: 0.7 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {filteredTrips.length === 0 && <div style={{color: "#475569", fontSize: 13, padding: 10, textAlign: "center"}}>No footprints yet.</div>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}