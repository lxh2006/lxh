'use client';
import "leaflet/dist/leaflet.css";
import { useState, useEffect, useRef, useCallback } from "react";
import API_BASE from "@/config";

var DEFAULT_CENTER = { lat: 39.9042, lng: 116.4074, zoom: 15 };

var POI_TYPES = [
  { key: "entrance",    label: "🚪 入口",   icon: "🚪", color: "#1677ff", defaultOn: true },
  { key: "attraction",  label: "🏯 景点",   icon: "🏯", color: "#2B6C4E", defaultOn: true },
  { key: "parking",     label: "🅿️ 停车场", icon: "🅿️", color: "#722ed1", defaultOn: true },
  { key: "rest",        label: "🏨 酒店",   icon: "🏨", color: "#fa8c16", defaultOn: true },
  { key: "restaurant",  label: "🍽️ 餐厅",   icon: "🍽️", color: "#eb2f96", defaultOn: true },
];

var typeConfigMap = Object.fromEntries(POI_TYPES.map(function(t) { return [t.key, t]; }));

function createDivIcon(L, type, highlighted) {
  var cfg = typeConfigMap[type] || { icon: "📍", color: "#999" };
  var sz = highlighted ? 36 : 28;
  var bc = highlighted ? "#fff" : cfg.color;
  return L.divIcon({
    className: "cm",
    html: "<div style=\"width:" + sz + "px;height:" + sz + "px;background:" + cfg.color + ";border:2px solid " + bc + ";border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:" + (highlighted ? 16 : 13) + "px;box-shadow:0 2px 8px rgba(0,0,0,0.25)\">" + cfg.icon + "</div>",
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz / 2],
  });
}

function createClusterIcon(L, n) {
  return L.divIcon({
    html: "<div style=\"background:rgba(43,108,78,0.9);color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:3px solid rgba(255,255,255,0.8);box-shadow:0 2px 12px rgba(0,0,0,0.25)\">" + n + "</div>",
    className: "mcc",
    iconSize: [40, 40],
  });
}

function loadCSS(url) {
  return new Promise(function(res, rej) {
    var el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = url;
    el.onload = res;
    el.onerror = rej;
    document.head.appendChild(el);
  });
}

function loadScript(url) {
  return new Promise(function(res, rej) {
    var el = document.createElement("script");
    el.src = url;
    el.async = true;
    el.onload = res;
    el.onerror = rej;
    document.body.appendChild(el);
  });
}

