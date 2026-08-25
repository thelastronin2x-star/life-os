"use client";

import { BODY_ZONES } from "@/lib/health-store";
import { cn } from "@/lib/cn";

interface BodyMapProps {
  activeZones: Set<string>;
  onToggle: (zoneId: string) => void;
}

/** Tap works on either the SVG zone or the matching row in the list on the
 *  right — both drive the same activeZones state. The list isn't a caption
 *  under the silhouette, it's the accessible fallback: a 16px-radius circle
 *  is not a reliable tap target, and the list gives every zone a full-width
 *  row instead. */
export function BodyMap({ activeZones, onToggle }: BodyMapProps) {
  return (
    <div className="bodymap-row">
      <div className="bodymap">
        <svg viewBox="0 0 100 200">
          <circle
            className={cn("zone", activeZones.has("head") && "active")}
            onClick={() => onToggle("head")}
            cx="50"
            cy="20"
            r="16"
          />
          <rect
            className={cn("zone", activeZones.has("throat") && "active")}
            onClick={() => onToggle("throat")}
            x="38"
            y="38"
            width="24"
            height="10"
            rx="3"
          />
          <rect
            className={cn("zone", activeZones.has("chest") && "active")}
            onClick={() => onToggle("chest")}
            x="30"
            y="50"
            width="40"
            height="45"
            rx="8"
          />
          <rect
            className={cn("zone", activeZones.has("stomach") && "active")}
            onClick={() => onToggle("stomach")}
            x="30"
            y="97"
            width="40"
            height="35"
            rx="6"
          />
          <rect
            className={cn("zone", activeZones.has("back_arms") && "active")}
            onClick={() => onToggle("back_arms")}
            x="12"
            y="52"
            width="16"
            height="55"
            rx="7"
          />
          <rect
            className={cn("zone", activeZones.has("back_arms") && "active")}
            onClick={() => onToggle("back_arms")}
            x="72"
            y="52"
            width="16"
            height="55"
            rx="7"
          />
          <rect
            className={cn("zone", activeZones.has("legs") && "active")}
            onClick={() => onToggle("legs")}
            x="32"
            y="134"
            width="16"
            height="60"
            rx="7"
          />
          <rect
            className={cn("zone", activeZones.has("legs") && "active")}
            onClick={() => onToggle("legs")}
            x="52"
            y="134"
            width="16"
            height="60"
            rx="7"
          />
        </svg>
      </div>
      <div className="zone-list">
        {BODY_ZONES.map((z) => (
          <div
            key={z.id}
            onClick={() => onToggle(z.id)}
            className={cn("zone-item", activeZones.has(z.id) && "active")}
          >
            <span className="zone-dot" />
            {z.label}
          </div>
        ))}
      </div>
    </div>
  );
}
