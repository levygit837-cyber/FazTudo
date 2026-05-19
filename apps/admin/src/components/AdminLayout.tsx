import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Building2,
  BarChart3,
  AlertTriangle,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/users", icon: Users, label: "Usuarios" },
  { to: "/verifications", icon: ShieldCheck, label: "Verificacoes" },
  { to: "/companies", icon: Building2, label: "Empresas" },
  { to: "/traffic", icon: BarChart3, label: "Trafego" },
  { to: "/disputes", icon: AlertTriangle, label: "Disputas" },
  { to: "/settings", icon: Settings, label: "Configuracoes" },
] as const;

const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const linkClasses = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
      isActive
        ? "bg-primary-600/90 text-white shadow-glow-blue ring-1 ring-primary-500/30"
        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
    }`;

  const sidebarContent = (
    <>
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800/50">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-sm shadow-glow-blue shrink-0">
          FT
        </div>
        {!sidebarCollapsed && (
          <div>
            <span className="text-sm font-bold text-slate-100 tracking-tight font-display">
              FazTudo
            </span>
            <span className="ml-1.5 text-xs text-primary-400 font-semibold bg-primary-500/15 px-1.5 py-0.5 rounded-md">
              Admin
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/" ? true : undefined}
            className={({ isActive }) => linkClasses(isActive)}
            onClick={() => setMobileOpen(false)}
          >
            <item.icon size={20} className="shrink-0" />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden lg:block p-3 border-t border-slate-800/50">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors w-full"
        >
          <ChevronLeft
            size={20}
            className={`shrink-0 transition-transform duration-200 ${
              sidebarCollapsed ? "rotate-180" : ""
            }`}
          />
          {!sidebarCollapsed && <span>Recolher</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 border-r border-slate-800/50 transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } w-64`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-3 text-slate-400 hover:text-slate-100 p-1"
        >
          <X size={20} />
        </button>
        {sidebarContent}
      </aside>

      {/* Sidebar — desktop */}
      <aside
        className={`hidden lg:flex flex-col bg-slate-900 border-r border-slate-800/50 transition-all duration-300 shrink-0 ${
          sidebarCollapsed ? "w-[72px]" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50 px-4 sm:px-6 h-16 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100 p-1"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 hidden sm:block">
              Painel Administrativo
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
              {user?.name ?? "Admin"}
            </span>
            <button
              onClick={handleLogout}
              className="btn btn-ghost btn-sm gap-2 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