async function loadLeafletWithCluster() {
  var LModule = await import("leaflet");
  var L = LModule.default || LModule;

  window.L = Object.assign({}, L);

  try { await loadCSS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"); } catch(e) {}
  try { await loadCSS("https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"); } catch(e) {}
  try { await loadCSS("https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"); } catch(e) {}

  await loadScript("https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js");

  return window.L;
}

export default function MapPanel({ onBack, onAskGuide, routeData, onDiary })  {
  var [loading, setLoading] = useState(true);
  var [pois, setPois] = useState([]);
  var [activeTypes, setActiveTypes] = useState(POI_TYPES.filter(function(t) { return t.defaultOn; }).map(function(t) { return t.key; }));
  var [selectedPoi, setSelectedPoi] = useState(null);
  var [showFilter, setShowFilter] = useState(false);
  var [drawerVisible, setDrawerVisible] = useState(false);
  var [toast, setToast] = useState(null);

  var containerRef = useRef(null);
  var mapRef = useRef(null);
  var clusterRef = useRef(null);
  var watchRef = useRef(null);
  var userMRef = useRef(null);
  var userCRef = useRef(null);
  var routeRef = useRef([]);
  var poisCache = useRef([]);
  var Lref = useRef(null);

  function doLocate(L, map) {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(function(pos) {
      var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      if (!mapRef.current || mapRef.current._leaflet_id !== map._leaflet_id) return;
      if (!userMRef.current) {
        userMRef.current = L.circleMarker(ll, { radius: 8, fillColor: "#1677ff", fillOpacity: 1, color: "#fff", weight: 2 }).addTo(map);
        userCRef.current = L.circle(ll, { radius: pos.coords.accuracy, color: "#1677ff", fillColor: "#1677ff", fillOpacity: 0.08, weight: 1 }).addTo(map);
        map.setView(ll, 15);
      } else {
        userMRef.current.setLatLng(ll);
        userCRef.current.setLatLng(ll);
        userCRef.current.setRadius(pos.coords.accuracy);
      }
    }, function(err) { console.warn("定位失败:", err.message); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 });
  }

  function buildCluster(L, map, data) {
    var filtered = data.filter(function(p) { return activeTypes.includes(p.type); });
    var g = L.markerClusterGroup({
      maxClusterRadius: 50, spiderfyOnMaxZoom: true, showCoverageOnHover: false,
      zoomToBoundsOnClick: true, disableClusteringAtZoom: 18,
      spiderLegPolylineOptions: { weight: 1.5, color: "#2B6C4E", opacity: 0.5 },
      iconCreateFunction: function(cl) { return createClusterIcon(L, cl.getChildCount()); },
    });
    filtered.forEach(function(poi) {
      if (!poi.lat || !poi.lng) return;
      var m = L.marker([poi.lat, poi.lng], { icon: createDivIcon(L, poi.type, false) });
      m._pd = poi;
      m.on("click", function() {
        setSelectedPoi(poi);
        setDrawerVisible(true);
        m.setIcon(createDivIcon(L, poi.type, true));
        setTimeout(function() { if (m._icon) m.setIcon(createDivIcon(L, poi.type, false)); }, 800);
      });
      g.addLayer(m);
    });
    return g;
  }

  function drawRoute(L, map, rd, allPois) {
    routeRef.current.forEach(function(l) { try { map.removeLayer(l); } catch(e) {} });
    routeRef.current = [];
    var pm = {};
    allPois.forEach(function(p) { pm[p.name] = p; });
    var pts = [];
    rd.forEach(function(item, idx) {
      var p = pm[item.name];
      if (p) {
        pts.push(L.latLng(p.lat, p.lng));
        var ni = L.divIcon({
          className: "rn",
          html: "<div style=\"background:#1677ff;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)\">" + (idx + 1) + "</div>",
          iconSize: [26, 26], iconAnchor: [13, 13],
        });
        L.marker([p.lat, p.lng], { icon: ni }).addTo(map);
      }
    });
    if (pts.length > 1) {
      var pl = L.polyline(pts, { color: "#1677ff", weight: 4, opacity: 0.7, dashArray: "10, 10" }).addTo(map);
      routeRef.current.push(pl);
      map.fitBounds(pl.getBounds().pad(0.15));
    }
  }

  useEffect(function() {
    var alive = true;
    var el = containerRef.current;
    if (!el) return;

    (async function() {
      if (!alive) return;
      if (!alive || !el) return;

      var L = await loadLeafletWithCluster();
      Lref.current = L;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

      var map = L.map(el, { zoomControl: false, attributionControl: false }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_CENTER.zoom);
      mapRef.current = map;
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19 }).addTo(map);

      doLocate(L, map);

      try {
        var res = await fetch(API_BASE + "/api/map/pois");
        var d = await res.json();
        if (!alive) return;
        if (d.status === "success") {
          var pd = d.pois || [];
          setPois(pd);
          poisCache.current = pd;
        if (!alive) return;
          if (d.center) map.setView([d.center.lat, d.center.lng], d.center.zoom);
          var g = buildCluster(L, map, pd);
          map.addLayer(g);
          clusterRef.current = g;
        }
      } catch(e) { console.error("POI load fail:", e); }
      setLoading(false);

      if (routeData && routeData.length > 0) {
        drawRoute(L, map, routeData, poisCache.current);
      }
    })();

    return function() {
      alive = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      if (watchRef.current) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
    };
  }, []);

  useEffect(function() {
    var Lx = Lref.current, map = mapRef.current;
    if (!Lx || !map || pois.length === 0) return;
    if (clusterRef.current) map.removeLayer(clusterRef.current);
    var g = buildCluster(Lx, map, pois);
    map.addLayer(g);
    clusterRef.current = g;
  }, [activeTypes, pois]);

  useEffect(function() {
    var Lx = Lref.current, map = mapRef.current;
    if (!Lx || !map || !routeData || routeData.length === 0 || pois.length === 0) return;
    drawRoute(Lx, map, routeData, pois);
  }, [routeData, pois]);

  var toggleType = useCallback(function(k) {
    setActiveTypes(function(prev) {
      return prev.includes(k) ? prev.filter(function(x) { return x !== k; }) : prev.concat([k]);
    });
  }, []);

  function navTo(poi) {
    window.open("https://uri.amap.com/marker?position=" + poi.lng + "," + poi.lat + "&name=" + encodeURIComponent(poi.name), "_blank");
  }

  function guide(poi) {
    if (onAskGuide) onAskGuide(poi.name);
  }

  function checkin(poi) {
  // 触发旅行记忆事件，和拍照识景记录格式一致
  window.dispatchEvent(new CustomEvent("travelMemory", {
    detail: {
      spot: poi.name,
      description: poi.description || '',
      contents: {}  // 地图打卡暂时没有日记文案，后续可扩展
    }
  }));
  // 给一个轻提示（Toast）而不是弹窗
  setToast("✅ 已打卡：" + poi.name);
  setTimeout(() => setToast(null), 2000);
}

  function diary(poi) {
  if (onDiary) {
    onDiary("请帮我写一段关于「" + poi.name + "」的旅行日记，包括历史背景和游览感受。");
  }
}

  return (
    <div style={s.c}>
      <div style={s.top}>
        <button style={s.back} onClick={onBack}>← 返回</button>
        <span style={s.tt}>🗺️ 景区地图</span>
        <button style={Object.assign({}, s.fb, { backgroundColor: showFilter ? "#2B6C4E" : "rgba(255,255,255,0.9)", color: showFilter ? "#fff" : "#2B6C4E" })} onClick={function() { setShowFilter(!showFilter); }}>{showFilter ? "完成" : "筛选"}</button>
      </div>

      {!showFilter && (
        <div style={s.strip}>
          {POI_TYPES.map(function(t) { return (
            <button key={t.key} style={Object.assign({}, s.chip, { backgroundColor: activeTypes.includes(t.key) ? t.color : "#f0f0f0", color: activeTypes.includes(t.key) ? "#fff" : "#666" })} onClick={function() { toggleType(t.key); }}>{t.icon} {t.label}</button>
          );})}
        </div>
      )}

      {showFilter && (
        <div style={s.fp}>
          <div style={s.fg}>
            {POI_TYPES.map(function(t) { return (
              <button key={t.key} style={Object.assign({}, s.fgb, { backgroundColor: activeTypes.includes(t.key) ? t.color : "#f5f5f5", color: activeTypes.includes(t.key) ? "#fff" : "#666", borderColor: activeTypes.includes(t.key) ? t.color : "#ddd" })} onClick={function() { toggleType(t.key); }}>
                <span style={{fontSize:20}}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );})}
          </div>
        </div>
      )}

      <div ref={containerRef} style={s.map}>
        {loading && <div style={s.load}><div style={s.loadTxt}>加载地图...</div></div>}
      </div>

      <button style={s.ai} onClick={function() { if (onAskGuide) onAskGuide(""); }}>
        <span style={{fontSize:24}}>🤖</span>
        <span style={s.aiT}>AI导游</span>
      </button>


      {toast && <div style={s.toast}>{toast}</div>}

      {drawerVisible && selectedPoi && (
        <div style={s.dover} onClick={function() { setDrawerVisible(false); }}>
          <div style={s.draw} onClick={function(e) { e.stopPropagation(); }}>
            <button onClick={() => setDrawerVisible(false)} style={s.closeBtn}>✕</button>
            <div style={s.dh}></div>
            <div style={s.dhd}>
              <div>
                <span style={s.dt}>{(typeConfigMap[selectedPoi.type] || {}).icon || "📍"} {(typeConfigMap[selectedPoi.type] || {}).label || "未知"}</span>
                <h3 style={s.dti}>{selectedPoi.name}</h3>
              </div>
            </div>
            {selectedPoi.image && (
              <div style={s.diw}><img src={selectedPoi.image} alt={selectedPoi.name} style={s.di} loading="lazy" /></div>
            )}
            {selectedPoi.description && <p style={s.dd}>{selectedPoi.description}</p>}
            <div style={s.da}>
              <button style={s.ap} onClick={function() { guide(selectedPoi); }}>🤖 讲解</button>
              <button style={s.ab} onClick={function() { checkin(selectedPoi); }}>✅ 打卡</button>
              <button style={s.ab} onClick={function() { navTo(selectedPoi); }}>🧭 导航</button>
              <button style={s.ab} onClick={function() { diary(selectedPoi); }}>📸 日记</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

var s = {
  c: { position: "fixed", bottom: 0, left: 0, right: 0, top: 0, background: "#fff", display: "flex", flexDirection: "column", zIndex: 20 },
  top: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fff", borderBottom: "1px solid #f0f0f0", zIndex: 10, flexShrink: 0 },
  back: { background: "none", border: "none", fontSize: "16px", color: "#2B6C4E", fontWeight: 600, cursor: "pointer", padding: "4px 0" },
  tt: { fontSize: "17px", fontWeight: 700, color: "#2B6C4E" },
  fb: { padding: "6px 14px", borderRadius: "16px", border: "1px solid #2B6C4E", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" },
  strip: { display: "flex", gap: "8px", padding: "8px 16px", overflowX: "auto", flexShrink: 0, background: "#fff", borderBottom: "1px solid #f5f5f5", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" },
  chip: { flexShrink: 0, padding: "6px 14px", borderRadius: "20px", border: "none", fontSize: "13px", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s" },
  fp: { padding: "12px 16px", background: "#fafafa", borderBottom: "1px solid #eee", flexShrink: 0 },
  fg: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" },
  fgb: { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "10px 6px", borderRadius: "12px", border: "1.5px solid #ddd", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" },
  map: { flex: 1, width: "100%", position: "relative", minHeight: 0, zIndex: 1    },
  load: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.9)", zIndex: 5 },
  loadTxt: { color: "#888", fontSize: "14px" },
  toast: {
  position: "absolute", bottom: "120px", left: "50%", transform: "translateX(-50%)",
  background: "rgba(43,108,78,0.9)", color: "#fff", padding: "10px 20px",
  borderRadius: "20px", fontSize: "14px", fontWeight: 600, zIndex: 2000,
  boxShadow: "0 2px 10px rgba(0,0,0,0.2)", whiteSpace: "nowrap"
  },
  ai: { position: "absolute", top: "80px", right: "12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "10px 8px", background: "rgba(255,255,255,0.92)", border: "1px solid rgba(43,108,78,0.2)", borderRadius: "16px", cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.12)", zIndex: 50, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" },
  aiT: { fontSize: "10px", color: "#2B6C4E", fontWeight: 600 },
  dover: { position: "absolute", bottom: 0, left: 0, right: 0, top: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", background: "rgba(0,0,0,0.2)" ,pointerEvents: "auto"},
  closeBtn: { position: "absolute", top: 12, right: 16, width: 28, height: 28, borderRadius: "50%", background: "#f0f0f0", border: "none", fontSize: 14, color: "#666", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 1 },
  draw: { position: "relative",width: "100%", maxHeight: "40vh",minHeight: "200px", background: "#fff", borderTopLeftRadius: "20px", borderTopRightRadius: "20px", padding: "12px 20px 24px", boxShadow: "0 -4px 20px rgba(0,0,0,0.15)", overflowY: "auto",marginBottom: 0,zIndex: 1001  },
  dh: { width: 36, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 12px" },
  dhd: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  dt: { fontSize: "12px", color: "#888", fontWeight: 500 },
  dti: { fontSize: "20px", fontWeight: 700, color: "#222", marginTop: 4 },
  diw: { width: "100%", height: 120, borderRadius: 12, overflow: "hidden", marginBottom: 12, background: "#f5f5f5" },
  di: { width: "100%", height: "100%", objectFit: "cover" },
  dd: { fontSize: "14px", color: "#555", lineHeight: 1.6, marginBottom: 16 },
  da: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" },
  ap: { padding: "10px 0", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #2B6C4E, #3A8F5F)", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(43,108,78,0.25)" },
  ab: { padding: "10px 0", borderRadius: "12px", border: "1px solid #e0e0e0", background: "#fff", color: "#444", fontSize: "13px", fontWeight: 500, cursor: "pointer" },
};
