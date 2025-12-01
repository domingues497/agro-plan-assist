import { useQuery } from "@tanstack/react-query";

export const useAdminRole = () => {
  return useQuery({
    queryKey: ["admin-role"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("auth_token");
      if (!token) return { isAdmin: false };
      const res = await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return { isAdmin: false };
      const json = await res.json();
      const role = String(json?.user?.role || "consultor").toLowerCase();
      return { isAdmin: role === "admin" };
    },
  });
};
