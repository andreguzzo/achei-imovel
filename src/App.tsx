import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/MainLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import RequireAuth from "@/components/RequireAuth";
import Index from "./pages/Index";
import Search from "./pages/Search";
import PropertyDetail from "./pages/PropertyDetail";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Heavy, authenticated-only areas are loaded on demand
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const CreateProperty = lazy(() => import("./pages/CreateProperty"));

const BrokerProfile = lazy(() => import("./pages/BrokerProfile"));
const Financing = lazy(() => import("./pages/Financing"));
const Plans = lazy(() => import("./pages/Plans"));
const Favorites = lazy(() => import("./pages/Favorites"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const OwnerReport = lazy(() => import("./pages/OwnerReport"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex justify-center py-20">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route element={<MainLayout />}>
                    <Route path="/" element={<Index />} />
                    <Route path="/busca" element={<Search />} />
                    <Route path="/imovel/:id" element={<PropertyDetail />} />
                    <Route path="/corretor/:username" element={<BrokerProfile />} />
                    <Route path="/financiamento" element={<Financing />} />
                    <Route path="/planos" element={<Plans />} />
                    <Route path="/favoritos" element={<Favorites />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/cadastro" element={<Signup />} />
                    <Route path="/esqueci-senha" element={<ForgotPassword />} />
                    <Route path="/redefinir-senha" element={<ResetPassword />} />
                    <Route path="/convite/:token" element={<AcceptInvite />} />
                    <Route path="/relatorio/:id" element={<OwnerReport />} />
                    <Route path="/privacidade" element={<Privacy />} />
                    <Route path="/termos" element={<Terms />} />

                    <Route element={<RequireAuth />}>
                      <Route path="/corretor/vendas" element={<Navigate to="/painel" replace />} />

                      <Route path="/anunciar" element={<CreateProperty />} />
                      <Route path="/editar/:id" element={<CreateProperty />} />
                      <Route path="/painel" element={<Dashboard />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/admin/imovel/:id" element={<CreateProperty />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
