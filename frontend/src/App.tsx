import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { PublicLayout } from "@/components/PublicLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useThemeCookieBootstrap } from "@/hooks/useThemeCookie";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import DonorImpactDashboard from "./pages/DonorImpactDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import CaseloadInventory from "./pages/CaseloadInventory";
import ResidentDetail from "./pages/ResidentDetail";
import DonorsContributions from "./pages/DonorsContributions";
import ReportsAnalytics from "./pages/ReportsAnalytics";
import SocialMediaAnalytics from "./pages/SocialMediaAnalytics";
import HomeVisitCaseConferences from "./pages/HomeVisitCaseConferences";
import DonorPortal from "./pages/DonorPortal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ThemeBootstrap() {
  useThemeCookieBootstrap();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeBootstrap />
    <AuthProvider>
      <CookieConsentProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public pages with shared layout */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/impact" element={<DonorImpactDashboard />} />
              </Route>

              {/* Donor portal */}
              <Route path="/donor-portal" element={
                <ProtectedRoute requiredRole="donor">
                  <DonorPortal />
                </ProtectedRoute>
              } />

              {/* Admin pages with sidebar layout */}
              <Route path="/admin" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }>
                <Route index element={<AdminDashboard />} />
                <Route path="caseload" element={<CaseloadInventory />} />
                <Route path="resident/:id" element={<ResidentDetail />} />
                <Route path="field-ops" element={<HomeVisitCaseConferences />} />
                <Route path="donors" element={<DonorsContributions />} />
                <Route path="reports" element={<ReportsAnalytics />} />
                <Route path="social-media" element={<SocialMediaAnalytics />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CookieConsentProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
