import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/MainLayout";
import Index from "./pages/Index";
import Search from "./pages/Search";
import PropertyDetail from "./pages/PropertyDetail";
import BrokerSales from "./pages/BrokerSales";
import BrokerProfile from "./pages/BrokerProfile";
import Financing from "./pages/Financing";
import CreateProperty from "./pages/CreateProperty";
import Plans from "./pages/Plans";
import Favorites from "./pages/Favorites";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/busca" element={<Search />} />
                <Route path="/imovel/:id" element={<PropertyDetail />} />
                <Route path="/corretor/vendas" element={<BrokerSales />} />
                <Route path="/corretor/:username" element={<BrokerProfile />} />
                <Route path="/financiamento" element={<Financing />} />
                <Route path="/anunciar" element={<CreateProperty />} />
                <Route path="/editar/:id" element={<CreateProperty />} />
                <Route path="/planos" element={<Plans />} />
                <Route path="/favoritos" element={<Favorites />} />
                <Route path="/painel" element={<Dashboard />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Signup />} />
                <Route path="/esqueci-senha" element={<ForgotPassword />} />
                <Route path="/redefinir-senha" element={<ResetPassword />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
