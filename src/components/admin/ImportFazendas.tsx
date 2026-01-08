import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { getApiBaseUrl } from "@/lib/utils";
import { useImportFazendasMutation } from "@/hooks/useImportFazendasMutation";
import { useSyncFazendasMutation } from "@/hooks/useSyncFazendasMutation";

export function ImportFazendas() {
  const [file, setFile] = useState<File | null>(null);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("offline");
  const [totalRows, setTotalRows] = useState(0);
  const [importedRows, setImportedRows] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [deletedRows, setDeletedRows] = useState(0);
  
  const importMutation = useImportFazendasMutation();
  const syncMutation = useSyncFazendasMutation();
  const isImporting = importMutation.isPending;
  const isSyncingApi = syncMutation.isPending;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo XLSX primeiro");
      return;
    }

    try {
      setImportedRows(0);
      setDeletedRows(0);
      setShowSummary(false);

      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      if (!token) throw new Error("Usuário não autenticado");
      const meRes = await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!meRes.ok) throw new Error("Falha ao obter usuário");
      const meJson = await meRes.json();
      const user = meJson?.user;
      if (!user?.user_id && !user?.id) throw new Error("Usuário inválido");

      let deletedRecords = 0;
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const payload = rows.map((row) => ({
        numerocm: String(row.NUMEROCM ?? row.numerocm ?? "").trim(),
        idfazenda: String(row.IDFAZENDA ?? row.idfazenda ?? "").trim(),
        nomefazenda: String(row.NOMEFAZENDA ?? row.nomefazenda ?? "").trim(),
        numerocm_consultor: String(row.NUMEROCMCONSULTOR ?? row.numerocm_consultor ?? "").trim(),
      })).filter((r) => r.numerocm && r.idfazenda && r.nomefazenda && r.numerocm_consultor);

      if (payload.length === 0) {
        toast.error("Nenhuma linha válida encontrada (precisa de NUMEROCM, IDFAZENDA, NOMEFAZENDA, NUMEROCMCONSULTOR)");
        return;
      }

      // Deduplicar por numerocm + idfazenda
      const dedupMap = new Map<string, typeof payload[0]>();
      for (const item of payload) {
        const key = `${item.numerocm}|${item.idfazenda}`;
        dedupMap.set(key, item);
      }
      const uniquePayload = Array.from(dedupMap.values());
      const removed = payload.length - uniquePayload.length;
      if (removed > 0) {
        toast.info(`${removed} registros duplicados foram ignorados`);
      }

      setTotalRows(uniquePayload.length);

      importMutation.mutate(
        {
          endpoint: "/fazendas/bulk",
          items: uniquePayload,
          userId: user.user_id || user.id,
          fileName: file.name
        },
        {
          onSuccess: (json) => {
            const count = json.count ?? uniquePayload.length;
            setImportedRows(count);
            toast.success(`${count} fazendas importadas com sucesso!`);
            setShowSummary(true);
            setFile(null);
          },
          onError: (err) => {
            toast.error(err.message);
          }
        }
      );
    } catch (error) {
      console.error(error);
      toast.error("Erro ao processar arquivo");
    }
  };


  const checkApiConnectivity = async () => {
    try {
      setApiStatus("checking");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/fazendas/sync/test`, { method: 'GET' });
      if (!res.ok) {
        setApiStatus('offline');
        return false;
      }
      const j = await res.json().catch(() => null);
      const ok = j && (j.ok || j.status === 200);
      setApiStatus(ok ? 'online' : 'offline');
      return !!ok;
    } catch {
      setApiStatus('offline');
      return false;
    }
  };

  const handleSyncApi = async () => {
    try {
      const connected = await checkApiConnectivity();
      if (!connected) {
        toast.error('API de Fazendas indisponível');
        return;
      }
      setShowSummary(false);
      
      syncMutation.mutate(undefined, {
        onSuccess: (json) => {
          const imported = Number(json?.imported || 0);
          toast.success(`Fazendas sincronizadas: ${imported}`);
        },
        onError: (err) => {
          toast.error(`Erro ao sincronizar fazendas: ${err.message}`);
        }
      });
    } catch (err: any) {
      toast.error(`Erro ao verificar conectividade: ${err.message || err}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Fazendas</CardTitle>
        <CardDescription>Planilha com colunas: NUMEROCM, IDFAZENDA, NOMEFAZENDA, NUMEROCMCONSULTOR</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Arquivo XLSX</Label>
          <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
        </div>

        <div className="flex items-center gap-3">
          {apiStatus === 'checking' && (
            <Badge variant="secondary">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Verificando...
            </Badge>
          )}
          {apiStatus === 'online' && (
            <Badge variant="secondary">
              <Wifi className="mr-1 h-3 w-3" />
              Online
            </Badge>
          )}
          {apiStatus === 'offline' && (
            <Badge variant="destructive">
              <WifiOff className="mr-1 h-3 w-3" />
              Offline
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={checkApiConnectivity} disabled={apiStatus === 'checking'}>
            Verificar Conexão
          </Button>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleImport} disabled={isImporting || isSyncingApi || !file}>
            {isImporting && !isSyncingApi ? "Importando..." : "Importar"}
          </Button>
          <Button variant="secondary" onClick={handleSyncApi} disabled={isImporting || isSyncingApi}>
            {isSyncingApi ? "Sincronizando..." : "Sincronizar via API"}
          </Button>
        </div>
        {(isImporting || isSyncingApi) && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {isSyncingApi ? 'Sincronizando com API externa...' : `Importando ${importedRows} de ${totalRows} linhas...`}
            </p>
            {!isSyncingApi && (
              <Progress value={totalRows ? Math.round((importedRows / totalRows) * 100) : 0} />
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resumo da Importação</AlertDialogTitle>
            <AlertDialogDescription>
              {deletedRows > 0 && (
                <>
                  Registros removidos: {deletedRows}
                  <br />
                </>
              )}
              Total na planilha: {totalRows}
              <br />
              Linhas importadas: {importedRows}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
