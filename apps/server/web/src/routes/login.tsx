import { Link, useNavigate } from "@tanstack/react-router";
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

export function LoginPage() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
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
        setSetupRequired(status.setupRequired);
        if (session.authenticated) {
          void navigate({ to: redirectPath() });
        }
      } catch (error) {
        if (!cancelled) {
          setError(errorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
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
    setSubmitting(true);
    setError(undefined);
    try {
      await api.auth.login({ password });
      await navigate({ to: redirectPath() });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <AuthLayout title="Loading rho" description="Checking this workspace." />
    );
  }

  return (
    <AuthLayout
      title="Log in to rho"
      description="Use the owner password for this workspace."
    >
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Field label="Password">
          <Input
            autoComplete="current-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </Field>
        <AuthError message={error} />
        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
      {setupRequired ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Need to claim this deployment?{" "}
          <Link
            className="font-medium text-foreground underline underline-offset-4"
            search={{ redirect: redirectPath() }}
            to="/setup"
          >
            Go to setup
          </Link>
        </p>
      ) : null}
    </AuthLayout>
  );
}
