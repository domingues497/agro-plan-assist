import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useBuildVersion() {
  return useQuery({
    queryKey: ["build-version"],
    queryFn: async () => {
      let version = "";
      let env = "";

      // Tenta buscar do backend primeiro
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/versions`);
        if (res.ok) {
          const json = await res.json();
          const items = (json?.items || []) as any[];
          const first = items[0];
          version = String(first?.version || first?.build || "").trim();
          env = String(first?.environment || "").trim();
          
          if (version) {
             return { version, env };
          }
        }
      } catch (e) {
        console.error("Failed to fetch backend version", e);
      }

      // Fallback para build.json local
      try {
        const alt = await fetch(`/build.json`);
        if (alt.ok) {
          const j = await alt.json();
          const v = String(j?.version || j?.build || "").trim();
          const e = String(j?.environment || "").trim();
          if (v) version = v;
          if (e) env = e;
        }
      } catch (e) {
        console.error("Failed to fetch local build.json", e);
      }

      return { version, env };
    },
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}
