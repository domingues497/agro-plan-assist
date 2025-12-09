import { useMemo, useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sprout, Droplet, Shield, FileText, Settings, Calendar, MapPin } from "lucide-react";
import { useProgramacaoCultivares } from "@/hooks/useProgramacaoCultivares";
import { useProgramacaoAdubacao } from "@/hooks/useProgramacaoAdubacao";
import { useAplicacoesDefensivos } from "@/hooks/useAplicacoesDefensivos";
import { useProfile } from "@/hooks/useProfile";
import { useFazendas } from "@/hooks/useFazendas";
import { useProdutores } from "@/hooks/useProdutores";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { GerenciarTalhoes } from "@/components/programacao/GerenciarTalhoes";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getApiBaseUrl } from "@/lib/utils";

const Dashboard = () => {
  const {
    programacoes: cultivaresProgramacoes,
    isLoading: cultivaresLoading,
    error: cultivaresError,
  } = useProgramacaoCultivares();

  const {
    programacoes: adubacoesProgramacoes,
    isLoading: adubacoesLoading,
    error: adubacoesError,
  } = useProgramacaoAdubacao();

  const {
    aplicacoes: defensivosProgramacoes,
    isLoading: defensivosLoading,
    error: defensivosError,
  } = useAplicacoesDefensivos();

  const cultivaresList = cultivaresProgramacoes ?? [];
  const adubacoesList = adubacoesProgramacoes ?? [];
  const defensivosList = defensivosProgramacoes ?? [];

  const lastSync = useMemo(() => new Date().toLocaleString(), []);
  const showSummaryCards = String(import.meta.env.VITE_DASHBOARD_SUMMARY_ENABLED || "")
    .toLowerCase() === "true";

  // Modal obrigatório: preenchimento de área cultivável ao logar
  const { profile, updateProfile, changePassword } = useProfile();
  const { data: allFazendas = [] } = useFazendas();
  const { data: allProdutores = [] } = useProdutores();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Verificar e preencher numerocm_consultor se estiver vazio
  useEffect(() => {}, []);

  // Estados do modal de área removidos - agora gerenciado via talhões
  const [gerenciarTalhoesOpen, setGerenciarTalhoesOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [fazendaSelecionada, setFazendaSelecionada] = useState<{ id: string; nome: string } | null>(null);
  const [searchProdutor, setSearchProdutor] = useState<string>("");
  const [onlyComTalhao, setOnlyComTalhao] = useState<boolean>(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editCmConsultor, setEditCmConsultor] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [buildVersion, setBuildVersion] = useState<string | null>(null);
  const [buildEnv, setBuildEnv] = useState<string | null>(null);
  const [idleLeft, setIdleLeft] = useState<number | null>(null);
  const lastRefreshRef = useRef<number>(0);


  const produtoresDisponiveis = useMemo(() => {
    const q = searchProdutor.trim().toLowerCase();
    return allProdutores.filter((p: any) => {
      if (!q) return true;
      const nome = String(p.nome || "").toLowerCase();
      const cm = String(p.numerocm || "").toLowerCase();
      return nome.includes(q) || cm.includes(q);
    });
  }, [allProdutores, searchProdutor]);

  const fazendasPorProdutor = useMemo(() => {
    const grouped: Record<string, typeof allFazendas> = {};
    const cmSet = new Set((allFazendas || []).map((f: any) => String(f.numerocm || "")));
    cmSet.forEach((cm) => {
      grouped[cm] = allFazendas.filter(
        (f: any) => String(f.numerocm || "") === cm && (!onlyComTalhao || Number(f.area_cultivavel || 0) > 0)
      );
    });
    return grouped;
  }, [allFazendas, onlyComTalhao]);

  const produtoresParaRenderizar = useMemo(() => {
    const q = searchProdutor.trim().toLowerCase();
    const cmSet = new Set((allFazendas || []).map((f: any) => String(f.numerocm || "")));
    const base = [...produtoresDisponiveis];
    cmSet.forEach((cm) => {
      if (!base.some((p: any) => String(p.numerocm || "") === cm)) {
        const stub = {
          id: cm,
          numerocm: cm,
          nome: `Produtor ${cm}`,
          numerocm_consultor: "",
          consultor: null,
          created_at: null,
          updated_at: null,
        } as any;
        base.push(stub);
      }
    });
    return base.filter((p: any) => {
      if (!q) return true;
      const nome = String(p.nome || "").toLowerCase();
      const cm = String(p.numerocm || "").toLowerCase();
      return nome.includes(q) || cm.includes(q);
    });
  }, [produtoresDisponiveis, allFazendas, searchProdutor]);

  // Área agora é calculada pelos talhões - modal de edição removido

  const loadingCounter = (isLoading: boolean, value: number) => {
    if (isLoading) {
      return "...";
    }
    return value.toString();
  };

  const renderError = (error: unknown) =>
    error ? <p className="text-sm text-destructive mt-2">Erro ao carregar dados.</p> : null;

  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      localStorage.removeItem("auth_token");
      queryClient.clear();
      navigate("/auth", { replace: true });
    } catch (err) {
      toast({ title: "Erro ao sair", description: "Tente novamente.", variant: "destructive" });
    }
  };

  const openProfile = () => {
    setEditNome(String(profile?.nome || ""));
    setEditCmConsultor(String(profile?.numerocm_consultor || ""));
    setEditEmail(String((profile as any)?.email || ""));
    setNewPassword("");
    setProfileOpen(true);
  };

  const handleSaveProfile = () => {
    updateProfile({ nome: editNome });
  };

  const { data: roleData } = useAdminRole();

  useEffect(() => {
    const loadBuild = async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/versions`);
        if (res.ok) {
          const json = await res.json();
          const items = (json?.items || []) as any[];
          const first = items[0];
          const ver = String(first?.version || first?.build || "").trim();
          const env = String(first?.environment || "").trim();
          if (ver) { setBuildVersion(ver); return; }
          if (env) setBuildEnv(env);
        }
      } catch {}
      try {
        const alt = await fetch(`/build.json`);
        if (!alt.ok) return;
        const j = await alt.json();
        const ver = String(j?.version || j?.build || "").trim();
        const env = String(j?.environment || "").trim();
        if (ver) setBuildVersion(ver);
        if (env) setBuildEnv(env);
      } catch {}
    };
    loadBuild();
  }, []);

  const refreshToken = async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("auth_token") || "";
      if (!token) return;
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        if (j?.token) localStorage.setItem("auth_token", j.token);
      }
    } catch {}
  };

  useEffect(() => {
    let last = Date.now();
    let ttl = 1800; // 30 minutos padrão
    const tick = () => {
      const now = Date.now();
      const diff = Math.floor((now - last) / 1000);
      setIdleLeft(Math.max(ttl - diff, 0));
    };
    const onActivity = () => {
      last = Date.now();
      tick();
      const now = Date.now();
      if (now - (lastRefreshRef.current || 0) > 60_000) {
        lastRefreshRef.current = now;
        refreshToken();
      }
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, []);

  useEffect(() => {
    if (idleLeft === 0) {
      handleLogout();
    }
  }, [idleLeft]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sprout className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">AgroPlan</h1>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex gap-2">
                {roleData?.isAdmin && (
                  <Link to="/admin">
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Admin
                    </Button>
                  </Link>
                )}
                <Button variant="outline" size="sm" onClick={openProfile}>Perfil</Button>
                <Button variant="outline" size="sm" onClick={handleLogout}>Sair</Button>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {`Bem vindo ${String(profile?.nome || "").trim() || "usuário"}`}
                {buildVersion ? `, Build: ${buildVersion}${roleData?.isAdmin && buildEnv ? ` (${buildEnv})` : ""}` : ""}
                {idleLeft != null ? `, Inatividade: ${Math.floor(idleLeft / 60)}:${String(idleLeft % 60).padStart(2, "0")}` : ""}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Modal de área cultivável removido - agora gerenciado via talhões */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard</h2>
          <p className="text-muted-foreground">Gerencie programacoes agricolas e cultivos</p>
        </div>

        

        {showSummaryCards && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <Sprout className="h-10 w-10 text-primary" />
                <span className="text-2xl font-bold text-primary">
                  {loadingCounter(cultivaresLoading, cultivaresList.length)}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-1">Cultivares ativos</h3>
              <p className="text-sm text-muted-foreground">Programacoes de plantio cadastradas</p>
              {renderError(cultivaresError)}
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <Droplet className="h-10 w-10 text-primary" />
                <span className="text-2xl font-bold text-primary">
                  {loadingCounter(adubacoesLoading, adubacoesList.length)}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-1">Adubacoes</h3>
              <p className="text-sm text-muted-foreground">Programacoes de fertilizacao</p>
              {renderError(adubacoesError)}
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <Shield className="h-10 w-10 text-primary" />
                <span className="text-2xl font-bold text-primary">
                  {loadingCounter(defensivosLoading, defensivosList.length)}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-1">Defensivos</h3>
              <p className="text-sm text-muted-foreground">Aplicacoes defensivas planejadas</p>
              {renderError(defensivosError)}
            </Card>
          </div>
        )}

        

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link to="/programacao">
            <Card className="p-6 hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer group">
              <Calendar className="h-8 w-8 mb-4 text-primary group-hover:text-primary-foreground" />
              <h3 className="font-semibold text-lg mb-2">Programação</h3>
              <p className="text-sm text-muted-foreground group-hover:text-primary-foreground">
                Planejamento completo de cultivares e adubação
              </p>
            </Card>
          </Link>

          <Link to="/defensivos">
            <Card className="p-6 hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer group">
              <Shield className="h-8 w-8 mb-4 text-primary group-hover:text-primary-foreground" />
              <h3 className="font-semibold text-lg mb-2">Defensivos</h3>
              <p className="text-sm text-muted-foreground group-hover:text-primary-foreground">
                Programar aplicacoes
              </p>
            </Card>
          </Link>

          <Link to="/relatorios">
            <Card className="p-6 hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer group">
              <FileText className="h-8 w-8 mb-4 text-primary group-hover:text-primary-foreground" />
              <h3 className="font-semibold text-lg mb-2">Relatorios</h3>
              <p className="text-sm text-muted-foreground group-hover:text-primary-foreground">
                Visualizar dados consolidados
              </p>
            </Card>
          </Link>
        </div>

        {/* Card de Gerenciamento de Talhões */}
        <Card className="mt-6 p-6 bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-semibold text-lg">Gerenciar Talhões</h3>
                <p className="text-sm text-muted-foreground">Cadastre e edite os talhões das suas fazendas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Produtor</Label>
                <Input
                  value={searchProdutor}
                  onChange={(e) => setSearchProdutor(e.target.value)}
                  placeholder="Buscar por nome ou CM"
                  className="w-[240px]"
                />
              </div>
              <label className="text-sm flex items-center gap-2 whitespace-nowrap">
                <Checkbox checked={onlyComTalhao} onCheckedChange={(c) => setOnlyComTalhao(!!c)} className="h-4 w-4" />
                Somente fazendas com talhão
              </label>
            </div>
          </div>

          {produtoresParaRenderizar.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p>Nenhum produtor vinculado ao seu perfil.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {produtoresParaRenderizar.map((produtor) => {
                const fazendas = fazendasPorProdutor[produtor.numerocm] || [];
                if (fazendas.length === 0) return null;

                return (
                  <div key={produtor.numerocm} className="border rounded-lg p-4 space-y-3">
                    <div className="font-medium text-sm text-muted-foreground">
                      {produtor.nome}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {fazendas.map((fazenda) => (
                        <div
                          key={fazenda.id}
                          className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{fazenda.nomefazenda}</p>
                            <p className="text-xs text-muted-foreground">
                              {Number(fazenda.area_cultivavel || 0).toFixed(2)} ha
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFazendaSelecionada({ id: fazenda.id, nome: fazenda.nomefazenda });
                              setGerenciarTalhoesOpen(true);
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Bloco 'Safra atual' removido conforme solicitado */}
      </main>

      {fazendaSelecionada && (
        <GerenciarTalhoes
          fazendaId={fazendaSelecionada.id}
          fazendaNome={fazendaSelecionada.nome}
          open={gerenciarTalhoesOpen}
          onOpenChange={setGerenciarTalhoesOpen}
        />
      )}

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="space-y-2">
              <Label>CM Consultor</Label>
              <Input value={editCmConsultor} disabled readOnly placeholder="Ex: 123456" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editEmail} disabled readOnly placeholder="seu@email.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">Alterar minha senha</Label>
              <div className="flex gap-2">
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button
                  variant="default"
                  onClick={() => changePassword(newPassword)}
                  disabled={!newPassword || newPassword.length < 6}
                >
                  Definir
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>Fechar</Button>
            <Button onClick={handleSaveProfile}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
