/**
 * Creates a DOM element for the professional avatar marker.
 * Rotates based on bearing for navigation feel.
 */
export function createProfessionalMarkerElement(bearing: number | null): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "width: 56px",
    "height: 56px",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "pointer-events: auto",
  ].join("; ");

  const rotation = bearing !== null ? `rotate(${bearing}deg)` : "";

  // Inner container (rotates)
  const inner = document.createElement("div");
  inner.style.cssText = [
    "width: 52px",
    "height: 52px",
    "position: relative",
    `transform: ${rotation}`,
    "transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
  ].join("; ");

  // Arrow (direction indicator above circle)
  if (bearing !== null) {
    const arrow = document.createElement("div");
    arrow.style.cssText = [
      "position: absolute",
      "top: -9px",
      "left: 50%",
      "transform: translateX(-50%)",
      "width: 0",
      "height: 0",
      "border-left: 8px solid transparent",
      "border-right: 8px solid transparent",
      "border-bottom: 11px solid #2563eb",
      "filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
    ].join("; ");
    inner.appendChild(arrow);
  }

  // Avatar circle
  const circle = document.createElement("div");
  circle.style.cssText = [
    "width: 48px",
    "height: 48px",
    "background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    "border: 3px solid white",
    "border-radius: 50%",
    "box-shadow: 0 0 0 6px rgba(59,130,246,0.15), 0 4px 16px rgba(0,0,0,0.35)",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "animation: nav-glow-pulse 2s ease-in-out infinite",
  ].join("; ");

  // Wrench SVG icon
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "white");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z");
  svg.appendChild(path);
  circle.appendChild(svg);

  inner.appendChild(circle);
  wrapper.appendChild(inner);
  return wrapper;
}

/**
 * Creates a DOM element for the destination pin marker.
 * Pin-style (circle + triangle tail) in green.
 */
export function createDestinationMarkerElement(houseNumber?: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "width: 48px",
    "height: 64px",
    "display: flex",
    "flex-direction: column",
    "align-items: center",
    "pointer-events: auto",
    "position: relative",
  ].join("; ");

  // Container
  const container = document.createElement("div");
  container.style.cssText = [
    "position: relative",
    "display: flex",
    "flex-direction: column",
    "align-items: center",
  ].join("; ");

  // Circle
  const circle = document.createElement("div");
  circle.style.cssText = [
    "width: 44px",
    "height: 44px",
    "background: linear-gradient(135deg, #10b981 0%, #059669 100%)",
    "border: 3px solid white",
    "border-radius: 50%",
    "box-shadow: 0 0 0 4px rgba(16,185,129,0.2), 0 4px 16px rgba(0,0,0,0.3)",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "animation: nav-dest-pulse 3s ease-in-out infinite",
    "position: relative",
  ].join("; ");

  // Home SVG
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "white");
  svg.setAttribute("stroke-width", "2.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path1 = document.createElementNS(svgNS, "path");
  path1.setAttribute("d", "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z");
  const polyline = document.createElementNS(svgNS, "polyline");
  polyline.setAttribute("points", "9 22 9 12 15 12 15 22");
  svg.appendChild(path1);
  svg.appendChild(polyline);
  circle.appendChild(svg);

  // House number badge
  if (houseNumber) {
    const badge = document.createElement("span");
    badge.textContent = houseNumber;
    badge.style.cssText = [
      "position: absolute",
      "bottom: -6px",
      "left: 50%",
      "transform: translateX(-50%)",
      "background: white",
      "color: #059669",
      "font-size: 10px",
      "font-weight: 700",
      "padding: 1px 5px",
      "border-radius: 6px",
      "white-space: nowrap",
      "box-shadow: 0 1px 4px rgba(0,0,0,0.2)",
      "line-height: 1.4",
      "font-family: system-ui, -apple-system, sans-serif",
    ].join("; ");
    circle.appendChild(badge);
  }

  // Pin tail (triangle)
  const tail = document.createElement("div");
  tail.style.cssText = [
    "width: 0",
    "height: 0",
    "border-left: 6px solid transparent",
    "border-right: 6px solid transparent",
    "border-top: 10px solid #059669",
    "margin-top: -2px",
  ].join("; ");

  container.appendChild(circle);
  container.appendChild(tail);
  wrapper.appendChild(container);
  return wrapper;
}

/**
 * Alert marker DOM element — small colored circle with SVG icon.
 */
export function createAlertMarkerElement(type: string): HTMLDivElement {
  const bgColors: Record<string, string> = {
    speed_bump: "#f59e0b",
    traffic_signal: "#ef4444",
    curve: "#f59e0b",
    construction: "#f97316",
    roundabout: "#3b82f6",
    flood_prone: "#06b6d4",
    unpaved: "#78716c",
  };

  const bg = bgColors[type] ?? "#6b7280";

  const el = document.createElement("div");
  el.style.cssText = [
    "width: 26px",
    "height: 26px",
    `background: ${bg}`,
    "border: 2px solid white",
    "border-radius: 50%",
    "box-shadow: 0 1px 6px rgba(0,0,0,0.35)",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "cursor: pointer",
  ].join("; ");

  return el;
}
