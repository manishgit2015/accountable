import { type FormEvent, useState } from "react";

import { Button } from "../components/Button";
import { session } from "../lib/session";

export const SIGN_IN_MESSAGES = {
  wrong: "Email or password is wrong. Check them and try again.",
  unreachable: "Couldn't reach the sign-in service. Check your internet connection and try again.",
  ended: "Your session has ended. Sign in again.",
  help: "Ask whoever runs Accountable for your team to add you.",
} as const;

/**
 * The sign-in screen (R100, R103, R104, R108, section 3.9 Sign-in screen). It's shown in place of whatever
 * page was asked for, so once the person signs in, that page appears (or the dashboard, for "/").
 * There's no sign-up, password reset or magic link (R104).
 */
export function SignInPage({ ended = false }: { ended?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    const result = await session().signIn(email.trim(), password);
    setBusy(false);
    if (result === "ok") return;
    setPassword(""); // R103: the email stays, the password is cleared
    setProblem(result === "wrong" ? SIGN_IN_MESSAGES.wrong : SIGN_IN_MESSAGES.unreachable);
  }

  return (
    <main className="sign-in">
      <div className="sign-in-panel">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          Accountable
        </div>
        <h1 className="sign-in-title">Sign in</h1>
        {ended && !problem && (
          <p className="sign-in-note" role="status">
            {SIGN_IN_MESSAGES.ended}
          </p>
        )}
        <form className="form" onSubmit={(event) => void submit(event)} noValidate>
          <div className="field">
            <label htmlFor="sign-in-email">Email</label>
            <input
              id="sign-in-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="sign-in-password">Password</label>
            <input
              id="sign-in-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <Button variant="primary" type="submit" className="sign-in-button" disabled={busy}>
            Sign in
          </Button>
          {problem && (
            <p className="field-error" role="alert">
              {problem}
            </p>
          )}
        </form>
        <p className="sign-in-help">{SIGN_IN_MESSAGES.help}</p>
      </div>
      <p className="sign-in-tagline">Your sales, in one place.</p>
    </main>
  );
}
