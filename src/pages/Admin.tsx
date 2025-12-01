import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// Removido layout em abas; migrado para sidebar com grupos
import { ImportCultivares } from "@/components/admin/ImportCultivares";
import { ListCultivares } from "@/components/admin/ListCultivares";
import { ImportFertilizantes } from "@/components/admin/ImportFertilizantes";
import { ListFertilizantes } from "@/components/admin/ListFertilizantes";
import { ImportDefensivos } from "@/components/admin/ImportDefensivos";
import { ListDefensivos } from "@/components/admin/ListDefensivos";
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
import { ListUsuarios } from "@/components/admin/ListUsuarios";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ListConsultores } from "@/components/admin/ListConsultores";
import { ListProdutores } from "@/components/admin/ListProdutores";
import { ListFazendas } from "@/components/admin/ListFazendas";
import { ListTalhoes } from "@/components/admin/ListTalhoes";
import { ImportTalhoes } from "@/components/admin/ImportTalhoes";
import { ListCalendario } from "@/components/admin/ListCalendario";
import { ImportCultivaresTratamentos } from "@/components/admin/ImportCultivaresTratamentos";
import { ImportEpocas } from "@/components/admin/ImportEpocas";
import { ListEpocas } from "@/components/admin/ListEpocas";
import { GerenciarGestores } from "@/components/admin/GerenciarGestores";
import { SystemConfig } from "@/components/admin/SystemConfig";

export default function Admin() {
  const navigate = useNavigate();
  const { data: roleData, isLoading } = useAdminRole();
  const [selected, setSelected] = useState<string>("cultivares");
  const [openGroups, setOpenGroups] = useState<{ produtos: boolean; pessoas: boolean; gerais: boolean }>({
    produtos: true,
    pessoas: true,
    gerais: true,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!roleData?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>Seu perfil não possui permissão de administrador.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/")}>Voltar ao Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex justify-between items-center px-6 py-4 border-b bg-card">
        <div>
          <h1 className="text-3xl font-bold">Área Administrativa</h1>
          <p className="text-muted-foreground">Importação de catálogos</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/")}>
          Voltar ao Dashboard
        </Button>
      </div>
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r bg-card">
          <nav className="p-4 space-y-4">
            {/* Produtos */}
            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm font-semibold py-1"
                onClick={() => setOpenGroups((s) => ({ ...s, produtos: !s.produtos }))}
              >
                <span>Produtos</span>
                {openGroups.produtos ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {openGroups.produtos && (
                <div className="mt-1 ml-3 space-y-1">
                  <Button
                    variant={selected === "cultivares" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("cultivares")}
                  >
                    Cultivares
                  </Button>
                  <Button
                    variant={selected === "fertilizantes" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("fertilizantes")}
                  >
                    Fertilizantes
                  </Button>
                  <Button
                    variant={selected === "defensivos" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("defensivos")}
                  >
                    Defensivos
                  </Button>
                </div>
              )}
            </div>

            {/* Pessoas */}
            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm font-semibold py-1"
                onClick={() => setOpenGroups((s) => ({ ...s, pessoas: !s.pessoas }))}
              >
                <span>Pessoas</span>
                {openGroups.pessoas ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {openGroups.pessoas && (
                <div className="mt-1 ml-3 space-y-1">
                  <Button
                    variant={selected === "produtores" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("produtores")}
                  >
                    Produtores
                  </Button>
                  <Button
                    variant={selected === "fazendas" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("fazendas")}
                  >
                    Fazendas
                  </Button>
                  <Button
                    variant={selected === "talhoes" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("talhoes")}
                  >
                    Talhões
                  </Button>
                  <Button
                    variant={selected === "consultores" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("consultores")}
                  >
                    Consultores
                  </Button>
                  <Button
                    variant={selected === "gestores" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("gestores")}
                  >
                    Gestores
                  </Button>
                </div>
              )}
            </div>

          {/* Gerais */}
          <div>
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm font-semibold py-1"
                onClick={() => setOpenGroups((s) => ({ ...s, gerais: !s.gerais }))}
              >
                <span>Gerais</span>
                {openGroups.gerais ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {openGroups.gerais && (
                <div className="mt-1 ml-3 space-y-1">
                  <Button
                    variant={selected === "config" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("config")}
                  >
                    Configurações
                  </Button>
                  <Button
                    variant={selected === "usuarios" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("usuarios")}
                  >
                    Usuários
                  </Button>
                  <Button
                    variant={selected === "safras" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("safras")}
                  >
                    Safras
                  </Button>
                  <Button
                    variant={selected === "tratamentos" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("tratamentos")}
                  >
                    Tratamentos
                  </Button>
                  <Button
                    variant={selected === "cultivares-tratamentos" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("cultivares-tratamentos")}
                  >
                    Cultivares x Tratamentos
                  </Button>
                  <Button
                    variant={selected === "justificativas" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("justificativas")}
                  >
                    Justificativas
                  </Button>
                  <Button
                    variant={selected === "calendario" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("calendario")}
                  >
                    Calendário
                  </Button>
                  <Button
                    variant={selected === "epocas" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("epocas")}
                  >
                    Épocas
                  </Button>
                  <Button
                    variant={selected === "replicar" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("replicar")}
                  >
                    Replicar
                  </Button>
                  <Button
                    variant={selected === "historico" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelected("historico")}
                  >
                    Histórico
                  </Button>
                </div>
              )}
            </div>
          </nav>
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 p-6 space-y-6">
          {selected === "cultivares" && (
            <>
              <ImportCultivares />
              <ListCultivares />
            </>
          )}
          {selected === "fertilizantes" && (
            <>
              <ImportFertilizantes />
              <ListFertilizantes />
            </>
          )}
          {selected === "defensivos" && (
            <>
              <ImportDefensivos />
              <ListDefensivos />
            </>
          )}
          {selected === "calendario" && (
            <>
              <ImportCalendarioAplicacoes />
              <ListCalendario />
            </>
          )}
          {selected === "consultores" && (
            <>
              <ImportConsultores />
              <ListConsultores />
            </>
          )}
          {selected === "produtores" && (
            <>
              <ImportProdutores />
              <ListProdutores />
            </>
          )}
          {selected === "fazendas" && (
            <>
              <ImportFazendas />
              <ListFazendas />
            </>
          )}
          {selected === "talhoes" && (
            <>
              <ImportTalhoes />
              <ListTalhoes />
            </>
          )}
          {selected === "safras" && <ImportSafras />}
          {selected === "tratamentos" && <ImportTratamentos />}
          {selected === "cultivares-tratamentos" && <ImportCultivaresTratamentos />}
          {selected === "justificativas" && <ImportJustificativas />}
          {selected === "epocas" && (
            <>
              <ImportEpocas />
              <ListEpocas />
            </>
          )}
          {selected === "usuarios" && <ListUsuarios />}
          {selected === "config" && <SystemConfig />}
          {selected === "gestores" && <GerenciarGestores />}
          {selected === "replicar" && <ReplicarSafras />}
          {selected === "historico" && <HistoricoImportacoes />}
        </main>
      </div>
    </div>
  );
}
