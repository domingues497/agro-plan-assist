import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getApiBaseUrl } from '@/lib/utils';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos em milissegundos
const WARNING_TIMEOUT = 25 * 60 * 1000; // Aviso 5 minutos antes

type Ctx = { idleLeft: number };
const InactivityContext = createContext<Ctx | undefined>(undefined);

export const InactivityProvider = ({ children }: { children: React.ReactNode }) => {
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(Date.now());
  const [idleLeft, setIdleLeft] = useState<number>(Math.floor(INACTIVITY_TIMEOUT / 1000));

  const showWarning = () => {
    toast({
      title: "Inatividade detectada",
      description: "Você será desconectado em 1 minuto por inatividade.",
      variant: "destructive",
    });
  };

  const logout = async () => {
    try {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      toast({ title: "Sessão encerrada", description: "Você foi desconectado por inatividade.", variant: "destructive" });
      localStorage.removeItem('auth_token');
      window.location.replace('/auth');
    } catch (error) {
      window.location.replace('/auth');
    }
  };

  const resetTimer = useCallback(() => {
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
    lastActivityRef.current = Date.now();
    setIdleLeft(Math.floor(INACTIVITY_TIMEOUT / 1000));

    // Renovar token se houver atividade e passou mais de 60s
    try {
      const now = Date.now();
      if (now - (lastRefreshRef.current || 0) > 60_000) {
        lastRefreshRef.current = now;
        const baseUrl = getApiBaseUrl();
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || '' : '';
        if (token) {
          fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
            .then(async (res) => {
              if (!res.ok) return;
              const j = await res.json();
              if (j?.token) localStorage.setItem('auth_token', j.token);
            })
            .catch(() => {});
        }
      }
    } catch {}
  }, []);

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

    const id = setInterval(() => {
      const now = Date.now();
      const diffSec = Math.floor((now - lastActivityRef.current) / 1000);
      const left = Math.max(Math.floor(INACTIVITY_TIMEOUT / 1000) - diffSec, 0);
      setIdleLeft(left);
      if (left <= 0) {
        logout();
      }
    }, 1000);

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
      clearInterval(id);
    };
  }, [resetTimer]);

  return (
    <InactivityContext.Provider value={{ idleLeft }}>
      {children}
    </InactivityContext.Provider>
  );
};

export const useInactivity = (): Ctx => {
  const ctx = useContext(InactivityContext);
  return ctx || { idleLeft: Math.floor(INACTIVITY_TIMEOUT / 1000) };
};

