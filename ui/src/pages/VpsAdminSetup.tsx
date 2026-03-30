import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { authApi } from "../api/auth";
import { vpsApi } from "../api/vps";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { AsciiArtAnimation } from "@/components/AsciiArtAnimation";
import { Shield } from "lucide-react";

export function VpsAdminSetupPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      // Step 1: Create BetterAuth user + session
      await authApi.signUpEmail({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      // Step 2: Promote to instance_admin
      await vpsApi.bootstrapAdmin();
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.health });
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      navigate("/setup/domain", { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Setup failed");
    },
  });

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.trim().length >= 8;

  return (
    <div className="fixed inset-0 flex bg-background">
      <div className="w-full md:w-1/2 flex flex-col overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto px-8 py-12">
          <div className="flex items-center gap-2 mb-8">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Paperclip VPS Setup</span>
          </div>

          <h1 className="text-xl font-semibold">Secure your instance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create the admin account to protect your Paperclip board. This will be
            the only account with full access to manage the instance.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (mutation.isPending) return;
              if (!canSubmit) {
                setError("Please fill in all fields. Password must be at least 8 characters.");
                return;
              }
              mutation.mutate();
            }}
          >
            <div>
              <label htmlFor="admin-name" className="text-xs text-muted-foreground mb-1 block">
                Name
              </label>
              <input
                id="admin-name"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="admin-email" className="text-xs text-muted-foreground mb-1 block">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="text-xs text-muted-foreground mb-1 block">
                Password (min 8 characters)
              </label>
              <input
                id="admin-password"
                type="password"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={mutation.isPending}
              aria-disabled={!canSubmit || mutation.isPending}
              className={`w-full ${!canSubmit && !mutation.isPending ? "opacity-50" : ""}`}
            >
              {mutation.isPending ? "Creating admin account..." : "Create Admin Account"}
            </Button>
          </form>
        </div>
      </div>

      <div className="hidden md:block w-1/2 overflow-hidden">
        <AsciiArtAnimation />
      </div>
    </div>
  );
}
