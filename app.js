// ================================
// WebGIS prototipo: Leaflet + GeoJSON
// Linee (muretti) colorate per stato
// POI cliccabili con popup
// Stati possibili: ottimo, buono, mediocre, pessimo
// ================================

// 1) Inizializzo la mappa
const ZOOM_OFFSET = 3;
const map = L.map("map").setView([41.9, 12.5], 6); // Italia

// Base map OSM
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// Base map satellitare (Esri)
const esriSat = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 19,
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
  }
);

// 2) Stati supportati (solo i 4 richiesti)
const STATI = ["pessimo", "mediocre", "buono", "ottimo"];

// 3) Funzione che assegna il colore in base allo stato
function coloreStato(stato) {
  const s = String(stato || "").toLowerCase().trim();
  switch (s) {
    case "pessimo":
      return "#d7191c"; // rosso
    case "mediocre":
      return "#fdae61"; // arancione
    case "buono":
      return "#ffff66"; // giallo
    case "ottimo":
      return "#1a9641"; // verde
    default:
      return "#2b83ba"; // fallback blu
  }
}

// 4) Stile delle linee (muretti)
function stileMuretti(feature) {
  const stato = String(feature?.properties?.stato || "").toLowerCase().trim();

  // Se il GeoJSON fornisce un peso esplicito, usalo.
  const weightFromData = Number(feature?.properties?.weight);

  // Fallback: peso diverso per evidenziare i pessimi
  let weight = 4;
  if (stato === "pessimo") weight = 6;
  if (stato === "ottimo") weight = 3;

  return {
    color: coloreStato(stato),
    weight: Number.isFinite(weightFromData) ? weightFromData : weight,
    opacity: 0.95
  };
}

// 5) Popup e interazione per ogni muretto
function onEachMuretto(feature, layer) {
  const p = feature.properties || {};

  const titolo = p.titolo || `Muretto ${p.id ?? ""}`.trim();
  const stato = p.stato ?? "n.d.";
  const note = p.note ? `<p style="margin: 6px 0 0 0;">${p.note}</p>` : "";

  // Se in futuro avrai una foto: p.foto = "url"
  const foto = p.foto
    ? `<p style="margin:8px 0 0 0;">
         <img src="${p.foto}" alt="" style="width:100%;border-radius:10px"/>
       </p>`
    : "";

  layer.bindPopup(`
    <h3 style="margin:0 0 6px 0;">${titolo}</h3>
    <p style="margin:0;"><b>Stato:</b> ${stato}</p>
    ${note}
    ${foto}
  `);

  // Highlight al passaggio e al click
  layer.on("mouseover", () => layer.setStyle({ weight: 7 }));
  layer.on("mouseout", () => layer.setStyle(stileMuretti(feature)));
}

// 6) Stile POI (marker custom)
function poiToLayer(feature, latlng) {
  const sizeFromData = Number(feature?.properties?.size);
  const colorFromData = String(feature?.properties?.color || "").trim();
  const markerColor = colorFromData || "#3388ff";
  const diameter = Number.isFinite(sizeFromData) && sizeFromData > 0 ? sizeFromData : 14;
  const iconSize = diameter + 8;

  return L.marker(latlng, {
    icon: L.divIcon({
      className: "poi-div-icon",
      html: `<span class="poi-dot" style="--poi-size:${diameter}px;--poi-color:${markerColor};"></span>`,
      iconSize: [iconSize, iconSize],
      iconAnchor: [iconSize / 2, iconSize / 2],
      popupAnchor: [0, -iconSize / 2]
    })
  });
}

// 7) Popup POI
function onEachPoi(feature, layer) {
  const p = feature.properties || {};

  const titolo = p.titolo || "POI";
  const contenuto = p.html
    ? p.html
    : (p.descrizione ? `<p style="margin:6px 0 0 0;">${p.descrizione}</p>` : "");

  const link = p.link
    ? `<p style="margin:8px 0 0 0;">
         <a href="${p.link}" target="_blank" rel="noopener">Apri link</a>
       </p>`
    : "";

  const data = p.data
    ? `<p style="margin:8px 0 0 0;">
         <a href="${p.data}" target="_blank" rel="noopener">Apri cartella Drive</a>
       </p>`
    : "";

  const img = p.immagine
    ? `<p style="margin:8px 0 0 0;">
         <img src="${p.immagine}" alt="" style="width:100%;border-radius:10px"/>
       </p>`
    : "";

  layer.bindPopup(`
    <h3 style="margin:0 0 6px 0;">${titolo}</h3>
    ${contenuto}
    ${img}
    ${link}
    ${data}
  `);
}

