import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { geocode } from "./geocode";
import { loadTrips, saveTrips, loadTags, saveTags, exportData, importData, loadParkVisits, saveParkVisits, loadParkMapVisibility, saveParkMapVisibility, loadPublishedData, publishData } from "./storage";
import { Pill } from "./components/UI/Pill";
import { 
  uniq, 
  uid, 
  today,  
  normalizeUSStateName,
  getFlagEmoji 
} from "./lib/utils";
import { CN_EN_TO_ZH } from "./constants/geoMaps";
import { NATIONAL_PARKS, PARKS_BY_STATE, PARK_COORDS } from "./constants/nationalParks";
import type { TagId, Trip, Candidate, VisitType } from "./types";
import { HOT_CITIES } from "./constants/hotCities";

type ViewMode = "world" | "cn" | "us";
type ColorMode = "light" | "dark";

const CHINA_REGION_TOTAL = 34;
const US_STATE_TOTAL = 50;

function getVisitType(trip: Pick<Trip, "visitType">): VisitType {
  return trip.visitType ?? "visited";
}

function getChinaRegionKey(trip: Trip): string | null {
  const raw = (trip.place.admin1 || "").trim();
  if (!raw) return null;
  const clean = raw.replace(/( Province| City| Autonomous Region| AR| SAR)/gi, "").trim();
  return CN_EN_TO_ZH[clean] || clean || raw;
}

function getUSStateKey(trip: Trip): string | null {
  const raw = (trip.place.admin1 || "").trim();
  return normalizeUSStateName(raw) || raw || null;
}

const DARK_THEME = {
  pageBackground: "#0b1220",
  baseFill: "#152238",
  baseLine: "#2b3a55",
  hiFill: "#45769c",
  hiOutline: "#729bb9",
  hiOpacity: 1.0,
  pointColor: "#29dff2",
  pointStrokeColor: "transparent",
  pointStrokeWidth: 0,
  transitFill: "#d4d3d5",
  transitOutline: "#d4d3d5",
  transitOpacity: 0.26,
  transitPointColor: "#d4d3d5",
  transitPointOpacity: 0.48
};

const LIGHT_THEME = {
  pageBackground: "#fbfaf7",
  baseFill: "#f1ede4",
  baseLine: "#d9cfb8",
  hiFill: "#f0d98a",
  hiOutline: "#d2ad35",
  hiOpacity: 0.88,
  pointColor: "#ffbf00",
  pointStrokeColor: "#c58f00",
  pointStrokeWidth: 1.5,
  transitFill: "#74716b",
  transitOutline: "#5d5953",
  transitOpacity: 0.7,
  transitPointColor: "#5f5b55",
  transitPointOpacity: 0.8
};

