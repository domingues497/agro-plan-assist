import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos em milissegundos
const WARNING_TIMEOUT = 4 * 60 * 1000; // Aviso 1 minuto antes

export const useInactivityLogout = () => {
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showWarning = () => {
    toast({
      title: "Inatividade detectada",
      description: "Você será desconectado em 1 minuto por inatividade.",
      variant: "destructive",
    });
  };

  const logout = async () => {
    try {
      // Limpar timers
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

      // Verificar se ainda há sessão ativa antes de fazer logout
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        toast({
          title: "Sessão encerrada",
          description: "Você foi desconectado por inatividade.",
          variant: "destructive",
        });
        
        await supabase.auth.signOut();
      }
      
      // Limpar storage e redirecionar
      window.location.replace('/auth');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      window.location.replace('/auth');
    }
  };

  const resetTimer = () => {
    // Limpar timers existentes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Configurar aviso
    warningTimeoutRef.current = setTimeout(showWarning, WARNING_TIMEOUT);

    // Configurar logout
    timeoutRef.current = setTimeout(logout, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
    // Eventos que indicam atividade do usuário
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Adicionar listeners para todos os eventos
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Iniciar o timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, []);

  return null;
};
