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
import type { TagId, Trip, Candidate, VisitType } from "./types";
import { HOT_CITIES } from "./constants/hotCities";

type ViewMode = "world" | "cn" | "us";

function getVisitType(trip: Pick<Trip, "visitType">): VisitType {
  return trip.visitType ?? "visited";
}

// Theme colors
const THEME = {
  hiFill: "#45769c",    // Highlight fill
  hiOutline: "#729bb9", // Highlight outline
  hiOpacity: 1.0,       // Highlight opacity
  pointColor: "#29dff2", // Footprint point
  transitFill: "#d4d3d5",
  transitOutline: "#d4d3d5",
  transitOpacity: 0.26,
  transitPointColor: "#d4d3d5",
  transitPointOpacity: 0.48
};

export default function App() {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // const [exportScope, setExportScope] = useState<"all" | "current">("all");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  // Tag state
  const [tags, setTagsState] = useState<string[]>(() => loadTags());
  const [tag, setTag] = useState<TagId>(() => tags.length > 0 ? tags[0] : "Me");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagVal, setNewTagVal] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editTagVal, setEditTagVal] = useState("");

  const [view, setView] = useState<ViewMode>("world");
  const [trips, setTrips] = useState<Trip[]>(() => loadTrips());

  const [modalOpen, setModalOpen] = useState(false);
  const [visitType, setVisitType] = useState<VisitType>("visited");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Stats and flags
  const stats = useMemo(() => {
    const current = trips.filter((t) => t.tag === tag);
    const countryCodes = uniq(current.map((t) => (t.place.countryIso2 || "").toUpperCase()).filter(Boolean));
    return {
      countries: countryCodes.length,
      footprints: current.length,
      codes: countryCodes
    };
  }, [trips, tag]);

  // Tag actions
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
      const nextTrips = trips.map(t => t.tag === editingTag ? { ...t, tag: val } : t);
      setTagsState(next);
      saveTags(next);
      setTrips(nextTrips);
      saveTrips(nextTrips);
      if (tag === editingTag) setTag(val);
    }
    setEditingTag(null);
    setEditTagVal("");
  }

  // Map setup
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

        // Base layers
        const baseFill = "#152238";
        const baseLine = "#2b3a55";

        // World base
        map.addLayer({ id: "countries-base-fill", type: "fill", source: "countries", paint: { "fill-color": baseFill } });
        map.addLayer({ id: "countries-base-line", type: "line", source: "countries", paint: { "line-color": baseLine } });

        // China base
        map.addLayer({ id: "cn-base-fill", type: "fill", source: "cn-provinces", paint: { "fill-color": baseFill } });
        map.addLayer({ id: "cn-base-line", type: "line", source: "cn-provinces", paint: { "line-color": baseLine } });

        // US base
        map.addLayer({ id: "us-base-fill", type: "fill", source: "us-states", paint: { "fill-color": baseFill } });
        map.addLayer({ id: "us-base-line", type: "line", source: "us-states", paint: { "line-color": baseLine } });


        // Highlight layers
        const hiPaint = { "fill-color": THEME.hiFill, "fill-opacity": THEME.hiOpacity };
        const hiLinePaint = { "line-color": THEME.hiOutline, "line-width": 1.5 };
        const transitPaint = { "fill-color": THEME.transitFill, "fill-opacity": THEME.transitOpacity };
        const transitLinePaint = { "line-color": THEME.transitOutline, "line-width": 1, "line-opacity": 0.7 };
        const emptyFilter: any = ["in", "id", ""]; // Hidden by default

        // World highlights
        map.addLayer({ id: "countries-transit", type: "fill", source: "countries", paint: transitPaint, filter: emptyFilter });
        map.addLayer({ id: "countries-transit-line", type: "line", source: "countries", paint: transitLinePaint, filter: emptyFilter });
        map.addLayer({ id: "countries-hi", type: "fill", source: "countries", paint: hiPaint, filter: emptyFilter });
        map.addLayer({ id: "countries-hi-line", type: "line", source: "countries", paint: hiLinePaint, filter: emptyFilter });

        // China highlights
        map.addLayer({ id: "cn-transit", type: "fill", source: "cn-provinces", paint: transitPaint, filter: emptyFilter });
        map.addLayer({ id: "cn-transit-line", type: "line", source: "cn-provinces", paint: transitLinePaint, filter: emptyFilter });
        map.addLayer({ id: "cn-hi", type: "fill", source: "cn-provinces", paint: hiPaint, filter: emptyFilter });
        map.addLayer({ id: "cn-hi-line", type: "line", source: "cn-provinces", paint: hiLinePaint, filter: emptyFilter });

        // US highlights
        map.addLayer({ id: "us-transit", type: "fill", source: "us-states", paint: transitPaint, filter: emptyFilter });
        map.addLayer({ id: "us-transit-line", type: "line", source: "us-states", paint: transitLinePaint, filter: emptyFilter });
        map.addLayer({ id: "us-hi", type: "fill", source: "us-states", paint: hiPaint, filter: emptyFilter });
        map.addLayer({ id: "us-hi-line", type: "line", source: "us-states", paint: hiLinePaint, filter: emptyFilter });


        // Trip points
        map.addSource("trip-points", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "trip-points-transit-layer", type: "circle", source: "trip-points",
          paint: {
            "circle-color": THEME.transitPointColor,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2, 6, 4],
            "circle-opacity": THEME.transitPointOpacity,
            "circle-stroke-width": 1,
            "circle-stroke-color": "rgba(15,23,42,0.8)"
          }
        });
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

  // Search
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

  function addTrip(it: Candidate, selectedVisitType = visitType) {
    let finalIso = it.countryIso2;
    let finalAdmin1 = it.admin1;
    let finalName = it.displayName;
    // Store Hong Kong and Macau under China.
    if (it.countryIso2 === "HK") {
      finalIso = "CN";
      finalAdmin1 = "Hong Kong"; 
    } else if (it.countryIso2 === "MO") {
      finalIso = "CN";
      finalAdmin1 = "Macau";
    }
    // Prevent duplicate places in the current tag.
    const exists = trips.find(t => 
      t.tag === tag && 
      t.place.name === finalName && 
      t.place.countryIso2 === finalIso // Compare after normalization
    );

    if (exists) {
      if (getVisitType(exists) !== selectedVisitType) {
        const next = trips.map(t => t.id === exists.id ? { ...t, visitType: selectedVisitType } : t);
        setTrips(next);
        saveTrips(next);
      } else {
        alert("⚠️ This place is already in your list!");
      }
      flyToLonLat(exists.place.lon, exists.place.lat, 4);
      setQ("");
      setItems([]);
      setModalOpen(false);
      return;
    }
    const t: Trip = {
      id: uid(),
      date: today(),
      tag,
      visitType: selectedVisitType,
      place: {
        name: finalName, lat: it.lat, lon: it.lon,
        countryIso2: finalIso, admin1: finalAdmin1
      }
    };
    const next = [t, ...trips];
    setTrips(next);
    saveTrips(next);

    // Auto-switch by destination country.
    if (it.countryIso2 === "CN") {
      setView("cn");
    } else if (it.countryIso2 === "US") {
      setView("us");
    } else {
      setView("world");
    }

    // Wait for the view change before focusing the city.
    setTimeout(() => {
      flyToLonLat(it.lon, it.lat, 4);
    }, 800); // Let the view animation start first

    setQ("");
    setItems([]);
    setModalOpen(false);
  }


  function resetAll() {
    // Confirm before clearing this tag.
    if (!confirm(`DANGER: Are you sure you want to delete ALL ${filteredTrips.length} footprints for "${tag}"?`)) return;
    
    // Keep trips from other tags.
    const keep = trips.filter(t => t.tag !== tag);
    setTrips(keep);
    saveTrips(keep);
  }

  // Delete one footprint.
  function deleteSingleTrip(id: string, e: React.MouseEvent) {
    e.stopPropagation(); // Keep row click from firing
    
    if (!confirm("Remove this footprint?")) return;

    const next = trips.filter(t => t.id !== id);
    setTrips(next);
    saveTrips(next);
  }

  // Import backup data.
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Importing will overwrite current data. Continue?")) return;

    importData(file)
      .then((newTrips) => {
        // Replace footprint data.
        setTrips(newTrips);
        saveTrips(newTrips);

        // Collect imported tag names.
        
        const importedTags = newTrips.map(t => t.tag);
        const uniqueImportedTags = Array.from(new Set(importedTags));
        // Merge and dedupe tags.
        const mergedTags = Array.from(new Set([...tags, ...importedTags]));
        
        // Save newly imported tags.
        if (mergedTags.length > tags.length) {
           setTagsState(mergedTags);
           saveTags(mergedTags);
        }
        if (uniqueImportedTags.length > 0) {
          // Show the first imported tag.
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

  // Update highlights.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const current = trips.filter((t) => t.tag === tag);
    const visitedTrips = current.filter((t) => getVisitType(t) === "visited");
    const transitTrips = current.filter((t) => getVisitType(t) === "transit");
    const transitOnly = (transitKeys: string[], visitedKeys: string[]) =>
      transitKeys.filter((key) => !visitedKeys.includes(key));

    const getWorldCodes = (sourceTrips: Trip[]) => {
      let codes = uniq(sourceTrips.map((t) => (t.place.countryIso2 || "").toUpperCase()).filter(Boolean));
      const hasHK = sourceTrips.some(t => 
        (t.place.admin1 === "Hong Kong") || 
        (t.place.name && t.place.name.includes("Hong Kong"))
      );
      if (hasHK && !codes.includes("HK")) codes.push("HK");

      const hasMO = sourceTrips.some(t => 
        (t.place.admin1 === "Macau") || 
        (t.place.name && t.place.name.includes("Macau"))
      );
      if (hasMO && !codes.includes("MO")) codes.push("MO");

      if (codes.includes("CN") && !codes.includes("CN-TW")) {
        codes = [...codes, "CN-TW"];
      }
      return codes;
    };

    const getCNKeys = (sourceTrips: Trip[]) => uniq(
      sourceTrips
        .filter((t) => (t.place.countryIso2 || "").toUpperCase() === "CN") 
        .flatMap((t) => {
          const raw = (t.place.admin1 || "").trim();
          const clean = raw.replace(/( Province| City| Autonomous Region| AR| SAR)/gi, "").trim();
          const zhName = CN_EN_TO_ZH[clean];
          return [raw, clean, zhName].filter((value): value is string => Boolean(value));
        })
    );

    const getUSKeys = (sourceTrips: Trip[]) => uniq(
      sourceTrips
        .filter((t) => (t.place.countryIso2 || "").toUpperCase() === "US" && t.place.admin1)
        .flatMap((t) => {
          const raw = (t.place.admin1 || "").trim();
          const norm = normalizeUSStateName(raw);
          return [raw, norm].filter((value): value is string => Boolean(value));
        })
    );

    if (view === "world") {
      const countries = getWorldCodes(visitedTrips);
      const transitCountries = transitOnly(getWorldCodes(transitTrips), countries);
      const transitFilter: any = ["in", ["get", "ISO3166-1-Alpha-2"], ["literal", transitCountries.length ? transitCountries : [""]]];
      const filter: any = ["in", ["get", "ISO3166-1-Alpha-2"], ["literal", countries.length ? countries : [""]]];
      map.setFilter("countries-transit", transitFilter);
      map.setFilter("countries-transit-line", transitFilter);
      map.setFilter("countries-hi", filter);
      map.setFilter("countries-hi-line", filter);
    } 
    else if (view === "cn") {
      const cnKeys = getCNKeys(visitedTrips);
      const transitCnKeys = transitOnly(getCNKeys(transitTrips), cnKeys);
      const transitFilter: any = ["in", ["get", "name"], ["literal", transitCnKeys.length ? transitCnKeys : [""]]];
      const filter: any = ["in", ["get", "name"], ["literal", cnKeys.length ? cnKeys : [""]]];
      map.setFilter("cn-transit", transitFilter);
      map.setFilter("cn-transit-line", transitFilter);
      map.setFilter("cn-hi", filter);
      map.setFilter("cn-hi-line", filter);
    } 
    else if (view === "us") {
      const usStates = getUSKeys(visitedTrips);
      const transitStates = transitOnly(getUSKeys(transitTrips), usStates);
      const transitFilter: any = ["in", ["get", "name"], ["literal", transitStates.length ? transitStates : [""]]];
      const filter: any = ["in", ["get", "name"], ["literal", usStates.length ? usStates : [""]]];
      map.setFilter("us-transit", transitFilter);
      map.setFilter("us-transit-line", transitFilter);
      map.setFilter("us-hi", filter);
      map.setFilter("us-hi-line", filter);
    }
  }, [trips, tag, view, mapReady]);

  // Update footprint points.
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
          ...t,         // Expose tag to the map
          ...t.place,   // Expose countryIso2 to the map
          visitType: getVisitType(t)
        }
      }))
    };
    (map.getSource("trip-points") as maplibregl.GeoJSONSource)?.setData(fc as any);
  }, [trips, tag, mapReady]);

  // View switching
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Hide all map layers first.
    const allLayers = [
      "countries-base-fill", "countries-base-line", "countries-transit", "countries-transit-line", "countries-hi", "countries-hi-line",
      "cn-base-fill", "cn-base-line", "cn-transit", "cn-transit-line", "cn-hi", "cn-hi-line",
      "us-base-fill", "us-base-line", "us-transit", "us-transit-line", "us-hi", "us-hi-line"
    ];
    allLayers.forEach(id => {
       if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
    });

    map.setMaxBounds(null);

    // Show layers by prefix.
    const setVisible = (prefix: string) => {
      [`${prefix}-base-fill`, `${prefix}-base-line`, `${prefix}-transit`, `${prefix}-transit-line`, `${prefix}-hi`, `${prefix}-hi-line`].forEach(id => {
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
    // Filter by selected tag.
    const tagFilter = ["==", ["get", "tag"], tag];

    // Filter by active region.
    let regionFilter: any = null;

    if (view === "cn") {
      regionFilter = ["==", ["get", "countryIso2"], "CN"];
    } else if (view === "us") {
      regionFilter = ["==", ["get", "countryIso2"], "US"];
    }

    const visitedFilter = ["==", ["get", "visitType"], "visited"];
    const transitFilter = ["==", ["get", "visitType"], "transit"];
    let finalVisitedFilter: any;
    let finalTransitFilter: any;
    if (regionFilter) {
      // Require both tag and region.
      finalVisitedFilter = ["all", tagFilter, regionFilter, visitedFilter];
      finalTransitFilter = ["all", tagFilter, regionFilter, transitFilter];
    } else {
      // World view only needs the tag.
      finalVisitedFilter = ["all", tagFilter, visitedFilter];
      finalTransitFilter = ["all", tagFilter, transitFilter];
    }

    // Use the exact layer id from addLayer.
    if (map.getLayer("trip-points-layer")) {
      map.setFilter("trip-points-layer", finalVisitedFilter);
    }
    if (map.getLayer("trip-points-transit-layer")) {
      map.setFilter("trip-points-transit-layer", finalTransitFilter);
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
        {/* Backup tools */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", gap: 10, position: "relative" }}>
            
            {/* Backup menu button */}
            <button 
              onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
              style={{ flex: 1, padding: "6px", fontSize: 12, background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
            >
              ⬇️ Backup
            </button>

            {/* Backup dropdown */}
            {downloadMenuOpen && (
              <div style={{
                position: "absolute",
                top: "100%", // Below the button
                left: 0,
                marginTop: 8,
                width: 140,
                background: "#1e293b", // Dark background
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                zIndex: 10,
                overflow: "hidden",
                display: "flex", 
                flexDirection: "column"
              }}>
                {/* All data */}
                <button
                  onClick={() => {
                    exportData(trips); // Export all
                    setDownloadMenuOpen(false); // Close menu
                  }}
                  style={{ padding: "10px 12px", textAlign: "left", background: "transparent", border: "none", color: "#e2e8f0", fontSize: 12, cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  Download All
                </button>
                
                {/* Current tag only */}
                <button
                  onClick={() => {
                    exportData(trips.filter(t => t.tag === tag)); // Export current tag
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

            {/* Restore button */}
            <label style={{ flex: 1, padding: "6px", fontSize: 12, background: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: 6, cursor: "pointer", textAlign: "center" }}>
              ⬆️ Restore
              <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
            </label>
         </div>
      </div>

      {/* Flag bar */}
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
                
                {/* Clear All button */}
                {filteredTrips.length > 0 && (
                  <button 
                    onClick={resetAll}
                    style={{ 
                      background: "transparent", 
                      border: "none", 
                      color: "#ef4444", // Red
                      fontSize: 13, 
                      cursor: "pointer", 
                      textDecoration: "underline", // Underline
                      fontWeight: 500
                    }}
                  >
                    Clear All
                  </button>
                )}

                {/* Close button */}
                <button 
                  onClick={() => setModalOpen(false)} 
                  style={{ border: "none", background: "transparent", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search city (e.g. Kyoto)..." autoFocus
                style={{ flex: 1, minWidth: 0, padding: "12px 16px", borderRadius: 12, border: "1px solid #334155", background: "#0f172a", color: "#fff", outline: "none", fontSize: 15 }}
              />
              <select
                value={visitType}
                onChange={(e) => setVisitType(e.target.value as VisitType)}
                style={{
                  width: 112,
                  padding: "0 10px",
                  borderRadius: 12,
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  outline: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                <option value="visited">Visited</option>
                <option value="transit">Transit</option>
              </select>
            </div>
            
            <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8", height: 20 }}>
              {loading && "Searching..."}
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              
              {/* Search results */}
              {items.map((it, idx) => (
                <div key={idx} style={{ padding: "10px 14px", background: "#334155", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{it.displayName}</div>
                    <div style={{ fontSize: 12, color: "#cbd5e1" }}>{it.countryIso2} {it.admin1}</div>
                  </div>
                  <button onClick={() => addTrip(it)} style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>Add</button>
                </div>
              ))}

              {/* Hot cities */}
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

              {/* History */}
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
                        <span style={{ fontSize: 12, color: "#64748b", display: "flex", gap: 8, alignItems: "center" }}>
                          {t.date}
                          <span style={{
                            color: getVisitType(t) === "transit" ? "#cbd5e1" : THEME.pointColor,
                            fontWeight: 700
                          }}>
                            {getVisitType(t) === "transit" ? "Transit" : "Visited"}
                          </span>
                        </span>
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
