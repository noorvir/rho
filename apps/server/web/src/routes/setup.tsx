import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AuthError,
  AuthLayout,
  errorMessage,
  Field,
  redirectPath,
} from "../auth.tsx";
import { api } from "../api.ts";

export function SetupPage() {
  const navigate = useNavigate();
  const [ownerToken, setOwnerToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>();
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [status, session] = await Promise.all([
          api.auth.status(),
          api.auth.session(),
        ]);
        if (cancelled) {
          return;
        }
        if (session.authenticated) {
          void navigate({ to: redirectPath() });
          return;
        }
        if (!status.setupRequired) {
          void navigate({ to: "/login" });
          return;
        }
      } catch (error) {
        if (!cancelled) {
          setError(errorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setCheckingSetup(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      await api.auth.setup({ ownerToken, password });
      await navigate({ to: redirectPath() });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSetup) {
    return (
      <AuthLayout title="Loading rho" description="Checking this workspace." />
    );
  }

  return (
    <AuthLayout
      title="Set up rho"
      description="Enter the deployment root secret once, then choose the owner password you will use for future browser logins."
    >
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Field label="Root secret">
          <Input
            autoComplete="off"
            name="ownerToken"
            onChange={(event) => setOwnerToken(event.target.value)}
            required
            type="password"
            value={ownerToken}
          />
        </Field>
        <Field label="New password">
          <Input
            autoComplete="new-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </Field>
        <Field label="Confirm password">
          <Input
            autoComplete="new-password"
            name="confirmPassword"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </Field>
        <AuthError message={error} />
        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? "Setting up…" : "Set password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
