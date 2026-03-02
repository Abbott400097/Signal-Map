"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import type { BuildingSummary, HeatLevel } from "@/lib/types";
import { SearchPanel } from "@/components/search-panel";

/* ─── Types ─── */

type EventItem = {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  locationText: string | null;
  organizer: string | null;
  category: string | null;
  isCLE: boolean;
};

type EventResponse = { items: EventItem[] };

type PanelState = {
  building: BuildingSummary | null;
  now: EventItem[];
  upcoming: EventItem[];
  loading: boolean;
};

type GeoJSONFeature = {
  type: "Feature";
  properties: { n: string; c: [number, number] };
  geometry: { type: "Polygon"; coordinates: number[][][] };
};

type GeoJSONCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

/* ─── Constants ─── */

const UNC_CENTER: [number, number] = [35.9108, -79.0472];

const HEAT_STYLES: Record<HeatLevel, { fill: string; fillOp: number; stroke: string; weight: number }> = {
  0: { fill: "#c8c0aa", fillOp: 0.22, stroke: "#a8a08a", weight: 0.8 },
  1: { fill: "#5b9e7d", fillOp: 0.40, stroke: "#3d7a5a", weight: 1.2 },
  2: { fill: "#d4a62a", fillOp: 0.50, stroke: "#b08a18", weight: 1.3 },
  3: { fill: "#e07830", fillOp: 0.55, stroke: "#c05a18", weight: 1.5 },
  4: { fill: "#d93636", fillOp: 0.65, stroke: "#b82020", weight: 1.8 },
};

const BG_STYLE = { fill: "#e8dcc4", fillOp: 0.10, stroke: "#d8ccb0", weight: 0.4 };
const SELECTED_STYLE = { fill: "#f0c040", fillOp: 0.70, stroke: "#d4a020", weight: 3 };

/* ─── Helpers ─── */

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function heatTooltip(b: BuildingSummary): string {
  const lines: string[] = [b.name];
  if (b.happeningNowCount > 0) {
    lines.push(`<span class="tooltip-heat">${b.happeningNowCount} happening now</span>`);
  } else if (b.nextEventStartsAt) {
    const dist = formatDistanceToNow(new Date(b.nextEventStartsAt), { addSuffix: false });
    lines.push(`<span class="tooltip-heat">Next in ${dist}</span>`);
  } else if (b.eventCount > 0) {
    lines.push(`<span class="tooltip-heat">${b.eventCount} upcoming</span>`);
  }
  if (b.cleCount > 0) {
    lines.push(`<span class="tooltip-cle">CLE ${b.cleCount}</span>`);
  }
  return lines.join("<br>");
}

/* ─── Component ─── */

