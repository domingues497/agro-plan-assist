import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sprout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiBaseUrl } from "@/lib/utils";
import { useLogin, useRegisterCheck } from "@/hooks/useAuth";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const registerMutation = useRegisterCheck();
  
  const loading = loginMutation.isPending || registerMutation.isPending;

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    const token = sessionStorage.getItem("auth_token");
    if (token) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    
    registerMutation.mutate(email, {
      onSuccess: () => {
        toast({ title: "Cadastro gerenciado", description: "Solicite habilitação ao administrador.", variant: "default" });
      },
      onError: (error) => {
        toast({ title: "Cadastro bloqueado", description: error.message, variant: "destructive" });
      }
    });
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    
    loginMutation.mutate({ email, password }, {
      onSuccess: async (json) => {
        // Limpeza completa de cache e storage para garantir sessão limpa
        localStorage.clear();
        sessionStorage.clear();
        
        // Tentar limpar caches do navegador (Service Workers) se existirem
        if ('caches' in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
          } catch (e) {
            console.error("Erro ao limpar caches", e);
          }
        }

        sessionStorage.setItem("auth_token", json?.token);
        // Forçar recarregamento para limpar memória e buscar novos assets
        window.location.href = "/";
      },
      onError: (error) => {
        toast({ title: "Erro ao fazer login", description: error.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <Sprout className="h-16 w-16 text-primary mb-4" />
          <h1 className="text-3xl font-bold text-foreground">AgroPlan</h1>
          <p className="text-muted-foreground text-center mt-2">
            Sistema de Planejamento Agrícola
          </p>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="email@coopagricola.coop.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Senha</Label>
                <Input
                  id="signin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="email@coopagricola.coop.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Criando conta..." : "Criar Conta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;
