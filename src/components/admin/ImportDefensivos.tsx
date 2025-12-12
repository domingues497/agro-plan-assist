import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";
import { normalizeProductName } from "@/lib/importUtils";
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
import { Badge } from "@/components/ui/badge";

export const ImportDefensivos = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [importedRows, setImportedRows] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  
  const [deletedRows, setDeletedRows] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [isSyncingApi, setIsSyncingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
  };

  const checkApiConnectivity = async () => {
    setApiStatus('checking');
    try {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const resHealth = await fetch(`${baseUrl}/health`);
      if (!resHealth.ok) throw new Error('backend-offline');
      const resTest = await fetch(`${baseUrl}/defensivos/sync/test`);
      if (!resTest.ok) {
        let detail = '';
        try {
          const j = await resTest.json();
          detail = j?.error ? `Detalhes: ${j.error}${j.status ? ` (status ${j.status})` : ''}` : '';
        } catch {
          const t = await resTest.text().catch(() => '');
          detail = t ? `Detalhes: ${t}` : '';
        }
        setApiStatus('offline');
        toast.error(`Configuração ou conectividade da API externa falhou. ${detail}`);
        return false;
      }
      setApiStatus('online');
      toast.success('Backend e API externa acessíveis.');
      return true;
    } catch (e) {
      setApiStatus('offline');
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Não foi possível conectar: ${msg}`);
      return false;
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo primeiro");
      return;
    }

    setIsImporting(true);
    setShowSummary(false);
    setImportedRows(0);
    setDeletedRows(0);

    try {
      let deletedRecords = 0;

      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setTotalRows(jsonData.length);

      // Processar e normalizar dados
      const processedData = new Map<string, any>();
      
      for (const row of jsonData as any[]) {
        const item = row["ITEM"] || null;
        const normalizedItem = normalizeProductName(item);
        
        // Se já existe um item com o mesmo nome normalizado, pular
        if (processedData.has(normalizedItem)) {
          continue;
        }
        
        const defensivoData = {
          cod_item: row["COD.ITEM"] || row["COD. ITEM"] || null,
          item: normalizedItem || item,
          grupo: row["GRUPO"]?.toString().toUpperCase().trim() || null,
          marca: row["MARCA"]?.toString().toUpperCase().trim() || null,
          principio_ativo: row["PRINCIPIO_ATIVO"]?.toString().toUpperCase().trim() || row["PRINCIPIO ATIVO"]?.toString().toUpperCase().trim() || row["PRINCÍPIO ATIVO"]?.toString().toUpperCase().trim() || null,
        };
        
        processedData.set(normalizedItem, defensivoData);
      }

      const dataArray = Array.from(processedData.values());
      const res = await fetch(`${baseUrl}/defensivos/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: dataArray }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || 'Falha ao importar via API');
      }
      const j = await res.json();
      const imported = Number(j?.imported || 0);
      setImportedRows(imported);

      toast.success(`Importação concluída! ${imported} registros únicos de ${totalRows} linhas processadas`);
      setShowSummary(true);
      setFile(null);
      
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo. Verifique o formato.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSyncApi = async () => {
    const isConnected = await checkApiConnectivity();
    if (!isConnected) return;

    setIsSyncingApi(true);
    setIsImporting(true);
    setShowSummary(false);
    setImportedRows(0);
    setDeletedRows(0);

    toast.info('🚀 Iniciando sincronização com API externa...', {
      description: 'Novos dados serão mesclados com os existentes.'
    });

    try {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      toast.loading('⏳ Conectando à API externa e processando dados...', { description: 'Este processo pode levar alguns minutos.' });
      const res = await fetch(`${baseUrl}/defensivos/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      toast.dismiss();
      if (!res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const j = await res.json().catch(() => null);
          const msg = j?.error || 'Erro ao sincronizar via API externa';
          const details = j?.details ? ` Detalhes: ${j.details}` : '';
          const status = j?.status ? ` (status ${j.status})` : '';
          toast.error(`${msg}${status}${details}`);
        } else {
          const t = await res.text().catch(() => '');
          toast.error(`Erro ao sincronizar via API externa (HTTP ${res.status}). ${t}`);
        }
        return;
      }
      const j = await res.json();
      const imported = Number(j?.imported || 0);
      setImportedRows(imported);
      setTotalRows(imported);

      toast.success('✅ Sincronização concluída com sucesso!');
      setShowSummary(true);
      setFile(null);
      
    } catch (err) {
      toast.dismiss();
      console.error('Erro ao sincronizar API:', err);
      toast.error('❌ Erro inesperado ao sincronizar', {
        description: err instanceof Error ? err.message : 'Erro desconhecido'
      });
    } finally {
      setIsSyncingApi(false);
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Defensivos</CardTitle>
        <CardDescription>
          Faça upload de uma planilha Excel (.xlsx ou .xls) com as colunas: 
          COD. ITEM, ITEM, GRUPO, MARCA, PRINCIPIO_ATIVO
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="defensivos-file">Selecione o arquivo</Label>
          <div className="flex items-center gap-4">
            <Input
              id="defensivos-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isImporting || isSyncingApi}
            />
          </div>
        </div>

        

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Status da API:</Label>
            {apiStatus === 'idle' && (
              <Badge variant="outline">
                Não verificado
              </Badge>
            )}
            {apiStatus === 'checking' && (
              <Badge variant="outline">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Verificando...
              </Badge>
            )}
            {apiStatus === 'online' && (
              <Badge variant="default" className="bg-green-600">
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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={checkApiConnectivity}
              disabled={apiStatus === 'checking'}
            >
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
        </div>
        {isImporting && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-medium">
                {isSyncingApi ? 'Sincronizando com API externa...' : `Importando arquivo...`}
              </p>
            </div>
            {!isSyncingApi && totalRows > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  {importedRows} de {totalRows} linhas processadas
                </p>
                <Progress value={Math.round((importedRows / totalRows) * 100)} />
              </>
            )}
            {isSyncingApi && (
              <p className="text-sm text-muted-foreground">
                Aguarde enquanto os dados são importados da API externa. Este processo pode levar alguns minutos.
              </p>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              Importação Concluída
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <div className="grid gap-2">
                  {deletedRows > 0 && (
                    <div className="flex justify-between items-center p-2 bg-destructive/10 rounded">
                      <span className="text-sm font-medium">Registros removidos:</span>
                      <Badge variant="destructive">{deletedRows}</Badge>
                    </div>
                  )}
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm font-medium">Total processado:</span>
                    <Badge variant="outline">{totalRows}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-primary/10 rounded">
                    <span className="text-sm font-medium">Registros importados:</span>
                    <Badge variant="default">{importedRows}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  A importação foi registrada no histórico de importações.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
