import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { InactivityProvider } from "@/hooks/useInactivityLogout.tsx";
import { getApiBaseUrl } from "@/lib/utils";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Defensivos from "./pages/Defensivos";
import Relatorios from "./pages/Relatorios";
import Programacao from "./pages/Programacao";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
      retry: false,
      refetchOnWindowFocus: true,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = sessionStorage.getItem("auth_token");
        if (!token) {
          setSession(null);
          setLoading(false);
          return;
        }
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          sessionStorage.removeItem("auth_token");
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
      <InactivityProvider>
        {(() => {
          const isBrowser = typeof window !== "undefined";
          const host = isBrowser ? window.location.hostname : "localhost";
          const isProdHost = isBrowser && !["localhost", "127.0.0.1"].includes(host);
          const RouterComp = isProdHost ? HashRouter : BrowserRouter;
          return (
            <RouterComp
              future={{
                v7_relativeSplatPath: true,
                v7_startTransition: true,
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
            </RouterComp>
          );
        })()}
      </InactivityProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
