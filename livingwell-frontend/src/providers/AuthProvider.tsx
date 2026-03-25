"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { User } from "@/types/auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("lwc_access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    // Ensure the flag cookie is set for middleware
    document.cookie = "lwc_token_present=1; path=/; max-age=604800; SameSite=Lax";
    apiClient
      .get<User>("/api/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.clear();
        document.cookie =
          "lwc_token_present=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post("/api/auth/login", { email, password });
    // Store tokens in localStorage
    localStorage.setItem("lwc_access_token", data.access_token);
    localStorage.setItem("lwc_refresh_token", data.refresh_token);
    // Set a flag cookie so Next.js middleware knows the user is logged in
    document.cookie = "lwc_token_present=1; path=/; max-age=604800; SameSite=Lax";
    const me = await apiClient.get<User>("/api/auth/me");
    setUser(me.data);
  };

  const logout = async () => {
    try {
      // Server clears httpOnly cookies
      await apiClient.post("/api/auth/logout");
    } catch {
      // Ignore errors — clear client state regardless
    }
    localStorage.removeItem("lwc_access_token");
    localStorage.removeItem("lwc_refresh_token");
    document.cookie =
      "lwc_token_present=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
