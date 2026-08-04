import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function isMapTilerConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_MAPTILER_KEY);
}

/** Only allow relative in-app return paths (open-redirect safe). */
export function safeReturnPath(path: string | null | undefined, fallback = "/explore"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return fallback;
  }
  return path;
}
