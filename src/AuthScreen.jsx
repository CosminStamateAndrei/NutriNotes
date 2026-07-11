import { useState } from "react";
import { supabase } from "./supabaseClient";
import { translate, LANGUAGES } from "./i18n";

const ink = "#2B2620";
const muted = "#8A8270";
const line = "#D8CFB8";
const card = "#FBF8F0";
const page = "#EFE7D6";
const rust = "#B23A0E";
const sage = "#5f6c3e";
const serif = "'Fraunces', serif";
const sans = "'Inter', sans-serif";

export default function AuthScreen({ lang = "en", setLang }) {
  const t = (key, vars) => translate(lang, key, vars);

  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const resetMessages = () => {
    setError("");
    setInfo("");
  };

  const submit = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setInfo(t("auth.resetEmailSent"));
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo(t("auth.accountCreatedInfo"));
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

  const title =
    mode === "forgot" ? t("auth.resetTitle") : mode === "signup" ? t("auth.signUpTitle") : t("auth.signInTitle");

  const submitLabel =
    mode === "forgot" ? t("auth.sendResetLink") : mode === "signup" ? t("auth.createAccount") : t("auth.signIn");

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: page, fontFamily: sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;500;600&display=swap');
      `}</style>
      <div className="w-full max-w-sm border-[3px] p-6" style={{ borderColor: ink, background: card }}>
        <div className="flex justify-between items-start mb-1">
          <h1 className="text-2xl" style={{ fontFamily: serif, fontWeight: 700, color: ink }}>
            {t("app.title")}
          </h1>
          {setLang && (
            <div className="flex border overflow-hidden shrink-0" style={{ borderColor: ink }}>
              {LANGUAGES.map((l, i) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLang(l.code)}
                  className={`px-2 py-1 text-[11px] font-medium tracking-wide ${i > 0 ? "border-l" : ""}`}
                  style={{
                    fontFamily: sans,
                    borderColor: ink,
                    background: lang === l.code ? ink : "#FFFDF7",
                    color: lang === l.code ? card : ink,
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs mb-6" style={{ color: muted }}>
          {title}
        </p>

        {mode === "forgot" && (
          <p className="text-xs mb-4" style={{ color: muted }}>
            {t("auth.resetInstructions")}
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[11px] uppercase tracking-wide" style={{ color: muted }}>{t("auth.email")}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border px-2 py-2 text-sm focus:outline-none"
              style={{ borderColor: line, background: "#FFFDF7" }}
            />
          </label>

          {mode !== "forgot" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[11px] uppercase tracking-wide" style={{ color: muted }}>{t("auth.password")}</span>
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
          )}

          {mode === "signin" && (
            <button
              type="button"
              onClick={() => {
                resetMessages();
                setMode("forgot");
              }}
              className="text-left text-xs underline -mt-1"
              style={{ color: muted }}
            >
              {t("auth.forgotPassword")}
            </button>
          )}

          {error && <p className="text-xs" style={{ color: rust }}>{error}</p>}
          {info && <p className="text-xs" style={{ color: sage }}>{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-2.5 text-sm font-medium disabled:opacity-50 transition"
            style={{ background: rust, color: card }}
          >
            {loading ? t("auth.pleaseWait") : submitLabel}
          </button>
        </form>

        {mode === "forgot" ? (
          <button
            onClick={() => {
              resetMessages();
              setMode("signin");
            }}
            className="mt-4 text-xs underline"
            style={{ color: muted }}
          >
            {t("auth.backToSignIn")}
          </button>
        ) : (
          <button
            onClick={() => {
              resetMessages();
              setMode(mode === "signin" ? "signup" : "signin");
            }}
            className="mt-4 text-xs underline"
            style={{ color: muted }}
          >
            {mode === "signin" ? t("auth.needAccount") : t("auth.haveAccount")}
          </button>
        )}
      </div>
    </div>
  );
}