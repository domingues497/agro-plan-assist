import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Wifi, WifiOff, Loader2 } from "lucide-react";
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

export const ImportFertilizantes = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [importedRows, setImportedRows] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [limparAntes, setLimparAntes] = useState(false);
  const [deletedRows, setDeletedRows] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [isSyncingApi, setIsSyncingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
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
        
        const fertilizanteData = {
          cod_item: row["COD.ITEM"] || row["COD. ITEM"] || null,
          item: normalizedItem || item,
          grupo: row["GRUPO"]?.toString().toUpperCase().trim() || null,
          marca: row["MARCA"]?.toString().toUpperCase().trim() || null,
          principio_ativo: row["PRINCIPIO_ATIVO"]?.toString().toUpperCase().trim() || row["PRINCIPIO ATIVO"]?.toString().toUpperCase().trim() || row["PRINCÍPIO ATIVO"]?.toString().toUpperCase().trim() || null,
        };
        
        processedData.set(normalizedItem, fertilizanteData);
      }

      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;

      const items = Array.from(processedData.values());

      const res = await fetch(`${baseUrl}/fertilizantes/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, limparAntes }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erro ${res.status}`);
      }
      const json = await res.json();
      const imported = Number(json?.imported || items.length);
      setImportedRows(imported);

      // Opcional: manter histórico no Supabase se desejado (não obrigatório para PostgreSQL)

      toast.success(`Importação concluída! ${importedRows} registros únicos de ${totalRows} linhas processadas`);
      setShowSummary(true);
      setFile(null);
      setLimparAntes(false);
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo. Verifique o formato.");
    } finally {
      setIsImporting(false);
    }
  };

  const checkApiConnectivity = async () => {
    setApiStatus('checking');
    try {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/fertilizantes/sync/test`);
      if (!res.ok) {
        setApiStatus('offline');
        toast.error('API Flask não está acessível. Verifique /fertilizantes/sync/test e system_config.');
        return false;
      }
      setApiStatus('online');
      toast.success('API está acessível!');
      return true;
    } catch (error) {
      setApiStatus('offline');
      toast.error('Não foi possível conectar à API externa.');
      return false;
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
      description: limparAntes ? 'Os dados existentes serão removidos antes da importação.' : 'Novos dados serão mesclados com os existentes.'
    });

    try {
      toast.loading('⏳ Conectando à API externa e processando dados...', {
        description: 'Este processo pode levar alguns minutos.'
      });
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/fertilizantes/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limparAntes }),
      });
      toast.dismiss();
      if (!res.ok) {
        const txt = await res.text();
        toast.error('❌ Erro ao sincronizar via API', { description: txt });
        return;
      }
      const data = await res.json();
      const imported = Number(data?.imported || 0);
      const deleted = Number(data?.deleted || 0);
      const ignored = Number(data?.ignored || 0);
      setImportedRows(imported);
      setDeletedRows(deleted);
      setTotalRows(imported);

      toast.success('✅ Sincronização concluída com sucesso!', {
        description: `${imported} registros importados${deleted ? `, ${deleted} removidos` : ''}${ignored ? `, ${ignored} ignorados` : ''}`
      });
      setShowSummary(true);
      setFile(null);
      setLimparAntes(false);
    } catch (err) {
      toast.dismiss();
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
        <CardTitle>Importar Fertilizantes</CardTitle>
        <CardDescription>
          Faça upload de uma planilha Excel (.xlsx ou .xls) com as colunas: 
          COD. ITEM, ITEM, GRUPO, MARCA, PRINCIPIO_ATIVO
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fertilizantes-file">Selecione o arquivo</Label>
          <div className="flex items-center gap-4">
            <Input
              id="fertilizantes-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isImporting}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="limpar-antes"
            checked={limparAntes}
            onCheckedChange={(checked) => setLimparAntes(checked as boolean)}
            disabled={isImporting}
          />
          <Label htmlFor="limpar-antes" className="cursor-pointer text-sm">
            Limpar todos os registros antes de importar
          </Label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Status da API:</Label>
            {apiStatus === 'idle' && (
              <Badge variant="outline">Não verificado</Badge>
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
        </div>
        {(isImporting || isSyncingApi) && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-medium">
                {isSyncingApi ? 'Sincronizando com API externa...' : 'Importando arquivo...'}
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
};
