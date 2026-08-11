import { supabase } from "../lib/supabase";

export const signUp = async (email, password, fullName = "") => {
  // Point the confirmation link in Supabase's verification email at the
  // frontend the user is actually on: window.location.origin is the
  // deployed Vercel frontend in production and localhost in local dev —
  // never a hardcoded URL, and never the backend's origin. The origin
  // must be present in Supabase Auth -> URL Configuration -> Redirect
  // URLs for the override to be honoured.
  const emailRedirectTo = `${window.location.origin}/login?confirmed=true`;

  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo,
    },
  });
};

export const signIn = async (email, password) => {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
};

export const signOut = async () => {
  return await supabase.auth.signOut();
};

export const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
};