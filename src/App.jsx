import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { Plus, Trash2, Flame, Scale, ChefHat, CalendarDays, User, X, Check, TrendingDown, Utensils, BookmarkPlus, BookmarkCheck, ArrowRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from "recharts";
import { BUILTIN_INGREDIENTS } from "./ingredientsData";
import { supabase } from "./supabaseClient";
import AuthScreen from "./AuthScreen";
import { translate, LANGUAGES } from "./i18n";
import { BUILTIN_RECIPES, QUICK_FOODS } from "./builtinRecipes";

// Import your custom app logo asset
import logoIcon from "./assets/NutriNotesGood.png";

// ---------- design tokens ----------
const C = {
  page: "#EFE7D6",
  card: "#FBF8F0",
  cardAlt: "#F4EEDD",
  ink: "#2B2620",
  muted: "#8A8270",
  line: "#D8CFB8",
  lineStrong: "#2B2620",
  rust: "#B23A0E",
  rustDark: "#8f2f0b",
  sage: "#8A9A5B",
  sageDark: "#5f6c3e",
  amber: "#C1861F",
  amberDark: "#8f6416",
  teal: "#3F7D75",
  tealDark: "#2c5951",
  blue: "#3B6EA5",
  blueDark: "#2b527c",
  plum: "#8B4F6B",
  plumDark: "#653a4d",
};
const serif = "'Fraunces', serif";
const sans = "'Inter', sans-serif";
const mono = "'IBM Plex Mono', monospace";
const MACRO_COLORS = { protein: C.rust, carbs: C.amber, fat: C.teal };
const MEAL_COLORS = { breakfast: C.amber, lunch: C.sage, dinner: C.rust, snack: C.teal };
const TAB_COLORS = { dashboard: C.rust, recipes: C.amber, log: C.teal, weight: C.blue, plan: C.sage, profile: C.plum };
const TAB_WASH = {
  dashboard: "#F3E3D6",
  recipes: "#F5E7CE",
  log: "#E7EEE9",
  weight: "#E5EAF0",
  plan: "#EDEFDF",
  profile: "#EEE2E8",
};

// ---------- constants ----------
const ACTIVITY = [
  { id: "sedentary", label: "Sedentary", sub: "little/no exercise", mult: 1.2 },
  { id: "light", label: "Light", sub: "1–3 days/week", mult: 1.375 },
  { id: "moderate", label: "Moderate", sub: "3–5 days/week", mult: 1.55 },
  { id: "active", label: "Active", sub: "6–7 days/week", mult: 1.725 },
  { id: "veryactive", label: "Very active", sub: "physical job + training", mult: 1.9 },
];
const KCAL_PER_KG_FAT = 7700;
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (n, d = 0) => (isFinite(n) ? n.toFixed(d) : "—");

function calcBMR(p) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}
function calcTargets(p) {
  const bmr = calcBMR(p);
  const mult = ACTIVITY.find((a) => a.id === p.activity)?.mult ?? 1.2;
  const tdee = bmr * mult;
  const dailyDeficit = (p.goalRateKgWeek * KCAL_PER_KG_FAT) / 7;
  let target = tdee - dailyDeficit;
  const safetyFloor = p.sex === "male" ? 1500 : 1200;
  const clamped = Math.max(target, safetyFloor);
  const proteinG = 1.8 * p.weightKg;
  const fatKcal = clamped * 0.28;
  const fatG = fatKcal / 9;
  const proteinKcal = proteinG * 4;
  const carbsKcal = Math.max(clamped - proteinKcal - fatKcal, 0);
  const carbsG = carbsKcal / 4;
  const weeksToGoal = p.goalRateKgWeek > 0 ? Math.abs(p.weightKg - p.targetWeightKg) / p.goalRateKgWeek : null;
  return { bmr, tdee, target: clamped, unclamped: target, wasFloored: target < safetyFloor, proteinG, fatG, carbsG, weeksToGoal };
}

