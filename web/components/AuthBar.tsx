"use client";

import { useState, type FormEvent } from "react";
import { useSupabase } from "@/lib/browser";

export function AuthBar() {
  const { supabase, session } = useSupabase();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (session) {
    return (
      <span className="auth">
        <span className="muted">{session.user.email}</span>
        <button className="link" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </span>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else setOpen(false);
  };

  return (
    <span className="auth">
      <button className="link" onClick={() => setOpen((o) => !o)}>
        Sign in
      </button>
      {open ? (
        <form className="popover" onSubmit={submit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">Sign in</button>
        </form>
      ) : null}
    </span>
  );
}
