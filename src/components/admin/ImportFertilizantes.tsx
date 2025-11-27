import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, RefreshCw, Wifi, WifiOff } from "lucide-react";
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
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline' | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
  };

  const checkApiConnectivity = async () => {
    setApiStatus('checking');
    try {
      const { data, error } = await supabase.functions.invoke('fertilizantes-sync', {
        body: { checkOnly: true }
      });

      if (error) throw error;
      
      if (data.success) {
        setApiStatus('online');
        toast.success(`API conectada! ${data.itemCount} fertilizantes disponíveis`);
      } else {
        setApiStatus('offline');
        toast.error('API não está respondendo');
      }
    } catch (error) {
      console.error('Erro ao verificar API:', error);
      setApiStatus('offline');
      toast.error('Erro ao conectar com a API');
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let deletedRecords = 0;

      // Limpar tabela se checkbox marcado
      if (limparAntes) {
        const { count } = await supabase
          .from("fertilizantes_catalog")
          .select("*", { count: "exact", head: true });
        
        deletedRecords = count || 0;

        const { error: deleteError } = await supabase
          .from("fertilizantes_catalog")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        
        if (deleteError) {
          console.error("Erro ao limpar tabela:", deleteError);
          toast.error("Erro ao limpar tabela");
          setIsImporting(false);
          return;
        }
        setDeletedRows(deletedRecords);
        toast.info(`${deletedRecords} registros removidos`);
      }
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

      // Importar dados únicos
      let imported = 0;
      for (const fertilizanteData of processedData.values()) {
        const { error } = await supabase
          .from("fertilizantes_catalog")
          .upsert(fertilizanteData, { 
            onConflict: "cod_item",
            ignoreDuplicates: false 
          });

        if (error) {
          console.error("Erro ao importar fertilizante:", error);
        } else {
          imported++;
          setImportedRows(imported);
        }
      }

      // Registrar no histórico
      await supabase.from("import_history").insert({
        user_id: user.id,
        tabela_nome: "fertilizantes_catalog",
        registros_importados: importedRows,
        registros_deletados: deletedRecords,
        arquivo_nome: file.name,
        limpar_antes: limparAntes,
      });

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

  const handleSyncApi = async () => {
    setIsSyncing(true);
    setShowSummary(false);
    setImportedRows(0);
    setDeletedRows(0);

    try {
      toast.info('Iniciando sincronização com API...');

      const { data, error } = await supabase.functions.invoke('fertilizantes-sync', {
        body: { limparAntes }
      });

      if (error) throw error;

      if (data.success) {
        setImportedRows(data.imported);
        setDeletedRows(data.deleted);
        setTotalRows(data.imported);
        toast.success(data.message);
        setShowSummary(true);
        setLimparAntes(false);
      } else {
        toast.error(data.error || 'Erro ao sincronizar');
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      toast.error('Erro ao sincronizar com a API');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Fertilizantes</CardTitle>
        <CardDescription>
          Importe fertilizantes via planilha Excel ou sincronize com a API externa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seção API */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Sincronização via API</h3>
              {apiStatus === 'online' && (
                <Badge variant="default" className="gap-1">
                  <Wifi className="h-3 w-3" />
                  Online
                </Badge>
              )}
              {apiStatus === 'offline' && (
                <Badge variant="destructive" className="gap-1">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkApiConnectivity}
              disabled={apiStatus === 'checking' || isSyncing}
            >
              {apiStatus === 'checking' ? 'Verificando...' : 'Testar Conexão'}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="limpar-antes-api"
              checked={limparAntes}
              onCheckedChange={(checked) => setLimparAntes(checked as boolean)}
              disabled={isSyncing}
            />
            <Label htmlFor="limpar-antes-api" className="cursor-pointer text-sm">
              Limpar todos os registros antes de sincronizar
            </Label>
          </div>

          <Button
            onClick={handleSyncApi}
            disabled={isSyncing || apiStatus === 'offline'}
            className="w-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar com API'}
          </Button>
        </div>

        {/* Separador */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        {/* Seção Upload de Arquivo */}
        <div className="space-y-4">
          <h3 className="font-medium">Upload de Planilha</h3>
          <div className="space-y-2">
            <Label htmlFor="fertilizantes-file">Selecione o arquivo Excel</Label>
            <div className="flex items-center gap-4">
              <Input
                id="fertilizantes-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isImporting}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Colunas necessárias: COD. ITEM, ITEM, GRUPO, MARCA, PRINCIPIO_ATIVO
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="limpar-antes-file"
              checked={limparAntes}
              onCheckedChange={(checked) => setLimparAntes(checked as boolean)}
              disabled={isImporting}
            />
            <Label htmlFor="limpar-antes-file" className="cursor-pointer text-sm">
              Limpar todos os registros antes de importar
            </Label>
          </div>

          <Button onClick={handleImport} disabled={isImporting || !file} className="w-full">
            <Upload className="mr-2 h-4 w-4" />
            {isImporting ? "Importando..." : "Importar Planilha"}
          </Button>
        </div>

        {(isImporting || isSyncing) && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {isImporting && `Importando ${importedRows} de ${totalRows} linhas...`}
              {isSyncing && `Sincronizando dados da API...`}
            </p>
            <Progress value={totalRows ? Math.round((importedRows / totalRows) * 100) : 0} />
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