// 8) Funzione di caricamento GeoJSON
async function loadGeoJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Errore caricamento ${url}: ${res.status}`);
  return res.json();
}

// Variabili layer (così possiamo gestirle)
let layerMuretti = null;
let layerPoi = null;

function setupLayerControlToggle(layerControl) {
  const toggleBtn = document.getElementById("layers-toggle-btn");
  if (!toggleBtn || !layerControl) return;

  const container = layerControl.getContainer();
  if (!container) return;

  let isVisible = true;
  toggleBtn.setAttribute("aria-pressed", "true");

  toggleBtn.addEventListener("click", () => {
    isVisible = !isVisible;
    container.style.display = isVisible ? "" : "none";
    toggleBtn.setAttribute("aria-pressed", String(isVisible));
    toggleBtn.title = isVisible ? "Nascondi livelli" : "Mostra livelli";
  });
}

// 9) Carico i dati e li aggiungo alla mappa
async function initMap() {
  const muretti = await loadGeoJson("./data/muretti.geojson");
  layerMuretti = L.geoJSON(muretti, {
    style: stileMuretti,
    onEachFeature: onEachMuretto
  }).addTo(map);

  const poi = await loadGeoJson("./data/poi.geojson");
  layerPoi = L.geoJSON(poi, {
    pointToLayer: poiToLayer,
    onEachFeature: onEachPoi
  }).addTo(map);

  // Zoom automatico sui dati
  const gruppo = L.featureGroup([layerMuretti, layerPoi]);
  const bounds = gruppo.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.1));
    // Riduce lo zoom iniziale rispetto al fit automatico
    map.setZoom(Math.max(map.getZoom() - ZOOM_OFFSET, 0));
  }

  // Controllo layer
  const layerControl = L.control.layers(
    { "OpenStreetMap": osm, "Satellite (Esri)": esriSat },
    { "Muretti a secco": layerMuretti, "POI": layerPoi },
    { collapsed: false }
  ).addTo(map);
  setupLayerControlToggle(layerControl);

  // Legenda
  const legend = L.control({ position: "bottomleft" });
  legend.onAdd = () => {
    const div = L.DomUtil.create("div", "info legend");

    let expanded = false;

    div.style.background = "white";
    div.style.padding = "10px";
    div.style.borderRadius = "12px";
    div.style.boxShadow = "0 2px 10px rgba(0,0,0,0.15)";
    div.style.fontFamily = "sans-serif";
    div.style.fontSize = "14px";
    div.style.lineHeight = "18px";
    div.style.cursor = "pointer";
    div.style.userSelect = "none";
    div.style.transition = "max-width 180ms ease, max-height 180ms ease, padding 180ms ease";

    div.setAttribute("role", "button");
    div.setAttribute("tabindex", "0");

    const items = [
      ["Pessimo", coloreStato("pessimo")],
      ["Mediocre", coloreStato("mediocre")],
      ["Buono", coloreStato("buono")],
      ["Ottimo", coloreStato("ottimo")]
    ];

    function swatch(col) {
      return `<span style="display:inline-block;width:12px;height:12px;background:${col};margin-right:6px;border:1px solid #999;border-radius:2px;"></span>`;
    }

    function render() {
      div.setAttribute("aria-expanded", String(expanded));

      if (!expanded) {
        div.style.maxWidth = "190px";
        div.style.maxHeight = "160px";
        div.innerHTML =
          `<b>Stato muretto</b> <span style="opacity:.65;font-size:12px;">(clicca)</span><br>` +
          items
            .map(([lab, col]) => `${swatch(col)}${lab}<br>`)
            .join("");
        return;
      }

      div.style.maxWidth = "720px";
      div.style.maxHeight = "380px";
      div.innerHTML =
        `<div style="font-size:15px;line-height:20px;">` +
        `<div style="display:flex;align-items:baseline;gap:8px;justify-content:space-between;">` +
        `<b>Classificazione dello stato di conservazione delle strutture a secco</b>` +
        `<span style="opacity:.65;font-size:13px;">(clicca per chiudere)</span>` +
        `</div>` +
        `<div style="margin-top:8px;">` +
        `<div style="margin-bottom:8px;">${swatch(coloreStato("pessimo"))}<b>Stato pessimo/crollato (gravemente compromesso)</b><div style="opacity:.85;font-size:14px;">Struttura gravemente compromessa o totalmente crollata, con perdita della funzione originaria, frequentemente dovuta a crolli strutturali, interventi incongrui o abbandono prolungato.</div></div>` +
        `<div style="margin-bottom:8px;">${swatch(coloreStato("mediocre"))}<b>Stato mediocre/critico (parzialmente compromesso)</b><div style="opacity:.85;font-size:14px;">Struttura caratterizzata da cedimenti parziali, disallineamenti delle pietre o perdita locale di ammorsamento, spesso associati a interventi impropri o assenza di manutenzione.</div></div>` +
        `<div style="margin-bottom:8px;">${swatch(coloreStato("buono"))}<b>Stato buono/discreto (integro con interventi non conformi ai canoni tradizionali)</b><div style="opacity:.85;font-size:14px;">Struttura integra e stabile, priva di dissesti strutturali significativi, ma interessata da interventi di ripristino o manutenzione non pienamente conformi ai canoni costruttivi tradizionali della pietra a secco.</div></div>` +
        `<div>${swatch(coloreStato("ottimo"))}<b>Stato ottimo (integro o recentemente ristrutturato secondo i canoni tradizionali)</b><div style="opacity:.85;font-size:14px;">Struttura integra, stabile e correttamente ammorsata, oppure recentemente ristrutturata secondo i canoni costruttivi tradizionali della pietra a secco e nel rispetto dei criteri di tutela paesaggistica.</div></div>` +
        `</div>` +
        `</div>`;
    }

    render();

    // Evita che click/scroll sulla legenda interagiscano con la mappa
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    div.addEventListener("click", () => {
      expanded = !expanded;
      render();
    });

    div.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        expanded = !expanded;
        render();
      }
    });

    return div;
  };
  legend.addTo(map);
}

initMap().catch((err) => {
  console.error(err);
  alert(err.message);
});
