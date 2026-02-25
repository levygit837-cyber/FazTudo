import L from "leaflet";

/**
 * Create a Waze-style professional avatar icon.
 * Custom FazTudo branding — gradient blue circle with tool silhouette,
 * directional arrow, and animated glow pulse.
 * Rotates based on bearing for navigation feel.
 */
export function createWazeAvatarIcon(bearing: number | null): L.DivIcon {
  const rotation = bearing !== null ? `transform: rotate(${bearing}deg);` : "";

  return L.divIcon({
    className: "waze-avatar-marker",
    html: `
      <div style="
        width: 56px; height: 56px;
        display: flex; align-items: center; justify-content: center;
        pointer-events: auto;
      ">
        <div style="
          width: 48px; height: 48px;
          position: relative;
          ${rotation}
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        ">
          <!-- Direction arrow (top) -->
          <div style="
            position: absolute;
            top: -8px; left: 50%; transform: translateX(-50%);
            width: 0; height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-bottom: 10px solid #2563eb;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
            ${bearing === null ? 'display: none;' : ''}
          "></div>

          <!-- Main avatar circle -->
          <div style="
            width: 44px; height: 44px;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 3px rgba(59,130,246,0.3), 0 4px 12px rgba(0,0,0,0.25);
            display: flex; align-items: center; justify-content: center;
            position: relative;
            animation: waze-glow-pulse 2s ease-in-out infinite;
          ">
            <!-- FazTudo tool silhouette (wrench) -->
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
        </div>
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    popupAnchor: [0, -28],
  });
}

/**
 * Destination marker — house icon with optional address number badge.
 * Green gradient with subtle pulse animation and pin tail.
 */
export function createWazeDestinationIcon(houseNumber?: string): L.DivIcon {
  const numberDisplay = houseNumber
    ? `<span style="
        position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
        background: white; color: #059669; font-size: 10px; font-weight: 700;
        padding: 1px 5px; border-radius: 6px; white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        line-height: 1.2;
        font-family: system-ui, -apple-system, sans-serif;
      ">${houseNumber}</span>`
    : "";

  return L.divIcon({
    className: "waze-destination-marker",
    html: `
      <div style="
        width: 48px; height: 56px;
        display: flex; flex-direction: column; align-items: center;
        pointer-events: auto;
        position: relative;
      ">
        <div style="
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.3), 0 4px 12px rgba(0,0,0,0.25);
          display: flex; align-items: center; justify-content: center;
          animation: waze-dest-pulse 3s ease-in-out infinite;
          position: relative;
        ">
          <!-- House icon -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          ${numberDisplay}
        </div>
        <!-- Pin tail -->
        <div style="
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid #059669;
          margin-top: -2px;
        "></div>
      </div>
    `,
    iconSize: [48, 56],
    iconAnchor: [24, 56],
    popupAnchor: [0, -56],
  });
}

/**
 * Alert icons for road features — 24x24px circles with themed colors
 * and distinct SVG symbols per alert type.
 */
export function createAlertIcon(type: string): L.DivIcon {
  const iconConfigs: Record<string, { bg: string; svg: string }> = {
    speed_bump: {
      bg: "#f59e0b",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2 17h2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4h2v2H2z"/></svg>`,
    },
    traffic_signal: {
      bg: "#ef4444",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><circle cx="12" cy="8" r="2"/><circle cx="12" cy="16" r="2"/></svg>`,
    },
    curve: {
      bg: "#f59e0b",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M4 20c0-8 6-12 16-12"/><path d="M16 4l4 4-4 4"/></svg>`,
    },
    construction: {
      bg: "#f97316",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M2 20l10-18 10 18H2z"/><path d="M12 9v4"/><circle cx="12" cy="16" r="0.5" fill="white"/></svg>`,
    },
    roundabout: {
      bg: "#3b82f6",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="6"/><path d="M12 2v4"/><path d="M12 18v4"/></svg>`,
    },
    flood_prone: {
      bg: "#06b6d4",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2v6l3 3"/><path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>`,
    },
    unpaved: {
      bg: "#78716c",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M4 4l16 16"/><path d="M4 12h4"/><path d="M16 12h4"/></svg>`,
    },
  };

  const config = iconConfigs[type] || { bg: "#6b7280", svg: "" };

  return L.divIcon({
    className: "waze-alert-icon",
    html: `
      <div style="
        width: 24px; height: 24px;
        background: ${config.bg};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
      ">
        ${config.svg}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}
