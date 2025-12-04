import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export const useCultivaresCatalog = () => {
  return useQuery({
    queryKey: ["cultivares-catalog"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/cultivares_catalog`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return json?.items || [];
    },
  });
};
