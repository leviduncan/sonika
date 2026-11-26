"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/redirect";
import {
  clearRecoveryCookie,
  hasValidRecoveryCookie,
  setRecoveryCookie,
} from "@/lib/auth/recovery-cookie";

export type AuthState =
  | {
      error?: string;
      message?: string;
      /** Echoed back so the form keeps what the user typed. */
      email?: string;
      /** Set when the password changed but signing out other devices failed. */
      passwordUpdated?: boolean;
    }
  | undefined;

const SignupSchema = z.object({
  agencyName: z.string().trim().min(2, "Agency name must be at least 2 characters."),
  fullName: z.string().trim().min(1, "Please enter your name."),
  email: z.email("Please enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const LoginSchema = z.object({
  email: z.email("Please enter a valid email."),
  password: z.string().min(1, "Please enter your password."),
});

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = SignupSchema.safeParse({
    agencyName: formData.get("agencyName"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const { agencyName, fullName, email, password } = parsed.data;
  const supabase = await createClient();

  // agency_name + full_name ride along in user_metadata; the DB trigger
  // `handle_new_user` reads them to create the agency + owner profile.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { agency_name: agencyName, full_name: fullName } },
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: "Invalid email or password." };

  // A password sign-in is never a recovery: drop any leftover recovery proof.
  await clearRecoveryCookie();

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

const ForgotPasswordSchema = z.object({
  email: z.email("Please enter a valid email."),
});

const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match.",
  });

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rawEmail = formData.get("email");
  const parsed = ForgotPasswordSchema.safeParse({ email: rawEmail });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid email.",
      email: typeof rawEmail === "string" ? rawEmail : undefined,
    };
  }

  const { email } = parsed.data;
  const supabase = await createClient();
  // No redirectTo: the recovery template builds the link from the project's
  // Site URL ({{ .SiteURL }}), never from anything in this request.
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  // Every outcome (sent, unknown email, rate limited, send failure) gets the
  // same answer, so the form can't be used to probe for accounts. Real
  // failures are logged here only; the email itself is not logged.
  if (error) {
    console.error("[auth] resetPasswordForEmail failed:", {
      status: error.status,
      code: error.code,
      message: error.message,
    });
  }

  return {
    email,
    message:
      "If that email has a Sonika account, a reset link is on its way. It expires in 1 hour. Nothing after a few minutes? Check spam, then try again.",
  };
}

const RESET_LINK_EXPIRED = "/forgot-password?error=link_expired";

/**
 * Step two of the email link. The GET page at /auth/confirm only renders a
 * "Continue" button, so mail scanners that prefetch links can't burn the
 * single-use token; the token is verified here, on the POST. Server Actions
 * also reject cross-origin posts, so this can't be used for login CSRF.
 *
 * Only `recovery` tokens are accepted, and only `token_hash` links (the PKCE
 * `?code=` fallback is gone: it can't be restricted to recovery up front).
 */
export async function confirmRecovery(formData: FormData) {
  const tokenHash = formData.get("token_hash");
  const next = safeNext(formData.get("next"));
  if (typeof tokenHash !== "string" || !tokenHash) redirect(RESET_LINK_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  if (error || !data.user) {
    if (error && error.code !== "otp_expired") {
      console.error("[auth] recovery verifyOtp failed:", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
    }
    redirect(RESET_LINK_EXPIRED);
  }

  if (!(await setRecoveryCookie(data.user.id))) {
    // No signing key configured: don't leave a session that can't reset.
    await supabase.auth.signOut({ scope: "local" });
    redirect("/forgot-password?error=reset_unavailable");
  }

  revalidatePath("/", "layout");
  redirect(next);
}

/** Supabase auth errors the reset form can hit, in words a user can act on. */
function friendlyResetError(error: AuthError): string {
  switch (error.code) {
    case "same_password":
      return "Choose a password you haven't used for this account.";
    case "weak_password":
      return "That password is too easy to guess. Try a longer one with a mix of words, numbers or symbols.";
    case "session_expired":
    case "session_not_found":
    case "refresh_token_not_found":
    case "reauthentication_needed":
      return "Your reset session has expired. Request a new link.";
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    default:
      return "We couldn't update your password. Try again in a minute.";
  }
}

const SIGN_OUT_OTHERS_FAILED =
  "Your password was updated, but we couldn't sign out your other devices. Try again below.";

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A session alone isn't enough: it must come from a recovery link opened in
  // this browser in the last 15 minutes (see recovery-cookie.ts).
  if (!user || !(await hasValidRecoveryCookie(user.id))) {
    return { error: "Your reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error("[auth] updateUser(password) failed:", {
      userId: user.id,
      status: error.status,
      code: error.code,
      message: error.message,
    });
    return { error: friendlyResetError(error) };
  }

  // Single use: the password is changed, the recovery proof is spent.
  await clearRecoveryCookie();

  // If someone else got in, a reset should lock them out.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) {
    console.error("[auth] signOut(others) after password reset failed:", {
      userId: user.id,
      status: signOutError.status,
      code: signOutError.code,
      message: signOutError.message,
    });
    return { passwordUpdated: true, error: SIGN_OUT_OTHERS_FAILED };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Retry for the "password updated, other devices still signed in" state. */
export async function signOutOtherDevices(): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    console.error("[auth] signOut(others) retry failed:", {
      userId: user.id,
      status: error.status,
      code: error.code,
      message: error.message,
    });
    return { passwordUpdated: true, error: SIGN_OUT_OTHERS_FAILED };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearRecoveryCookie();
  revalidatePath("/", "layout");
  redirect("/login");
}
