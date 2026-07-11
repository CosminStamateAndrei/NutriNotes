import { useState } from "react";
import { supabase } from "./supabaseClient";
import { translate } from "./i18n";

const ink = "#2B2620";
const muted = "#8A8270";
const line = "#D8CFB8";
const card = "#FBF8F0";
const page = "#EFE7D6";
const rust = "#B23A0E";
const sage = "#5f6c3e";
const serif = "'Fraunces', serif";
const sans = "'Inter', sans-serif";

export default function ResetPasswordScreen({ lang = "en", onDone, onCancel }) {
  const t = (key, vars) => translate(lang, key, vars);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
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
          {t("app.title")}
        </h1>
        <p className="text-xs mb-6" style={{ color: muted }}>
          {t("auth.setNewPasswordTitle")}
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[11px] uppercase tracking-wide" style={{ color: muted }}>{t("auth.newPassword")}</span>
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[11px] uppercase tracking-wide" style={{ color: muted }}>{t("auth.confirmPassword")}</span>
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="border px-2 py-2 text-sm focus:outline-none"
              style={{ borderColor: line, background: "#FFFDF7" }}
            />
          </label>

          {error && <p className="text-xs" style={{ color: rust }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-2.5 text-sm font-medium disabled:opacity-50 transition"
            style={{ background: rust, color: card }}
          >
            {loading ? t("auth.pleaseWait") : t("auth.updatePassword")}
          </button>
        </form>

        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-4 text-xs underline"
            style={{ color: muted }}
          >
            {t("auth.backToSignIn")}
          </button>
        )}
      </div>
    </div>
  );
}