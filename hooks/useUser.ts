"use client";

import { useState, useEffect } from "react";
import { Character, Limits, ApiUser } from "@/types";

interface UseUserResult {
  characters: Character[];
  limits: Limits | null;
  user: ApiUser | null;
  loading: boolean;
  error: string;
  refetch: () => void;
}

export function useUser(authHeaders: Record<string, string>, isReady: boolean): UseUserResult {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [limits,     setLimits]     = useState<Limits | null>(null);
  const [user,       setUser]       = useState<ApiUser | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [tick,       setTick]       = useState(0);

  useEffect(() => {
    if (!isReady) return;
    setLoading(true);
    setError("");
    fetch("/api/user", { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => {
        setCharacters(data.characters ?? []);
        setLimits(data.limits ?? null);
        setUser(data.user ?? null);
      })
      .catch(() => setError("Не удалось загрузить данные"))
      .finally(() => setLoading(false));
  }, [isReady, tick]);

  return { characters, limits, user, loading, error, refetch: () => setTick(t => t + 1) };
}
