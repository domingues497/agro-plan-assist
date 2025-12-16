import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SystemConfigItem, useSystemConfig, upsertSystemConfig } from "@/hooks/useSystemConfig";

export const SystemConfig = () => {
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useSystemConfig();

  const map = useMemo(() => {
    const m: Record<string, string> = {};
    for (const it of data) m[it.config_key] = String(it.config_value ?? "");
    return m;
  }, [data]);

  const [defClientId, setDefClientId] = useState("");
  const [defSecret, setDefSecret] = useState("");
  const [defExp, setDefExp] = useState("");
  const [defUrl, setDefUrl] = useState("");
  const [defAud, setDefAud] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState("30");
  const [fertClientId, setFertClientId] = useState("");
  const [fertSecret, setFertSecret] = useState("");
  const [fertExp, setFertExp] = useState("");
  const [fertUrl, setFertUrl] = useState("");
  const [prodClientId, setProdClientId] = useState("");
  const [prodSecret, setProdSecret] = useState("");
  const [prodExp, setProdExp] = useState("");
  const [prodUrl, setProdUrl] = useState("");
  const [fazClientId, setFazClientId] = useState("");
  const [fazSecret, setFazSecret] = useState("");
  const [fazExp, setFazExp] = useState("");
  const [fazUrl, setFazUrl] = useState("");
  const [prodSyncInterval, setProdSyncInterval] = useState("30");
  const [fazSyncInterval, setFazSyncInterval] = useState("30");
  const [prodSyncEnabled, setProdSyncEnabled] = useState(false);
  const [fazSyncEnabled, setFazSyncEnabled] = useState(false);

  useEffect(() => {
    setDefClientId(map["api_defensivos_client_id"] ?? "");
    setDefSecret(map["api_defensivos_secret"] ?? "");
    setDefExp(map["api_defensivos_exp"] ?? "");
    setDefUrl(map["api_defensivos_url"] ?? "");
    setDefAud(map["api_defensivos_aud"] ?? "");
    setSyncEnabled((map["defensivos_sync_enabled"] ?? "").toLowerCase() === "true" || (map["defensivos_sync_enabled"] ?? "") === "1");
    setSyncInterval(map["defensivos_sync_interval_minutes"] ?? "30");
    setFertClientId(map["api_fertilizantes_cliente_id"] ?? "");
    setFertSecret(map["api_fertilizantes_secret"] ?? "");
    setFertExp(map["api_fertilizantes_exp"] ?? "");
    setFertUrl(map["api_fertilizantes_url"] ?? "");
    setProdClientId(map["api_produtores_client_id"] ?? "");
    setProdSecret(map["api_produtores_secret"] ?? "");
    setProdExp(map["api_produtores_exp"] ?? "");
    setProdUrl(map["api_produtores_url"] ?? "");
    setFazClientId(map["api_fazendas_client_id"] ?? "");
    setFazSecret(map["api_fazendas_secret"] ?? "");
    setFazExp(map["api_fazendas_exp"] ?? "");
    setFazUrl(map["api_fazendas_url"] ?? "");
    setProdSyncEnabled((map["produtores_sync_enabled"] ?? "").toLowerCase() === "true" || (map["produtores_sync_enabled"] ?? "") === "1");
    setFazSyncEnabled((map["fazendas_sync_enabled"] ?? "").toLowerCase() === "true" || (map["fazendas_sync_enabled"] ?? "") === "1");
    setProdSyncInterval(map["produtores_sync_interval_minutes"] ?? "30");
    setFazSyncInterval(map["fazendas_sync_interval_minutes"] ?? "30");
  }, [map]);

  const onSave = async () => {
    const items: SystemConfigItem[] = [
      { config_key: "api_defensivos_client_id", config_value: defClientId, description: "Client ID para autenticação JWT na API de defensivos" },
      { config_key: "api_defensivos_secret", config_value: defSecret, description: "Secret para geração do JWT da API de defensivos" },
      { config_key: "api_defensivos_exp", config_value: defExp, description: "Timestamp de expiração do JWT para API de defensivos" },
      { config_key: "api_defensivos_url", config_value: defUrl, description: "URL da API externa para sincronização de defensivos" },
      { config_key: "api_defensivos_aud", config_value: defAud, description: "Audience JWT (se exigido pela API externa)" },
      { config_key: "defensivos_sync_enabled", config_value: syncEnabled ? "true" : "false", description: "Ativar sincronização automática de defensivos" },
      { config_key: "defensivos_sync_interval_minutes", config_value: syncInterval || "30", description: "Intervalo da sincronização automática em minutos" },
      { config_key: "api_fertilizantes_cliente_id", config_value: fertClientId, description: "Client ID para autenticação JWT na API de fertilizantes" },
      { config_key: "api_fertilizantes_secret", config_value: fertSecret, description: "Secret para geração do JWT da API de fertilizantes" },
      { config_key: "api_fertilizantes_exp", config_value: fertExp, description: "Timestamp de expiração do JWT para API de fertilizantes" },
      { config_key: "api_fertilizantes_url", config_value: fertUrl, description: "URL da API externa para sincronização de fertilizantes" },
      { config_key: "api_produtores_client_id", config_value: prodClientId, description: "Client ID para autenticação JWT na API de produtores" },
      { config_key: "api_produtores_secret", config_value: prodSecret, description: "Secret para geração do JWT da API de produtores" },
      { config_key: "api_produtores_exp", config_value: prodExp, description: "Timestamp de expiração do JWT para API de produtores" },
      { config_key: "api_produtores_url", config_value: prodUrl, description: "URL da API externa para sincronização de produtores" },
      { config_key: "produtores_sync_enabled", config_value: prodSyncEnabled ? "true" : "false", description: "Ativar sincronização automática de produtores" },
      { config_key: "produtores_sync_interval_minutes", config_value: prodSyncInterval || "30", description: "Intervalo da sincronização automática de produtores (min)" },
      { config_key: "api_fazendas_client_id", config_value: fazClientId, description: "Client ID para autenticação JWT na API de fazendas" },
      { config_key: "api_fazendas_secret", config_value: fazSecret, description: "Secret para geração do JWT da API de fazendas" },
      { config_key: "api_fazendas_exp", config_value: fazExp, description: "Timestamp de expiração do JWT para API de fazendas" },
      { config_key: "api_fazendas_url", config_value: fazUrl, description: "URL da API externa para sincronização de fazendas" },
      { config_key: "fazendas_sync_enabled", config_value: fazSyncEnabled ? "true" : "false", description: "Ativar sincronização automática de fazendas" },
      { config_key: "fazendas_sync_interval_minutes", config_value: fazSyncInterval || "30", description: "Intervalo da sincronização automática de fazendas (min)" },
    ];
    try {
      await upsertSystemConfig(items);
      toast.success("Configurações salvas");
      await qc.invalidateQueries({ queryKey: ["system-config"] });
    } catch (e: any) {
      toast.error(e?.message || String(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações de Sistema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar configurações.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client ID (Defensivos)</Label>
              <Input value={defClientId} onChange={(e) => setDefClientId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sincronização automática (Defensivos)</Label>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={syncEnabled} onChange={(e) => setSyncEnabled(e.target.checked)} />
                <span className="text-sm">Ativar</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Intervalo (minutos)</Label>
              <Input value={syncInterval} onChange={(e) => setSyncInterval(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Secret (Defensivos)</Label>
              <Input value={defSecret} onChange={(e) => setDefSecret(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Expiração JWT (timestamp)</Label>
              <Input value={defExp} onChange={(e) => setDefExp(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>URL API (Defensivos)</Label>
              <Input value={defUrl} onChange={(e) => setDefUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Audience (Defensivos)</Label>
              <Input value={defAud} onChange={(e) => setDefAud(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Client ID (Fertilizantes)</Label>
              <Input value={fertClientId} onChange={(e) => setFertClientId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Secret (Fertilizantes)</Label>
              <Input value={fertSecret} onChange={(e) => setFertSecret(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Expiração JWT Fertilizantes (timestamp)</Label>
              <Input value={fertExp} onChange={(e) => setFertExp(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>URL API (Fertilizantes)</Label>
              <Input value={fertUrl} onChange={(e) => setFertUrl(e.target.value)} />
            </div>

            <div className="col-span-1 md:col-span-2 border-t pt-4" />
            <div className="space-y-2">
              <Label>Client ID (Produtores)</Label>
              <Input value={prodClientId} onChange={(e) => setProdClientId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Secret (Produtores)</Label>
              <Input value={prodSecret} onChange={(e) => setProdSecret(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Expiração JWT Produtores (timestamp)</Label>
              <Input value={prodExp} onChange={(e) => setProdExp(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>URL API (Produtores)</Label>
              <Input value={prodUrl} onChange={(e) => setProdUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sincronização automática (Produtores)</Label>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={prodSyncEnabled} onChange={(e) => setProdSyncEnabled(e.target.checked)} />
                <span className="text-sm">Ativar</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Intervalo Produtores (minutos)</Label>
              <Input value={prodSyncInterval} onChange={(e) => setProdSyncInterval(e.target.value)} />
            </div>

            <div className="col-span-1 md:col-span-2 border-t pt-4" />
            <div className="space-y-2">
              <Label>Client ID (Fazendas)</Label>
              <Input value={fazClientId} onChange={(e) => setFazClientId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Secret (Fazendas)</Label>
              <Input value={fazSecret} onChange={(e) => setFazSecret(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Expiração JWT Fazendas (timestamp)</Label>
              <Input value={fazExp} onChange={(e) => setFazExp(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>URL API (Fazendas)</Label>
              <Input value={fazUrl} onChange={(e) => setFazUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sincronização automática (Fazendas)</Label>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={fazSyncEnabled} onChange={(e) => setFazSyncEnabled(e.target.checked)} />
                <span className="text-sm">Ativar</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Intervalo Fazendas (minutos)</Label>
              <Input value={fazSyncInterval} onChange={(e) => setFazSyncInterval(e.target.value)} />
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["system-config"] })}>Atualizar</Button>
          <Button onClick={onSave}>Salvar</Button>
        </div>
      </CardContent>
    </Card>
  );
};
