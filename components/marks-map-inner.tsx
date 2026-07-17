"use client";

import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { button } from "@/lib/ui";

const markerIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:var(--accent);border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.25)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export type MappableMark = { id: number; name: string; location: string | null; lat: number; lng: number };

/** Formats a distance in meters as whichever of m/km + nautical miles reads best at that scale. */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const nm = meters / 1852;
  return `${(meters / 1000).toFixed(2)} km (${nm.toFixed(2)} nm)`;
}

/** Zooms/pans the map to fit whatever marks are currently shown — a single focused mark gets a tight zoom, a filtered set gets fit to its bounding box, so the map reacts to filtering instead of staying put. */
function FitToMarks({ marks, focusedMark }: { marks: MappableMark[]; focusedMark?: MappableMark }) {
  const map = useMap();

  useEffect(() => {
    if (focusedMark) {
      map.setView([focusedMark.lat, focusedMark.lng], 15);
    } else if (marks.length === 1) {
      map.setView([marks[0].lat, marks[0].lng], 15);
    } else if (marks.length > 1) {
      const bounds = L.latLngBounds(marks.map((m): [number, number] => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fit whenever the mark set or focus changes, not on every map instance change
  }, [marks, focusedMark]);

  return null;
}

function MeasureLayer({
  active,
  points,
  onAddPoint,
}: {
  active: boolean;
  points: [number, number][];
  onAddPoint: (point: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      if (!active) return;
      onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
  });

  if (points.length === 0) return null;

  return (
    <>
      <Polyline positions={points} pathOptions={{ color: "var(--accent)", weight: 3, dashArray: "6 6" }} />
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={p}
          radius={5}
          pathOptions={{ color: "var(--accent)", fillColor: "var(--accent)", fillOpacity: 1 }}
        />
      ))}
    </>
  );
}

export function MarksMapInner({
  marks,
  showLabels = false,
  focusMarkId,
}: {
  marks: MappableMark[];
  showLabels?: boolean;
  focusMarkId?: number | null;
}) {
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);

  if (marks.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border border-surface-border bg-surface text-sm text-muted sm:h-[32rem]">
        No marks with GPS coordinates yet.
      </div>
    );
  }

  const focusedMark = focusMarkId != null ? marks.find((m) => m.id === focusMarkId) : undefined;
  const center: [number, number] = focusedMark ? [focusedMark.lat, focusedMark.lng] : [marks[0].lat, marks[0].lng];
  const zoom = focusedMark ? 15 : 9;

  let totalMeters = 0;
  for (let i = 1; i < measurePoints.length; i++) {
    totalMeters += L.latLng(measurePoints[i - 1]).distanceTo(L.latLng(measurePoints[i]));
  }

  function toggleMeasuring() {
    setMeasuring((m) => !m);
    setMeasurePoints([]);
  }

  return (
    <div
      className={`relative h-96 overflow-hidden rounded-xl border border-surface-border sm:h-[32rem] ${measuring ? "cursor-crosshair" : ""}`}
    >
      <div className="absolute right-2 top-2 z-[1000] flex flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={toggleMeasuring}
          className={button(measuring ? "primary" : "secondary", "px-2.5 py-1.5 text-xs shadow-md")}
        >
          {measuring ? "Stop measuring" : "Measure distance"}
        </button>
        {measuring && measurePoints.length > 0 && (
          <div className="rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs shadow-md">
            {measurePoints.length === 1 ? "Click to add another point" : formatDistance(totalMeters)}
            {measurePoints.length > 1 && (
              <button type="button" onClick={() => setMeasurePoints([])} className="ml-2 text-muted hover:text-danger">
                Clear
              </button>
            )}
          </div>
        )}
        {measuring && measurePoints.length === 0 && (
          <div className="rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-muted shadow-md">
            Click the map to start measuring
          </div>
        )}
      </div>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", cursor: measuring ? "crosshair" : undefined }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToMarks marks={marks} focusedMark={focusedMark} />
        {marks.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={markerIcon}
            ref={(instance) => {
              if (instance && m.id === focusMarkId) instance.openPopup();
            }}
          >
            <Popup>
              <strong>{m.name}</strong>
              {m.location && <div>{m.location}</div>}
            </Popup>
            {showLabels && (
              <Tooltip permanent direction="right" offset={[8, 0]} opacity={1} className="mark-label-tooltip">
                {m.name}
              </Tooltip>
            )}
          </Marker>
        ))}
        <MeasureLayer active={measuring} points={measurePoints} onAddPoint={(p) => setMeasurePoints((pts) => [...pts, p])} />
      </MapContainer>
    </div>
  );
}