export function MapPanel({ initialBuildings }: { initialBuildings: BuildingSummary[] }) {
  const mapRef = useRef<unknown>(null);
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<{ layer: unknown; building: BuildingSummary | null }>({ layer: null, building: null });

  const [state, setState] = useState<PanelState>({
    building: null,
    now: [],
    upcoming: [],
    loading: false,
  });

  const selectBuilding = useCallback(async (building: BuildingSummary) => {
    setState((prev) => ({ ...prev, building, loading: true }));

    const from = new Date();
    const to = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const query = new URLSearchParams({
      buildingId: building.id,
      from: from.toISOString(),
      to: to.toISOString(),
    });

    try {
      const response = await fetch(`/api/events?${query.toString()}`);
      if (!response.ok) {
        setState({ building, now: [], upcoming: [], loading: false });
        return;
      }

      const payload = (await response.json()) as EventResponse;
      const nowTime = new Date();
      const now: EventItem[] = [];
      const upcoming: EventItem[] = [];

      for (const event of payload.items) {
        const start = new Date(event.startTime);
        const end = event.endTime ? new Date(event.endTime) : null;
        if (start <= nowTime && (!end || end >= nowTime)) {
          now.push(event);
        } else if (start > nowTime) {
          upcoming.push(event);
        }
      }

      setState({ building, now, upcoming, loading: false });
    } catch {
      setState({ building, now: [], upcoming: [], loading: false });
    }
  }, []);

  const resetSelectedStyle = useCallback(() => {
    if (selectedRef.current.layer && selectedRef.current.building) {
      const prev = selectedRef.current.layer as { setStyle: (s: Record<string, unknown>) => void; _path?: SVGPathElement };
      const hl = selectedRef.current.building.heatLevel;
      const s = HEAT_STYLES[hl as HeatLevel];
      prev.setStyle({ fillColor: s.fill, fillOpacity: s.fillOp, color: s.stroke, weight: s.weight });
      if (prev._path) {
        prev._path.classList.remove("building-selected-3d");
        if (hl > 0) prev._path.classList.add(`building-heat-${hl}`);
      }
    }
  }, []);

  const closeOverlay = useCallback(() => {
    resetSelectedStyle();
    selectedRef.current = { layer: null, building: null };
    setState({ building: null, now: [], upcoming: [], loading: false });
    if (mapRef.current) {
      (mapRef.current as { flyTo: (c: [number, number], z: number, o: Record<string, number>) => void })
        .flyTo(UNC_CENTER, 16, { duration: 0.6 });
    }
  }, [resetSelectedStyle]);

  const handleSearchSelect = useCallback((building: BuildingSummary) => {
    resetSelectedStyle();
    selectedRef.current = { layer: null, building: building };
    if (mapRef.current) {
      const offsetLat = building.lat - 0.0012;
      (mapRef.current as { flyTo: (c: { lat: number; lng: number }, z: number, o: Record<string, number>) => void })
        .flyTo({ lat: offsetLat, lng: building.lng }, 18, { duration: 0.8 });
    }
    void selectBuilding(building);
  }, [selectBuilding, resetSelectedStyle]);

  // Keyboard: Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.building) closeOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.building, closeOverlay]);

  // Initialize map
  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;
    let cancelled = false;

    import("leaflet").then(async (L) => {
      if (cancelled || !mapNodeRef.current) return;

      const map = L.map(mapNodeRef.current, {
        center: UNC_CENTER,
        zoom: 16,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      // Build building index
      const buildingIndex = new Map<number, BuildingSummary>();

      let geojson: GeoJSONCollection | null = null;
      try {
        const res = await fetch("/buildings.geojson");
        if (res.ok) geojson = (await res.json()) as GeoJSONCollection;
      } catch { /* ignore */ }

      if (!geojson) {
        mapRef.current = map;
        return;
      }

      // Match DB buildings to OSM polygons
      // Pass 1: match by name (OSM name matches any DB building alias)
      const matchedBuildingIds = new Set<string>();
      for (let i = 0; i < geojson.features.length; i++) {
        const osmName = geojson.features[i].properties.n;
        if (!osmName) continue;
        const osmLower = osmName.toLowerCase();

        for (const building of initialBuildings) {
          if (matchedBuildingIds.has(building.id)) continue;
          const allNames = [building.name, ...building.aliases];
          const matched = allNames.some((alias) => {
            const aLower = alias.toLowerCase();
            return osmLower.includes(aLower) || aLower.includes(osmLower);
          });
          if (matched) {
            buildingIndex.set(i, building);
            matchedBuildingIds.add(building.id);
            break;
          }
        }
      }

      // Pass 2: match remaining by distance
      const unmatchedBuildings = initialBuildings.filter((b) => !matchedBuildingIds.has(b.id));
      for (const building of unmatchedBuildings) {
        let bestIdx = -1;
        let bestDist = 80;
        for (let i = 0; i < geojson.features.length; i++) {
          if (buildingIndex.has(i)) continue;
          const feat = geojson.features[i];
          const [clat, clng] = feat.properties.c;
          const d = distM(building.lat, building.lng, clat, clng);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0) {
          buildingIndex.set(bestIdx, building);
          matchedBuildingIds.add(building.id);
        }
      }

      L.geoJSON(geojson as GeoJSON.GeoJsonObject, {
        style: (feature) => {
          if (!feature) return {};
          const idx = geojson!.features.indexOf(feature as GeoJSONFeature);
          const matched = buildingIndex.get(idx);

          if (matched) {
            const s = HEAT_STYLES[matched.heatLevel as HeatLevel];
            const classes = ["building-poly"];
            if (matched.heatLevel > 0) classes.push(`building-heat-${matched.heatLevel}`);
            if (matched.cleCount > 0) classes.push("building-cle");
            return {
              fillColor: s.fill,
              fillOpacity: s.fillOp,
              color: s.stroke,
              weight: s.weight,
              className: classes.join(" "),
            };
          }

          return {
            fillColor: BG_STYLE.fill,
            fillOpacity: BG_STYLE.fillOp,
            color: BG_STYLE.stroke,
            weight: BG_STYLE.weight,
            className: "building-poly-bg",
          };
        },

        onEachFeature: (feature, layer) => {
          const idx = geojson!.features.indexOf(feature as GeoJSONFeature);
          const matched = buildingIndex.get(idx);
          const osmName = (feature as GeoJSONFeature).properties.n;
          const path = layer as unknown as { _path?: SVGPathElement; setStyle: (s: Record<string, unknown>) => void };

          // Tooltip for all buildings
          if (matched) {
            layer.bindTooltip(heatTooltip(matched), {
              direction: "top",
              offset: [0, -4],
              className: "building-tooltip",
            });
          } else if (osmName) {
            layer.bindTooltip(osmName, {
              direction: "top",
              offset: [0, -4],
              className: "building-tooltip",
            });
          }

          // Hover for all buildings
          layer.on("mouseover", () => {
            if (selectedRef.current.layer === layer) return;
            if (matched) {
              const s = HEAT_STYLES[matched.heatLevel as HeatLevel];
              (layer as L.Path).setStyle({
                fillOpacity: Math.min(s.fillOp + 0.15, 0.85),
                weight: s.weight + 0.8,
              });
              if (path._path) {
                path._path.style.filter = `drop-shadow(0 0 6px ${s.stroke})`;
              }
            } else {
              (layer as L.Path).setStyle({
                fillOpacity: 0.25,
                weight: 0.8,
                fillColor: "#d4c9a8",
              });
              if (path._path) {
                path._path.style.filter = "drop-shadow(0 0 3px rgba(212,201,168,0.5))";
              }
            }
          });

          layer.on("mouseout", () => {
            if (selectedRef.current.layer === layer) return;
            if (matched) {
              const s = HEAT_STYLES[matched.heatLevel as HeatLevel];
              (layer as L.Path).setStyle({
                fillOpacity: s.fillOp,
                weight: s.weight,
              });
            } else {
              (layer as L.Path).setStyle({
                fillOpacity: BG_STYLE.fillOp,
                weight: BG_STYLE.weight,
                fillColor: BG_STYLE.fill,
              });
            }
            if (path._path) path._path.style.filter = "";
          });

          // Click for matched buildings
          if (matched) {
            layer.on("click", (e: L.LeafletEvent) => {
              // Stop propagation so map's click handler doesn't fire closeOverlay
              L.DomEvent.stopPropagation(e as unknown as Event);

              // If clicking already selected, zoom back out
              if (selectedRef.current.building?.id === matched.id) {
                closeOverlay();
                return;
              }

              // Deselect previous
              resetSelectedStyle();

              // Select new
              (layer as L.Path).setStyle({
                fillColor: SELECTED_STYLE.fill,
                fillOpacity: SELECTED_STYLE.fillOp,
                color: SELECTED_STYLE.stroke,
                weight: SELECTED_STYLE.weight,
              });

              selectedRef.current = { layer, building: matched };

              // FlyTo with offset: shift target south so building appears
              // in the upper third of the viewport (above the bottom panel)
              const offsetLat = matched.lat - 0.0012;
              const flyTarget = L.latLng(offsetLat, matched.lng);
              map.flyTo(flyTarget, 18, { duration: 0.8 });

              // Apply 3D effect after flight
              map.once("moveend", () => {
                if (path._path) {
                  path._path.classList.remove(`building-heat-${matched.heatLevel}`);
                  path._path.classList.add("building-selected-3d");
                }
              });

              void selectBuilding(matched);
            });
          }
        },
      }).addTo(map);

      // Click on map (not on building) to close
      map.on("click", () => {
        if (selectedRef.current.building) {
          closeOverlay();
        }
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, [initialBuildings, selectBuilding, closeOverlay]);

  return (
    <>
      <div ref={mapNodeRef} style={{ position: "absolute", inset: 0 }} />

      {/* Search */}
      <SearchPanel buildings={initialBuildings} onSelect={handleSearchSelect} />

      {/* Legend */}
      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-swatch legend-heat-4" />
          <span>Happening Now</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch legend-heat-3" />
          <span>Within 3h</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch legend-heat-2" />
          <span>Within 6h</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch legend-heat-1" />
          <span>Later Today</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch legend-heat-0" />
          <span>No Events</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch legend-cle" />
          <span>CLE Credit</span>
        </div>
      </div>

      {/* Bottom overlay */}
      <div className="event-overlay-anchor">
        <div className={`event-overlay${state.building ? " open" : ""}`}>
          {state.building && (
            <>
              <div className="overlay-header">
                <h3>{state.building.name}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="badge badge-campus">
                    {state.building.campus === "NORTH" ? "North" : state.building.campus === "SOUTH" ? "South" : "Campus"}
                  </span>
                  {state.building.cleCount > 0 && (
                    <span className="badge badge-cle">CLE {state.building.cleCount}</span>
                  )}
                  <button type="button" className="overlay-close" onClick={closeOverlay}>&times;</button>
                </div>
              </div>

              {state.loading ? (
                <p className="subtle" style={{ padding: "16px 0", textAlign: "center" }}>Loading events...</p>
              ) : (
                <>
                  <div className="overlay-stats">
                    <div className="overlay-stat">
                      <span className="overlay-stat-num">{state.now.length}</span>
                      <span className="overlay-stat-label">Now</span>
                    </div>
                    <div className="overlay-stat">
                      <span className="overlay-stat-num">{state.upcoming.length}</span>
                      <span className="overlay-stat-label">Upcoming</span>
                    </div>
                    {state.building.nextEventStartsAt && state.now.length === 0 && (
                      <div className="overlay-stat overlay-stat--countdown">
                        <span className="overlay-stat-num">
                          {formatDistanceToNow(new Date(state.building.nextEventStartsAt))}
                        </span>
                        <span className="overlay-stat-label">Until Next</span>
                      </div>
                    )}
                  </div>

                  {state.now.length > 0 && (
                    <div className="event-section">
                      <h4>Happening Now</h4>
                      <div className="event-list">
                        {state.now.map((event) => (
                          <EventCard key={event.id} event={event} live />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="event-section">
                    <h4>Coming Up</h4>
                    <div className="event-list">
                      {state.upcoming.length === 0 ? (
                        <p className="subtle">No upcoming events in the next 3 days</p>
                      ) : (
                        state.upcoming.slice(0, 8).map((event) => (
                          <EventCard key={event.id} event={event} />
                        ))
                      )}
                    </div>
                  </div>

                  {state.upcoming.length > 8 && (
                    <Link href={`/building/${state.building.id}`} className="view-all-link">
                      View all {state.upcoming.length} events &rarr;
                    </Link>
                  )}

                  <Link href={`/building/${state.building.id}`} className="view-all-link">
                    Full details &rarr;
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── EventCard ─── */

function EventCard({ event, live }: { event: EventItem; live?: boolean }) {
  return (
    <article className={`event-card${live ? " event-card--live" : ""}${event.isCLE ? " event-card--cle" : ""}`}>
      <div className="event-card-top">
        {live && <span className="live-dot" />}
        {event.isCLE && <span className="cle-badge-inline">CLE</span>}
        <strong>{event.title}</strong>
      </div>
      <div className="event-card-meta">
        <span>{format(new Date(event.startTime), "MMM d, h:mm a")}</span>
        {event.endTime && (
          <span> &ndash; {format(new Date(event.endTime), "h:mm a")}</span>
        )}
      </div>
      {event.locationText && <div className="event-card-loc">{event.locationText}</div>}
      <div className="event-card-badges">
        {event.isCLE && <span className="badge badge-cle">CLE Credit</span>}
        {event.category && <span className="badge badge-sm">{event.category}</span>}
      </div>
    </article>
  );
}
