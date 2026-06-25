import { Routes, Route } from "react-router";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import DashboardPage from "./pages/DashboardPage";
import CampaignsPage from "./pages/CampaignsPage";
import ContactsPage from "./pages/ContactsPage";
import TemplatesPage from "./pages/TemplatesPage";
import LogsPage from "./pages/LogsPage";
import SuppressionsPage from "./pages/SuppressionsPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        }
      />
      <Route
        path="/campaigns"
        element={
          <AppLayout>
            <CampaignsPage />
          </AppLayout>
        }
      />
      <Route
        path="/contacts"
        element={
          <AppLayout>
            <ContactsPage />
          </AppLayout>
        }
      />
      <Route
        path="/templates"
        element={
          <AppLayout>
            <TemplatesPage />
          </AppLayout>
        }
      />
      <Route
        path="/logs"
        element={
          <AppLayout>
            <LogsPage />
          </AppLayout>
        }
      />
      <Route
        path="/suppressions"
        element={
          <AppLayout>
            <SuppressionsPage />
          </AppLayout>
        }
      />
      <Route
        path="/settings"
        element={
          <AppLayout>
            <SettingsPage />
          </AppLayout>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
