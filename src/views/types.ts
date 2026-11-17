import type { Repo } from "@/lib/data/repo";

export interface ViewProps {
  repo: Repo;
  params?: Record<string, string>;
  searchParams?: Record<string, string | string[] | undefined>;
}

export const sp = (s: ViewProps["searchParams"], k: string): string | undefined => {
  const v = s?.[k];
  return Array.isArray(v) ? v[0] : v;
};
