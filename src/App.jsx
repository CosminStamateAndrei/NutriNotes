import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { Plus, Trash2, Flame, Scale, ChefHat, CalendarDays, User, X, Check, TrendingDown, Utensils, BookmarkPlus, BookmarkCheck, ArrowRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from "recharts";
import { BUILTIN_INGREDIENTS } from "./ingredientsData";

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
// Each section of the app gets its own accent, like colored dividers in a recipe box.
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
const dateStr = (d) => d.toISOString().slice(0, 10);
const mondayOf = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};
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

// ---------- storage helpers (localStorage, synchronous) ----------
function loadKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveKey(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("storage save failed", key, e);
  }
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
const inputCls =
  "border border-[#D8CFB8] bg-[#FFFDF7] px-2 py-1.5 text-sm focus:outline-none focus:border-[#B23A0E] w-full min-h-[38px]";

// ---------- Nutrition label component (signature element) ----------
function NutritionLabel({ kcal, protein, carbs, fat, servingLabel }) {
  const pKcal = protein * 4, cKcal = carbs * 4, fKcal = fat * 9;
  const totalKcal = pKcal + cKcal + fKcal;
  const seg = (v) => (totalKcal > 0 ? (v / totalKcal) * 100 : 0);
  return (
    <div className="border-[3px] border-[#2B2620] bg-[#FFFDF7] p-3 w-full max-w-[220px]" style={{ fontFamily: mono }}>
      <div className="text-[13px] font-bold border-b-[6px] border-[#2B2620] pb-1 mb-1" style={{ fontFamily: serif }}>
        Nutrition
      </div>
      <div className="text-[10px] text-[#8A8270] mb-1">{servingLabel || "per serving"}</div>
      <div className="flex justify-between items-baseline border-b border-[#2B2620] py-1">
        <span className="text-[12px]">Calories</span>
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
        ["Protein", protein, "g", MACRO_COLORS.protein],
        ["Carbs", carbs, "g", MACRO_COLORS.carbs],
        ["Fat", fat, "g", MACRO_COLORS.fat],
      ].map(([l, v, u, color]) => (
        <div key={l} className="flex justify-between items-center text-[11px] py-0.5 border-b border-dashed border-[#D8CFB8]">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 shrink-0" style={{ background: color }} />{l}</span>
          <span>{fmt(v)}{u}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Calorie ring (dashboard signature element) ----------
function CalorieRing({ value, target, size = 152 }) {
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
        <span style={{ fontFamily: sans, fontSize: size * 0.075, color: C.muted, marginTop: 4 }}>of {fmt(target)} kcal</span>
      </div>
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [profile, setProfile] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [foodlog, setFoodlog] = useState({});
  const [weightlog, setWeightlog] = useState([]);
  const [logDate, setLogDate] = useState(todayStr());
  const [customIngredients, setCustomIngredients] = useState([]);

  useEffect(() => {
    const p = loadKey("profile", null);
    const r = loadKey("recipes", []);
    const f = loadKey("foodlog", {});
    const w = loadKey("weightlog", []);
    const ci = loadKey("customIngredients", []);
    setProfile(p);
    setRecipes(r);
    setFoodlog(f);
    setWeightlog(w);
    setCustomIngredients(ci);
    setReady(true);
    if (!p) setTab("profile");
  }, []);

  useEffect(() => { if (ready) saveKey("recipes", recipes); }, [recipes, ready]);
  useEffect(() => { if (ready) saveKey("foodlog", foodlog); }, [foodlog, ready]);
  useEffect(() => { if (ready) saveKey("weightlog", weightlog); }, [weightlog, ready]);
  useEffect(() => { if (ready && profile) saveKey("profile", profile); }, [profile, ready]);
  useEffect(() => { if (ready) saveKey("customIngredients", customIngredients); }, [customIngredients, ready]);

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

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EFE7D6] text-[#2B2620]" style={{ fontFamily: sans }}>
        Loading your ledger…
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
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 max-w-5xl mx-auto">
          <div>
            <h1 className="text-2xl sm:text-3xl" style={{ fontFamily: serif, fontWeight: 600 }}>
              NutriNotes
            </h1>
            <p className="text-[11px] sm:text-xs text-[#8A8270] mt-0.5 tracking-wide">A plan that fits your pan</p>
          </div>
          {profile && targets && (
            <div className="flex gap-1.5 items-center">
              <Flame size={15} style={{ color: TAB_COLORS[tab] }} />
              <span style={{ fontFamily: mono }} className="text-xs sm:text-sm">
                {fmt(targets.target)} kcal/day target
              </span>
            </div>
          )}
        </div>
        <nav className="max-w-5xl mx-auto flex gap-0.5 mt-4 overflow-x-auto">
          <Tab active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={TrendingDown} color={TAB_COLORS.dashboard}>Dashboard</Tab>
          <Tab active={tab === "recipes"} onClick={() => setTab("recipes")} icon={ChefHat} color={TAB_COLORS.recipes}>Recipes</Tab>
          <Tab active={tab === "log"} onClick={() => setTab("log")} icon={Utensils} color={TAB_COLORS.log}>Food Log</Tab>
          <Tab active={tab === "weight"} onClick={() => setTab("weight")} icon={Scale} color={TAB_COLORS.weight}>Weight</Tab>
          <Tab active={tab === "plan"} onClick={() => setTab("plan")} icon={CalendarDays} color={TAB_COLORS.plan}>Weekly Plan</Tab>
          <Tab active={tab === "profile"} onClick={() => setTab("profile")} icon={User} color={TAB_COLORS.profile}>Profile</Tab>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-5 sm:py-6">
        {tab === "profile" && <ProfileTab profile={profile} setProfile={setProfile} targets={targets} />}
        {tab === "dashboard" && (
          <DashboardTab profile={profile} targets={targets} foodlog={foodlog} weightlog={weightlog} todaysTotals={todaysTotals} logDate={logDate} />
        )}
        {tab === "recipes" && (
          <RecipesTab recipes={recipes} setRecipes={setRecipes} allIngredients={allIngredients} addCustomIngredient={addCustomIngredient} />
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
          />
        )}
        {tab === "weight" && <WeightTab weightlog={weightlog} setWeightlog={setWeightlog} profile={profile} />}
        {tab === "plan" && <PlanTab recipes={recipes} targets={targets} />}
      </main>
      <footer className="text-center text-[10px] text-[#8A8270] pb-6 pt-2 px-4">
        Not medical advice — for guidance on weight loss, talk with a doctor or dietitian.
      </footer>
    </div>
  );
}

// ---------- Profile Tab ----------
function ProfileTab({ profile, setProfile, targets }) {
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
        <h2 className="text-lg mb-4" style={{ fontFamily: serif, fontWeight: 600 }}>Your details</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2 sm:col-span-1">
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Cosmin" />
          </Field>
          <Field label="Sex (for BMR formula)" className="col-span-2 sm:col-span-1">
            <select className={inputCls} value={form.sex} onChange={(e) => set("sex", e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Age (years)"><input type="number" className={inputCls} value={form.age} onChange={(e) => set("age", +e.target.value)} /></Field>
          <Field label="Height (cm)"><input type="number" className={inputCls} value={form.heightCm} onChange={(e) => set("heightCm", +e.target.value)} /></Field>
          <Field label="Current weight (kg)"><input type="number" step="0.1" className={inputCls} value={form.weightKg} onChange={(e) => set("weightKg", +e.target.value)} /></Field>
          <Field label="Target weight (kg)"><input type="number" step="0.1" className={inputCls} value={form.targetWeightKg} onChange={(e) => set("targetWeightKg", +e.target.value)} /></Field>
        </div>
        <div className="mt-3">
          <Field label="Activity level">
            <div className="grid gap-1.5 mt-1">
              {ACTIVITY.map((a) => (
                <button
                  key={a.id}
                  onClick={() => set("activity", a.id)}
                  className={`text-left px-3 py-2 min-h-[40px] border text-sm flex justify-between items-center gap-2 ${
                    form.activity === a.id ? "border-[#B23A0E] bg-[#F3E7D8]" : "border-[#D8CFB8]"
                  }`}
                >
                  <span className="truncate">{a.label} <span className="text-[#8A8270] text-xs">— {a.sub}</span></span>
                  {form.activity === a.id && <Check size={14} className="text-[#B23A0E] shrink-0" />}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-3">
          <Field label={`Goal pace: ${fmt(form.goalRateKgWeek, 2)} kg/week`}>
            <input type="range" min="0" max="1" step="0.05" value={form.goalRateKgWeek} onChange={(e) => set("goalRateKgWeek", +e.target.value)} className="w-full" />
          </Field>
          <p className="text-[11px] text-[#8A8270] mt-1">0.25–0.75 kg/week is a commonly sustainable range.</p>
        </div>
        <Button className="mt-4 w-full sm:w-auto" onClick={() => setProfile(form)} color={C.plum}>
          <Check size={14} /> Save profile
        </Button>
      </Card>

      <Card className="p-4 sm:p-5" accent={C.plum}>
        <h2 className="text-lg mb-4" style={{ fontFamily: serif, fontWeight: 600 }}>Your daily targets</h2>
        {liveTargets ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="BMR" value={fmt(liveTargets.bmr)} unit="kcal" bar={C.blue} />
              <Stat label="Maintenance (TDEE)" value={fmt(liveTargets.tdee)} unit="kcal" bar={C.teal} />
              <Stat label="Daily target" value={fmt(liveTargets.target)} unit="kcal" accent={C.rust} bar={C.rust} />
              <Stat label="Est. time to goal" value={liveTargets.weeksToGoal ? fmt(liveTargets.weeksToGoal, 0) : "—"} unit="weeks" bar={C.sage} />
            </div>
            {liveTargets.wasFloored && (
              <p className="text-[11px] text-[#B23A0E] border border-[#B23A0E] px-2 py-1.5">
                Your requested pace would drop you below a safe minimum, so your target's been raised to a safer floor. Consider a slower pace instead.
              </p>
            )}
            <div className="flex justify-center sm:justify-start">
              <NutritionLabel kcal={liveTargets.target} protein={liveTargets.proteinG} carbs={liveTargets.carbsG} fat={liveTargets.fatG} servingLabel="your daily target" />
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#8A8270]">Fill in your details to see targets.</p>
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

function RecipesTab({ recipes, setRecipes, allIngredients, addCustomIngredient }) {
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

  const filtered = recipes.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()));

  if (editing) {
    return (
      <RecipeEditor recipe={editing} onSave={save} onCancel={() => setEditing(null)} allIngredients={allIngredients} addCustomIngredient={addCustomIngredient} />
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
        <input className={inputCls + " sm:max-w-xs"} placeholder="Search recipes…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <Button onClick={() => setEditing(emptyRecipe())} className="w-full sm:w-auto" color={C.amber}><Plus size={14} /> New recipe</Button>
      </div>
      {filtered.length === 0 && (
        <div className="border border-dashed border-[#D8CFB8] px-4 py-8 text-center">
          <ChefHat size={22} className="mx-auto text-[#8A8270] mb-2" />
          <p className="text-sm text-[#8A8270]">{recipes.length === 0 ? "Your recipe box is empty — add the first card." : "No recipes match that search."}</p>
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((r, idx) => {
          const ps = perServing(r);
          return (
            <Card key={r.id} className="p-4 pt-5 flex flex-col gap-2 relative" style={{ borderLeft: `4px solid ${C.amber}` }}>
              <div className="absolute top-0 left-0 right-0 flex justify-center gap-10 -translate-y-1/2">
                <span className="w-2 h-2 rounded-full bg-[#EFE7D6] border border-[#D8CFB8]" />
                <span className="w-2 h-2 rounded-full bg-[#EFE7D6] border border-[#D8CFB8]" />
              </div>
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-[#8A8270]" style={{ fontFamily: mono }}>No. {String(idx + 1).padStart(3, "0")}</span>
                  <h3 className="text-base truncate" style={{ fontFamily: serif, fontWeight: 600 }}>{r.name || "Untitled"}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-[#8A8270] uppercase tracking-wide truncate">{r.cuisine || "—"}</span>
                    <span
                      className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 shrink-0"
                      style={{ background: `${MEAL_COLORS[r.mealType]}20`, color: MEAL_COLORS[r.mealType] }}
                    >
                      {r.mealType}
                    </span>
                  </div>
                </div>
                <span style={{ fontFamily: mono }} className="text-sm text-[#B23A0E] shrink-0">{fmt(ps.kcal)} kcal</span>
              </div>
              <p className="text-[11px] text-[#8A8270]">{r.servings} servings · P {fmt(ps.protein)}g · C {fmt(ps.carbs)}g · F {fmt(ps.fat)}g</p>
              <div className="flex gap-2 mt-1">
                <Button variant="ghost" onClick={() => setEditing(r)} className="flex-1 sm:flex-initial">Edit</Button>
                <Button variant="text" onClick={() => remove(r.id)}><Trash2 size={13} /> Delete</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function IngredientRow({ ing, isKnown, savedFlash, onChange, onSave, onRemove }) {
  return (
    <>
      {/* Desktop / tablet row (>= sm) */}
      <div className="hidden sm:grid grid-cols-[2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_auto_auto] gap-2 items-center">
        <input className={inputCls} value={ing.name} onChange={(e) => onChange("name", e.target.value)} placeholder="e.g. chicken breast" list="ingredient-options" />
        <input type="number" className={inputCls} value={ing.grams} onChange={(e) => onChange("grams", +e.target.value)} />
        <input type="number" className={inputCls} value={ing.kcal100} onChange={(e) => onChange("kcal100", +e.target.value)} />
        <input type="number" className={inputCls} value={ing.protein100} onChange={(e) => onChange("protein100", +e.target.value)} />
        <input type="number" className={inputCls} value={ing.carbs100} onChange={(e) => onChange("carbs100", +e.target.value)} />
        <input type="number" className={inputCls} value={ing.fat100} onChange={(e) => onChange("fat100", +e.target.value)} />
        <button
          onClick={onSave}
          disabled={!ing.name.trim()}
          title={isKnown ? "Already in your ingredient library — click to update it" : "Save this ingredient for future use"}
          className="text-[#8A8270] hover:text-[#B23A0E] disabled:opacity-30 disabled:cursor-not-allowed p-1"
        >
          {savedFlash ? <BookmarkCheck size={16} className="text-[#8A9A5B]" /> : <BookmarkPlus size={16} />}
        </button>
        <button onClick={onRemove} className="text-[#8A8270] hover:text-[#B23A0E] p-1"><Trash2 size={16} /></button>
      </div>

      {/* Mobile stacked card (< sm) */}
      <div className="sm:hidden border border-[#D8CFB8] bg-[#FFFDF7] p-3 flex flex-col gap-2">
        <input className={inputCls} value={ing.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Ingredient name" list="ingredient-options" />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Grams"><input type="number" className={inputCls} value={ing.grams} onChange={(e) => onChange("grams", +e.target.value)} /></Field>
          <Field label="Kcal / 100g"><input type="number" className={inputCls} value={ing.kcal100} onChange={(e) => onChange("kcal100", +e.target.value)} /></Field>
          <Field label="Protein / 100g"><input type="number" className={inputCls} value={ing.protein100} onChange={(e) => onChange("protein100", +e.target.value)} /></Field>
          <Field label="Carbs / 100g"><input type="number" className={inputCls} value={ing.carbs100} onChange={(e) => onChange("carbs100", +e.target.value)} /></Field>
          <Field label="Fat / 100g" className="col-span-2"><input type="number" className={inputCls} value={ing.fat100} onChange={(e) => onChange("fat100", +e.target.value)} /></Field>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" onClick={onSave} disabled={!ing.name.trim()} className="flex-1">
            {savedFlash ? <BookmarkCheck size={14} className="text-[#8A9A5B]" /> : <BookmarkPlus size={14} />}
            {savedFlash ? "Saved" : "Save ingredient"}
          </Button>
          <Button variant="text" onClick={onRemove}><Trash2 size={13} /> Remove</Button>
        </div>
      </div>
    </>
  );
}

function RecipeEditor({ recipe, onSave, onCancel, allIngredients, addCustomIngredient }) {
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg" style={{ fontFamily: serif, fontWeight: 600 }}>{recipe.name ? "Edit recipe" : "New recipe"}</h2>
        <button onClick={onCancel} className="text-[#8A8270] hover:text-[#2B2620] p-1"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Field label="Name" className="col-span-2"><input className={inputCls} value={r.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Cuisine" className="col-span-2 sm:col-span-1"><input className={inputCls} value={r.cuisine} onChange={(e) => set("cuisine", e.target.value)} placeholder="Romanian, Japanese…" /></Field>
        <Field label="Meal type">
          <select className={inputCls} value={r.mealType} onChange={(e) => set("mealType", e.target.value)}>
            {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Servings" className="col-span-2 sm:col-span-1"><input type="number" min="1" className={inputCls} value={r.servings} onChange={(e) => set("servings", +e.target.value)} /></Field>
      </div>

      <h3 className="text-sm uppercase tracking-wide text-[#8A8270] mb-2">
        Ingredients — type a name to pull from {allIngredients.length}+ saved ingredients, or enter your own
      </h3>
      <datalist id="ingredient-options">
        {allIngredients.map((ing) => <option key={ing.name} value={ing.name} />)}
      </datalist>

      <div className="hidden sm:grid grid-cols-[2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_auto_auto] gap-2 text-[10px] uppercase text-[#8A8270] px-1 mb-1">
        <span>Name</span><span>Grams</span><span>Kcal/100g</span><span>Protein/100g</span><span>Carbs/100g</span><span>Fat/100g</span><span></span><span></span>
      </div>
      <div className="space-y-2 mb-3">
        {r.ingredients.map((ing) => (
          <IngredientRow
            key={ing.id}
            ing={ing}
            isKnown={ingredientByName.has(ing.name.trim().toLowerCase())}
            savedFlash={savedFlash === ing.id}
            onChange={(k, v) => setIng(ing.id, k, v)}
            onSave={() => saveIngredientToLibrary(ing)}
            onRemove={() => removeIng(ing.id)}
          />
        ))}
      </div>
      <Button variant="ghost" onClick={addIng} className="w-full sm:w-auto"><Plus size={13} /> Add ingredient</Button>

      <div className="flex flex-wrap gap-4 items-start sm:items-end mt-5 pt-4 border-t border-[#D8CFB8]">
        <NutritionLabel kcal={ps.kcal} protein={ps.protein} carbs={ps.carbs} fat={ps.fat} servingLabel={`per serving (of ${r.servings})`} />
        <div className="text-xs text-[#8A8270]">
          Recipe total: {fmt(totals.kcal)} kcal · P {fmt(totals.protein)}g · C {fmt(totals.carbs)}g · F {fmt(totals.fat)}g
        </div>
      </div>

      <div className="flex gap-2 mt-5">
        <Button onClick={() => onSave(r)} disabled={!r.name.trim()} className="flex-1 sm:flex-initial" color={C.amber}><Check size={14} /> Save recipe</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

// ---------- Log Tab ----------
function LogTab({ logDate, setLogDate, entries, totals, targets, recipes, addLogEntry, removeLogEntry }) {
  const [mode, setMode] = useState("recipe");
  const [recipeId, setRecipeId] = useState("");
  const [servings, setServings] = useState(1);
  const [custom, setCustom] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });

  const addFromRecipe = () => {
    const r = recipes.find((x) => x.id === recipeId);
    if (!r) return;
    const ps = perServing(r);
    addLogEntry(logDate, { source: "recipe", name: r.name, servings, kcal: ps.kcal * servings, protein: ps.protein * servings, carbs: ps.carbs * servings, fat: ps.fat * servings });
    setServings(1);
  };
  const addCustom = () => {
    if (!custom.name.trim()) return;
    addLogEntry(logDate, { source: "custom", name: custom.name, servings: 1, kcal: +custom.kcal || 0, protein: +custom.protein || 0, carbs: +custom.carbs || 0, fat: +custom.fat || 0 });
    setCustom({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
  };

  const pct = targets ? Math.min(100, (totals.kcal / targets.target) * 100) : 0;

  return (
    <div className="grid lg:grid-cols-3 gap-5 sm:gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center gap-3">
          <CalendarDays size={16} className="text-[#8A8270] shrink-0" />
          <input type="date" className={inputCls + " max-w-[200px]"} value={logDate} onChange={(e) => setLogDate(e.target.value)} />
        </div>

        <Card className="p-4" accent={C.teal}>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setMode("recipe")} className={`text-xs px-2 py-1.5 border`} style={{ borderColor: mode === "recipe" ? C.teal : C.line, color: mode === "recipe" ? C.teal : C.muted }}>From recipe</button>
            <button onClick={() => setMode("custom")} className={`text-xs px-2 py-1.5 border`} style={{ borderColor: mode === "custom" ? C.teal : C.line, color: mode === "custom" ? C.teal : C.muted }}>Custom entry</button>
          </div>
          {mode === "recipe" ? (
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-end">
              <Field label="Recipe" className="flex-1 min-w-[140px]">
                <select className={inputCls} value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
                  <option value="">Select…</option>
                  {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Servings" className="w-full sm:w-24">
                <input type="number" step="0.25" min="0.25" className={inputCls} value={servings} onChange={(e) => setServings(+e.target.value)} />
              </Field>
              <Button onClick={addFromRecipe} disabled={!recipeId} className="w-full sm:w-auto" color={C.teal}><Plus size={14} /> Add</Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-end">
              <Field label="Food" className="flex-1 min-w-[140px]"><input className={inputCls} value={custom.name} onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} /></Field>
              <div className="grid grid-cols-4 sm:flex gap-2">
                <Field label="Kcal" className="sm:w-16"><input type="number" className={inputCls} value={custom.kcal} onChange={(e) => setCustom((c) => ({ ...c, kcal: e.target.value }))} /></Field>
                <Field label="Protein" className="sm:w-16"><input type="number" className={inputCls} value={custom.protein} onChange={(e) => setCustom((c) => ({ ...c, protein: e.target.value }))} /></Field>
                <Field label="Carbs" className="sm:w-16"><input type="number" className={inputCls} value={custom.carbs} onChange={(e) => setCustom((c) => ({ ...c, carbs: e.target.value }))} /></Field>
                <Field label="Fat" className="sm:w-16"><input type="number" className={inputCls} value={custom.fat} onChange={(e) => setCustom((c) => ({ ...c, fat: e.target.value }))} /></Field>
              </div>
              <Button onClick={addCustom} className="w-full sm:w-auto" color={C.teal}><Plus size={14} /> Add</Button>
            </div>
          )}
        </Card>

        <Card className="p-4" accent={C.teal}>
          <h3 className="text-sm uppercase tracking-wide text-[#8A8270] mb-2">Today's entries</h3>
          {entries.length === 0 && <p className="text-sm text-[#8A8270]">Nothing logged yet — add a meal above to get started.</p>}
          <div className="divide-y divide-[#D8CFB8]">
            {entries.map((e) => (
              <div key={e.id} className="flex justify-between items-center gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <span className="truncate">{e.name}</span>
                  {e.source === "recipe" && <span className="text-[11px] text-[#8A8270]"> · {fmt(e.servings, 2)} serv.</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span style={{ fontFamily: mono }}>{fmt(e.kcal)} kcal</span>
                  <button onClick={() => removeLogEntry(logDate, e.id)} className="text-[#8A8270] hover:text-[#B23A0E] p-1"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex justify-center lg:justify-start">
          <NutritionLabel kcal={totals.kcal} protein={totals.protein} carbs={totals.carbs} fat={totals.fat} servingLabel="logged today" />
        </div>
        {targets && (
          <Card className="p-4" accent={C.teal}>
            <div className="flex justify-between text-xs mb-1">
              <span>{fmt(totals.kcal)} / {fmt(targets.target)} kcal</span>
              <span>{fmt(pct, 0)}%</span>
            </div>
            <div className="h-2 bg-[#EFE7D6] border border-[#D8CFB8]">
              <div className="h-full" style={{ width: `${pct}%`, background: C.teal }} />
            </div>
            <p className="text-[11px] text-[#8A8270] mt-2">{fmt(Math.max(targets.target - totals.kcal, 0))} kcal remaining today</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------- Weight Tab ----------
function WeightTab({ weightlog, setWeightlog, profile }) {
  const [entry, setEntry] = useState({ date: todayStr(), weightKg: profile?.weightKg || "" });
  const sorted = [...weightlog].sort((a, b) => a.date.localeCompare(b.date));
  const chartData = sorted.map((w) => ({ date: w.date.slice(5), weight: w.weightKg }));

  const add = () => {
    if (!entry.weightKg) return;
    setWeightlog((prev) => {
      const others = prev.filter((w) => w.date !== entry.date);
      return [...others, { date: entry.date, weightKg: +entry.weightKg }];
    });
  };
  const remove = (date) => setWeightlog((prev) => prev.filter((w) => w.date !== date));

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const change = first && last ? last.weightKg - first.weightKg : 0;

  return (
    <div className="grid lg:grid-cols-3 gap-5 sm:gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card className="p-4" accent={C.blue}>
          <h3 className="text-sm uppercase tracking-wide text-[#8A8270] mb-3">Weight over time</h3>
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid stroke="#D8CFB8" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8A8270" }} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#8A8270" }} unit="kg" width={50} />
                <Tooltip contentStyle={{ fontFamily: "IBM Plex Mono", fontSize: 12, background: "#FBF8F0", border: "1px solid #2B2620" }} />
                {profile?.targetWeightKg && <ReferenceLine y={profile.targetWeightKg} stroke="#8A9A5B" strokeDasharray="4 4" label={{ value: "target", fontSize: 10, fill: "#8A9A5B" }} />}
                <Line type="monotone" dataKey="weight" stroke={C.blue} strokeWidth={2} dot={{ r: 3, fill: C.blue }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[#8A8270]">Log at least two entries to see a trend.</p>
          )}
        </Card>
        <Card className="p-4" accent={C.blue}>
          <h3 className="text-sm uppercase tracking-wide text-[#8A8270] mb-2">Entries</h3>
          <div className="divide-y divide-[#D8CFB8] max-h-64 overflow-auto">
            {sorted.slice().reverse().map((w) => (
              <div key={w.date} className="flex justify-between py-1.5 text-sm">
                <span>{w.date}</span>
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: mono }}>{fmt(w.weightKg, 1)} kg</span>
                  <button onClick={() => remove(w.date)} className="text-[#8A8270] hover:text-[#B23A0E] p-1"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="p-4" accent={C.blue}>
          <h3 className="text-sm uppercase tracking-wide text-[#8A8270] mb-2">Log today's weight</h3>
          <div className="flex flex-col gap-2">
            <Field label="Date"><input type="date" className={inputCls} value={entry.date} onChange={(e) => setEntry((s) => ({ ...s, date: e.target.value }))} /></Field>
            <Field label="Weight (kg)"><input type="number" step="0.1" className={inputCls} value={entry.weightKg} onChange={(e) => setEntry((s) => ({ ...s, weightKg: e.target.value }))} /></Field>
            <Button onClick={add} className="w-full" color={C.blue}><Plus size={14} /> Log weight</Button>
          </div>
        </Card>
        {sorted.length >= 2 && (
          <Stat label={`Since ${first.date}`} value={`${change > 0 ? "+" : ""}${fmt(change, 1)}`} unit="kg" accent={change <= 0 ? C.sage : C.rust} bar={change <= 0 ? C.sage : C.rust} />
        )}
      </div>
    </div>
  );
}

// ---------- Weekly goal card ----------
function WeeklyGoalCard({ profile, targets, foodlog, weightlog }) {
  const monday = mondayOf(new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return dateStr(d);
  });
  const todayIdx = weekDates.indexOf(todayStr());
  const daysElapsed = todayIdx >= 0 ? todayIdx + 1 : 7;
  const daysRemaining = 7 - daysElapsed;
  const weeklyBudget = targets.target * 7;
  const weeklyLogged = weekDates.slice(0, daysElapsed).reduce((sum, d) => sum + (foodlog[d] || []).reduce((s, e) => s + e.kcal, 0), 0);
  const weeklyRemaining = Math.max(weeklyBudget - weeklyLogged, 0);
  const avgDaily = daysElapsed > 0 ? weeklyLogged / daysElapsed : 0;
  const onPace = avgDaily <= targets.target * 1.03;
  const weekPct = weeklyBudget > 0 ? Math.min(100, (weeklyLogged / weeklyBudget) * 100) : 0;

  const sortedW = [...weightlog].sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = sortedW[sortedW.length - 1]?.weightKg ?? profile.weightKg;
  const weekStart = sortedW.filter((w) => w.date <= weekDates[0]).slice(-1)[0];
  const direction = profile.targetWeightKg < latestWeight ? -1 : 1;
  const plannedWeeklyChange = direction * profile.goalRateKgWeek;
  const actualWeeklyChange = weekStart ? latestWeight - weekStart.weightKg : null;
  const actualOnTrack = actualWeeklyChange !== null && (direction < 0 ? actualWeeklyChange <= 0 : actualWeeklyChange >= 0);

  return (
    <Card className="p-4 sm:p-5" accent={C.rust}>
      <div className="flex items-center gap-1.5 mb-3">
        <CalendarDays size={14} className="text-[#8A8270]" />
        <h3 className="text-sm uppercase tracking-wide text-[#8A8270]">This week's goal · day {daysElapsed} of 7</h3>
      </div>
      <div className="space-y-1.5 mb-4">
        <div className="flex justify-between text-xs">
          <span>{fmt(weeklyLogged)} / {fmt(weeklyBudget)} kcal this week</span>
          <span>{fmt(weekPct, 0)}%</span>
        </div>
        <div className="h-2.5 bg-[#EFE7D6] border border-[#D8CFB8]">
          <div className="h-full" style={{ width: `${weekPct}%`, background: C.blue }} />
        </div>
        <p className="text-[11px] text-[#8A8270]">
          {fmt(weeklyRemaining)} kcal left across {daysRemaining} day{daysRemaining === 1 ? "" : "s"} · averaging {fmt(avgDaily)} kcal/day so far —{" "}
          <span style={{ color: onPace ? C.sage : C.rust }}>{onPace ? "on pace" : "above pace"}</span>
        </p>
      </div>
      <div className="border-t border-[#D8CFB8] pt-3">
        <p className="text-sm leading-relaxed">
          Aiming to <b>{direction < 0 ? "lose" : "gain"} {fmt(Math.abs(plannedWeeklyChange), 2)} kg</b> this week.{" "}
          {actualWeeklyChange !== null ? (
            <>
              So far you're{" "}
              <b style={{ color: actualOnTrack ? C.sage : C.rust }}>
                {actualWeeklyChange > 0 ? "+" : ""}{fmt(actualWeeklyChange, 2)} kg
              </b>{" "}
              since Monday.
            </>
          ) : (
            "Log a weigh-in to track this week's change."
          )}
        </p>
      </div>
    </Card>
  );
}

// ---------- Dashboard Tab ----------
function DashboardTab({ profile, targets, foodlog, weightlog, todaysTotals, logDate }) {
  if (!profile || !targets) {
    return (
      <div className="border border-dashed border-[#D8CFB8] px-4 py-10 text-center">
        <TrendingDown size={22} className="mx-auto text-[#8A8270] mb-2" />
        <p className="text-sm text-[#8A8270] mb-3">Set up your profile first to see your dashboard.</p>
      </div>
    );
  }
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const barData = last7.map((d) => {
    const entries = foodlog[d] || [];
    const kcal = entries.reduce((s, e) => s + e.kcal, 0);
    return { date: d.slice(5), kcal };
  });
  const sortedW = [...weightlog].sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = sortedW[sortedW.length - 1]?.weightKg ?? profile.weightKg;
  const remaining = latestWeight - profile.targetWeightKg;

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card className="p-4 sm:p-5" accent={C.rust}>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <CalorieRing value={todaysTotals.kcal} target={targets.target} />
          <div className="flex-1 w-full grid grid-cols-2 gap-3">
            <Stat label="Today logged" value={fmt(todaysTotals.kcal)} unit="kcal" bar={C.rust} />
            <Stat label="Remaining" value={fmt(Math.max(targets.target - todaysTotals.kcal, 0))} unit="kcal" accent={C.amberDark} bar={C.amber} />
            <Stat label="Current weight" value={fmt(latestWeight, 1)} unit="kg" bar={C.blue} />
            <Stat label="To goal" value={fmt(Math.abs(remaining), 1)} unit="kg" accent={C.sageDark} bar={C.sage} />
          </div>
        </div>
      </Card>

      <WeeklyGoalCard profile={profile} targets={targets} foodlog={foodlog} weightlog={weightlog} />

      <Card className="p-4" accent={C.rust}>
        <h3 className="text-sm uppercase tracking-wide text-[#8A8270] mb-3">Last 7 days — calories logged</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{ left: -20, right: 8 }}>
            <CartesianGrid stroke="#D8CFB8" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8A8270" }} />
            <YAxis tick={{ fontSize: 11, fill: "#8A8270" }} width={50} />
            <Tooltip contentStyle={{ fontFamily: "IBM Plex Mono", fontSize: 12, background: "#FBF8F0", border: "1px solid #2B2620" }} />
            <ReferenceLine y={targets.target} stroke="#B23A0E" strokeDasharray="4 4" />
            <Bar dataKey="kcal">
              {barData.map((d, i) => (
                <Cell key={i} fill={d.kcal > targets.target ? C.rust : C.sage} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-4 flex justify-center sm:block" accent={C.rust}>
          <NutritionLabel kcal={todaysTotals.kcal} protein={todaysTotals.protein} carbs={todaysTotals.carbs} fat={todaysTotals.fat} servingLabel={`logged ${logDate}`} />
        </Card>
        <Card className="p-4" accent={C.rust}>
          <h3 className="text-sm uppercase tracking-wide text-[#8A8270] mb-2">Plan summary</h3>
          <p className="text-sm leading-relaxed">
            At <b>{fmt(profile.goalRateKgWeek, 2)} kg/week</b>, reaching {fmt(profile.targetWeightKg, 1)} kg from {fmt(latestWeight, 1)} kg
            takes roughly <b>{targets.weeksToGoal ? fmt(Math.abs(remaining) / profile.goalRateKgWeek, 0) : "—"} weeks</b>.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ---------- Plan Tab ----------
function PlanTab({ recipes, targets }) {
  const byMeal = (type) => recipes.filter((r) => r.mealType === type);
  const [week, setWeek] = useState(() => Array.from({ length: 7 }, () => ({ breakfast: "", lunch: "", dinner: "", snack: "" })));
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const setSlot = (dayIdx, meal, recipeId) => setWeek((w) => w.map((d, i) => (i === dayIdx ? { ...d, [meal]: recipeId } : d)));

  const dayKcal = (day) =>
    MEAL_TYPES.reduce((sum, m) => {
      const r = recipes.find((x) => x.id === day[m]);
      return sum + (r ? perServing(r).kcal : 0);
    }, 0);

  const autofill = () => {
    if (recipes.length === 0) return;
    setWeek(
      Array.from({ length: 7 }, () => {
        const slot = {};
        MEAL_TYPES.forEach((m) => {
          const options = byMeal(m);
          slot[m] = options.length ? options[Math.floor(Math.random() * options.length)].id : "";
        });
        return slot;
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <p className="text-sm text-[#8A8270]">Build a week from your recipe library. Bars compare each day's total to your target.</p>
        <Button onClick={autofill} disabled={recipes.length === 0} className="w-full sm:w-auto shrink-0" color={C.sage}>Auto-fill randomly</Button>
      </div>
      {recipes.length === 0 && <p className="text-sm text-[#B23A0E]">Add some recipes first to build a plan.</p>}
      <p className="text-[11px] text-[#8A8270] sm:hidden flex items-center gap-1">Swipe to see the full week <ArrowRight size={12} /></p>
      <div className="overflow-x-auto border border-[#D8CFB8]" style={{ scrollSnapType: "x proximity", borderTop: `4px solid ${C.sage}` }}>
        <div className="grid grid-cols-[70px_repeat(7,minmax(130px,1fr))] gap-2 min-w-[830px] p-2">
          <div />
          {days.map((d) => <div key={d} className="text-center text-xs uppercase tracking-wide text-[#8A8270] pb-1" style={{ scrollSnapAlign: "start" }}>{d}</div>)}
          {MEAL_TYPES.map((meal) => (
            <Fragment key={meal}>
              <div className="text-xs uppercase tracking-wide text-[#8A8270] self-center capitalize">{meal}</div>
              {week.map((day, i) => (
                <select key={i + meal} className={inputCls} value={day[meal]} onChange={(e) => setSlot(i, meal, e.target.value)}>
                  <option value="">—</option>
                  {byMeal(meal).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              ))}
            </Fragment>
          ))}
          <div className="text-xs uppercase tracking-wide text-[#8A8270] self-center">Total</div>
          {week.map((day, i) => {
            const kcal = dayKcal(day);
            const over = targets && kcal > targets.target;
            return (
              <div key={i} style={{ fontFamily: mono }} className={`text-sm text-center py-1.5 border ${over ? "border-[#B23A0E] text-[#B23A0E]" : "border-[#D8CFB8]"}`}>
                {fmt(kcal)} kcal
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}