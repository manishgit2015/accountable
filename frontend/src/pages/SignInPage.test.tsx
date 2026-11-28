import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setSession } from "../lib/session";
import { fakeSession } from "../test/session";
import { SIGN_IN_MESSAGES, SignInPage } from "./SignInPage";

function signedOut() {
  const current = fakeSession({ status: "signed-out", token: null });
  setSession(current);
  return current;
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("the sign-in screen (R100, R103, R104)", () => {
  it("R100 R104 asks for an email and a password, with one button and no sign-up or reset", () => {
    signedOut();
    render(<SignInPage />);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByText(/sign up|forgot|reset|magic link/i)).not.toBeInTheDocument();
    expect(screen.getByText(SIGN_IN_MESSAGES.help)).toBeInTheDocument();
    expect(screen.getByText("Your sales, in one place.")).toBeInTheDocument();
  });

  it("R102 signs in with the email, trimmed, and the password as typed", async () => {
    const current = signedOut();
    render(<SignInPage />);
    fill("  priya@example.com ", " pw ");
    await waitFor(() => expect(current.signIn).toHaveBeenCalledWith("priya@example.com", " pw "));
  });

  it("R103 wrong details: the message, the email kept and the password cleared", async () => {
    const current = signedOut();
    current.signIn.mockResolvedValueOnce("wrong");
    render(<SignInPage />);
    fill("priya@example.com", "nope");
    expect(await screen.findByRole("alert")).toHaveTextContent(SIGN_IN_MESSAGES.wrong);
    expect(screen.getByLabelText("Email")).toHaveValue("priya@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("R103 can't reach the sign-in service", async () => {
    const current = signedOut();
    current.signIn.mockResolvedValueOnce("unreachable");
    render(<SignInPage />);
    fill("priya@example.com", "pw");
    expect(await screen.findByRole("alert")).toHaveTextContent(SIGN_IN_MESSAGES.unreachable);
  });

  it("R108 says the session has ended, until the next try", async () => {
    const current = signedOut();
    current.signIn.mockResolvedValueOnce("wrong");
    render(<SignInPage ended />);
    expect(screen.getByRole("status")).toHaveTextContent("Your session has ended. Sign in again.");
    fill("priya@example.com", "nope");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("the button can't be pressed twice while signing in", async () => {
    const current = signedOut();
    let finish: (value: "wrong") => void = () => undefined;
    current.signIn.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    render(<SignInPage />);
    fill("priya@example.com", "pw");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    finish("wrong");
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled());
  });
});
