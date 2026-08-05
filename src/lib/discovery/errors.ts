export type DiscoveryErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_UNAUTHORIZED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_BAD_REQUEST"
  | "PROVIDER_UNAVAILABLE"
  | "MAPTILER_FAILED"
  | "MAPTILER_NOT_CONFIGURED"
  | "DISCOVERY_LIMIT_REACHED"
  | "AUTH_REQUIRED"
  | "UNKNOWN_PROVIDER_ERROR";

export interface DiscoveryError {
  code: DiscoveryErrorCode;
  message: string;
  retryable: boolean;
}

export class ProviderHttpError extends Error {
  readonly status: number;
  readonly provider: string;
  readonly endpoint: string;
  readonly bodySnippet: string;

  constructor(args: {
    status: number;
    provider: string;
    endpoint: string;
    bodySnippet: string;
  }) {
    super(`${args.provider} ${args.endpoint} HTTP ${args.status}`);
    this.name = "ProviderHttpError";
    this.status = args.status;
    this.provider = args.provider;
    this.endpoint = args.endpoint;
    this.bodySnippet = args.bodySnippet.slice(0, 300);
  }
}

export function discoveryErrorFromHttp(err: ProviderHttpError): DiscoveryError {
  if (err.provider === "maptiler") {
    if (err.status === 401 || err.status === 403) {
      return {
        code: "MAPTILER_FAILED",
        message:
          "Map place fallback could not authenticate. Check NEXT_PUBLIC_MAPTILER_KEY.",
        retryable: false,
      };
    }
    if (
      err.bodySnippet.includes("NEXT_PUBLIC_MAPTILER_KEY missing") ||
      err.status === 503
    ) {
      const missing = err.bodySnippet.includes("NEXT_PUBLIC_MAPTILER_KEY missing");
      return {
        code: missing ? "MAPTILER_NOT_CONFIGURED" : "MAPTILER_FAILED",
        message: missing
          ? "Map place fallback is not configured (NEXT_PUBLIC_MAPTILER_KEY)."
          : "Map place fallback is temporarily unavailable.",
        retryable: !missing,
      };
    }
    return {
      code: "MAPTILER_FAILED",
      message: "Map place fallback failed. Try again or create a custom place.",
      retryable: err.status >= 500 || err.status === 429,
    };
  }

  if (err.status === 401 || err.status === 403 || err.status === 402) {
    return {
      code: "PROVIDER_UNAUTHORIZED",
      message: "Place discovery could not authenticate with the provider.",
      retryable: false,
    };
  }
  if (err.status === 429) {
    return {
      code: "PROVIDER_RATE_LIMITED",
      message: "Place discovery is rate limited. Try again shortly.",
      retryable: true,
    };
  }
  if (err.status === 400 || err.status === 422) {
    return {
      code: "PROVIDER_BAD_REQUEST",
      message: "Place discovery rejected the search request.",
      retryable: false,
    };
  }
  if (err.status >= 500) {
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: "We couldn’t reach place discovery right now. Try again or create a custom place.",
      retryable: true,
    };
  }
  return {
    code: "UNKNOWN_PROVIDER_ERROR",
    message: "We couldn’t reach place discovery right now. Try again or create a custom place.",
    retryable: true,
  };
}

function looksLikeNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = `${err.name} ${err.message}`.toLowerCase();
  return (
    err.name === "TypeError" ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("enotfound") ||
    msg.includes("etimedout") ||
    msg.includes("socket")
  );
}

export function discoveryErrorFromUnknown(err: unknown): DiscoveryError {
  if (err instanceof ProviderHttpError) return discoveryErrorFromHttp(err);
  if (looksLikeNetworkFailure(err)) {
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: "We couldn’t reach place discovery right now. Try again or create a custom place.",
      retryable: true,
    };
  }
  return {
    code: "UNKNOWN_PROVIDER_ERROR",
    message: "We couldn’t reach place discovery right now. Try again or create a custom place.",
    retryable: true,
  };
}

/** Prefer actionable Foursquare codes; surface MapTiler when that is the only signal. */
export function mergeDiscoveryErrors(
  primary: DiscoveryError,
  fallback: DiscoveryError | null,
): DiscoveryError {
  if (!fallback) return primary;
  if (
    primary.code === "UNKNOWN_PROVIDER_ERROR" ||
    primary.code === "PROVIDER_UNAVAILABLE"
  ) {
    if (
      fallback.code === "MAPTILER_FAILED" ||
      fallback.code === "MAPTILER_NOT_CONFIGURED"
    ) {
      return {
        code: fallback.code,
        message: `${primary.message} Map fallback also failed.`,
        retryable: primary.retryable || fallback.retryable,
      };
    }
  }
  if (
    fallback.code === "MAPTILER_FAILED" ||
    fallback.code === "MAPTILER_NOT_CONFIGURED"
  ) {
    return {
      ...primary,
      message: `${primary.message} Map fallback also failed (${fallback.code}).`,
    };
  }
  return primary;
}

/** User-facing copy; append stable codes so production UI stays actionable. */
export function userMessageForDiscoveryError(error: DiscoveryError): string {
  const withCode = (msg: string) => `${msg} (${error.code})`;
  switch (error.code) {
    case "PROVIDER_NOT_CONFIGURED":
      return withCode("Place discovery is not configured.");
    case "DISCOVERY_LIMIT_REACHED":
      return withCode(
        "Nearby search limit reached for this month. You can still use the map and create a custom place.",
      );
    case "AUTH_REQUIRED":
      return withCode("Sign in to discover nearby places.");
    case "PROVIDER_UNAUTHORIZED":
      return withCode(
        "Place discovery could not authenticate with the provider. Check FOURSQUARE_API_KEY (Places Service Key).",
      );
    case "PROVIDER_BAD_REQUEST":
      return withCode("Place discovery rejected the search request.");
    case "PROVIDER_RATE_LIMITED":
      return withCode("Place discovery is rate limited. Try again shortly.");
    case "PROVIDER_UNAVAILABLE":
      return withCode(
        "We couldn’t reach place discovery right now. Try again or create a custom place.",
      );
    case "MAPTILER_NOT_CONFIGURED":
      return withCode(
        "Map place fallback is not configured. Set NEXT_PUBLIC_MAPTILER_KEY in Vercel.",
      );
    case "MAPTILER_FAILED":
      return withCode(
        "Place discovery and map fallback both failed. Try again or create a custom place.",
      );
    default:
      return withCode(error.message);
  }
}

export function logDiscoveryEvent(payload: Record<string, unknown>): void {
  // Never include Authorization or API keys.
  const safe = { ...payload };
  delete safe.authorization;
  delete safe.apiKey;
  delete safe.key;
  console.info(JSON.stringify({ scope: "discovery", ...safe }));
}
