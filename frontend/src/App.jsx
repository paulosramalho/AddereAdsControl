import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ToastProvider } from "./components/Toast.jsx";
import { Layout } from "./components/Layout.jsx";
import { isLoggedIn } from "./lib/auth.js";
import { silentRefresh } from "./lib/api.js";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LeadsPage from "./pages/LeadsPage.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import CampaignsPage from "./pages/CampaignsPage.jsx";
import ContentPage from "./pages/ContentPage.jsx";
import WeeklyPage from "./pages/WeeklyPage.jsx";
import AgentsPage from "./pages/AgentsPage.jsx";
import ClientEditPage from "./pages/ClientEditPage.jsx";
import PostsPage from "./pages/PostsPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";

function Guard({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState(() => (isLoggedIn() ? "ok" : "checking"));

  useEffect(() => {
    if (status !== "checking") return;
    silentRefresh().then((ok) => setStatus(ok ? "ok" : "fail"));
  }, [status]);

  if (status === "checking") return null;
  if (status === "fail") return <Navigate to="/login" state={{ from: location }} replace />;
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
                    <Route path="/clients/:clientId/posts" element={<PostsPage />} />
                    <Route path="/clients/:clientId/edit" element={<ClientEditPage />} />
                    <Route path="/team" element={<TeamPage />} />
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
