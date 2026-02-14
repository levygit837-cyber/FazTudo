import React from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import ToastContainer from "./components/common/Toast";
import LandingPageProfessional from "./pages/LandingPageProfessional";
import LandingPageUser from "./pages/LandingPageUser";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Register from "./pages/Register";
import Settings from "./pages/Settings";
import VerifyAccount from "./pages/VerifyAccount";
import ClientDashboard from "./pages/client/Dashboard";
import ClientServiceOrders from "./pages/client/ServiceOrders";
import NewOrder from "./pages/client/NewOrder";
import OrderDetails from "./pages/orders/OrderDetails";
import CreateService from "./pages/professional/CreateService";
import EditService from "./pages/professional/EditService";
import ProfessionalDashboard from "./pages/professional/Dashboard";
import ProfessionalServiceOrders from "./pages/professional/ServiceOrders";
import ProfessionalCRM from "./pages/professional/CRM";
import ProfessionalCalendar from "./pages/professional/Calendar";
import ProfessionalReputation from "./pages/professional/Reputation";
import ServiceChat from "./pages/services/ServiceChat";
import ServiceDetails from "./pages/services/ServiceDetails";
import ServiceSearch from "./pages/services/ServiceSearch";
import Security from "./pages/Security";
import Notifications from "./pages/Notifications";
import Wallet from "./pages/Wallet";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminVerifications from "./pages/admin/AdminVerifications";
import { UserRole } from "./types";

const NotFound = () => (
  <div className="container mx-auto px-4 py-12 text-center">
    <h1 className="mb-4 text-4xl font-bold text-slate-900 dark:text-slate-100">
      404
    </h1>
    <p className="mb-6 text-slate-600 dark:text-slate-400">
      Pagina nao encontrada
    </p>
    <a href="/" className="btn btn-primary">
      Voltar para Home
    </a>
  </div>
);

const App: React.FC = () => {
  return (
    <Router>
      <ThemeProvider>
        <ToastProvider>
        <AuthProvider>
        <Routes>
            <Route path="/" element={<LandingPageUser />} />
            <Route path="/profissionais" element={<LandingPageProfessional />} />

            <Route element={<Layout />}>
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="verify-email" element={<VerifyAccount />} />
              <Route path="services" element={<ServiceSearch />} />
              <Route path="services/:id" element={<ServiceDetails />} />
              <Route path="seguranca" element={<Security />} />

              <Route
                path="client"
                element={<ProtectedRoute allowedRoles={[UserRole.CLIENT]} />}
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ClientDashboard />} />
                <Route path="orders" element={<ClientServiceOrders />} />
                <Route path="orders/new" element={<NewOrder />} />
                <Route path="orders/:id" element={<OrderDetails />} />
                <Route path="orders/:id/chat" element={<ServiceChat />} />
                <Route path="messages" element={<Navigate to="../orders" replace />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="carteira" element={<Wallet />} />
              </Route>

              <Route
                path="professional"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.PROFESSIONAL]} />
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ProfessionalDashboard />} />
                <Route path="crm" element={<ProfessionalCRM />} />
                <Route path="agenda" element={<ProfessionalCalendar />} />
                <Route path="reputacao" element={<ProfessionalReputation />} />
                <Route path="services" element={<ProfessionalServiceOrders />} />
                <Route path="services/:id" element={<OrderDetails />} />
                <Route path="services/:id/chat" element={<ServiceChat />} />
                <Route
                  path="catalog"
                  element={<ServiceSearch showProfessionalCatalog />}
                />
                <Route path="catalog/new" element={<CreateService />} />
                <Route path="catalog/:id/edit" element={<EditService />} />
                <Route
                  path="messages"
                  element={<Navigate to="../services" replace />}
                />
                <Route path="notifications" element={<Notifications />} />
                <Route path="carteira" element={<Wallet />} />
              </Route>

              <Route
                path="admin"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.ADMIN]} />
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="verifications" element={<AdminVerifications />} />
                <Route path="notifications" element={<Notifications />} />
              </Route>

              <Route
                path="profile"
                element={
                  <ProtectedRoute
                    allowedRoles={[UserRole.CLIENT, UserRole.PROFESSIONAL, UserRole.ADMIN]}
                  />
                }
              >
                <Route index element={<Profile />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Route>
        </Routes>
        </AuthProvider>
        <ToastContainer />
        </ToastProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;
