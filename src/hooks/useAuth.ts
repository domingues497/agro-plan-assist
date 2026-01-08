import { useMutation } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useLogin() {
  return useMutation({
    mutationFn: async ({ email, password }: any) => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || (res.status === 403 ? "Email não autorizado ou senha inválida" : "Falha ao fazer login"));
      }
      return res.json();
    },
  });
}

export function useRegisterCheck() {
  return useMutation({
    mutationFn: async (email: string) => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/consultores/by_email?email=${encodeURIComponent(email.toLowerCase())}`);
      if (!res.ok) {
        throw new Error("Email não encontrado na base de consultores.");
      }
      return true;
    }
  });
}
