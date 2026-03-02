"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { BuildingSummary } from "@/lib/types";

type SearchResult = {
  type: "building";
  building: BuildingSummary;
};

type Props = {
  buildings: BuildingSummary[];
  onSelect: (building: BuildingSummary) => void;
};

export function SearchPanel({ buildings, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const results: SearchResult[] = query.length >= 1
    ? buildings
        .filter((b) => {
          const q = query.toLowerCase();
          return (
            b.name.toLowerCase().includes(q) ||
            b.aliases.some((a) => a.toLowerCase().includes(q))
          );
        })
        .slice(0, 8)
        .map((b) => ({ type: "building" as const, building: b }))
    : [];

  const handleSelect = useCallback((building: BuildingSummary) => {
    onSelect(building);
    setOpen(false);
    setQuery("");
  }, [onSelect]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const heatLabel = (level: number) => {
    if (level === 4) return "live";
    if (level === 3) return "< 3h";
    if (level === 2) return "< 6h";
    if (level === 1) return "today";
    return "";
  };

  const heatClass = (level: number) => {
    if (level >= 3) return "search-heat-high";
    if (level >= 1) return "search-heat-mid";
    return "";
  };

  return (
    <div className="search-container" ref={panelRef}>
      {!open ? (
        <button
          type="button"
          className="search-trigger"
          onClick={() => setOpen(true)}
          aria-label="Search buildings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
      ) : (
        <div className="search-dropdown">
          <div className="search-input-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Search buildings..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="overlay-close"
              onClick={() => { setOpen(false); setQuery(""); }}
              style={{ width: 24, height: 24, fontSize: 14 }}
            >
              &times;
            </button>
          </div>

          {results.length > 0 && (
            <div className="search-results">
              {results.map((r) => (
                <button
                  key={r.building.id}
                  type="button"
                  className="search-result-item"
                  onClick={() => handleSelect(r.building)}
                >
                  <div className="search-result-name">{r.building.name}</div>
                  <div className="search-result-meta">
                    <span className="badge badge-campus" style={{ fontSize: 10, padding: "1px 6px" }}>
                      {r.building.campus === "NORTH" ? "North" : r.building.campus === "SOUTH" ? "South" : "Campus"}
                    </span>
                    {r.building.heatLevel > 0 && (
                      <span className={`search-heat-badge ${heatClass(r.building.heatLevel)}`}>
                        {r.building.eventCount} event{r.building.eventCount !== 1 ? "s" : ""} &middot; {heatLabel(r.building.heatLevel)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {query.length >= 1 && results.length === 0 && (
            <div className="search-empty">No buildings found</div>
          )}
        </div>
      )}
    </div>
  );
}
