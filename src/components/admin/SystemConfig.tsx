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