function initialColorMode(): ColorMode {
  try {
    const saved = localStorage.getItem("via-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Fall back to the system preference.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const embedMode = query.get("embed") === "1";
  const publishedMode = embedMode || query.get("public") === "1";
  const [colorMode, setColorMode] = useState<ColorMode>(initialColorMode);
  const THEME = colorMode === "dark" ? DARK_THEME : LIGHT_THEME;
  const UI = colorMode === "dark" ? {
    panelBackground: "rgba(15,23,42,0.88)",
    panelBorder: "rgba(255,255,255,0.1)",
    panelText: "#f8fafc",
    secondaryText: "#94a3b8",
    mutedText: "#64748b",
    faintText: "#3a4a5e",
    controlBackground: "rgba(255,255,255,0.1)",
    controlBorder: "rgba(255,255,255,0.18)",
    controlText: "#fff",
    inactiveControlBackground: "rgba(10,16,28,0.55)",
    inactiveControlText: "rgba(255,255,255,0.75)",
    activeControlBackground: "rgba(255,255,255,0.92)",
    activeControlText: "#0b1220",
    menuBackground: "#1e293b",
    divider: "rgba(255,255,255,0.1)",
    hoverBackground: "rgba(255,255,255,0.1)",
    progressTrack: "rgba(255,255,255,0.08)",
    toggleOffBackground: "rgba(51,65,85,0.9)",
    toggleOffBorder: "rgba(148,163,184,0.22)",
    toggleOffKnob: "#94a3b8",
    emptyCheckBorder: "#2a3a55",
    checkText: "#fff",
    cardShadow: "0 8px 32px rgba(0,0,0,0.18)",
    menuShadow: "0 10px 25px rgba(0,0,0,0.5)",
  } : {
    panelBackground: "rgba(255,255,255,0.94)",
    panelBorder: "rgba(178,134,16,0.48)",
    panelText: "#493a11",
    secondaryText: "#77652e",
    mutedText: "#8c7a45",
    faintText: "#a99b73",
    controlBackground: "rgba(255,255,255,0.78)",
    controlBorder: "rgba(178,134,16,0.34)",
    controlText: "#6f570f",
    inactiveControlBackground: "rgba(255,255,255,0.78)",
    inactiveControlText: "#77652e",
    activeControlBackground: "#d2ad35",
    activeControlText: "#fff",
    menuBackground: "rgba(255,255,255,0.98)",
    divider: "rgba(178,134,16,0.22)",
    hoverBackground: "rgba(210,173,53,0.14)",
    progressTrack: "rgba(178,134,16,0.14)",
    toggleOffBackground: "#eee8d8",
    toggleOffBorder: "#d5c9aa",
    toggleOffKnob: "#9b8e6a",
    emptyCheckBorder: "#c9bd9c",
    checkText: "#6f570f",
    cardShadow: "0 10px 30px rgba(89,72,24,0.16), 0 1px 4px rgba(89,72,24,0.1)",
    menuShadow: "0 10px 25px rgba(89,72,24,0.18)",
  };
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const parkMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  // const [exportScope, setExportScope] = useState<"all" | "current">("all");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);

  // Tag state
  const [tags, setTagsState] = useState<string[]>(() => publishedMode ? [] : loadTags());
  const [tag, setTag] = useState<TagId>(() => tags.length > 0 ? tags[0] : "Me");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagVal, setNewTagVal] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editTagVal, setEditTagVal] = useState("");

  const [view, setView] = useState<ViewMode>("world");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [trips, setTrips] = useState<Trip[]>(() => publishedMode ? [] : loadTrips());
  const [publishedLoading, setPublishedLoading] = useState(publishedMode);

  const [modalOpen, setModalOpen] = useState(false);
  const [visitType, setVisitType] = useState<VisitType>("visited");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [parkSidebarOpen, setParkSidebarOpen] = useState(false);
  const [showParksOnMap, setShowParksOnMap] = useState(() => publishedMode ? false : loadParkMapVisibility());
  const [flagListExpanded, setFlagListExpanded] = useState(false);

  useEffect(() => {
    if (!publishedMode) return;

    loadPublishedData()
      .then((data) => {
        setTrips(data.trips);
        setTagsState(data.tags);
        if (data.tags.length) setTag(data.tags[0]);
      })
      .catch((error) => setMapError(error instanceof Error ? error.message : String(error)))
      .finally(() => setPublishedLoading(false));
  }, [publishedMode]);

  useEffect(() => {
    if (!embedMode) return;
    const receiveTheme = (event: MessageEvent) => {
      if (event.data?.type !== "via-theme") return;
      if (event.data.theme === "light" || event.data.theme === "dark") {
        setColorMode(event.data.theme);
      }
    };
    window.addEventListener("message", receiveTheme);
    window.parent.postMessage({ type: "via-ready" }, "*");
    return () => window.removeEventListener("message", receiveTheme);
  }, [embedMode]);

  function toggleColorMode() {
    const next = colorMode === "dark" ? "light" : "dark";
    setColorMode(next);
    try {
      localStorage.setItem("via-theme", next);
    } catch {
      // Theme persistence is optional.
    }
  }

  // Stats and flags
  const stats = useMemo(() => {
    let current = trips.filter((t) => t.tag === tag);
    if (yearFilter !== "all") current = current.filter(t => t.date.startsWith(yearFilter));
    const visitedTripsForStats = current.filter((t) => getVisitType(t) === "visited");
    const countryCodes = uniq(visitedTripsForStats.map((t) => (t.place.countryIso2 || "").toUpperCase()).filter(Boolean));

    const chinaTrips = current.filter((t) => (t.place.countryIso2 || "").toUpperCase() === "CN");
    const visitedChinaTrips = visitedTripsForStats.filter((t) => (t.place.countryIso2 || "").toUpperCase() === "CN");
    const chinaRegions = uniq(
      visitedChinaTrips
        .map(getChinaRegionKey)
        .filter((value): value is string => Boolean(value))
    );

    const usTrips = current.filter((t) => (t.place.countryIso2 || "").toUpperCase() === "US");
    const visitedUSTrips = visitedTripsForStats.filter((t) => (t.place.countryIso2 || "").toUpperCase() === "US");
    const usStates = uniq(
      visitedUSTrips
        .map(getUSStateKey)
        .filter((value): value is string => Boolean(value))
    );

    return {
      countries: countryCodes.length,
      chinaRegions: chinaRegions.length,
      usStates: usStates.length,
      footprints: current.length,
      chinaFootprints: chinaTrips.length,
      usFootprints: usTrips.length,
      codes: countryCodes
    };
  }, [trips, tag, yearFilter]);

  const primaryStatsLabel = useMemo(() => {
    if (view === "cn") {
      return `${stats.chinaRegions}/${CHINA_REGION_TOTAL} Provinces · ${stats.chinaFootprints} Footprints`;
    }
    if (view === "us") {
      return `${stats.usStates}/${US_STATE_TOTAL} States · ${stats.usFootprints} Footprints`;
    }
    return `${stats.countries}/195 Countries · ${stats.footprints} Footprints`;
  }, [stats, view]);

  const hasMoreFlags = stats.codes.length > 5;
  const visibleFlagCodes = flagListExpanded ? stats.codes : stats.codes.slice(0, 5);

  useEffect(() => {
    if (!hasMoreFlags) setFlagListExpanded(false);
  }, [hasMoreFlags]);

  useEffect(() => {
    if (publishedMode) return;
    saveParkMapVisibility(showParksOnMap);
  }, [publishedMode, showParksOnMap]);

  const availableYears = useMemo(
    () => [...new Set(trips.filter(t => t.tag === tag).map(t => t.date.slice(0, 4)))].sort().reverse(),
    [trips, tag]
  );


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
    const nextTrips = trips.filter(t => t.tag !== tToDelete);
    setTagsState(next);
    saveTags(next);
    setTrips(nextTrips);
    saveTrips(nextTrips);
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
        layers: [{ id: "bg", type: "background", paint: { "background-color": THEME.pageBackground } }]
      };

      const map = new maplibregl.Map({
        container: mapElRef.current,
        style: minimalStyle,
        center: [0, 20],
        zoom: 1.4,
        attributionControl: false,
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
        const baseFill = THEME.baseFill;
        const baseLine = THEME.baseLine;

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
            "circle-stroke-width": THEME.pointStrokeWidth,
            "circle-stroke-color": THEME.pointStrokeColor
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    map.setPaintProperty("bg", "background-color", THEME.pageBackground);
    ["countries", "cn", "us"].forEach((prefix) => {
      map.setPaintProperty(`${prefix}-base-fill`, "fill-color", THEME.baseFill);
      map.setPaintProperty(`${prefix}-base-line`, "line-color", THEME.baseLine);
      map.setPaintProperty(`${prefix}-hi`, "fill-color", THEME.hiFill);
      map.setPaintProperty(`${prefix}-hi`, "fill-opacity", THEME.hiOpacity);
      map.setPaintProperty(`${prefix}-hi-line`, "line-color", THEME.hiOutline);
      map.setPaintProperty(`${prefix}-transit`, "fill-color", THEME.transitFill);
      map.setPaintProperty(`${prefix}-transit`, "fill-opacity", THEME.transitOpacity);
      map.setPaintProperty(`${prefix}-transit-line`, "line-color", THEME.transitOutline);
    });
    map.setPaintProperty("trip-points-layer", "circle-color", THEME.pointColor);
    map.setPaintProperty("trip-points-layer", "circle-stroke-color", THEME.pointStrokeColor);
    map.setPaintProperty("trip-points-layer", "circle-stroke-width", THEME.pointStrokeWidth);
    map.setPaintProperty("trip-points-transit-layer", "circle-color", THEME.transitPointColor);
    map.setPaintProperty("trip-points-transit-layer", "circle-opacity", THEME.transitPointOpacity);
  }, [colorMode, mapReady]);

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
      .then(({ trips: newTrips, tags: importedBackupTags }) => {
        const fallbackTags = Array.from(new Set(newTrips.map(t => t.tag).filter(Boolean)));
        const nextTags = importedBackupTags?.length ? importedBackupTags : (fallbackTags.length ? fallbackTags : ["Me"]);
        const nextTrips = newTrips.filter(t => nextTags.includes(t.tag));

        // Replace footprint data.
        setTrips(nextTrips);
        saveTrips(nextTrips);
        setTagsState(nextTags);
        saveTags(nextTags);
        setTag(nextTags[0]);

        alert(`Success! Loaded ${nextTrips.length} footprints.`);
      })
      .catch((err) => alert("Failed to import: " + err));
    
    e.target.value = ""; 
  }

  async function handlePublish() {
    let secret = sessionStorage.getItem("via-publish-secret") ?? "";
    if (!secret) {
      secret = window.prompt("Enter the Via publish password:") ?? "";
    }
    if (!secret) return;

    setPublishing(true);
    setPublishStatus(null);
    try {
      await publishData(trips, tags, secret);
      sessionStorage.setItem("via-publish-secret", secret);
      setPublishStatus(`Published ${trips.length} footprints to the homepage.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "Incorrect publish password.") {
        sessionStorage.removeItem("via-publish-secret");
      }
      setPublishStatus(message);
    } finally {
      setPublishing(false);
    }
  }

  const filteredTrips = useMemo(() => {
    let result = trips.filter((t) => t.tag === tag);
    if (yearFilter !== "all") result = result.filter(t => t.date.startsWith(yearFilter));
    return result.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [trips, tag, yearFilter]);

  const [parkVisits, setParkVisits] = useState<Record<string, string[]>>(() => loadParkVisits());
  const visitedParks = useMemo(() => new Set(parkVisits[tag] ?? []), [parkVisits, tag]);

  function togglePark(parkName: string) {
    const current = parkVisits[tag] ?? [];
    const next = current.includes(parkName)
      ? current.filter(p => p !== parkName)
      : [...current, parkName];
    const updated = { ...parkVisits, [tag]: next };
    setParkVisits(updated);
    saveParkVisits(updated);
  }

  // Update highlights.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const visitedTrips = filteredTrips.filter((t) => getVisitType(t) === "visited");
    const transitTrips = filteredTrips.filter((t) => getVisitType(t) === "transit");
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
  }, [filteredTrips, view, mapReady]);

  // Update footprint points.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const fc = {
      type: "FeatureCollection",
      features: filteredTrips.map((t) => ({
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
  }, [filteredTrips, mapReady]);

  // Show visited national parks as small map icons in the USA view.
  useEffect(() => {
    const clearParkMarkers = () => {
      parkMarkersRef.current.forEach(marker => marker.remove());
      parkMarkersRef.current = [];
    };
    const map = mapRef.current;

    clearParkMarkers();

    if (!map || !mapReady || view !== "us" || !showParksOnMap) return clearParkMarkers;

    NATIONAL_PARKS.forEach((park) => {
      if (!visitedParks.has(park.name)) return;
      const coords = PARK_COORDS[park.name];
      if (!coords) return;

      const el = document.createElement("button");
      el.type = "button";
      el.title = park.name;
      el.setAttribute("aria-label", park.name);
      el.textContent = park.icon;
      Object.assign(el.style, {
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        border: `1px solid ${THEME.hiOutline}`,
        background: "rgba(15,23,42,0.82)",
        boxShadow: `0 0 0 2px rgba(41,223,242,0.18), 0 4px 12px rgba(0,0,0,0.35)`,
        color: "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        lineHeight: "1",
        padding: "0",
        pointerEvents: "auto",
      });

      el.addEventListener("click", () => {
        map.easeTo({ center: coords, zoom: Math.max(map.getZoom(), 5), duration: 600 });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(coords)
        .addTo(map);
      parkMarkersRef.current.push(marker);
    });

    return clearParkMarkers;
  }, [mapReady, showParksOnMap, view, visitedParks]);

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
      map.easeTo({ center: [108, 33], zoom: 1.0 });
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
    <div className={`via-app theme-${colorMode}${embedMode ? " embed-mode" : ""}`} style={{ position: "relative", width: "100vw", height: "100vh", background: THEME.pageBackground, overflow: "hidden" }}>
      <div ref={mapElRef} style={{ position: "absolute", inset: 0 }} />

      {!embedMode && (
        <button
          type="button"
          onClick={toggleColorMode}
          aria-label={`Switch to ${colorMode === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${colorMode === "dark" ? "light" : "dark"} theme`}
          style={{
            position: "absolute",
            top: 14,
            right: 52,
            zIndex: 10,
            width: 32,
            height: 32,
            padding: 0,
            borderRadius: "50%",
            border: `1px solid ${colorMode === "dark" ? "#555762" : "#d8d8d8"}`,
            background: colorMode === "dark" ? "rgba(32,33,43,0.92)" : "rgba(255,255,255,0.92)",
            color: colorMode === "dark" ? "#3eb7f0" : "#b18412",
            cursor: "pointer",
            fontSize: 15,
            lineHeight: "30px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          {colorMode === "dark" ? "☀" : "☾"}
        </button>
      )}

      {embedMode && (
        <div style={{
          position: "absolute",
          top: 8,
          left: 8,
          color: colorMode === "dark" ? "rgba(248,250,252,0.92)" : "#6f570f",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.01em",
          textShadow: colorMode === "dark" ? "0 1px 4px rgba(0,0,0,0.9)" : "0 1px 3px rgba(255,255,255,0.95)",
          pointerEvents: "none",
        }}>
          {publishedLoading ? "Loading…" : primaryStatsLabel}
        </div>
      )}

      {/* Stats Card */}
      {!embedMode && (
      <div style={{
        position: "absolute", top: 12, left: 12, width: 250, padding: 12, borderRadius: 16,
        background: UI.panelBackground,
        border: `1px solid ${UI.panelBorder}`,
        color: UI.panelText,
        backdropFilter: "blur(12px)", boxSizing: "border-box", boxShadow: UI.cardShadow
      }}>
        <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.02em" }}>Travel Footprints</div>
        <div style={{ marginTop: 3, fontSize: 11.5, opacity: 0.8 }}>
          {publishedLoading ? "Loading published map…" : primaryStatsLabel}
        </div>
        {mapError && <div style={{ color: "red", fontSize: 12 }}>{mapError}</div>}

        {!publishedMode && <>
        {/* Tag List */}
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
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
                  <Pill theme={colorMode} active={isActive} onClick={() => setTag(t)}>
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
              style={{ width: 60, padding: "6px 10px", borderRadius: 99, border: `1px solid ${UI.controlBorder}`, background: UI.controlBackground, color: UI.controlText, outline: "none", fontSize: 12 }}
            />
          ) : (
            <button onClick={() => setIsAddingTag(true)} style={{
               padding: "4px 10px", borderRadius: 99, border: `1px dashed ${UI.controlBorder}`,
               background: "transparent", color: UI.controlText, cursor: "pointer", fontSize: 14
            }}>+</button>
          )}
        </div>
        {/* Year filter */}
        {availableYears.length > 0 && (
          <div style={{ marginTop: 7, display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
            {["all", ...availableYears].map(y => (
              <button
                key={y}
                onClick={() => setYearFilter(y)}
                style={{
                  padding: "2px 7px", borderRadius: 99, fontSize: 10.5, cursor: "pointer",
                  border: `1px solid ${UI.controlBorder}`,
                  background: yearFilter === y ? UI.activeControlBackground : UI.inactiveControlBackground,
                  color: yearFilter === y ? UI.activeControlText : UI.inactiveControlText,
                  fontWeight: yearFilter === y ? 700 : 400,
                }}
              >
                {y === "all" ? "All" : y}
              </button>
            ))}
          </div>
        )}

        {/* Backup tools */}
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${UI.divider}`, display: "flex", flexWrap: "wrap", gap: 5, position: "relative" }}>
            
            {/* Backup menu button */}
            <button 
              onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
              style={{ flex: 1, minWidth: 0, padding: "5px 3px", fontSize: 10.5, whiteSpace: "nowrap", background: UI.controlBackground, color: UI.controlText, border: `1px solid ${UI.controlBorder}`, borderRadius: 6, cursor: "pointer" }}
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
                background: UI.menuBackground,
                border: `1px solid ${UI.panelBorder}`,
                borderRadius: 8,
                boxShadow: UI.menuShadow,
                zIndex: 10,
                overflow: "hidden",
                display: "flex", 
                flexDirection: "column"
              }}>
                {/* All data */}
                <button
                  onClick={() => {
                    exportData(trips, tags); // Export visible tags only
                    setDownloadMenuOpen(false); // Close menu
                  }}
                  style={{ padding: "10px 12px", textAlign: "left", background: "transparent", border: "none", color: UI.panelText, fontSize: 12, cursor: "pointer", borderBottom: `1px solid ${UI.divider}` }}
                  onMouseEnter={(e) => e.currentTarget.style.background = UI.hoverBackground}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  Download All
                </button>
                
                {/* Current tag only */}
                <button
                  onClick={() => {
                    exportData(trips.filter(t => t.tag === tag), [tag]); // Export current tag
                    setDownloadMenuOpen(false);
                  }}
                  style={{ padding: "10px 12px", textAlign: "left", background: "transparent", border: "none", color: colorMode === "dark" ? "#3b82f6" : THEME.hiOutline, fontSize: 12, cursor: "pointer" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = UI.hoverBackground}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  Download "{tag}"
                </button>
              </div>
            )}

            {/* Restore button */}
            <label style={{ flex: 1, minWidth: 0, padding: "5px 3px", fontSize: 10.5, whiteSpace: "nowrap", background: UI.controlBackground, color: UI.controlText, border: `1px solid ${UI.controlBorder}`, borderRadius: 6, cursor: "pointer", textAlign: "center" }}>
              ⬆️ Restore
              <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
            </label>

            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "5px 3px",
                fontSize: 10.5,
                whiteSpace: "nowrap",
                background: UI.controlBackground,
                color: UI.controlText,
                border: `1px solid ${UI.controlBorder}`,
                borderRadius: 6,
                cursor: publishing ? "wait" : "pointer",
                opacity: publishing ? 0.65 : 1,
              }}
            >
              {publishing ? "Publishing…" : "☁️ Publish"}
            </button>

            {publishStatus && (
              <div style={{ flex: "1 0 100%", color: UI.secondaryText, fontSize: 11, lineHeight: 1.35 }}>
                {publishStatus}
              </div>
            )}
         </div>
        </>}
      </div>
      )}

      {/* Flag bar */}
      <div style={{
        position: "absolute", bottom: embedMode ? 12 : 20, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: embedMode ? 5 : 8,
        padding: flagListExpanded ? (embedMode ? "9px 11px" : "12px 14px") : (embedMode ? "5px 7px" : "8px 10px"),
        maxWidth: "80vw", maxHeight: flagListExpanded ? "32vh" : 40,
        overflowY: flagListExpanded ? "auto" : "hidden",
        overflowX: "hidden", scrollbarWidth: "none",
        justifyContent: "center", alignItems: "start",
        borderRadius: flagListExpanded ? 14 : 999,
        background: stats.codes.length > 0
          ? (colorMode === "dark" ? "rgba(15,23,42,0.42)" : "rgba(248,250,253,0.88)")
          : "transparent",
        backdropFilter: stats.codes.length > 0 ? "blur(10px)" : "none",
        border: stats.codes.length > 0
          ? (colorMode === "dark" ? "none" : "1px solid rgba(184,143,25,0.22)")
          : "none",
        pointerEvents: "auto"
      }}>
         <div style={{
           display: "grid",
           gridTemplateColumns: `repeat(${Math.min(5, visibleFlagCodes.length || 1)}, 24px)`,
           gridAutoRows: 24,
           gap: "6px 8px",
           justifyContent: "center"
         }}>
           {visibleFlagCodes.map(code => (
             <span key={code} title={code} style={{ fontSize: embedMode ? 15 : 20, cursor: "default", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))", textAlign: "center", lineHeight: "24px" }}>
               {getFlagEmoji(code)}
             </span>
           ))}
         </div>
         {hasMoreFlags && (
           <button
             type="button"
             aria-label={flagListExpanded ? "Collapse flags" : "Expand flags"}
             title={flagListExpanded ? "Show fewer flags" : "Show all flags"}
             onClick={() => setFlagListExpanded((open) => !open)}
             style={{
               width: 24,
               height: 24,
               borderRadius: 999,
               border: `1px solid ${colorMode === "dark" ? "rgba(255,255,255,0.22)" : "rgba(184,143,25,0.32)"}`,
               background: colorMode === "dark" ? "rgba(15,23,42,0.78)" : "rgba(255,255,255,0.94)",
               color: colorMode === "dark" ? "#e2e8f0" : "#9a7110",
               cursor: "pointer",
               display: "flex",
               alignItems: "center",
               justifyContent: "center",
               fontSize: 14,
               lineHeight: 1,
               padding: 0,
               flex: "0 0 auto",
               marginTop: 0
             }}
           >
             {flagListExpanded ? "⌃" : "⌄"}
           </button>
         )}
      </div>

      {/* View Switch */}
      <div style={{ position: "absolute", left: embedMode ? 8 : 14, bottom: embedMode ? 12 : 20, display: "flex", gap: embedMode ? 4 : 8 }}>
        <Pill theme={colorMode} compact={embedMode} active={view === "world"} onClick={() => setView("world")}>World</Pill>
        <Pill theme={colorMode} compact={embedMode} active={view === "cn"} onClick={() => setView("cn")}>China</Pill>
        <Pill theme={colorMode} compact={embedMode} active={view === "us"} onClick={() => setView("us")}>USA</Pill>
      </div>

      {/* Add Button */}
      {!publishedMode && <button onClick={() => setModalOpen(true)} style={{
          position: "absolute", right: 20, bottom: 20, width: 52, height: 52,
          borderRadius: 20, border: "none",
          background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
          color: "white", fontSize: 28, cursor: "pointer", boxShadow: "0 8px 20px rgba(59,130,246,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}
      >＋</button>}

      {/* National Parks Sidebar */}
      {!publishedMode && view === "us" && (
        <div style={{
          position: "absolute",
          top: 80,
          right: 0,
          display: "flex",
          alignItems: "flex-start",
          zIndex: 5,
        }}>
          {/* Sliding panel */}
          <div style={{
            width: parkSidebarOpen ? 240 : 0,
            maxHeight: "calc(100vh - 150px)",
            overflowX: "hidden",
            overflowY: parkSidebarOpen ? "auto" : "hidden",
            opacity: parkSidebarOpen ? 1 : 0,
            transition: "width 0.3s ease, opacity 0.2s ease",
            background: UI.panelBackground,
            backdropFilter: "blur(14px)",
            border: `1px solid ${UI.panelBorder}`,
            borderRight: "none",
            borderRadius: "12px 0 0 12px",
            scrollbarWidth: "thin",
            scrollbarColor: `${UI.controlBorder} transparent`,
          }}>
            <div style={{ width: 240, padding: "14px 16px", color: UI.panelText }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>National Parks</div>
                <label
                  title="Show visited parks on map"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: showParksOnMap ? (colorMode === "dark" ? "#c8f7ff" : "#8a6501") : UI.mutedText,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span>Show on map</span>
                  <input
                    type="checkbox"
                    checked={showParksOnMap}
                    onChange={(e) => setShowParksOnMap(e.target.checked)}
                    style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                  />
                  <span style={{
                    width: 28,
                    height: 16,
                    borderRadius: 999,
                    background: showParksOnMap ? THEME.hiFill : UI.toggleOffBackground,
                    border: `1px solid ${showParksOnMap ? THEME.hiOutline : UI.toggleOffBorder}`,
                    position: "relative",
                    flexShrink: 0,
                    transition: "background 0.2s ease, border-color 0.2s ease",
                  }}>
                    <span style={{
                      position: "absolute",
                      top: 2,
                      left: showParksOnMap ? 14 : 2,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: showParksOnMap ? THEME.pointColor : UI.toggleOffKnob,
                      boxShadow: showParksOnMap ? (colorMode === "dark" ? "0 0 8px rgba(41,223,242,0.7)" : "0 0 7px rgba(197,143,0,0.34)") : "none",
                      transition: "left 0.2s ease, background 0.2s ease",
                    }} />
                  </span>
                </label>
              </div>
              <div style={{ fontSize: 11, color: UI.mutedText, marginBottom: 8 }}>
                {visitedParks.size} / {NATIONAL_PARKS.length} visited
              </div>
              {/* Progress bar */}
              <div style={{ height: 3, background: UI.progressTrack, borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${(visitedParks.size / NATIONAL_PARKS.length) * 100}%`,
                  background: `linear-gradient(to right, ${THEME.hiFill}, ${THEME.pointColor})`,
                  borderRadius: 2,
                  transition: "width 0.5s ease",
                }} />
              </div>
              {/* Parks grouped by state */}
              {Object.keys(PARKS_BY_STATE).sort().map(state => {
                const parks = PARKS_BY_STATE[state];
                const stateVisited = parks.filter(p => visitedParks.has(p.name)).length;
                return (
                  <div key={state} style={{ marginBottom: 10 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700,
                      color: stateVisited > 0 ? UI.secondaryText : UI.faintText,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      marginBottom: 4, display: "flex", justifyContent: "space-between",
                    }}>
                      <span>{state}</span>
                      {stateVisited > 0 && (
                        <span style={{ color: THEME.pointColor }}>{stateVisited}/{parks.length}</span>
                      )}
                    </div>
                    {parks.map(park => {
                      const visited = visitedParks.has(park.name);
                      return (
                        <button
                          key={park.name}
                          onClick={() => togglePark(park.name)}
                          title={visited ? "Mark as not visited" : "Mark as visited"}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            width: "100%", padding: "3px 0",
                            background: "transparent", border: "none", cursor: "pointer",
                            textAlign: "left", fontSize: 11.5,
                            color: visited ? UI.panelText : UI.faintText,
                          }}
                        >
                          <span style={{
                            width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: visited ? THEME.hiFill : "transparent",
                            border: `1.5px solid ${visited ? THEME.hiOutline : UI.emptyCheckBorder}`,
                            fontSize: 9, color: UI.checkText, fontWeight: 700,
                          }}>
                            {visited ? "✓" : ""}
                          </span>
                          <span style={{ fontSize: 12 }}>{park.icon}</span>
                          {park.name}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Toggle tab */}
          <button
            onClick={() => setParkSidebarOpen(p => !p)}
            title={parkSidebarOpen ? "Close parks panel" : "National Parks"}
            style={{
              flexShrink: 0,
              width: 30,
              padding: "14px 0",
              background: UI.panelBackground,
              border: `1px solid ${UI.panelBorder}`,
              borderLeft: parkSidebarOpen ? "none" : `1px solid ${UI.panelBorder}`,
              borderRadius: parkSidebarOpen ? "0 12px 12px 0" : "12px",
              color: UI.panelText,
              cursor: "pointer",
              backdropFilter: "blur(12px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              transition: "border-radius 0.3s ease",
            }}
          >
            <span style={{ fontSize: 14 }}>🏕</span>
            <span style={{
              writingMode: "vertical-rl", textOrientation: "mixed",
              fontSize: 9, letterSpacing: "0.1em", color: UI.mutedText,
              fontWeight: 700, textTransform: "uppercase",
            }}>Parks</span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: visitedParks.size > 0 ? THEME.pointColor : UI.faintText,
            }}>
              {visitedParks.size}/{NATIONAL_PARKS.length}
            </span>
            <span style={{ fontSize: 10, color: UI.mutedText }}>
              {parkSidebarOpen ? "▶" : "◀"}
            </span>
          </button>
        </div>
      )}

      {/* Modal */}
      {!publishedMode && modalOpen && (
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
