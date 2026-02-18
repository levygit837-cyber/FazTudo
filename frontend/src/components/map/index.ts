// Premium navigation map (MapLibre GL)
export { default as NavigationMap } from "./NavigationMap";
export { default as NavInfoBar } from "./NavInfoBar";
export { default as NavControls } from "./NavControls";

// Legacy components (still in use)
export { default as InteractiveMap } from "./InteractiveMap";
export { default as ProfessionalLocationMap } from "./ProfessionalLocationMap";
export { default as MapLegend } from "./MapLegend";
export { default as RouteTracker } from "./RouteTracker";
export { default as LocationPicker } from "./LocationPicker";

// WazeMap kept as alias (backward compat)
export { default as WazeMap } from "./WazeMap";
export { default as WazeInfoBar } from "./WazeInfoBar";
export { default as WazeControls } from "./WazeControls";
export { createWazeAvatarIcon, createWazeDestinationIcon, createAlertIcon } from "./wazeIcons";
