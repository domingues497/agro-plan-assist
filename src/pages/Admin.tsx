import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ImportCultivares } from "@/components/admin/ImportCultivares";
import { ImportFertilizantes } from "@/components/admin/ImportFertilizantes";
import { ImportDefensivos } from "@/components/admin/ImportDefensivos";
import { ImportConsultores } from "@/components/admin/ImportConsultores";
import { ImportProdutores } from "@/components/admin/ImportProdutores";
import { ImportFazendas } from "@/components/admin/ImportFazendas";
import { ImportSafras } from "@/components/admin/ImportSafras";
import { ReplicarSafras } from "@/components/admin/ReplicarSafras";
import { ImportTratamentos } from "@/components/admin/ImportTratamentos";
import { ImportCalendario } from "@/components/admin/ImportCalendario";
import { ImportJustificativas } from "@/components/admin/ImportJustificativas";
import { ImportCalendarioAplicacoes } from "@/components/admin/ImportCalendarioAplicacoes";
import { HistoricoImportacoes } from "@/components/admin/HistoricoImportacoes";

const ADMIN_PASSWORD = "Co0p@gr!#0la";

export default function Admin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { data: roleData, isLoading } = useAdminRole();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      }
    };
    checkAuth();
  }, [navigate]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Call edge function to verify password and grant admin role
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        body: { password }
      });

      if (error) {
        console.error("Error calling admin-auth:", error);
        toast.error("Erro ao verificar senha");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setIsAuthenticated(true);
      toast.success("Acesso autorizado!");
      
      // Invalidate the query to refresh admin status
      window.location.reload();
    } catch (error) {
      console.error("Error in handlePasswordSubmit:", error);
      toast.error("Erro ao processar autenticação");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated && !roleData?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acesso Administrativo</CardTitle>
            <CardDescription>Digite a senha para acessar a área administrativa</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite a senha de admin"
                />
              </div>
              <Button type="submit" className="w-full">
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Área Administrativa</h1>
          <p className="text-muted-foreground">Importação de catálogos</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/")}>
          Voltar ao Dashboard
        </Button>
      </div>

      <Tabs defaultValue="cultivares" className="w-full">
        <TabsList className="grid w-full grid-cols-12">
          <TabsTrigger value="cultivares">Cultivares</TabsTrigger>
          <TabsTrigger value="fertilizantes">Fertilizantes</TabsTrigger>
          <TabsTrigger value="defensivos">Defensivos</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="consultores">Consultores</TabsTrigger>
          <TabsTrigger value="produtores">Produtores</TabsTrigger>
          <TabsTrigger value="fazendas">Fazendas</TabsTrigger>
          <TabsTrigger value="safras">Safras</TabsTrigger>
          <TabsTrigger value="tratamentos">Tratamentos</TabsTrigger>
          <TabsTrigger value="justificativas">Justificativas</TabsTrigger>
          <TabsTrigger value="replicar">Replicar</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="cultivares">
          <ImportCultivares />
        </TabsContent>

        <TabsContent value="fertilizantes">
          <ImportFertilizantes />
        </TabsContent>

        <TabsContent value="defensivos">
          <ImportDefensivos />
        </TabsContent>

        <TabsContent value="calendario">
          <ImportCalendarioAplicacoes />
        </TabsContent>

        <TabsContent value="consultores">
          <ImportConsultores />
        </TabsContent>

        <TabsContent value="produtores">
          <ImportProdutores />
        </TabsContent>

        <TabsContent value="fazendas">
          <ImportFazendas />
        </TabsContent>

        <TabsContent value="safras">
          <ImportSafras />
        </TabsContent>

        <TabsContent value="tratamentos">
          <ImportTratamentos />
        </TabsContent>

        <TabsContent value="justificativas">
          <ImportJustificativas />
        </TabsContent>

        <TabsContent value="replicar">
          <ReplicarSafras />
        </TabsContent>

        <TabsContent value="historico">
          <HistoricoImportacoes />
        </TabsContent>
      </Tabs>
    </div>
  );
}
