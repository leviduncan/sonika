"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import * as z from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | undefined;

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

/**
 * Origin the reset link should point back to. Prefer the request's own origin
 * (Next verifies it matches the host for Server Actions) so previews and local
 * ports work; Supabase still allow-lists the final redirect URL.
 */
async function appOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = ForgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }

  const supabase = await createClient();
  // Supabase returns success for unknown emails too, so the response never
  // reveals whether an account exists. Any error here is a real failure.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await appOrigin()}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    if (error.status === 429) {
      return { error: "Too many reset requests. Wait a minute and try again." };
    }
    console.error("[auth] resetPasswordForEmail failed:", error.message);
    return { error: "We couldn't send the reset email. Try again in a minute." };
  }

  return {
    message: "If that email has a Sonika account, a reset link is on its way. It expires in 1 hour.",
  };
}

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
  if (!user) {
    return { error: "Your reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { error: "Choose a password you haven't used for this account." };
    }
    return { error: error.message };
  }

  // Kill any other sessions: if someone else got in, a reset should lock them out.
  await supabase.auth.signOut({ scope: "others" });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
