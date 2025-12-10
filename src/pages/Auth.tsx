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

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Permitir cadastro apenas se email consta na base de consultores
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/consultores/by_email?email=${encodeURIComponent(email.toLowerCase())}`);
    if (!res.ok) {
      toast({ title: "Cadastro bloqueado", description: "Email não encontrado na base de consultores.", variant: "destructive" });
      setLoading(false);
      return;
    }

    toast({ title: "Cadastro gerenciado", description: "Solicite habilitação ao administrador.", variant: "default" });
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const baseUrl2 = getApiBaseUrl();
    // Tenta login diretamente; o backend valida se o email está autorizado e a senha
    const res = await fetch(`${baseUrl2}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const txt = await res.text();
      // Mensagens amigáveis para casos comuns
      const msg = txt || (res.status === 403 ? "Email não autorizado ou senha inválida" : "Falha ao fazer login");
      toast({ title: "Erro ao fazer login", description: msg, variant: "destructive" });
    } else {
      const json = await res.json();
      localStorage.setItem("auth_token", json?.token);
      navigate("/");
    }
    setLoading(false);
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
