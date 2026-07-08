import { useState } from "react";
import { supabase } from "./supabaseClient";

const ink = "#2B2620";
const muted = "#8A8270";
const line = "#D8CFB8";
const card = "#FBF8F0";
const page = "#EFE7D6";
const rust = "#B23A0E";
const sage = "#5f6c3e";
const serif = "'Fraunces', serif";
const sans = "'Inter', sans-serif";

export default function AuthScreen() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Account created — check your email to confirm it, then sign in below.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: page, fontFamily: sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;500;600&display=swap');
      `}</style>
      <div className="w-full max-w-sm border-[3px] p-6" style={{ borderColor: ink, background: card }}>
        <h1 className="text-2xl mb-1" style={{ fontFamily: serif, fontWeight: 700, color: ink }}>
          NutriNotes
        </h1>
        <p className="text-xs mb-6" style={{ color: muted }}>
          {mode === "signin" ? "Sign in to your ledger" : "Create your ledger account"}
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[11px] uppercase tracking-wide" style={{ color: muted }}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border px-2 py-2 text-sm focus:outline-none"
              style={{ borderColor: line, background: "#FFFDF7" }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[11px] uppercase tracking-wide" style={{ color: muted }}>Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border px-2 py-2 text-sm focus:outline-none"
              style={{ borderColor: line, background: "#FFFDF7" }}
            />
          </label>

          {error && <p className="text-xs" style={{ color: rust }}>{error}</p>}
          {info && <p className="text-xs" style={{ color: sage }}>{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-2.5 text-sm font-medium disabled:opacity-50 transition"
            style={{ background: rust, color: card }}
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setInfo("");
          }}
          className="mt-4 text-xs underline"
          style={{ color: muted }}
        >
          {mode === "signin" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}