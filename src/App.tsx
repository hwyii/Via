import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { geocode } from "./geocode";
import { loadTrips, saveTrips, loadTags, saveTags } from "./storage";
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

  // ====== Tag 状态管理 ======
  const [tags, setTagsState] = useState<string[]>(() => loadTags());
  const [tag, setTag] = useState<TagId>("Me"); 
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
    const t: Trip = {
      id: uid(),
      date: today(),
      tag,
      place: {
        name: it.displayName, lat: it.lat, lon: it.lon,
        countryIso2: it.countryIso2, admin1: it.admin1
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
    if (!confirm("Are you sure you want to clear ALL footprints for this tag?")) return;
    const keep = trips.filter(t => t.tag !== tag);
    setTrips(keep);
    saveTrips(keep);
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
          .filter((t) => (t.place.countryIso2 || "").toUpperCase() === "CN" && t.place.admin1)
          .flatMap((t) => {
            const raw = (t.place.admin1 || "").trim(); // 例如 "Zhejiang Province"
            
            // 1. 清洗英文后缀 (得到 "Zhejiang")
            const clean = raw.replace(/( Province| City| Autonomous Region| AR| SAR)/gi, "").trim();
            
            // 2. 尝试映射为中文全称 (得到 "浙江省")
            // 这样 "Zhejiang" 就能匹配阿里云地图里的 "浙江省" 了
            const zhName = CN_EN_TO_ZH[clean];

            // 把 原始英文、清洗后英文、中文名 全部扔进去尝试匹配
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
        properties: { id: t.id, name: t.place.name }
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
  }, [view, mapReady]);

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
              <button onClick={resetAll} style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Clear History</button>
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
              {/* Search Results */}
              {items.map((it, idx) => (
                <div key={idx} style={{ padding: "10px 14px", background: "#334155", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{it.displayName}</div>
                    <div style={{ fontSize: 12, color: "#cbd5e1" }}>{it.countryIso2} {it.admin1}</div>
                  </div>
                  <button onClick={() => addTrip(it)} style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>Add</button>
                </div>
              ))}

              {/* History List */}
              {!loading && items.length === 0 && (
                <>
                  <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>HISTORY ({filteredTrips.length})</div>
                  {filteredTrips.map(t => (
                    <div key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
                      <span>{t.place.name}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{t.date}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}