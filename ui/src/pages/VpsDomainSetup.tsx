import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { vpsApi } from "../api/vps";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { AsciiArtAnimation } from "@/components/AsciiArtAnimation";
import { Globe, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type DomainTransitionState = {
  domain: string;
  nextUrl: string;
  restartScheduled: boolean;
  startedAt: number;
  checks: number;
  lastStatusCode?: number;
  lastError?: string;
  ready: boolean;
};

export function VpsDomainSetupPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [transition, setTransition] = useState<DomainTransitionState | null>(null);

  const networkQuery = useQuery({
    queryKey: ["vps", "network-info"],
    queryFn: () => vpsApi.getNetworkInfo(),
    retry: false,
  });

  const ip = networkQuery.data?.ip ?? "...";

  const verifyMutation = useMutation({
    mutationFn: () => vpsApi.verifyDns(domain.trim()),
    onError: (err) => {
      setError(err instanceof Error ? err.message : "DNS verification failed");
    },
  });

  const configureMutation = useMutation({
    mutationFn: () => vpsApi.configureDomain(domain.trim()),
    onSuccess: async (data) => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.health });
      setTransition({
        domain: data.domain,
        nextUrl: data.nextUrl,
        restartScheduled: data.restartScheduled,
        startedAt: Date.now(),
        checks: 0,
        ready: false,
      });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Domain configuration failed");
    },
  });

  const skipMutation = useMutation({
    mutationFn: () => vpsApi.skipDomain(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.health });
      navigate("/setup/providers", { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to skip domain setup");
    },
  });

  const dnsResult = verifyMutation.data;
  const canConfigure = dnsResult?.matches === true;
  const isWorking = verifyMutation.isPending || configureMutation.isPending || skipMutation.isPending || transition !== null;

  useEffect(() => {
    if (!transition) return;

    let cancelled = false;
    let timeoutId: number | undefined;
    const { domain: activeDomain, nextUrl, restartScheduled } = transition;

    const poll = async () => {
      try {
        const readiness = await vpsApi.getDomainReadiness(activeDomain);
        if (cancelled) return;

        if (readiness.ready) {
          setTransition((current) => current ? {
            ...current,
            checks: current.checks + 1,
            ready: true,
          } : current);
          window.setTimeout(() => {
            window.location.href = nextUrl;
          }, 750);
          return;
        }

        setTransition((current) => current ? {
          ...current,
          checks: current.checks + 1,
          lastStatusCode: readiness.statusCode,
          lastError: readiness.error,
        } : current);
      } catch (err) {
        if (cancelled) return;
        setTransition((current) => current ? {
          ...current,
          checks: current.checks + 1,
          lastError: err instanceof Error ? err.message : "Waiting for HTTPS to finish provisioning",
        } : current);
      }

      timeoutId = window.setTimeout(poll, 3000);
    };

    timeoutId = window.setTimeout(poll, restartScheduled ? 1500 : 0);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [transition?.domain, transition?.nextUrl, transition?.restartScheduled]);

  const transitionElapsedSeconds = transition
    ? Math.max(0, Math.floor((Date.now() - transition.startedAt) / 1000))
    : 0;

  const transitionMessage = transition?.ready
    ? "HTTPS is ready. Redirecting you to the secure sign-in page..."
    : transition?.lastStatusCode === 502
      ? "The certificate or upstream server is still settling. Waiting for the secure site to become reachable..."
      : transition?.lastError
        ? "Paperclip is still restarting behind HTTPS. Waiting until the secure site answers successfully..."
        : "Applying HTTPS, waiting for the certificate, and checking that the secure site is reachable...";

  if (transition) {
    const showManualLink = transitionElapsedSeconds >= 45;

    return (
      <div className="fixed inset-0 flex bg-background">
        <div className="w-full md:w-1/2 flex flex-col overflow-y-auto">
          <div className="w-full max-w-lg mx-auto my-auto px-8 py-12">
            <div className="flex items-center gap-2 mb-8">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Paperclip VPS Setup</span>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <div>
                  <h1 className="text-xl font-semibold">Finishing HTTPS setup</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{transitionMessage}</p>
                </div>
              </div>

              <div className="mt-6 space-y-2 text-sm text-muted-foreground">
                <p>
                  Domain: <span className="font-medium text-foreground">{transition.domain}</span>
                </p>
                <p>
                  Checks: <span className="font-medium text-foreground">{transition.checks}</span>
                </p>
                <p>
                  Elapsed: <span className="font-medium text-foreground">{transitionElapsedSeconds}s</span>
                </p>
                {typeof transition.lastStatusCode === "number" && (
                  <p>
                    Last HTTPS status: <span className="font-medium text-foreground">{transition.lastStatusCode}</span>
                  </p>
                )}
              </div>

              {showManualLink && (
                <div className="mt-6 rounded-md border border-border bg-muted/30 p-4 text-sm">
                  <p className="text-muted-foreground">
                    This can take a bit longer while DNS, TLS, and the local restart settle. Paperclip will keep checking automatically.
                  </p>
                  <Button
                    type="button"
                    className="mt-4"
                    variant="outline"
                    onClick={() => {
                      window.location.href = transition.nextUrl;
                    }}
                  >
                    Open Secure Site Now
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="hidden md:block w-1/2 overflow-hidden">
          <AsciiArtAnimation />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-background">
      <div className="w-full md:w-1/2 flex flex-col overflow-y-auto">
        <div className="w-full max-w-lg mx-auto my-auto px-8 py-12">
          <div className="flex items-center gap-2 mb-8">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Paperclip VPS Setup</span>
          </div>

          <h1 className="text-xl font-semibold">Configure your domain</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up a custom domain with automatic HTTPS, or skip to continue using the IP address.
          </p>

          {/* DNS Instructions */}
          <div className="mt-6 rounded-md border border-border bg-muted/30 p-4 text-sm space-y-3">
            <p className="font-medium">Point your domain to this server:</p>
            <div className="font-mono text-xs bg-background rounded px-3 py-2 border border-border">
              <p>Type: <span className="text-foreground font-semibold">A</span></p>
              <p>Name: <span className="text-foreground font-semibold">dashboard</span> (or your subdomain)</p>
              <p>Value: <span className="text-foreground font-semibold">{ip}</span></p>
              <p>Proxy: <span className="text-foreground font-semibold">OFF</span> (DNS only)</p>
            </div>
            <p className="text-muted-foreground text-xs">
              You can also point <code className="bg-background px-1 rounded">*.yourdomain.com</code> and{" "}
              <code className="bg-background px-1 rounded">yourdomain.com</code> to{" "}
              <code className="bg-background px-1 rounded">{ip}</code> if you want Paperclip to control the
              full domain and all subdomains.
            </p>
          </div>

          {/* Domain Input + Actions */}
          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="domain" className="text-xs text-muted-foreground mb-1 block">
                Domain
              </label>
              <input
                id="domain"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                placeholder="dashboard.yourdomain.com"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  // Reset verification when domain changes
                  if (dnsResult) verifyMutation.reset();
                }}
              />
            </div>

            {/* DNS Verification Result */}
            {dnsResult && (
              <div
                className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                  dnsResult.matches
                    ? "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400"
                    : "border-yellow-500/30 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400"
                }`}
              >
                {dnsResult.matches ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <div>
                  {dnsResult.matches ? (
                    <p>DNS verified! <strong>{dnsResult.domain}</strong> resolves to <strong>{dnsResult.expectedIp}</strong>.</p>
                  ) : dnsResult.resolved ? (
                    <p>
                      <strong>{dnsResult.domain}</strong> resolves to{" "}
                      <strong>{dnsResult.resolvedIps.join(", ")}</strong> but this server's IP is{" "}
                      <strong>{dnsResult.expectedIp}</strong>. Update the A record and try again.
                    </p>
                  ) : (
                    <p>
                      <strong>{dnsResult.domain}</strong> does not resolve yet. DNS changes can take a few
                      minutes to propagate. Try again shortly.
                    </p>
                  )}
                </div>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
            {configureMutation.isPending && (
              <p className="text-xs text-muted-foreground">
                Applying HTTPS settings and preparing a restart...
              </p>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={!domain.trim() || isWorking}
                onClick={() => {
                  setError(null);
                  verifyMutation.mutate();
                }}
              >
                {verifyMutation.isPending ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Checking...</>
                ) : (
                  "Verify DNS"
                )}
              </Button>
              <Button
                type="button"
                disabled={!canConfigure || isWorking}
                onClick={() => {
                  setError(null);
                  configureMutation.mutate();
                }}
              >
                {configureMutation.isPending ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Configuring...</>
                ) : (
                  "Configure HTTPS"
                )}
              </Button>
            </div>
          </div>

          {/* Skip */}
          <div className="mt-8 pt-6 border-t border-border">
            <button
              type="button"
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              disabled={isWorking}
              onClick={() => skipMutation.mutate()}
            >
              {skipMutation.isPending ? "Skipping..." : "Skip — continue on IP address"}
            </button>
            <p className="mt-1 text-xs text-muted-foreground">
              You can configure a domain later from the instance settings.
            </p>
          </div>
        </div>
      </div>

      <div className="hidden md:block w-1/2 overflow-hidden">
        <AsciiArtAnimation />
      </div>
    </div>
  );
}
