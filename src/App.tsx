import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Defensivos from "./pages/Defensivos";
import Relatorios from "./pages/Relatorios";
import Programacao from "./pages/Programacao";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Hook de inatividade - desconecta após 5 minutos
  useInactivityLogout();

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          setSession(null);
          setLoading(false);
          return;
        }
        const envUrl = (import.meta as any).env?.VITE_API_URL;
        const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
        const baseUrl = envUrl || `http://${host}:5000`;
        const res = await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          localStorage.removeItem("auth_token");
          setSession(null);
        } else {
          const json = await res.json();
          setSession(json?.user || { token });
        }
      } catch (e) {
        toast({ title: "Erro de autenticação", description: "Falha ao validar sessão.", variant: "destructive" });
        setSession(null);
      } finally {
        setLoading(false);
      }
    };
    checkToken();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/defensivos" element={<ProtectedRoute><Defensivos /></ProtectedRoute>} />
          <Route path="/programacao" element={<ProtectedRoute><Programacao /></ProtectedRoute>} />
          <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
