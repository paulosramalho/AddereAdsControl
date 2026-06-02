import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ToastProvider } from "./components/Toast.jsx";
import { Layout } from "./components/Layout.jsx";
import { isLoggedIn } from "./lib/auth.js";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LeadsPage from "./pages/LeadsPage.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import CampaignsPage from "./pages/CampaignsPage.jsx";
import ContentPage from "./pages/ContentPage.jsx";
import WeeklyPage from "./pages/WeeklyPage.jsx";
import AgentsPage from "./pages/AgentsPage.jsx";
import ClientEditPage from "./pages/ClientEditPage.jsx";

function Guard({ children }) {
  const location = useLocation();
  if (!isLoggedIn()) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <Guard>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/leads" element={<LeadsPage />} />
                    <Route path="/campaigns" element={<CampaignsPage />} />
                    <Route path="/content" element={<ContentPage />} />
                    <Route path="/weekly" element={<WeeklyPage />} />
                    <Route path="/agents" element={<AgentsPage />} />
                    <Route path="/clients" element={<ClientsPage />} />
                    <Route path="/clients/:clientId/leads" element={<LeadsPage />} />
                    <Route path="/clients/:clientId/campaigns" element={<CampaignsPage />} />
                    <Route path="/clients/:clientId/edit" element={<ClientEditPage />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Layout>
              </Guard>
            }
          />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
