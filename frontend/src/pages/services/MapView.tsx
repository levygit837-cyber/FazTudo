// frontend/src/pages/services/MapView.tsx
import React, { useState } from "react";
import { Map as MapIcon, ArrowLeft, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { InteractiveMap, RouteTracker } from "../../components/map";
import type { MapMarker, RouteInfo } from "../../types";

// ========================================
// Iguatu-CE test coordinates (~5km apart)
// ========================================

/** Profissional: Cajazeiras, Iguatu-CE (~5km do destino) */
const PROFESSIONAL_MARKER: MapMarker = {
  id: "pro-1",
  position: { lat: -6.3480, lng: -39.2910 },
  type: "professional",
  label: "João Silva",
  subtitle: "Eletricista • 4.8 ★",
};

/** Destino: Bairro Vila Centenário, Iguatu */
const DESTINATION_MARKER: MapMarker = {
  id: "dest-1",
  position: { lat: -6.3780, lng: -39.3260 },
  type: "destination",
  label: "R. Jose de Alencar, 245",
  subtitle: "Vila Centenario, Iguatu-CE",
};

/** Sinalizadores de rua ao longo da rota (~5km, Cajazeiras → Vila Centenário) */
const LANDMARK_MARKERS: MapMarker[] = [
  {
    id: "landmark-1",
    position: { lat: -6.3555, lng: -39.2995 },
    type: "landmark",
    label: "Praca da Matriz",
    icon: "reference",
  },
  {
    id: "landmark-2",
    position: { lat: -6.3640, lng: -39.3080 },
    type: "landmark",
    label: "Av. Perimetral Sul",
    icon: "street",
  },
  {
    id: "landmark-3",
    position: { lat: -6.3720, lng: -39.3180 },
    type: "landmark",
    label: "Rotatoria CE-292",
    icon: "reference",
  },
];

/**
 * MapView — Full-page interactive map demonstration.
 * Shows a professional in Cajazeiras navigating to
 * Vila Centenário (~5km), with street landmarks along the route.
 */
const MapView: React.FC = () => {
  const navigate = useNavigate();
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [viewMode, setViewMode] = useState<"client" | "professional">(
    "client"
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 backdrop-blur-sm">
        <div className="container-responsive py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div className="flex items-center gap-2">
                <MapIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Mapa do Servico
                </h1>
              </div>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode("client")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === "client"
                    ? "bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Visao Cliente
              </button>
              <button
                onClick={() => setViewMode("professional")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === "professional"
                    ? "bg-white dark:bg-slate-700 text-secondary-600 dark:text-secondary-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Visao Profissional
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Map area */}
      <div className="container-responsive py-4 space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800/30 text-sm text-primary-700 dark:text-primary-400">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Demonstracao — Iguatu, CE</p>
            <p className="text-xs mt-0.5 opacity-80">
              Profissional em Cajazeiras → Destino na Vila Centenario
              (~5km). Sinalizadores marcam pontos de referencia na rota.
            </p>
          </div>
        </div>

        {/* Interactive Map */}
        <InteractiveMap
          professionalMarker={PROFESSIONAL_MARKER}
          destinationMarker={DESTINATION_MARKER}
          landmarkMarkers={LANDMARK_MARKERS}
          showRoute={true}
          height={500}
          onRouteInfo={setRouteInfo}
          className="shadow-lg"
        />

        {/* Route tracker overlay */}
        <RouteTracker
          routeInfo={routeInfo}
          isTracking={viewMode === "professional"}
          isProfessional={viewMode === "professional"}
        />

        {/* Marker details cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Professional card */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">J</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {PROFESSIONAL_MARKER.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {PROFESSIONAL_MARKER.subtitle}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                  {PROFESSIONAL_MARKER.position.lat.toFixed(4)},{" "}
                  {PROFESSIONAL_MARKER.position.lng.toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          {/* Destination card */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">D</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {DESTINATION_MARKER.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {DESTINATION_MARKER.subtitle}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                  {DESTINATION_MARKER.position.lat.toFixed(4)},{" "}
                  {DESTINATION_MARKER.position.lng.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;
