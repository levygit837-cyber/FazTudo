import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Home,
  Search,
  Briefcase,
  User,
  Bell,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Wallet,
  FileText,
  Shield,
  Users,
  Award,
  Calendar,
  Star,
} from "lucide-react";
import clsx from "clsx";
import PageTransition from "./navigation/PageTransition";
import { getUnreadCount } from "../services/notificationService";

/* -- Focus-trap helper -- */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const root = containerRef.current;
    const focusableEls = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = focusableEls();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const els = focusableEls();
    if (els.length > 0) els[0].focus();

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [active, containerRef]);
}

const Layout: React.FC = () => {
  const location = useLocation();
  const { user, isAuthenticated, isProfessional, isClient, isAdmin, logout } =
    useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useFocusTrap(mobileMenuRef, isMobileMenuOpen);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchUnread = async () => {
      try {
        const count = await getUnreadCount();
        setUnreadNotifications(count);
      } catch {
        // Silently fail
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isUserMenuOpen) setIsUserMenuOpen(false);
        if (isMobileMenuOpen) setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isUserMenuOpen, isMobileMenuOpen]);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
  };

  const navLinks = [
    { path: "/", label: "Inicio", icon: <Home size={20} />, visible: true },
    {
      path: "/services",
      label: "Servicos",
      icon: <Search size={20} />,
      visible: true,
    },
    ...(isAuthenticated && isClient
      ? [
          {
            path: "/client/dashboard",
            label: "Dashboard",
            icon: <User size={20} />,
          },
          {
            path: "/client/orders",
            label: "Meus Pedidos",
            icon: <FileText size={20} />,
          },
          {
            path: "/client/carteira",
            label: "Carteira",
            icon: <Wallet size={20} />,
          },
          {
            path: "/client/messages",
            label: "Mensagens",
            icon: <MessageSquare size={20} />,
          },
        ]
      : []),
    ...(isAuthenticated && isProfessional
      ? [
          {
            path: "/professional/dashboard",
            label: "Dashboard",
            icon: <Briefcase size={20} />,
          },
          {
            path: "/professional/services",
            label: "Meus Servicos",
            icon: <FileText size={20} />,
          },
          {
            path: "/professional/catalog",
            label: "Catalogo",
            icon: <Award size={20} />,
          },
          {
            path: "/professional/carteira",
            label: "Carteira",
            icon: <Wallet size={20} />,
          },
          {
            path: "/professional/messages",
            label: "Mensagens",
            icon: <MessageSquare size={20} />,
          },
        ]
      : []),
    ...(isAuthenticated && isAdmin
      ? [
          {
            path: "/admin/dashboard",
            label: "Admin",
            icon: <Shield size={20} />,
          },
        ]
      : []),
  ].filter((link) => link.visible !== false);

  const userMenuItems = [
    { label: "Meu Perfil", icon: <User size={18} />, path: "/profile" },
    {
      label: "Configuracoes",
      icon: <Settings size={18} />,
      path: "/profile/settings",
    },
    {
      label: "Minhas Avaliacoes",
      icon: <Star size={18} />,
      path: "/profile/reviews",
    },
    ...(isClient
      ? [
          {
            label: "Minha Carteira",
            icon: <Wallet size={18} />,
            path: "/client/carteira",
          },
        ]
      : []),
    ...(isProfessional
      ? [
          {
            label: "Minha Carteira",
            icon: <Wallet size={18} />,
            path: "/professional/carteira",
          },
          {
            label: "Agenda",
            icon: <Calendar size={18} />,
            path: "/professional/schedule",
          },
        ]
      : []),
    { type: "divider" as const },
    { label: "Sair", icon: <LogOut size={18} />, onClick: handleLogout },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Pular para o conteudo
      </a>

      {/* Header/Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50 shadow-sm dark:shadow-black/20">
        <div className="container-responsive">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center no-underline">
                <img src="/logo.png" alt="FazTudo" className="h-16 w-auto object-contain" />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1" aria-label="Navegacao principal">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={clsx(
                    "navbar-link flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium no-underline",
                    location.pathname === link.path &&
                      "navbar-link-active bg-slate-100 dark:bg-slate-800/50",
                  )}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              ))}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              {isAuthenticated && (
                <Link
                  to={
                    isProfessional
                      ? "/professional/notifications"
                      : "/client/notifications"
                  }
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 relative transition-colors no-underline"
                  aria-label="Notificacoes"
                >
                  <Bell size={20} className="text-slate-700 dark:text-slate-400" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  )}
                </Link>
              )}

              {/* User menu or auth buttons */}
              {isAuthenticated ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label="Menu do usuario"
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="true"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                      {user?.profileImage ? (
                        <img
                          src={user.profileImage}
                          alt={user.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-semibold">
                          {user?.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      size={16}
                      className={clsx(
                        "text-slate-500 dark:text-slate-400 transition-transform",
                        isUserMenuOpen && "rotate-180",
                      )}
                    />
                  </button>

                  {/* User dropdown — glass-card style */}
                  <div
                    className={clsx(
                      "absolute right-0 mt-2 w-56 rounded-xl shadow-lg py-1 z-50 transition-all duration-200 origin-top-right",
                      "bg-white dark:bg-slate-900/90 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 dark:shadow-black/30",
                      isUserMenuOpen
                        ? "opacity-100 scale-100 visible"
                        : "opacity-0 scale-95 invisible pointer-events-none",
                    )}
                    role="menu"
                    aria-orientation="vertical"
                    aria-label="Menu do usuario"
                  >
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800/50">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {user?.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {user?.email}
                        </p>
                        <div className="flex items-center mt-1">
                          <span
                            className={clsx(
                              "badge text-xs",
                              isProfessional
                                ? "badge-secondary"
                                : "badge-primary",
                            )}
                          >
                            {user?.role === "PROFESSIONAL"
                              ? "Profissional"
                              : "Cliente"}
                          </span>
                          {user?.isVerified && (
                            <span className="badge-success text-xs ml-2">
                              Verificado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Menu items */}
                      {userMenuItems.map((item, index) => {
                        if (item.type === "divider") {
                          return (
                            <div
                              key={`divider-${index}`}
                              className="border-t border-slate-200 dark:border-slate-800/50 my-1"
                            />
                          );
                        }

                        const content = (
                          <div
                            className={clsx(
                              "flex items-center space-x-3 px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer",
                              location.pathname === item.path &&
                                "bg-slate-100 dark:bg-slate-800/50",
                            )}
                          >
                            {item.icon}
                            <span className="text-slate-700 dark:text-slate-300">
                              {item.label}
                            </span>
                          </div>
                        );

                        return item.path ? (
                          <Link
                            key={item.label}
                            to={item.path}
                            onClick={() => setIsUserMenuOpen(false)}
                            role="menuitem"
                            className="no-underline"
                          >
                            {content}
                          </Link>
                        ) : (
                          <button
                            key={item.label}
                            onClick={item.onClick}
                            className="w-full text-left"
                            role="menuitem"
                          >
                            {content}
                          </button>
                        );
                      })}
                    </div>
                </div>
              ) : (
                <div className="hidden md:flex items-center space-x-2">
                  <Link to="/login" className="btn btn-outline btn-sm no-underline">
                    Entrar
                  </Link>
                  <Link to="/register" className="btn btn-primary btn-sm no-underline">
                    Cadastrar
                  </Link>
                </div>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-nav"
              >
                {isMobileMenuOpen ? (
                  <X size={24} className="text-slate-700 dark:text-slate-300" />
                ) : (
                  <Menu size={24} className="text-slate-700 dark:text-slate-300" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div
            ref={mobileMenuRef}
            id="mobile-nav"
            role="navigation"
            aria-label="Menu de navegacao mobile"
            className={clsx(
              "md:hidden border-t border-slate-200 dark:border-slate-800/50 overflow-hidden transition-all duration-300 ease-in-out",
              isMobileMenuOpen ? "max-h-[80vh] py-4 opacity-100" : "max-h-0 py-0 opacity-0",
            )}
          >
              <div className="flex flex-col space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={clsx(
                      "flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium no-underline",
                      location.pathname === link.path
                        ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50",
                    )}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                  </Link>
                ))}

                {!isAuthenticated && (
                  <>
                    <div className="border-t border-slate-200 dark:border-slate-800/50 my-2 pt-2">
                      <Link
                        to="/login"
                        className="flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium no-underline"
                      >
                        <User size={18} />
                        <span>Entrar</span>
                      </Link>
                    </div>
                    <Link
                      to="/register"
                      className="flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-gradient-primary text-white font-medium no-underline"
                    >
                      <Users size={18} />
                      <span>Criar Conta</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="flex-1 container-responsive py-8">
        <PageTransition routeKey={location.pathname}>
          <Outlet />
        </PageTransition>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/50" role="contentinfo">
        <div className="container-responsive">
          <div className="py-8 md:py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Company info */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <img src="/logo.png" alt="FazTudo" className="h-14 w-auto object-contain" />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-500">
                  Conectando profissionais qualificados a clientes que precisam
                  de servicos. Seguranca, qualidade e confianca em cada
                  transacao.
                </p>
              </div>

              {/* Quick links */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 uppercase tracking-wider mb-4">
                  Navegacao
                </h3>
                <ul className="space-y-2">
                  <li>
                    <Link
                      to="/services"
                      className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                    >
                      Servicos
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/#how-it-works"
                      className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                    >
                      Como funciona
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/#professionals"
                      className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                    >
                      Para Profissionais
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/#clients"
                      className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                    >
                      Para Clientes
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 uppercase tracking-wider mb-4">
                  Legal
                </h3>
                <ul className="space-y-2">
                  <li>
                    <Link
                      to="/terms"
                      className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                    >
                      Termos de Uso
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/privacy"
                      className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                    >
                      Politica de Privacidade
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/seguranca"
                      className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                    >
                      Seguranca
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/cookies"
                      className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                    >
                      Cookies
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Support */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 uppercase tracking-wider mb-4">
                  Suporte
                </h3>
                <ul className="space-y-2">
                  <li>
                    <Link
                      to="/help"
                      className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                    >
                      Central de Ajuda
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/contact"
                      className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                    >
                      Contato
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/faq"
                      className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                    >
                      FAQ
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/disputes"
                      className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                    >
                      Resolucao de Disputas
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-slate-200 dark:border-slate-800/50 mt-8 pt-8">
              <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
                <p className="text-sm text-slate-600 dark:text-slate-500">
                  &copy; {new Date().getFullYear()} FazTudo. Todos os direitos
                  reservados.
                </p>
                <div className="flex items-center space-x-6">
                  <Link
                    to="/about"
                    className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                  >
                    Sobre nos
                  </Link>
                  <Link
                    to="/press"
                    className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                  >
                    Imprensa
                  </Link>
                  <Link
                    to="/careers"
                    className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                  >
                    Carreiras
                  </Link>
                  <Link
                    to="/blog"
                    className="text-sm text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors no-underline"
                  >
                    Blog
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