// ---------- UI atoms ----------
function Tab({ active, onClick, icon: Icon, children, color = C.rust }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 border-b-2 text-[13px] sm:text-sm tracking-wide transition-colors whitespace-nowrap shrink-0 ${
        active ? "text-[#2B2620]" : "border-transparent text-[#8A8270] hover:text-[#2B2620]"
      }`}
      style={{ fontFamily: sans, borderBottomColor: active ? color : "transparent" }}
    >
      <Icon size={16} strokeWidth={2} style={{ color: active ? color : undefined }} />
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

function LanguageSwitcher({ language, setLanguage, className = "" }) {
  return (
    <div className={`flex border border-[#2B2620] overflow-hidden ${className}`}>
      {LANGUAGES.map((l, i) => (
        <button
          key={l.code}
          onClick={() => setLanguage(l.code)}
          className={`px-2 py-1 text-[11px] font-medium tracking-wide transition-colors ${i > 0 ? "border-l border-[#2B2620]" : ""}`}
          style={{
            fontFamily: sans,
            background: language === l.code ? C.ink : "#FFFDF7",
            color: language === l.code ? C.card : C.ink,
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, unit, accent, bar }) {
  return (
    <div className="flex flex-col border border-[#2B2620] px-3 py-2.5 bg-[#FBF8F0] min-w-0">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-[#8A8270] truncate" style={{ fontFamily: sans }}>
        {bar && <span className="w-2 h-2 shrink-0" style={{ background: bar }} />}
        {label}
      </span>
      <span className="text-lg sm:text-xl leading-tight truncate" style={{ fontFamily: mono, color: accent || C.ink }}>
        {value}
        {unit && <span className="text-xs ml-1 text-[#8A8270]">{unit}</span>}
      </span>
    </div>
  );
}

function Card({ children, className = "", accent, style }) {
  return (
    <div
      className={`bg-[#FBF8F0] border border-[#D8CFB8] ${className}`}
      style={{ ...(accent ? { borderTop: `4px solid ${accent}` } : {}), ...style }}
    >
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", color = C.rust, className = "", type = "button", disabled }) {
  const styles =
    variant === "primary"
      ? "text-[#FBF8F0] hover:brightness-90"
      : variant === "ghost"
      ? "bg-transparent text-[#2B2620] border border-[#2B2620] hover:bg-[#2B2620] hover:text-[#FBF8F0]"
      : "bg-transparent hover:underline";
  const inlineStyle = { fontFamily: sans };
  if (variant === "primary") inlineStyle.backgroundColor = color;
  if (variant === "text") inlineStyle.color = color;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-[38px] px-3 py-1.5 text-sm inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${styles} ${className}`}
      style={inlineStyle}
    >
      {children}
    </button>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="text-[11px] uppercase tracking-wide text-[#8A8270]" style={{ fontFamily: sans }}>
        {label}
      </span>
      {children}
    </label>
  );
}
const inputCls = "border border-[#D8CFB8] bg-[#FFFDF7] px-2 py-1.5 text-sm focus:outline-none focus:border-[#B23A0E] w-full min-h-[38px]";

// ---------- Nutrition label component ----------
function NutritionLabel({ kcal, protein, carbs, fat, servingLabel, t }) {
  const pKcal = protein * 4, cKcal = carbs * 4, fKcal = fat * 9;
  const totalKcal = pKcal + cKcal + fKcal;
  const seg = (v) => (totalKcal > 0 ? (v / totalKcal) * 100 : 0);
  return (
    <div className="border-[3px] border-[#2B2620] bg-[#FFFDF7] p-3 w-full max-w-[220px]" style={{ fontFamily: mono }}>
      <div className="text-[13px] font-bold border-b-[6px] border-[#2B2620] pb-1 mb-1" style={{ fontFamily: serif }}>
        {t("nutrition.title")}
      </div>
      <div className="text-[10px] text-[#8A8270] mb-1">{servingLabel || t("nutrition.perServing")}</div>
      <div className="flex justify-between items-baseline border-b border-[#2B2620] py-1">
        <span className="text-[12px]">{t("nutrition.calories")}</span>
        <span className="text-lg font-bold">{fmt(kcal)}</span>
      </div>
      {totalKcal > 0 && (
        <div className="flex h-[6px] w-full my-1.5 overflow-hidden">
          <div style={{ width: `${seg(pKcal)}%`, background: MACRO_COLORS.protein }} />
          <div style={{ width: `${seg(cKcal)}%`, background: MACRO_COLORS.carbs }} />
          <div style={{ width: `${seg(fKcal)}%`, background: MACRO_COLORS.fat }} />
        </div>
      )}
      {[
        [t("stat.protein"), protein, "g", MACRO_COLORS.protein],
        [t("stat.carbs"), carbs, "g", MACRO_COLORS.carbs],
        [t("stat.fat"), fat, "g", MACRO_COLORS.fat],
      ].map(([l, v, u, color]) => (
        <div key={l} className="flex justify-between items-center text-[11px] py-0.5 border-b border-dashed border-[#D8CFB8]">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 shrink-0" style={{ background: color }} />{l}</span>
          <span>{fmt(v)}{u}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Calorie ring ----------
function CalorieRing({ value, target, size = 152, t }) {
  const pct = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const over = target > 0 && value > target;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.line} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? C.rustDark : C.rust}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="butt"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontFamily: mono, fontSize: size * 0.17, color: C.ink, fontWeight: 600, lineHeight: 1 }}>{fmt(value)}</span>
        <span style={{ fontFamily: sans, fontSize: size * 0.075, color: C.muted, marginTop: 4 }}>{t("common.of")} {fmt(target)} kcal</span>
      </div>
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  // undefined = still checking for a session, null = logged out, object = logged in
  const [session, setSession] = useState(undefined);

  // UI language — a device-level preference, independent of the account
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem("nutrinotes_lang") || "en";
    } catch {
      return "en";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("nutrinotes_lang", language);
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  }, [language]);
  const t = useCallback((key, vars) => translate(language, key, vars), [language]);

  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [profile, setProfile] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [foodlog, setFoodlog] = useState({});
  const [weightlog, setWeightlog] = useState([]);
  const [logDate, setLogDate] = useState(todayStr());
  const [customIngredients, setCustomIngredients] = useState([]);

  // Track the Supabase auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        // signed out — clear local state so a different account starts clean
        setReady(false);
        setProfile(null);
        setRecipes([]);
        setFoodlog({});
        setWeightlog([]);
        setCustomIngredients([]);
        setTab("dashboard");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Load this user's data from Supabase once they're logged in
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_data")
        .select("data")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error("Failed to load your data:", error);
      const d = data?.data || {};
      setProfile(d.profile ?? null);
      setRecipes(d.recipes ?? []);
      setFoodlog(d.foodlog ?? {});
      setWeightlog(d.weightlog ?? []);
      setCustomIngredients(d.customIngredients ?? []);
      setReady(true);
      if (!d.profile) setTab("profile");
    })();
    return () => { cancelled = true; };
  }, [session]);

  // Save this user's data back to Supabase whenever it changes (debounced)
  useEffect(() => {
    if (!ready || !session) return;
    const payload = { profile, recipes, foodlog, weightlog, customIngredients };
    const saveTimer = setTimeout(() => {
      supabase
        .from("user_data")
        .upsert({ user_id: session.user.id, data: payload, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.error("Failed to save your data:", error); });
    }, 600);
    return () => clearTimeout(saveTimer);
  }, [profile, recipes, foodlog, weightlog, customIngredients, ready, session]);

  const allIngredients = useMemo(() => {
    const map = new Map();
    BUILTIN_INGREDIENTS.forEach((ing) => map.set(ing.name.toLowerCase(), ing));
    customIngredients.forEach((ing) => map.set(ing.name.toLowerCase(), ing));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [customIngredients]);

  const addCustomIngredient = useCallback((ing) => {
    if (!ing.name || !ing.name.trim()) return;
    setCustomIngredients((prev) => {
      const filtered = prev.filter((i) => i.name.toLowerCase() !== ing.name.toLowerCase());
      return [...filtered, { ...ing, name: ing.name.trim() }];
    });
  }, []);

  const targets = useMemo(() => (profile ? calcTargets(profile) : null), [profile]);
  const todaysEntries = foodlog[logDate] || [];
  const todaysTotals = useMemo(() => {
    return todaysEntries.reduce(
      (acc, e) => ({
        kcal: acc.kcal + e.kcal,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [todaysEntries]);

  const addLogEntry = useCallback((date, entry) => {
    setFoodlog((prev) => ({ ...prev, [date]: [...(prev[date] || []), { id: uid(), ...entry }] }));
  }, []);
  const removeLogEntry = useCallback((date, id) => {
    setFoodlog((prev) => ({ ...prev, [date]: (prev[date] || []).filter((e) => e.id !== id) }));
  }, []);

  // Still checking whether a session exists
  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EFE7D6] text-[#2B2620]" style={{ fontFamily: sans }}>
        {t("loading.checking")}
      </div>
    );
  }

  // Not logged in — show the login/register screen
  if (!session) {
    return <AuthScreen lang={language} setLang={setLanguage} />;
  }

  // Logged in, but this user's data hasn't loaded from Supabase yet
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EFE7D6] text-[#2B2620]" style={{ fontFamily: sans }}>
        {t("loading.ledger")}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-[#2B2620]"
      style={{
        fontFamily: sans,
        backgroundColor: TAB_WASH[tab],
        backgroundImage: "radial-gradient(rgba(43,38,32,0.05) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
        transition: "background-color 0.4s ease",
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-thumb { background: #D8CFB8; border-radius: 0; }
      `}</style>

      <header
        className="border-b-[3px] border-[#2B2620] px-4 sm:px-5 pt-5 sm:pt-6 pb-3"
        style={{ backgroundColor: TAB_WASH[tab], transition: "background-color 0.4s ease" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-1 border-2 border-[#2B2620] bg-[#FFFDF7] shadow-[2px_2px_0px_#2B2620] shrink-0">
              <img
                src={logoIcon}
                alt="NutriNotes Logo"
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl tracking-tight leading-none" style={{ fontFamily: serif, fontWeight: 700 }}>
                {t("app.title")}
              </h1>
              <p className="text-[11px] sm:text-xs text-[#8A8270] mt-1 tracking-wide">{t("header.tagline")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {profile && targets && (
              <div className="flex gap-1.5 items-center bg-[#FFFDF7] border border-[#2B2620] px-2.5 py-1">
                <Flame size={15} style={{ color: TAB_COLORS[tab] }} />
                <span style={{ fontFamily: mono }} className="text-xs sm:text-sm font-medium">
                  {fmt(targets.target)} {t("header.kcalPerDay")}
                </span>
              </div>
            )}
            <LanguageSwitcher language={language} setLanguage={setLanguage} />
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs underline text-[#8A8270] hover:text-[#2B2620] px-1"
              style={{ fontFamily: sans }}
            >
              {t("header.signOut")}
            </button>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto flex gap-0.5 mt-5 overflow-x-auto">
          <Tab active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={TrendingDown} color={TAB_COLORS.dashboard}>{t("nav.dashboard")}</Tab>
          <Tab active={tab === "recipes"} onClick={() => setTab("recipes")} icon={ChefHat} color={TAB_COLORS.recipes}>{t("nav.recipes")}</Tab>
          <Tab active={tab === "log"} onClick={() => setTab("log")} icon={Utensils} color={TAB_COLORS.log}>{t("nav.log")}</Tab>
          <Tab active={tab === "weight"} onClick={() => setTab("weight")} icon={Scale} color={TAB_COLORS.weight}>{t("nav.weight")}</Tab>
          <Tab active={tab === "plan"} onClick={() => setTab("plan")} icon={CalendarDays} color={TAB_COLORS.plan}>{t("nav.plan")}</Tab>
          <Tab active={tab === "profile"} onClick={() => setTab("profile")} icon={User} color={TAB_COLORS.profile}>{t("nav.profile")}</Tab>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-5 sm:py-6">
        {tab === "profile" && <ProfileTab profile={profile} setProfile={setProfile} targets={targets} t={t} />}
        {tab === "dashboard" && (
          <DashboardTab profile={profile} targets={targets} foodlog={foodlog} weightlog={weightlog} todaysTotals={todaysTotals} logDate={logDate} t={t} />
        )}
        {tab === "recipes" && (
          <RecipesTab recipes={recipes} setRecipes={setRecipes} allIngredients={allIngredients} addCustomIngredient={addCustomIngredient} t={t} />
        )}
        {tab === "log" && (
          <LogTab
            logDate={logDate}
            setLogDate={setLogDate}
            entries={todaysEntries}
            totals={todaysTotals}
            targets={targets}
            recipes={recipes}
            addLogEntry={addLogEntry}
            removeLogEntry={removeLogEntry}
            t={t}
            language={language}
          />
        )}
        {tab === "weight" && <WeightTab weightlog={weightlog} setWeightlog={setWeightlog} profile={profile} setProfile={setProfile} t={t} />}
        {tab === "plan" && <PlanTab recipes={recipes} targets={targets} t={t} />}
      </main>
      <footer className="text-center text-[10px] text-[#8A8270] pb-6 pt-2 px-4">
        {t("footer.disclaimer")}
      </footer>
    </div>
  );
}

// ---------- Profile Tab ----------
function ProfileTab({ profile, setProfile, targets, t }) {
  const [form, setForm] = useState(
    profile || {
      name: "",
      sex: "male",
      age: 25,
      heightCm: 175,
      weightKg: 75,
      targetWeightKg: 70,
      activity: "light",
      goalRateKgWeek: 0.5,
    }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.age > 0 && form.heightCm > 0 && form.weightKg > 0;
  const liveTargets = valid ? calcTargets(form) : null;

  return (
    <div className="grid lg:grid-cols-2 gap-5 sm:gap-6">
      <Card className="p-4 sm:p-5" accent={C.plum}>
        <h2 className="text-lg mb-4" style={{ fontFamily: serif, fontWeight: 600 }}>{t("profile.yourDetails")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("profile.name")} className="col-span-2 sm:col-span-1">
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Cosmin" />
          </Field>
          <Field label={t("profile.sex")} className="col-span-2 sm:col-span-1">
            <select className={inputCls} value={form.sex} onChange={(e) => set("sex", e.target.value)}>
              <option value="male">{t("profile.male")}</option>
              <option value="female">{t("profile.female")}</option>
            </select>
          </Field>
          <Field label={t("profile.age")}><input type="number" className={inputCls} value={form.age} onChange={(e) => set("age", +e.target.value)} /></Field>
          <Field label={t("profile.height")}><input type="number" className={inputCls} value={form.heightCm} onChange={(e) => set("heightCm", +e.target.value)} /></Field>
          <Field label={t("profile.currentWeight")}><input type="number" step="0.1" className={inputCls} value={form.weightKg} onChange={(e) => set("weightKg", +e.target.value)} /></Field>
          <Field label={t("profile.targetWeight")}><input type="number" step="0.1" className={inputCls} value={form.targetWeightKg} onChange={(e) => set("targetWeightKg", +e.target.value)} /></Field>
        </div>
        <div className="mt-3">
          <Field label={t("profile.activityLevel")}>
            <div className="grid gap-1.5 mt-1">
              {ACTIVITY.map((a) => (
                <button
                  key={a.id}
                  onClick={() => set("activity", a.id)}
                  className={`text-left px-3 py-2 min-h-[40px] border text-sm flex justify-between items-center gap-2 ${
                    form.activity === a.id ? "border-[#B23A0E] bg-[#F3E7D8]" : "border-[#D8CFB8]"
                  }`}
                >
                  <span className="truncate">{t(`activity.${a.id}`)} <span className="text-[#8A8270] text-xs">— {t(`activity.${a.id}.sub`)}</span></span>
                  {form.activity === a.id && <Check size={14} className="text-[#B23A0E] shrink-0" />}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-3">
          <Field label={t("profile.goalPaceLabel", { rate: fmt(form.goalRateKgWeek, 2) })}>
            <input type="range" min="0" max="1" step="0.05" value={form.goalRateKgWeek} onChange={(e) => set("goalRateKgWeek", +e.target.value)} className="w-full" />
          </Field>
          <p className="text-[11px] text-[#8A8270] mt-1">{t("profile.goalPaceHint")}</p>
        </div>
        <Button className="mt-4 w-full sm:w-auto" onClick={() => setProfile(form)} color={C.plum}>
          <Check size={14} /> {t("profile.saveProfile")}
        </Button>
      </Card>

      <Card className="p-4 sm:p-5" accent={C.plum}>
        <h2 className="text-lg mb-4" style={{ fontFamily: serif, fontWeight: 600 }}>{t("profile.yourTargets")}</h2>
        {liveTargets ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Stat label={t("stat.bmr")} value={fmt(liveTargets.bmr)} unit="kcal" bar={C.blue} />
              <Stat label={t("stat.tdee")} value={fmt(liveTargets.tdee)} unit="kcal" bar={C.teal} />
              <Stat label={t("stat.dailyTarget")} value={fmt(liveTargets.target)} unit="kcal" accent={C.rust} bar={C.rust} />
              <Stat label={t("stat.timeToGoal")} value={liveTargets.weeksToGoal ? fmt(liveTargets.weeksToGoal, 0) : "—"} unit={t("units.weeks")} bar={C.sage} />
            </div>
            {liveTargets.wasFloored && (
              <p className="text-[11px] text-[#B23A0E] border border-[#B23A0E] px-2 py-1.5">
                {t("profile.flooredWarning")}
              </p>
            )}
            <div className="flex justify-center sm:justify-start">
              <NutritionLabel kcal={liveTargets.target} protein={liveTargets.proteinG} carbs={liveTargets.carbsG} fat={liveTargets.fatG} servingLabel={t("nutrition.yourDailyTarget")} t={t} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#8A8270]">{t("profile.fillDetails")}</p>
        )}
      </Card>
    </div>
  );
}

// ---------- Recipes Tab ----------
function emptyIngredient() {
  return { id: uid(), name: "", grams: 100, kcal100: 0, protein100: 0, carbs100: 0, fat100: 0 };
}
function emptyRecipe() {
  return { id: uid(), name: "", cuisine: "", mealType: "dinner", servings: 2, ingredients: [emptyIngredient()] };
}
function isBuiltinRecipe(r) {
  return String(r.id).startsWith("builtin_");
}
// Editing a built-in recipe shouldn't modify the shared original —
// clone it with fresh ids so saving creates the user's own copy.
function cloneRecipe(r) {
  return { ...r, id: uid(), ingredients: r.ingredients.map((i) => ({ ...i, id: uid() })) };
}
function recipeTotals(recipe) {
  return recipe.ingredients.reduce(
    (acc, ing) => {
      const factor = ing.grams / 100;
      return {
        kcal: acc.kcal + ing.kcal100 * factor,
        protein: acc.protein + ing.protein100 * factor,
        carbs: acc.carbs + ing.carbs100 * factor,
        fat: acc.fat + ing.fat100 * factor,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
function perServing(recipe) {
  const t = recipeTotals(recipe);
  const s = recipe.servings || 1;
  return { kcal: t.kcal / s, protein: t.protein / s, carbs: t.carbs / s, fat: t.fat / s };
}

function RecipesTab({ recipes, setRecipes, allIngredients, addCustomIngredient, t }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("");

  const save = (r) => {
    setRecipes((prev) => {
      const exists = prev.some((p) => p.id === r.id);
      return exists ? prev.map((p) => (p.id === r.id ? r : p)) : [...prev, r];
    });
    setEditing(null);
  };
  const remove = (id) => setRecipes((prev) => prev.filter((p) => p.id !== id));
  const combined = [...BUILTIN_RECIPES, ...recipes];
  const filtered = combined.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()));

  if (editing) {
    return (
      <RecipeEditor recipe={editing} onSave={save} onCancel={() => setEditing(null)} allIngredients={allIngredients} addCustomIngredient={addCustomIngredient} t={t} />
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
        <input className={inputCls + " sm:max-w-xs"} placeholder={t("recipes.searchPlaceholder")} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <Button onClick={() => setEditing(emptyRecipe())} className="w-full sm:w-auto" color={C.amber}><Plus size={14} /> {t("recipes.newRecipe")}</Button>
      </div>
      {filtered.length === 0 && (
        <div className="border border-dashed border-[#D8CFB8] px-4 py-8 text-center">
          <ChefHat size={22} className="mx-auto text-[#8A8270] mb-2" />
          <p className="text-sm text-[#8A8270]">{recipes.length === 0 ? t("recipes.emptyBox") : t("recipes.noMatch")}</p>
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((r, idx) => {
          const ps = perServing(r);
          const builtin = isBuiltinRecipe(r);
          return (
            <Card key={r.id} className="p-4 pt-5 flex flex-col gap-2 relative" style={{ borderLeft: `4px solid ${C.amber}` }}>
              <div className="absolute top-0 left-0 right-0 flex justify-center gap-10 -translate-y-1/2">
                <span className="w-2 h-2 rounded-full bg-[#EFE7D6] border border-[#D8CFB8]" />
                <span className="w-2 h-2 rounded-full bg-[#EFE7D6] border border-[#D8CFB8]" />
              </div>
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] .text-[#8A8270]" style={{ fontFamily: mono }}>No. {String(idx + 1).padStart(3, "0")}</span>
                  <h3 className="text-base truncate" style={{ fontFamily: serif, fontWeight: 600 }}>{r.name || t("recipes.untitled")}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[11px] text-[#8A8270] uppercase tracking-wide truncate">{r.cuisine || "—"}</span>
                    <span
                      className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 shrink-0"
                      style={{ background: `${MEAL_COLORS[r.mealType]}20`, color: MEAL_COLORS[r.mealType] }}
                    >
                      {t(`meal.${r.mealType}`)}
                    </span>
                    {builtin && (
                      <span
                        className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 shrink-0"
                        style={{ background: `${C.ink}12`, color: C.muted, border: `1px solid ${C.line}` }}
                        title={t("recipes.builtinEditHint")}
                      >
                        {t("recipes.builtin")}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ fontFamily: mono }} className="text-sm text-[#B23A0E] shrink-0">{fmt(ps.kcal)} kcal</span>
              </div>
              <p className="text-[11px] text-[#8A8270]">{r.servings} {t("recipes.servings")} · {t("abbrev.protein")} {fmt(ps.protein)}g · {t("abbrev.carbs")} {fmt(ps.carbs)}g · {t("abbrev.fat")} {fmt(ps.fat)}g</p>
              <div className="flex gap-2 mt-1">
                <Button variant="ghost" onClick={() => setEditing(builtin ? cloneRecipe(r) : r)} className="flex-1 sm:flex-initial">{t("recipes.edit")}</Button>
                {!builtin && (
                  <Button variant="text" onClick={() => remove(r.id)}><Trash2 size={13} /> {t("recipes.delete")}</Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function IngredientRow({ ing, isKnown, savedFlash, onChange, onSave, onRemove, t }) {
  return (
    <>
      <div className="hidden sm:grid grid-cols-[2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_auto_auto] gap-2 items-center">
        <input className={inputCls} value={ing.name} onChange={(e) => onChange("name", e.target.value)} placeholder={t("editor.ingredientPlaceholderDesktop")} list="ingredient-options" />
        <input type="number" className={inputCls} value={ing.grams} onChange={(e) => onChange("grams", +e.target.value)} />
        <input type="number" className={inputCls} value={ing.kcal100} onChange={(e) => onChange("kcal100", +e.target.value)} />
        <input type="number" className={inputCls} value={ing.protein100} onChange={(e) => onChange("protein100", +e.target.value)} />
        <input type="number" className={inputCls} value={ing.carbs100} onChange={(e) => onChange("carbs100", +e.target.value)} />
        <input type="number" className={inputCls} value={ing.fat100} onChange={(e) => onChange("fat100", +e.target.value)} />
        <button
          onClick={onSave}
          disabled={!ing.name.trim()}
          className="text-[#8A8270] hover:text-[#B23A0E] disabled:opacity-30 p-1"
        >
          {savedFlash ? <BookmarkCheck size={16} className="text-[#8A9A5B]" /> : <BookmarkPlus size={16} />}
        </button>
        <button onClick={onRemove} className="text-[#8A8270] hover:text-[#B23A0E] p-1"><Trash2 size={16} /></button>
      </div>

      <div className="sm:hidden border border-[#D8CFB8] bg-[#FFFDF7] p-3 flex flex-col gap-2">
        <input className={inputCls} value={ing.name} onChange={(e) => onChange("name", e.target.value)} placeholder={t("editor.ingredientPlaceholderMobile")} list="ingredient-options" />
        <div className="grid grid-cols-2 gap-2">
          <Field label={t("editor.grams")}><input type="number" className={inputCls} value={ing.grams} onChange={(e) => onChange("grams", +e.target.value)} /></Field>
          <Field label={t("editor.kcal100")}><input type="number" className={inputCls} value={ing.kcal100} onChange={(e) => onChange("kcal100", +e.target.value)} /></Field>
          <Field label={t("editor.prot100")}><input type="number" className={inputCls} value={ing.protein100} onChange={(e) => onChange("protein100", +e.target.value)} /></Field>
          <Field label={t("editor.carb100")}><input type="number" className={inputCls} value={ing.carbs100} onChange={(e) => onChange("carbs100", +e.target.value)} /></Field>
          <Field label={t("editor.fat100")} className="col-span-2"><input type="number" className={inputCls} value={ing.fat100} onChange={(e) => onChange("fat100", +e.target.value)} /></Field>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" onClick={onSave} disabled={!ing.name.trim()} className="flex-1">
            {savedFlash ? <BookmarkCheck size={14} className="text-[#8A9A5B]" /> : <BookmarkPlus size={14} />}
            {savedFlash ? t("editor.saved") : t("editor.saveIngredient")}
          </Button>
          <Button variant="text" onClick={onRemove}><Trash2 size={13} /> {t("editor.remove")}</Button>
        </div>
      </div>
    </>
  );
}

function RecipeEditor({ recipe, onSave, onCancel, allIngredients, addCustomIngredient, t }) {
  const [r, setR] = useState(recipe);
  const [savedFlash, setSavedFlash] = useState(null);
  const set = (k, v) => setR((prev) => ({ ...prev, [k]: v }));

  const ingredientByName = useMemo(() => {
    const map = new Map();
    allIngredients.forEach((ing) => map.set(ing.name.toLowerCase(), ing));
    return map;
  }, [allIngredients]);

  const setIng = (id, k, v) =>
    setR((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) => {
        if (i.id !== id) return i;
        if (k === "name") {
          const match = ingredientByName.get(String(v).trim().toLowerCase());
          if (match) {
            return { ...i, name: v, kcal100: match.kcal100, protein100: match.protein100, carbs100: match.carbs100, fat100: match.fat100 };
          }
          return { ...i, name: v };
        }
        return { ...i, [k]: v };
      }),
    }));

  const addIng = () => setR((prev) => ({ ...prev, ingredients: [...prev.ingredients, emptyIngredient()] }));
  const removeIng = (id) => setR((prev) => ({ ...prev, ingredients: prev.ingredients.filter((i) => i.id !== id) }));

  const saveIngredientToLibrary = (ing) => {
    if (!ing.name.trim()) return;
    addCustomIngredient({ name: ing.name.trim(), kcal100: ing.kcal100, protein100: ing.protein100, carbs100: ing.carbs100, fat100: ing.fat100 });
    setSavedFlash(ing.id);
    setTimeout(() => setSavedFlash((cur) => (cur === ing.id ? null : cur)), 1500);
  };

  const totals = recipeTotals(r);
  const ps = perServing(r);

  return (
    <Card className="p-4 sm:p-5" accent={C.amber}>
      <datalist id="ingredient-options">
        {allIngredients.map((ing) => (<option key={ing.name} value={ing.name} />))}
      </datalist>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg" style={{ fontFamily: serif, fontWeight: 600 }}>{recipe.name ? t("editor.editRecipe") : t("editor.newRecipe")}</h2>
        <button onClick={onCancel} className="text-[#8A8270] hover:text-[#2B2620]"><X size={18} /></button>
      </div>
      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <Field label={t("editor.recipeName")} className="sm:col-span-2">
          <input className={inputCls} value={r.name} onChange={(e) => set("name", e.target.value)} placeholder={t("editor.recipeNamePlaceholder")} />
        </Field>
        <Field label={t("editor.cuisine")}>
          <input className={inputCls} value={r.cuisine} onChange={(e) => set("cuisine", e.target.value)} placeholder={t("editor.cuisinePlaceholder")} />
        </Field>
        <Field label={t("editor.mealCategory")}>
          <select className={inputCls} value={r.mealType} onChange={(e) => set("mealType", e.target.value)}>
            {MEAL_TYPES.map(m => <option key={m} value={m}>{t(`meal.${m}`)}</option>)}
          </select>
        </Field>
      </div>

      <div className="border-t border-[#D8CFB8] pt-3">
        <div className="hidden sm:grid grid-cols-[2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_auto_auto] gap-2 text-[10px] uppercase tracking-wider text-[#8A8270] mb-1 px-1">
          <span>{t("editor.ingredientName")}</span>
          <span>{t("editor.grams")}</span>
          <span>{t("editor.kcal100")}</span>
          <span>{t("editor.prot100")}</span>
          <span>{t("editor.carb100")}</span>
          <span>{t("editor.fat100")}</span>
          <span />
          <span />
        </div>
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {r.ingredients.map((ing) => (
            <IngredientRow
              key={ing.id}
              ing={ing}
              isKnown={ingredientByName.has(ing.name.trim().toLowerCase())}
              savedFlash={savedFlash === ing.id}
              onChange={(k, v) => setIng(ing.id, k, v)}
              onSave={() => saveIngredientToLibrary(ing)}
              onRemove={() => removeIng(ing.id)}
              t={t}
            />
          ))}
        </div>
        <Button variant="ghost" onClick={addIng} className="mt-3 w-full sm:w-auto"><Plus size={14} /> {t("editor.addIngredientLine")}</Button>
      </div>

      <div className="mt-5 border-t border-[#2B2620] pt-4 flex flex-col md:flex-row justify-between items-center md:items-start gap-4">
        <div className="flex flex-wrap gap-2 text-xs text-[#8A8270]">
          <div className="px-3 py-1.5 bg-[#F4EEDD] border border-[#D8CFB8]">{t("editor.total")}: {fmt(totals.kcal)} kcal · {t("abbrev.protein")} {fmt(totals.protein)}g · {t("abbrev.carbs")} {fmt(totals.carbs)}g · {t("abbrev.fat")} {fmt(totals.fat)}g</div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFDF7] border border-[#2B2620]">
            <Field label={t("editor.servingsCount")} className="flex-row items-center gap-2"><input type="number" min="1" className={inputCls + " w-16 min-h-[28px] py-0"} value={r.servings} onChange={(e) => set("servings", Math.max(1, +e.target.value))} /></Field>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <NutritionLabel kcal={ps.kcal} protein={ps.protein} carbs={ps.carbs} fat={ps.fat} servingLabel={t("editor.perServingLabel")} t={t} />
          <div className="flex flex-col gap-2">
            <Button onClick={() => onSave(r)} disabled={!r.name.trim() || r.ingredients.length === 0} color={C.amber}><Check size={14} /> {t("editor.saveRecipe")}</Button>
            <Button variant="ghost" onClick={onCancel}>{t("editor.cancel")}</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------- Dashboard Tab ----------
function DashboardTab({ profile, targets, foodlog, weightlog, todaysTotals, t }) {
  const recentWeight = useMemo(() => {
    if (!weightlog || weightlog.length === 0) return profile?.weightKg || 0;
    return [...weightlog].sort((a,b) => b.date.localeCompare(a.date))[0].weightKg;
  }, [weightlog, profile]);

  const chartData = useMemo(() => {
    const dates = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
    return dates.map(d => {
      const entries = foodlog[d] || [];
      const k = entries.reduce((s, e) => s + e.kcal, 0);
      return { day: d.slice(5), kcal: k };
    });
  }, [foodlog]);

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-3 gap-4 items-stretch">
        <Card className="p-4 flex flex-col items-center justify-center text-center" accent={C.rust}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A8270] mb-3">{t("dashboard.intakeProgress")}</h3>
          <CalorieRing value={todaysTotals.kcal} target={targets?.target || 2000} t={t} />
        </Card>
        <Card className="p-4 grid grid-cols-2 gap-2" accent={C.teal}>
          <div className="col-span-2 text-center border-b border-[#D8CFB8] pb-1 mb-1"><span className="text-xs uppercase tracking-wider text-[#8A8270]">{t("dashboard.macroBreakdown")}</span></div>
          <Stat label={t("stat.protein")} value={fmt(todaysTotals.protein)} unit={`/ ${fmt(targets?.proteinG || 130)}g`} bar={MACRO_COLORS.protein} />
          <Stat label={t("stat.carbs")} value={fmt(todaysTotals.carbs)} unit={`/ ${fmt(targets?.carbsG || 200)}g`} bar={MACRO_COLORS.carbs} />
          <Stat label={t("stat.fat")} value={fmt(todaysTotals.fat)} unit={`/ ${fmt(targets?.fatG || 65)}g`} bar={MACRO_COLORS.fat} />
          <Stat label={t("stat.currentWeight")} value={fmt(recentWeight, 1)} unit="kg" bar={C.blue} />
        </Card>
        <Card className="p-4 flex flex-col justify-between" accent={C.blue}>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A8270] mb-2">{t("dashboard.targetMetrics")}</h3>
            <p className="text-sm italic text-[#2B2620]">"{t("dashboard.quote")}"</p>
          </div>
          <div className="mt-4 space-y-1 text-xs border-t border-[#D8CFB8] pt-2">
            <div className="flex justify-between"><span>{t("dashboard.maintenanceTdee")}</span><span className="font-mono">{fmt(targets?.tdee || 2400)} kcal</span></div>
            <div className="flex justify-between"><span>{t("dashboard.activeDeficit")}</span><span className="font-mono">{targets ? fmt(targets.tdee - targets.target) : "0"} kcal</span></div>
            <div className="flex justify-between"><span>{t("dashboard.weeklyPace")}</span><span className="font-mono">{profile?.goalRateKgWeek || "0.0"} kg</span></div>
          </div>
        </Card>
      </div>

      <Card className="p-4" accent={C.lineStrong}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A8270] mb-3">{t("dashboard.past7days")}</h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D8CFB8" />
              <XAxis dataKey="day" stroke="#2B2620" style={{ fontSize: 11, fontFamily: mono }} />
              <YAxis stroke="#2B2620" style={{ fontSize: 11, fontFamily: mono }} />
              <Tooltip cursor={{ fill: 'rgba(43,38,32,0.04)' }} />
              <Bar dataKey="kcal" fill={C.rust}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={targets && entry.kcal > targets.target ? C.rustDark : C.rust} />
                ))}
              </Bar>
              {targets && <ReferenceLine y={targets.target} stroke={C.rustDark} strokeDasharray="5 5" label={{ value: t("common.target"), position: 'insideTopRight', fill: C.rustDark, fontSize: 10 }} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

// ---------- Food Log Tab ----------
function LogTab({ logDate, setLogDate, entries, totals, targets, recipes, addLogEntry, removeLogEntry, t, language }) {
  const [activeMeal, setActiveMeal] = useState("breakfast");
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [customKcal, setCustomKcal] = useState("");
  const [customName, setCustomName] = useState("");
  const [quickFoodId, setQuickFoodId] = useState("");
  const [quickFoodQty, setQuickFoodQty] = useState(1);

  const qfName = (qf) => qf.names[language] || qf.names.en;

  const handleAddQuickFood = () => {
    const qf = QUICK_FOODS.find((x) => x.id === quickFoodId);
    if (!qf) return;
    const q = +quickFoodQty || 1;
    addLogEntry(logDate, {
      name: q === 1 ? qfName(qf) : `${qfName(qf)} × ${q}`,
      mealType: activeMeal,
      kcal: qf.kcal * q,
      protein: qf.protein * q,
      carbs: qf.carbs * q,
      fat: qf.fat * q,
    });
    setQuickFoodId("");
    setQuickFoodQty(1);
  };

  const handleAddRecipe = () => {
    const rc = [...BUILTIN_RECIPES, ...recipes].find(r => r.id === selectedRecipeId);
    if (!rc) return;
    const ps = perServing(rc);
    addLogEntry(logDate, {
      name: rc.name,
      mealType: activeMeal,
      kcal: ps.kcal,
      protein: ps.protein,
      carbs: ps.carbs,
      fat: ps.fat
    });
    setSelectedRecipeId("");
  };

  const handleAddCustom = () => {
    if (!customName.trim() || !customKcal) return;
    addLogEntry(logDate, {
      name: customName.trim(),
      mealType: activeMeal,
      kcal: +customKcal,
      protein: 0,
      carbs: 0,
      fat: 0
    });
    setCustomKcal("");
    setCustomName("");
  };

  return (
    <div className="grid md:grid-cols-3 gap-5 items-start">
      <div className="space-y-4 md:col-span-2">
        <Card className="p-4" accent={C.teal}>
          <div className="flex gap-2 items-center mb-3">
            <Field label={t("log.targetDate")} className="flex-1">
              <input type="date" className={inputCls} value={logDate} onChange={(e) => setLogDate(e.target.value)} />
            </Field>
          </div>
          <div className="flex border-b border-[#D8CFB8] mb-3">
            {MEAL_TYPES.map(m => (
              <button key={m} onClick={() => setActiveMeal(m)} className={`flex-1 py-1.5 text-xs capitalize font-medium border-b-2 tracking-wide ${activeMeal === m ? "text-[#2B2620] border-[#2B2620]" : "text-[#8A8270] border-transparent"}`}>{t(`meal.${m}`)}</button>
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 items-end">
              <Field label={t("log.recipeLibrary")} className="flex-1">
                <select className={inputCls} value={selectedRecipeId} onChange={(e) => setSelectedRecipeId(e.target.value)}>
                  <option value="">{t("log.chooseRecipe")}</option>
                  <optgroup label={t("log.groupBuiltin")}>
                    {BUILTIN_RECIPES.map(r => <option key={r.id} value={r.id}>{r.name} ({fmt(perServing(r).kcal)} kcal)</option>)}
                  </optgroup>
                  {recipes.length > 0 && (
                    <optgroup label={t("log.groupMine")}>
                      {recipes.map(r => <option key={r.id} value={r.id}>{r.name} ({fmt(perServing(r).kcal)} kcal)</option>)}
                    </optgroup>
                  )}
                </select>
              </Field>
              <Button onClick={handleAddRecipe} disabled={!selectedRecipeId} color={C.teal} className="w-full sm:w-auto"><Plus size={14} /> {t("log.addLine")}</Button>
            </div>
            <div className="border-t border-dashed border-[#D8CFB8] pt-3 flex flex-col sm:flex-row gap-2 items-end">
              <Field label={t("log.quickFoods")} className="flex-1">
                <select className={inputCls} value={quickFoodId} onChange={(e) => setQuickFoodId(e.target.value)}>
                  <option value="">{t("log.chooseFood")}</option>
                  {QUICK_FOODS.map(qf => <option key={qf.id} value={qf.id}>{qfName(qf)} ({fmt(qf.kcal)} kcal)</option>)}
                </select>
              </Field>
              <Field label={t("log.quantity")} className="w-full sm:w-24">
                <input type="number" step="0.5" min="0.25" className={inputCls} value={quickFoodQty} onChange={(e) => setQuickFoodQty(e.target.value)} />
              </Field>
              <Button onClick={handleAddQuickFood} disabled={!quickFoodId} color={C.teal} className="w-full sm:w-auto"><Plus size={14} /> {t("log.add")}</Button>
            </div>
            <div className="border-t border-dashed border-[#D8CFB8] pt-3 flex flex-col sm:flex-row gap-2 items-end">
              <Field label={t("log.quickAdd")} className="flex-1">
                <input className={inputCls} placeholder={t("log.quickAddPlaceholder")} value={customName} onChange={(e) => setCustomName(e.target.value)} />
              </Field>
              <Field label={t("log.calories")} className="w-full sm:w-24">
                <input type="number" className={inputCls} placeholder="kcal" value={customKcal} onChange={(e) => setCustomKcal(e.target.value)} />
              </Field>
              <Button onClick={handleAddCustom} disabled={!customName.trim() || !customKcal} color={C.teal} className="w-full sm:w-auto">{t("log.add")}</Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#8A8270] mb-3">{t("log.todaysEntries")}</h3>
          {entries.length === 0 ? (
            <p className="text-sm text-center py-6 text-[#8A8270] border border-dashed border-[#D8CFB8]">{t("log.noEntries")}</p>
          ) : (
            <div className="divide-y divide-[#D8CFB8]">
              {entries.map(e => (
                <div key={e.id} className="py-2 flex justify-between items-center text-sm gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.name}</div>
                    <div className="text-[10px] uppercase text-[#8A8270] tracking-wide">{t(`meal.${e.mealType}`)}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-xs text-[#B23A0E]">{fmt(e.kcal)} kcal</span>
                    <button onClick={() => removeLogEntry(logDate, e.id)} className="text-[#8A8270] hover:text-[#B23A0E]"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div>
        <Card className="p-4 flex justify-center" accent={C.teal}>
          <NutritionLabel kcal={totals.kcal} protein={totals.protein} carbs={totals.carbs} fat={totals.fat} servingLabel={t("log.aggregate")} t={t} />
        </Card>
      </div>
    </div>
  );
}

// ---------- Weight Tab ----------
function WeightTab({ weightlog, setWeightlog, profile, setProfile, t }) {
  const [wInput, setWInput] = useState("");
  const [dInput, setDInput] = useState(todayStr());

  const addWeight = () => {
    if (!wInput || isNaN(+wInput)) return;
    setWeightlog(prev => {
      const filtered = prev.filter(w => w.date !== dInput);
      const next = [...filtered, { date: dInput, weightKg: +wInput }].sort((a,b) => a.date.localeCompare(b.date));
      // If this entry is the most recent one logged, treat it as your current
      // weight so BMR/TDEE targets on the Dashboard and Profile stay in sync.
      const isLatest = next[next.length - 1].date === dInput;
      if (isLatest && setProfile) {
        setProfile((p) => (p ? { ...p, weightKg: +wInput } : p));
      }
      return next;
    });
    setWInput("");
  };

  return (
    <div className="grid md:grid-cols-3 gap-5 items-start">
      <Card className="p-4" accent={C.blue}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#8A8270] mb-3">{t("weight.recordMetric")}</h3>
        <div className="space-y-3">
          <Field label={t("weight.logDate")}><input type="date" className={inputCls} value={dInput} onChange={(e) => setDInput(e.target.value)} /></Field>
          <Field label={t("weight.weightLedger")}><input type="number" step="0.1" className={inputCls} placeholder={t("weight.weightPlaceholder")} value={wInput} onChange={(e) => setWInput(e.target.value)} /></Field>
          <Button onClick={addWeight} disabled={!wInput} color={C.blue} className="w-full"><Check size={14} /> {t("weight.commitEntry")}</Button>
        </div>
      </Card>

      <Card className="p-4 md:col-span-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#8A8270] mb-3">{t("weight.historicalProgress")}</h3>
        {weightlog.length === 0 ? (
          <p className="text-sm text-center py-12 text-[#8A8270] border border-dashed border-[#D8CFB8]">{t("weight.noRecords")}</p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightlog} margin={{ top: 10, right: 15, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D8CFB8" />
                <XAxis dataKey="date" stroke="#2B2620" style={{ fontSize: 10, fontFamily: mono }} />
                <YAxis stroke="#2B2620" style={{ fontSize: 10, fontFamily: mono }} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip />
                {profile?.targetWeightKg && (
                  <ReferenceLine
                    y={profile.targetWeightKg}
                    stroke={C.sage}
                    strokeDasharray="5 5"
                    label={{ value: t("weight.goalLabel"), position: "insideTopRight", fill: C.sageDark, fontSize: 10 }}
                  />
                )}
                <Line type="monotone" dataKey="weightKg" stroke={C.blue} strokeWidth={2} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Plan Tab ----------
function PlanTab({ recipes, targets, t }) {
  const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  return (
    <Card className="p-4" accent={C.sage}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-[#8A8270] mb-2">{t("plan.manifest")}</h3>
      <p className="text-xs text-[#8A8270] mb-4">{t("plan.description", { target: targets ? fmt(targets.target) : "2000" })}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {dayKeys.map(dayKey => (
          <div key={dayKey} className="border border-[#D8CFB8] p-2.5 bg-[#FFFDF7] flex flex-col justify-between min-h-[100px]">
            <span className="text-xs font-bold uppercase tracking-wider border-b border-[#D8CFB8] pb-1 mb-1 block">{t(`day.${dayKey}`)}</span>
            <div className="text-[11px] text-[#8A8270] italic space-y-1">
              <div className="flex justify-between"><span>{t("plan.breakfastRow")}</span><span className="text-[#2B2620]">{t("plan.plannedValue")}</span></div>
              <div className="flex justify-between"><span>{t("plan.lunchRow")}</span><span className="text-[#2B2620]">{t("plan.plannedValue")}</span></div>
              <div className="flex justify-between"><span>{t("plan.dinnerRow")}</span><span className="text-[#2B2620]">{t("plan.plannedValue")}</span></div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}