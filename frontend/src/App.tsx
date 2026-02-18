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
import { SocketProvider } from "./context/SocketContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import ToastContainer from "./components/common/Toast";
import LandingPageProfessional from "./pages/LandingPageProfessional";
import LandingPageUser from "./pages/LandingPageUser";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
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
import Checkout from "./pages/checkout/Checkout";
import PaymentConfirmation from "./pages/checkout/PaymentConfirmation";
import ServiceChat from "./pages/services/ServiceChat";
import ServiceDetails from "./pages/services/ServiceDetails";
import ServiceSearch from "./pages/services/ServiceSearch";
import Messages from "./pages/Messages";
import Security from "./pages/Security";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Notifications from "./pages/Notifications";
import Wallet from "./pages/Wallet";
import MapView from "./pages/services/MapView";
import CompanyDashboard from "./pages/company/Dashboard";
import CompanyProfile from "./pages/company/Profile";
import CompanyMembers from "./pages/company/Members";
import CompanyRoles from "./pages/company/Roles";
import CompanySalary from "./pages/company/Salary";
import CompanyOrders from "./pages/company/Orders";
import CompanyChannels from "./pages/company/Channels";
import ChannelDetail from "./pages/company/ChannelDetail";
import CompanyStorefront from "./pages/CompanyStorefront";
import CompanyAnalytics from "./pages/company/Analytics";
import ProfessionalStorefrontPage from "./pages/ProfessionalStorefront";
import { UserRole } from "./types";
import { useSessionTracking } from "./hooks/useSessionTracking";

/**
 * Invisible component that runs session tracking inside the Router context
 */
const SessionTracker: React.FC = () => {
  useSessionTracking();
  return null;
};

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
        <SocketProvider>
        <SessionTracker />
        <Routes>
            <Route path="/" element={<LandingPageUser />} />
            <Route path="/profissionais" element={<LandingPageProfessional />} />

            <Route element={<Layout />}>
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="reset-password/:token" element={<ResetPassword />} />
              <Route path="verify-email" element={<VerifyAccount />} />
              <Route path="verify-email/:token" element={<VerifyEmail />} />
              <Route path="services" element={<ServiceSearch />} />
              <Route path="services/:id" element={<ServiceDetails />} />
              <Route path="mapa" element={<MapView />} />
              <Route path="seguranca" element={<Security />} />
              <Route path="termos" element={<TermsOfService />} />
              <Route path="privacidade" element={<PrivacyPolicy />} />

              <Route
                path="client"
                element={<ProtectedRoute allowedRoles={[UserRole.CLIENT]} />}
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ClientDashboard />} />
                <Route path="orders" element={<ClientServiceOrders />} />
                <Route path="orders/new" element={<NewOrder />} />
                <Route path="orders/:id" element={<OrderDetails />} />
                <Route path="orders/:id/checkout" element={<Checkout />} />
                <Route path="orders/:id/payment-confirmed" element={<PaymentConfirmation />} />
                <Route path="orders/:id/chat" element={<ServiceChat />} />
                <Route path="orders/:id/mapa" element={<MapView />} />
                <Route path="messages" element={<Messages />} />
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
                <Route path="services/:id/mapa" element={<MapView />} />
                <Route
                  path="catalog"
                  element={<ServiceSearch showProfessionalCatalog />}
                />
                <Route path="catalog/new" element={<CreateService />} />
                <Route path="catalog/:id/edit" element={<EditService />} />
                <Route
                  path="messages"
                  element={<Messages />}
                />
                <Route path="notifications" element={<Notifications />} />
                <Route path="carteira" element={<Wallet />} />
              </Route>

              <Route
                path="company"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.COMPANY]} />
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<CompanyDashboard />} />
                <Route path="profile" element={<CompanyProfile />} />
                <Route path="members" element={<CompanyMembers />} />
                <Route path="roles" element={<CompanyRoles />} />
                <Route path="salary" element={<CompanySalary />} />
                <Route path="orders" element={<CompanyOrders />} />
                <Route path="channels" element={<CompanyChannels />} />
                <Route path="channels/:channelId" element={<ChannelDetail />} />
                <Route path="analytics" element={<CompanyAnalytics />} />
                <Route path="orders/:id/chat" element={<ServiceChat />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="carteira" element={<Wallet />} />
              </Route>

              <Route
                path="profile"
                element={
                  <ProtectedRoute
                    allowedRoles={[UserRole.CLIENT, UserRole.PROFESSIONAL, UserRole.COMPANY, UserRole.ADMIN]}
                  />
                }
              >
                <Route index element={<Profile />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              <Route path="empresa/:companyId" element={<CompanyStorefront />} />
              <Route path="profissional/:userId" element={<ProfessionalStorefrontPage />} />

              <Route path="*" element={<NotFound />} />
            </Route>
        </Routes>
        </SocketProvider>
        </AuthProvider>
        <ToastContainer />
        </ToastProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;
