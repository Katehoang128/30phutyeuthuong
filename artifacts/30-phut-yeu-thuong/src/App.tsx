import { useCallback, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Router as WouterRouter, useLocation } from 'wouter';
import { AlertCircle, ArrowUpRight, BadgeCheck, BookOpen, CalendarDays, Camera, Check, ChefHat, ChevronDown, ChevronUp, CircleHelp, Clock3, Copy, Crown, ExternalLink, Heart, ImagePlus, Leaf, LoaderCircle, LockKeyhole, Mail, MessageCircle, Minus, Plus, Printer, QrCode, RefreshCw, Search, Send, Share2, ShoppingBasket, SlidersHorizontal, Smartphone, Sparkles, Trash2, Upload, Users, Utensils, WalletCards, X , Menu, User, Settings, ArrowRight } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { trackEvent } from './analytics';
import { BREAKFAST, CANH, DAM, DAILY_TARGET, DAY_NAMES, Dish, NUTRITION_PER_100G, PANTRY_COST, PRICE, RAU, RICE_PER_UNIT, SHOPPING_AFFILIATE_LINKS } from './data';

const queryClient = new QueryClient();
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
function apiUrl(path: string) { return `${API_BASE_URL}${path}`; }
type Budget = 'tietkiem' | 'vua' | 'thoaimai';
type VegMode = '0' | '1' | '2';
type HealingMode = 'stress' | 'hormone' | 'realfood';
type SpecialNutrition = 'none' | 'stress' | 'hormone' | 'realfood' | 'lowcarb' | 'who';
type Preferences = { kids: number; elderly: number; adults: number; maxTime: number; budget: Budget; targetBudget: number; veg: VegMode; healingModes: HealingMode[]; specialNutrition: SpecialNutrition; selectedMeals: { breakfast: boolean; lunch: boolean; dinner: boolean }; dishesPerMainMeal: 1 | 2 | 3; allergies: string[]; allergyOther: string; favoriteIngredients: string; };
type MealSet = { dam: Dish; rau: Dish; canh: Dish };
type DayPlan = { day: string; breakfast: Dish; lunch: MealSet; dinner: MealSet };
type DishSlot = 'breakfast' | 'lunch.dam' | 'lunch.rau' | 'lunch.canh' | 'dinner.dam' | 'dinner.rau' | 'dinner.canh';
type Aggregate = Record<string, { qty: number; unit?: string }>;
type ProQr = { qrUrl: string; transferContent: string; amount: number };
type AiUsage = { month: string; count: number };
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const initialPreferences: Preferences = { kids: 1, elderly: 0, adults: 2, maxTime: 30, budget: 'vua', targetBudget: 1200000, veg: '0', healingModes: [], specialNutrition: 'none', selectedMeals: { breakfast: true, lunch: true, dinner: true }, dishesPerMainMeal: 3, allergies: [], allergyOther: '', favoriteIngredients: '' };
const allergyOptions = [{ value: 'Tôm', label: 'Tôm' }, { value: 'Cua/Hải sản', label: 'Cua/Hải sản' }, { value: 'Trứng', label: 'Trứng' }, { value: 'Đậu nành', label: 'Đậu nành' }, { value: 'Thịt bò', label: 'Thịt bò' }, { value: 'Măng', label: 'Măng' }, { value: 'Nấm', label: 'Nấm' }];
const budgetLabels: Record<Budget, string> = { tietkiem: 'Tiết kiệm', vua: 'Vừa phải', thoaimai: 'Thoải mái' };
const presetBudgets: Record<Budget, number> = { tietkiem: 840_000, vua: 1_200_000, thoaimai: 1_680_000 };
const FREE_DAY_LIMIT = 3;
const FREE_AI_LIMIT = 3;
const PRO_PRICE = 49_000;
const PRO_ANNUAL_PRICE = 399_000;
const PRO_STORAGE_KEY = '30phut-pro-unlocked';
const AI_USAGE_STORAGE_KEY = '30phut-ai-usage';
const NEWSLETTER_STORAGE_KEY = '30phut-newsletter-email';
const PREFS_STORAGE_KEY = '30phut-preferences';
const PLAN_STORAGE_KEY = '30phut-plan';
const BOUGHT_STORAGE_KEY = '30phut-bought';
const DEVICE_ID_STORAGE_KEY = '30phut-device-id';
const SPEND_LOG_STORAGE_KEY = '30phut-spend-log';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

type SpendRecord = { weekKey: string; estimated: number; actual: number; recordedAt: string };
function readSpendLog(): SpendRecord[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SPEND_LOG_STORAGE_KEY) || 'null') as SpendRecord[] | null;
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}
// ISO-8601 week key ("2026-W38"), anchored to Vietnam local date so it lines up with when người dùng thực sự đi chợ.
function isoWeekKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  const d = new Date(Date.UTC(value('year'), value('month') - 1, value('day')));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  const weekNum = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + firstThursdayDayNum) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
function weekKeyLabel(weekKey: string) {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (date: Date) => `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

function getDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const deviceId = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
}

function vietnamDayName(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  const dayIndex = new Date(Date.UTC(value('year'), value('month') - 1, value('day'))).getUTCDay();
  return dayIndex === 0 ? 'Chủ nhật' : `Thứ ${dayIndex + 1}`;
}

function rotatePlanToToday(plan: DayPlan[]) {
  const today = vietnamDayName();
  const todayIndex = plan.findIndex((day) => day.day === today);
  return todayIndex > 0 ? [...plan.slice(todayIndex), ...plan.slice(0, todayIndex)] : plan;
}

function orderedDayNames() {
  const today = vietnamDayName();
  const todayIndex = DAY_NAMES.indexOf(today);
  return todayIndex > 0 ? [...DAY_NAMES.slice(todayIndex), ...DAY_NAMES.slice(0, todayIndex)] : DAY_NAMES;
}

function readStoredPreferences(): Preferences {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY) || 'null') as Partial<Preferences> | null;
    if (!saved) return initialPreferences;
    const legacyModes = saved.healingModes || [];
    const specialNutrition = saved.specialNutrition || (legacyModes[0] as SpecialNutrition) || 'none';
    return { ...initialPreferences, ...saved, specialNutrition, selectedMeals: { ...initialPreferences.selectedMeals, ...(saved.selectedMeals || {}) }, dishesPerMainMeal: ([1, 2, 3] as number[]).includes(saved.dishesPerMainMeal as number) ? saved.dishesPerMainMeal as 1 | 2 | 3 : 3 };
  } catch {
    return initialPreferences;
  }
}

function readStoredPlan(prefs: Preferences): DayPlan[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PLAN_STORAGE_KEY) || 'null') as DayPlan[] | null;
    return Array.isArray(saved) && saved.length === 7 ? rotatePlanToToday(saved) : generatePlan(prefs);
  } catch {
    return generatePlan(prefs);
  }
}

function readAiUsage(): AiUsage {
  try {
    const saved = JSON.parse(window.localStorage.getItem(AI_USAGE_STORAGE_KEY) || 'null') as Partial<AiUsage> | null;
    return saved?.month === currentMonth() && typeof saved.count === 'number' ? { month: saved.month, count: saved.count } : { month: currentMonth(), count: 0 };
  } catch {
    return { month: currentMonth(), count: 0 };
  }
}

function unitsOf(p: Preferences) { return p.adults + p.elderly * .8 + p.kids * .55; }
function money(value: number) { return `${Math.round(value).toLocaleString('vi-VN')} đ`; }
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function ingredientGrams(name: string, qty: number, unit?: string) {
  if (!unit) return qty;
  if (unit === 'ml' || unit === 'lá') return qty;
  if (unit === 'ổ') return qty * 60;
  if (unit === 'quả') return qty * (normalize(name).includes('cut') ? 10 : 50);
  return qty;
}
function priceFor(name: string, qty: number) {
  const price = PRICE[name];
  if (!price) return 0;
  if (price.perKg) return price.perKg * qty / 1000;
  if (price.perLiter) return price.perLiter * qty / 1000;
  return price.perPiece ? price.perPiece * qty : 0;
}
function nutrition(dish: Dish) {
  return (dish.ing || []).reduce((total, [name, qty, unit]) => {
    const item = NUTRITION_PER_100G[name];
    if (!item) return total;
    const factor = ingredientGrams(name, qty, unit) / 100;
    return { cal: total.cal + item.cal * factor, protein: total.protein + item.pro * factor };
  }, { cal: 0, protein: 0 });
}
const REAL_FOOD_BLOCKED_METHODS = new Set(['readymade', 'friedegg', 'panfry', 'stirfry', 'airfry']);
const REAL_FOOD_BLOCKED_INGREDIENTS = ['Chả lụa', 'Chả cá', 'Bánh cuốn'];
const HEALING_MODE_TERMS: Record<Exclude<HealingMode, 'realfood'>, string[]> = {
  stress: ['omega-3', 'dha', 'ca hoi', 'ca basa', 'ca loc', 'yen mach', 'dau xanh', 'cai bo xoi', 'rau den', 'rau muong', 'rau lang', 'bong cai', 'nam'],
  hormone: ['dau hu', 'dau xanh', 'bong cai', 'bap cai', 'cai thao', 'cai bo xoi', 'rau den', 'nam'],
};
const LOW_CARB_INGREDIENTS = ['gao te', 'gao nep', 'banh mi', 'banh pho', 'bun gao', 'yen mach', 'khoai lang', 'khoai so', 'dau xanh', 'chuoi', 'duong'];
function healingScore(dish: Dish, p: Preferences) {
  const text = normalize(`${dish.name} ${(dish.tags || []).join(' ')} ${dish.ing.map((item) => item[0]).join(' ')}`);
  let score = 0;
  if (p.healingModes.includes('stress') || p.specialNutrition === 'stress') score += HEALING_MODE_TERMS.stress.reduce((sum, term) => sum + (text.includes(term) ? 6 : 0), 0);
  if (p.healingModes.includes('hormone') || p.specialNutrition === 'hormone') score += HEALING_MODE_TERMS.hormone.reduce((sum, term) => sum + (text.includes(term) ? 6 : 0), 0);
  if (p.healingModes.includes('realfood')) {
    if (!dish.method || ['boilsteam', 'porridge', 'soak', 'nocook', 'oatsoup', 'phobun'].includes(dish.method)) score += 8;
    if (dish.veg) score += 2;
  }
  if (p.specialNutrition === 'lowcarb') {
    if (dish.type === 'dam' || dish.proteinGroup || dish.veg) score += 8;
    if (['Gạo tẻ', 'Gạo nếp', 'Bánh mì', 'Bánh phở', 'Bún gạo'].some((name) => dish.ing.some(([ingredient]) => ingredient === name))) score -= 10;
  }
  if (p.specialNutrition === 'who') {
    score += Math.min(8, (dish.tags || []).length * 2);
    if (dish.veg || dish.proteinGroup === 'fish' || dish.proteinGroup === 'plant' || dish.proteinGroup === 'soy') score += 4;
  }
  return score;
}
function matchesNutritionMode(dish: Dish, p: Preferences) {
  const text = normalize(`${dish.name} ${(dish.tags || []).join(' ')} ${dish.ing.map((item) => item[0]).join(' ')}`);
  const modes = [...new Set([...p.healingModes, ...(p.specialNutrition === 'none' ? [] : [p.specialNutrition as HealingMode])])];
  if (modes.includes('lowcarb' as HealingMode) && LOW_CARB_INGREDIENTS.some((ingredient) => text.includes(ingredient))) return false;
  if (modes.includes('who' as HealingMode) && !(dish.veg || dish.proteinGroup === 'fish' || dish.proteinGroup === 'plant' || dish.proteinGroup === 'soy')) return false;
  const healingModes = modes.filter((mode): mode is HealingMode => mode === 'stress' || mode === 'hormone' || mode === 'realfood');
  if (!healingModes.length) return true;
  if (healingModes.includes('realfood') && (REAL_FOOD_BLOCKED_METHODS.has(dish.method || '') || dish.ing.some(([name]) => REAL_FOOD_BLOCKED_INGREDIENTS.includes(name)))) return false;
  const preferenceMatch = healingModes.some((mode) => mode === 'realfood' || healingScore(dish, { ...p, healingModes: [mode], specialNutrition: 'none' }) > 0);
  return preferenceMatch;
}
function allergyTerms(p: Preferences) {
  const aliases: Record<string, string[]> = { 'tom': ['tom', 'hai san', 'muc'], 'cua/hai san': ['cua', 'tom', 'muc', 'hai san'], 'trung': ['trung'], 'dau nanh': ['dau nanh', 'dau hu'], 'thit bo': ['thit bo'], 'mang': ['mang'], 'nam': ['nam'] };
  return [...p.allergies, ...p.allergyOther.split(',').map((x) => x.trim()).filter(Boolean)].flatMap((x) => aliases[normalize(x)] || [normalize(x)]);
}
function dishAllowed(dish: Dish, p: Preferences) {
  const blocked = allergyTerms(p);
  const text = normalize(`${dish.name} ${(dish.allergens || []).join(' ')} ${dish.ing.map((x) => x[0]).join(' ')}`);
  return !blocked.some((term) => text.includes(term));
}
function poolAllowed(pool: Dish[], p: Preferences) {
  const favorites = p.favoriteIngredients.split(',').map((x) => normalize(x.trim())).filter(Boolean);
  const maxCost = p.budget === 'tietkiem' ? 1 : p.budget === 'thoaimai' ? 3 : 2;
  const result = pool.filter((dish) => {
    const text = normalize(`${dish.name} ${dish.ing.map((x) => x[0]).join(' ')}`);
    if (!dishAllowed(dish, p)) return false;
    if (dish.time > p.maxTime && dish !== BREAKFAST[0]) return false;
    if ((dish.costTier === 'cao' ? 3 : dish.costTier === 'vua' ? 2 : 1) > maxCost) return false;
    if (p.veg === '2' && !dish.veg) return false;
    if (!matchesNutritionMode(dish, p)) return false;
    return true;
  });
  if (!result.length) return [];
  const sorted = result.sort((a, b) => {
    const score = (dish: Dish) => healingScore(dish, p) + favorites.reduce((sum, term) => sum + (normalize(`${dish.name} ${dish.ing.map((x) => x[0]).join(' ')}`).includes(term) ? 4 : 0), 0);
    return score(b) - score(a);
  });
  return sorted;
}
function rotatePool(pool: Dish[], seed: number) {
  if (pool.length < 2) return pool;
  const offset = Math.abs(seed * 7 + pool.length) % pool.length;
  return [...pool.slice(offset), ...pool.slice(0, offset)];
}
function pick(pool: Dish[], index: number, avoid: string[] = []) {
  const options = pool.filter((dish) => !avoid.includes(dish.name));
  return (options.length ? options : pool)[index % (options.length || pool.length)];
}
function dishCost(dish: Dish, units: number) {
  return dish.ing.reduce((sum, [name, qty]) => sum + priceFor(name, qty * units), 0);
}
function aggregateCost(plan: DayPlan[], units: number, p: Preferences) {
  const agg = aggregate(plan, units, p);
  let sum = 0;
  for (const [name, item] of Object.entries(agg)) sum += priceFor(name, item.qty);
  return sum + PANTRY_COST[p.budget];
}
function generatePlan(p: Preferences, seed = 0): DayPlan[] {
  const breakfast = rotatePool(poolAllowed(BREAKFAST, p), seed);
  const dam = rotatePool(poolAllowed(DAM, p), seed + 1);
  const rau = rotatePool(poolAllowed(RAU, p), seed + 2);
  const canh = rotatePool(poolAllowed(CANH, p), seed + 3);
  
  const usedMain = new Set<string>();
  const usedMethods = new Set<string>();
  let previousProteinGroup = '';
  const chooseMain = (index: number, avoid: string[] = []) => {
    const unused = dam.filter((dish) => !usedMain.has(dish.name) && !avoid.includes(dish.name));
    const rotated = unused.filter((dish) => !previousProteinGroup || dish.proteinGroup !== previousProteinGroup);
    const varied = rotated.filter((dish) => !usedMethods.has(dish.preparation || dish.method || ''));
    const candidates = varied.length ? varied : rotated.length ? rotated : unused;
    const chosen = candidates[index % Math.max(1, candidates.length)] || dam[index % dam.length];
    usedMain.add(chosen.name);
    usedMethods.add(chosen.preparation || chosen.method || '');
    previousProteinGroup = chosen.proteinGroup || '';
    return chosen;
  };
  const pickSide = (pool: Dish[], index: number, avoidNames: string[], avoidMethods: string[]) => {
    const diverse = pool.filter((dish) => !avoidNames.includes(dish.name) && !avoidMethods.includes(dish.preparation || dish.method || ''));
    return pick(diverse.length ? diverse : pool, index, avoidNames);
  };
  const initialPlan = orderedDayNames().map((day, index) => {
    const b = pick(breakfast, index + seed);
    const lunchDam = chooseMain(index * 2 + seed);
    const dinnerDam = chooseMain(index * 2 + 1 + seed, [lunchDam.name]);
    const lunchRau = pickSide(rau, index + seed, [], [lunchDam.preparation || lunchDam.method || '']);
    const dinnerRau = pickSide(rau, index + 1 + seed, [lunchRau.name], [dinnerDam.preparation || dinnerDam.method || '']);
    const lunchCanh = pickSide(canh, index + seed, [], [lunchDam.preparation || lunchDam.method || '', lunchRau.preparation || lunchRau.method || '']);
    const dinnerCanh = pickSide(canh, index + 1 + seed, [lunchCanh.name], [dinnerDam.preparation || dinnerDam.method || '', dinnerRau.preparation || dinnerRau.method || '']);
    return { day, breakfast: b, lunch: { dam: lunchDam, rau: lunchRau, canh: lunchCanh }, dinner: { dam: dinnerDam, rau: dinnerRau, canh: dinnerCanh } };
  });

  const target = p.targetBudget || 1200000;
  const units = unitsOf(p);
  let currentCost = aggregateCost(initialPlan, units, p);
  let plan = initialPlan.map(day => ({ ...day, lunch: { ...day.lunch }, dinner: { ...day.dinner } }));
  const countUsage = (dishName: string) => {
    let count = 0;
    plan.forEach((day) => {
      if (day.breakfast.name === dishName) count++;
      if (day.lunch.dam.name === dishName) count++;
      if (day.lunch.rau.name === dishName) count++;
      if (day.lunch.canh.name === dishName) count++;
      if (day.dinner.dam.name === dishName) count++;
      if (day.dinner.rau.name === dishName) count++;
      if (day.dinner.canh.name === dishName) count++;
    });
    return count;
  };
  
  const pools = { breakfast, dam, rau, canh };
  const nutritionTarget = {
    cal: (p.kids * DAILY_TARGET.kid.calories + p.elderly * DAILY_TARGET.elderly.calories + p.adults * DAILY_TARGET.adult.calories) * 7,
    protein: (p.kids * DAILY_TARGET.kid.protein + p.elderly * DAILY_TARGET.elderly.protein + p.adults * DAILY_TARGET.adult.protein) * 7,
  };
  const nutritionTotals = () => plan.reduce((sum, day) => {
    const value = mealCalories(day, p);
    return { cal: sum.cal + value.cal * units, protein: sum.protein + value.protein * units };
  }, { cal: 0, protein: 0 });
  let currentNutrition = nutritionTotals();
  let nutritionIterations = 0;
  while ((currentNutrition.cal < nutritionTarget.cal || currentNutrition.protein < nutritionTarget.protein) && nutritionIterations < 60) {
    nutritionIterations++;
    let best: { dayIdx: number; key: string; candidate: Dish; score: number } | null = null;
    for (let dayIdx = 0; dayIdx < plan.length; dayIdx++) {
      const day = plan[dayIdx];
      const slots = [
        { key: 'breakfast', dish: day.breakfast, pool: breakfast },
        { key: 'lunch.dam', dish: day.lunch.dam, pool: dam },
        { key: 'lunch.rau', dish: day.lunch.rau, pool: rau },
        { key: 'lunch.canh', dish: day.lunch.canh, pool: canh },
        { key: 'dinner.dam', dish: day.dinner.dam, pool: dam },
        { key: 'dinner.rau', dish: day.dinner.rau, pool: rau },
        { key: 'dinner.canh', dish: day.dinner.canh, pool: canh },
      ];
      for (const slot of slots) {
        const old = nutrition(slot.dish);
        for (const candidate of slot.pool) {
          if (candidate.name === slot.dish.name) continue;
          if ((slot.key.endsWith('.dam') && countUsage(candidate.name) > 0) || countUsage(candidate.name) >= 2) continue;
          const next = nutrition(candidate);
          const calGain = (next.cal - old.cal) * units;
          const proteinGain = (next.protein - old.protein) * units;
          if (currentNutrition.cal >= nutritionTarget.cal && currentNutrition.cal + calGain < nutritionTarget.cal) continue;
          if (currentNutrition.protein >= nutritionTarget.protein && currentNutrition.protein + proteinGain < nutritionTarget.protein) continue;
          const score = Math.max(0, Math.min(calGain, nutritionTarget.cal - currentNutrition.cal)) / Math.max(1, nutritionTarget.cal)
            + Math.max(0, Math.min(proteinGain, nutritionTarget.protein - currentNutrition.protein)) / Math.max(1, nutritionTarget.protein);
          if (score > 0 && (!best || score > best.score)) best = { dayIdx, key: slot.key, candidate, score };
        }
      }
    }
    if (!best) break;
    const day = plan[best.dayIdx];
    const [group, field] = best.key.split('.');
    if (group === 'breakfast') day.breakfast = best.candidate;
    else if (group === 'lunch') day.lunch[field as keyof MealSet] = best.candidate;
    else day.dinner[field as keyof MealSet] = best.candidate;
    currentNutrition = nutritionTotals();
    currentCost = aggregateCost(plan, units, p);
  }
  let iterations = 0;
  while (currentCost > target && iterations < 50) {
    iterations++;
    let bestSwap: { dayIdx: number; key: string; candidate: Dish; reduction: number } | null = null;
    let maxScore = -999999;

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const day = plan[dayIdx];
      const mealTypes = [
        { key: 'breakfast', dish: day.breakfast, pool: pools.breakfast },
        { key: 'lunch.dam', dish: day.lunch.dam, pool: pools.dam },
        { key: 'lunch.rau', dish: day.lunch.rau, pool: pools.rau },
        { key: 'lunch.canh', dish: day.lunch.canh, pool: pools.canh },
        { key: 'dinner.dam', dish: day.dinner.dam, pool: pools.dam },
        { key: 'dinner.rau', dish: day.dinner.rau, pool: pools.rau },
        { key: 'dinner.canh', dish: day.dinner.canh, pool: pools.canh },
      ];

      for (const mt of mealTypes) {
        const currentDishCost = dishCost(mt.dish, units);
        for (const candidate of mt.pool) {
          if ((mt.key.endsWith('.dam') && countUsage(candidate.name) > 0) || countUsage(candidate.name) >= 2) continue;
          const candidateCost = dishCost(candidate, units);
          const reduction = currentDishCost - candidateCost;
          if (reduction > 0) {
            const oldNutrition = nutrition(mt.dish);
            const newNutrition = nutrition(candidate);
            const nextCal = currentNutrition.cal + (newNutrition.cal - oldNutrition.cal) * units;
            const nextProtein = currentNutrition.protein + (newNutrition.protein - oldNutrition.protein) * units;
            if (nextCal < nutritionTarget.cal || nextProtein < nutritionTarget.protein) continue;
            const penalty = countUsage(candidate.name) * 15000;
            const score = reduction - penalty;
            if (score > maxScore) {
              maxScore = score;
              bestSwap = { dayIdx, key: mt.key, candidate, reduction };
            }
          }
        }
      }
    }

    if (!bestSwap || maxScore < -50000) break;

    const day = plan[bestSwap.dayIdx];
    const keys = bestSwap.key.split('.');
    if (keys.length === 1) (day as any)[keys[0]] = bestSwap.candidate;
    else ((day as any)[keys[0]])[keys[1]] = bestSwap.candidate;

    currentCost -= bestSwap.reduction;
    currentNutrition = nutritionTotals();
  }

  let upgradeIterations = 0;
  while (currentCost < target - 30000 && upgradeIterations < 50) {
    upgradeIterations++;
    let bestSwap: { dayIdx: number; key: string; candidate: Dish; costIncrease: number } | null = null;
    let maxScore = -999999;

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const day = plan[dayIdx];
      const mealTypes = [
        { key: 'breakfast', dish: day.breakfast, pool: pools.breakfast },
        { key: 'lunch.dam', dish: day.lunch.dam, pool: pools.dam },
        { key: 'lunch.rau', dish: day.lunch.rau, pool: pools.rau },
        { key: 'lunch.canh', dish: day.lunch.canh, pool: pools.canh },
        { key: 'dinner.dam', dish: day.dinner.dam, pool: pools.dam },
        { key: 'dinner.rau', dish: day.dinner.rau, pool: pools.rau },
        { key: 'dinner.canh', dish: day.dinner.canh, pool: pools.canh },
      ];

      for (const mt of mealTypes) {
        const currentDishCost = dishCost(mt.dish, units);
        const currentPro = nutrition(mt.dish).protein;
        for (const candidate of mt.pool) {
          if ((mt.key.endsWith('.dam') && countUsage(candidate.name) > 0) || countUsage(candidate.name) >= 2) continue;
          const candidateCost = dishCost(candidate, units);
          const costIncrease = candidateCost - currentDishCost;
          
          if (costIncrease > 0 && currentCost + costIncrease <= target) {
            const candidatePro = nutrition(candidate).protein;
            const proIncrease = candidatePro - currentPro;
            const penalty = countUsage(candidate.name) * 20000;
            const score = costIncrease + (proIncrease * 1000) - penalty; 
            
            if (score > maxScore) {
              maxScore = score;
              bestSwap = { dayIdx, key: mt.key, candidate, costIncrease };
            }
          }
        }
      }
    }

    if (!bestSwap || maxScore < -50000) break;

    const day = plan[bestSwap.dayIdx];
    const keys = bestSwap.key.split('.');
    if (keys.length === 1) (day as any)[keys[0]] = bestSwap.candidate;
    else ((day as any)[keys[0]])[keys[1]] = bestSwap.candidate;

    currentCost += bestSwap.costIncrease;
  }

  const finalUsedMain = new Set<string>();
  let finalPreviousProtein = '';
  plan.forEach((day) => {
    (['lunch', 'dinner'] as const).forEach((meal) => {
      const current = day[meal].dam;
      const repeatsName = finalUsedMain.has(current.name);
      const repeatsProtein = Boolean(finalPreviousProtein && current.proteinGroup === finalPreviousProtein);
      if (repeatsName || repeatsProtein) {
        const sameTier = dam.filter((candidate) => !finalUsedMain.has(candidate.name) && candidate.proteinGroup !== finalPreviousProtein && candidate.costTier === current.costTier);
        const anyTier = dam.filter((candidate) => !finalUsedMain.has(candidate.name) && candidate.proteinGroup !== finalPreviousProtein);
        const replacement = (sameTier.length ? sameTier : anyTier)[(seed + finalUsedMain.size) % Math.max(1, (sameTier.length ? sameTier : anyTier).length)];
        if (replacement) day[meal].dam = replacement;
      }
      finalUsedMain.add(day[meal].dam.name);
      finalPreviousProtein = day[meal].dam.proteinGroup || '';
    });
  });
  return plan;
}
function aggregate(plan: DayPlan[], units: number, p: Preferences = initialPreferences): Aggregate {
  const result: Aggregate = {};
  const add = (name: string, qty: number, unit?: string) => { result[name] = result[name] ? { ...result[name], qty: result[name].qty + qty } : { qty, unit }; };
  plan.forEach((day) => {
    const meals: Dish[] = [];
    if (p.selectedMeals.breakfast) meals.push(day.breakfast);
    if (p.selectedMeals.lunch) meals.push(day.lunch.dam, ...(p.dishesPerMainMeal >= 2 ? [day.lunch.rau] : []), ...(p.dishesPerMainMeal >= 3 ? [day.lunch.canh] : []));
    if (p.selectedMeals.dinner) meals.push(day.dinner.dam, ...(p.dishesPerMainMeal >= 2 ? [day.dinner.rau] : []), ...(p.dishesPerMainMeal >= 3 ? [day.dinner.canh] : []));
    meals.forEach((dish) => dish.ing.forEach(([name, qty, unit]) => add(name, qty * units, unit)));
    add('Gạo tẻ', RICE_PER_UNIT * units * (Number(p.selectedMeals.lunch) + Number(p.selectedMeals.dinner)));
  });
  return result;
}
function displayQuantity(value: { qty: number; unit?: string }) {
  if (value.unit === 'ml') return `${(value.qty / 1000).toFixed(1).replace('.0', '')} lít`;
  if (value.unit) return `${Math.ceil(value.qty)} ${value.unit}`;
  return value.qty >= 1000 ? `${(value.qty / 1000).toFixed(1).replace('.0', '')} kg` : `${Math.ceil(value.qty / 5) * 5} g`;
}
function mealCalories(day: DayPlan, p: Preferences = initialPreferences) {
  const rice = { cal: 365 * RICE_PER_UNIT / 100, protein: 7 * RICE_PER_UNIT / 100 };
  const meals: Dish[] = [];
  if (p.selectedMeals.breakfast) meals.push(day.breakfast);
  if (p.selectedMeals.lunch) meals.push(day.lunch.dam, ...(p.dishesPerMainMeal >= 2 ? [day.lunch.rau] : []), ...(p.dishesPerMainMeal >= 3 ? [day.lunch.canh] : []));
  if (p.selectedMeals.dinner) meals.push(day.dinner.dam, ...(p.dishesPerMainMeal >= 2 ? [day.dinner.rau] : []), ...(p.dishesPerMainMeal >= 3 ? [day.dinner.canh] : []));
  return meals.map(nutrition).reduce((sum, item) => ({ cal: sum.cal + item.cal, protein: sum.protein + item.protein }), { cal: rice.cal * (p.selectedMeals.lunch || p.selectedMeals.dinner ? 1 : 0) * 2 + (p.selectedMeals.breakfast ? 120 : 0), protein: rice.protein * (p.selectedMeals.lunch || p.selectedMeals.dinner ? 2 : 0) });
}
function getCategory(name: string) {
  if (['Tôm','Cá','Mực','Thịt','Trứng','Đậu hũ','Gan','Sườn','Chả'].some((term) => name.includes(term))) return 'Thịt, cá & đạm';
  if (['Gạo','Bún','Bánh','Yến mạch','Đậu xanh'].some((term) => name.includes(term))) return 'Tinh bột & đồ khô';
  if (['Sữa','Chuối'].some((term) => name.includes(term))) return 'Sữa & trái cây';
  return 'Rau, củ & gia vị';
}
const BACH_HOA_XANH_AFFILIATE_URL = 'https://www.bachhoaxanh.com/khuyen-mai/gian-hang-affiliate-ct5001239?kol=9163HOANGTHICUC&utm_campaign=affiliate&utm_content=9163HOANGTHICUC';
const DRY_ITEMS = ['Gạo','Bún','Bánh','Yến mạch','Đậu xanh','Tôm khô','Nước mắm','Muối','Tiêu','Dầu ăn','Dầu ô liu'];
function shoppingGroup(name: string): 'fresh' | 'dry' {
  return DRY_ITEMS.some((item) => name.includes(item)) ? 'dry' : 'fresh';
}
// Sub-groups "Thực phẩm tươi sống" by ingredient type (thịt/cá/rau củ/...) instead of one flat grid —
// matches how a quầy chợ or BHX aisle is actually laid out, easier to scan while shopping.
const FRESH_GROUP_RAU_CU_INDEX = 2;
const FRESH_GROUP_ORDER: { label: string; icon: string; keywords: string[] }[] = [
  { label: 'Thịt', icon: '🥩', keywords: ['Thịt heo', 'Thịt bò', 'Sườn non', 'Ức gà', 'đùi gà', 'Gan heo', 'Chả lụa', 'Lòng heo'] },
  { label: 'Cá & Hải sản', icon: '🐟', keywords: ['Cá basa', 'Cá lóc', 'Cá diêu hồng', 'Cá hồi', 'Chả cá', 'Tôm tươi', 'Mực tươi'] },
  { label: 'Rau, Củ & Trái cây', icon: '🥬', keywords: [] },
  { label: 'Trứng, Đậu hũ & Sữa', icon: '🥚', keywords: ['Trứng gà', 'Trứng cút', 'Đậu hũ', 'Sữa tươi'] },
  { label: 'Gia vị & Nấm tươi', icon: '🧄', keywords: ['Gừng', 'Hành lá', 'Sả', 'Hành tím', 'Lá chanh', 'Nấm rơm', 'nấm bào ngư', 'Chanh'] },
];
function groupFreshItems(items: [string, { qty: number; unit?: string }][]) {
  const buckets = FRESH_GROUP_ORDER.map((group) => ({ ...group, items: [] as typeof items }));
  items.forEach((item) => {
    const [name] = item;
    const matchIndex = FRESH_GROUP_ORDER.findIndex((group, index) => index !== FRESH_GROUP_RAU_CU_INDEX && group.keywords.some((keyword) => name.includes(keyword)));
    buckets[matchIndex === -1 ? FRESH_GROUP_RAU_CU_INDEX : matchIndex].items.push(item);
  });
  return buckets.filter((bucket) => bucket.items.length > 0);
}
// Meal-to-Cart Converter: turns the dishes on a chốt (finalized) mâm cơm into a fresh-only BHX checklist.
function dailyFreshIngredients(dishes: { dish: Dish; slot: DishSlot }[], units: number): { name: string; qty: number; unit?: string }[] {
  const totals: Record<string, { qty: number; unit?: string }> = {};
  dishes.forEach(({ dish }) => dish.ing.forEach(([name, qty, unit]) => {
    if (shoppingGroup(name) !== 'fresh') return;
    totals[name] = totals[name] ? { ...totals[name], qty: totals[name].qty + qty * units } : { qty: qty * units, unit };
  }));
  return Object.entries(totals).map(([name, value]) => ({ name, ...value }));
}
function quantityEditorUnit(value: { qty: number; unit?: string }) {
  return value.unit || 'g';
}
function quantityEditorValue(value: { qty: number; unit?: string }) {
  return Number.isInteger(value.qty) ? value.qty : Number(value.qty.toFixed(1));
}

type BagItem = { id: string; name: string; qty: number; unit: 'g' | 'kg'; pricePerKg: number; group: 'dam' | 'rau' };
const BAG_QUICK_CHIPS: { label: string; emoji: string; group: 'dam' | 'rau' }[] = [
  { label: 'Thịt heo', emoji: '🥩', group: 'dam' },
  { label: 'Thịt bò', emoji: '🥩', group: 'dam' },
  { label: 'Cá', emoji: '🐟', group: 'dam' },
  { label: 'Tôm', emoji: '🦐', group: 'dam' },
  { label: 'Rau củ', emoji: '🥦', group: 'rau' },
  { label: 'Đậu hũ', emoji: '🍄', group: 'dam' },
  { label: 'Trứng gà', emoji: '🥚', group: 'dam' },
  { label: 'Thịt gà', emoji: '🍗', group: 'dam' },
];
// Ordered most-specific first: "cà chua"/"cà rốt" normalize to "ca ..." same as "cá" (fish), so veggie phrases must win first.
const BAG_CLASSIFY_RULES: [RegExp, 'dam' | 'rau', number][] = [
  [/ca chua/, 'rau', 25000],
  [/ca rot/, 'rau', 20000],
  [/ca tim/, 'rau', 18000],
  [/bi do|bi xanh/, 'rau', 15000],
  [/dau hu|dau phu/, 'dam', 16000],
  [/dau bap|dau que/, 'rau', 22000],
  [/thit bo|\bbo\b/, 'dam', 260000],
  [/thit heo|\bheo\b|suon|ba roi/, 'dam', 120000],
  [/\bga\b|uc ga|dui ga/, 'dam', 70000],
  [/\btom\b/, 'dam', 180000],
  [/\bmuc\b/, 'dam', 150000],
  [/\bca\b|basa|dieu hong|ca loc|ca hoi/, 'dam', 110000],
  [/trung/, 'dam', 35000],
  [/rau|cai|bau|muop|mong toi|gia do|xa lach|sup lo|bong cai|kho qua/, 'rau', 15000],
];
function classifyBagIngredient(name: string): { group: 'dam' | 'rau'; pricePerKg: number } {
  const normalized = normalize(name);
  for (const [pattern, group, pricePerKg] of BAG_CLASSIFY_RULES) if (pattern.test(normalized)) return { group, pricePerKg };
  return { group: 'rau', pricePerKg: 15000 };
}
// Smart Text Parser: "1kg thịt heo, 500g rau muống, 2 quả cà chua" -> structured items.
function parseBagText(text: string): { name: string; qty: number; unit: 'g' | 'kg' }[] {
  return text.split(/[,;\n]+/).map((chunk) => chunk.trim()).filter(Boolean).map((chunk) => {
    const match = chunk.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|gam|gr|lạng|lang|con|quả|qua|củ|cu|bó|bo|mớ|mo|trái|trai)?\s*(.+)$/i);
    if (!match) return { name: chunk, qty: 300, unit: 'g' as const };
    const num = parseFloat(match[1].replace(',', '.'));
    const unitRaw = normalize(match[2] || '');
    const name = match[3].trim();
    if (unitRaw === 'kg') return { name, qty: num, unit: 'kg' as const };
    if (unitRaw === 'lang') return { name, qty: num * 100, unit: 'g' as const };
    if (['con', 'qua', 'cu', 'bo', 'mo', 'trai'].includes(unitRaw)) return { name, qty: num * (normalize(name).includes('trung') ? 50 : 200), unit: 'g' as const };
    if (unitRaw === 'g' || unitRaw === 'gam' || unitRaw === 'gr') return { name, qty: num, unit: 'g' as const };
    return { name, qty: num <= 20 ? num * 200 : num, unit: 'g' as const };
  });
}
function bagItemCost(item: BagItem) { return item.pricePerKg * (item.unit === 'kg' ? item.qty : item.qty / 1000); }
function bagItemGrams(item: BagItem) { return item.unit === 'kg' ? item.qty * 1000 : item.qty; }

// Weekly Cost & Portion Estimator: a full week is 7 ngày x 2 bữa (trưa + tối) = 14 bữa mâm cơm 3 món.
// Baseline raw-weight guides per person per meal, consistent with the recipe portions in data.ts.
const BAG_MEALS_PER_WEEK = 14;
const BAG_DAM_G_PER_PERSON_MEAL = 100;
const BAG_RAU_G_PER_PERSON_MEAL = 150;
const BAG_GROUP_LABELS: Record<'dam' | 'rau', string> = { dam: 'đạm (thịt/cá)', rau: 'rau củ' };
// Cheap staple used to price a top-up suggestion when a food group falls short for the week.
const BAG_TOPUP_SUGGESTION: Record<'dam' | 'rau', { name: string; pricePerKg: number }> = {
  dam: { name: 'Đậu hũ', pricePerKg: 16000 },
  rau: { name: 'Rau muống', pricePerKg: 12000 },
};

function estimateBagWeek(items: BagItem[], prefs: Preferences) {
  const familyUnits = Math.max(unitsOf(prefs), 0.01);
  const perDayNeed: Record<'dam' | 'rau', number> = {
    dam: BAG_DAM_G_PER_PERSON_MEAL * 2 * familyUnits,
    rau: BAG_RAU_G_PER_PERSON_MEAL * 2 * familyUnits,
  };
  const groups: Record<'dam' | 'rau', { items: BagItem[]; grams: number; cost: number; days: number }> = {
    dam: { items: [], grams: 0, cost: 0, days: 0 },
    rau: { items: [], grams: 0, cost: 0, days: 0 },
  };
  items.forEach((item) => {
    const bucket = groups[item.group];
    bucket.items.push(item);
    bucket.grams += bagItemGrams(item);
    bucket.cost += bagItemCost(item);
  });
  (['dam', 'rau'] as const).forEach((group) => { groups[group].days = groups[group].grams / perDayNeed[group]; });
  const totalCost = groups.dam.cost + groups.rau.cost;
  const overallDays = Math.min(groups.dam.days, groups.rau.days);
  const shortages = (['dam', 'rau'] as const)
    .filter((group) => groups[group].days < 6.95)
    .map((group) => {
      const missingDays = 7 - groups[group].days;
      const missingGrams = perDayNeed[group] * missingDays;
      const missingCost = (missingGrams / 1000) * BAG_TOPUP_SUGGESTION[group].pricePerKg;
      return { group, missingDays, missingCost, topup: BAG_TOPUP_SUGGESTION[group].name };
    });
  const surplusDays = Math.max(0, overallDays - 7);
  const surplusCost = overallDays > 0 ? (totalCost / overallDays) * surplusDays : 0;
  return { groups, perDayNeed, totalCost, overallDays, shortages, surplusDays, surplusCost };
}

type BagDaySpread = { day: string; dam?: BagItem; damMethod: string; rau?: BagItem };
const BAG_COOK_STYLES = ['Hấp/Luộc', 'Kho/Rim', 'Xào/Áp chảo'];
// Auto-Spread Meals: rolls the entered bag across Thứ 2 -> Chủ nhật. Cycling items with `index % length`
// guarantees no two consecutive days land on the same đạm item (or cách chế biến) whenever ≥2 are entered.
function spreadBagAcrossWeek(items: BagItem[]): BagDaySpread[] {
  const damItems = items.filter((item) => item.group === 'dam');
  const rauItems = items.filter((item) => item.group === 'rau');
  return DAY_NAMES.map((day, index) => ({
    day,
    dam: damItems.length ? damItems[index % damItems.length] : undefined,
    damMethod: BAG_COOK_STYLES[index % BAG_COOK_STYLES.length],
    rau: rauItems.length ? rauItems[index % rauItems.length] : undefined,
  }));
}

function BudgetProgress({ totalCost, targetBudget, className = "" }: { totalCost: number, targetBudget: number, className?: string }) {
  const percent = targetBudget > 0 ? (totalCost / targetBudget) * 100 : 0;
  const isOver = totalCost > targetBudget;
  const colorClass = isOver ? 'bg-destructive' : percent >= 90 ? 'bg-amber-400' : 'bg-primary';
  
  return (
      <div className={`space-y-3 ${className}`} data-testid="budget-progress">
      <div className="flex justify-between text-xs">
        <span className="font-bold text-muted-foreground">Đã chi: <span className="text-foreground">{money(totalCost)}</span></span>
        <span className="font-bold text-muted-foreground">Mục tiêu: <span className="text-foreground">{money(targetBudget)}</span></span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <div className="flex justify-end text-[11px] font-bold">
        {isOver ? (
          <span className="text-destructive flex items-center gap-1"><AlertCircle size={13} /> Vượt ngân sách: {money(totalCost - targetBudget)}</span>
        ) : (
          <span className="text-primary flex items-center gap-1"><Check size={13} /> Còn trống: {money(targetBudget - totalCost)}</span>
        )}
      </div>
    </div>
  );
}

function BudgetWarning({ plan, units, p, totalCost, forceBudget }: { plan: DayPlan[], units: number, p: Preferences, totalCost: number, forceBudget: () => void }) {
  const target = p.targetBudget || 1200000;
  
  const swaps = useMemo(() => {
    if (totalCost <= target) return [];
    const cheapPool = poolAllowed(DAM, p).filter(d => ['Đậu hũ', 'Trứng gà', 'Cá basa', 'Ức gà'].some(ing => d.ing.some(i => i[0].includes(ing))));
    const expensiveDams: { dayIdx: number, meal: 'lunch' | 'dinner', dish: Dish, cost: number }[] = [];
    plan.forEach((day, i) => {
      expensiveDams.push({ dayIdx: i, meal: 'lunch', dish: day.lunch.dam, cost: dishCost(day.lunch.dam, units) });
      expensiveDams.push({ dayIdx: i, meal: 'dinner', dish: day.dinner.dam, cost: dishCost(day.dinner.dam, units) });
    });
    
    expensiveDams.sort((a, b) => b.cost - a.cost);
    
    const result = [];
    for (const exp of expensiveDams) {
      if (result.length >= 3) break;
      const expPro = nutrition(exp.dish).protein;
      let bestCheap = null;
      let bestScore = -999999;
      for (const cheap of cheapPool) {
        if (cheap.name === exp.dish.name) continue;
        const cCost = dishCost(cheap, units);
        if (cCost < exp.cost - 5000) {
          const cPro = nutrition(cheap).protein;
          const score = (exp.cost - cCost) - Math.abs(expPro - cPro) * 500;
          if (score > bestScore) {
            bestScore = score;
            bestCheap = cheap;
          }
        }
      }
      if (bestCheap) {
        result.push({ oldDish: exp.dish, newDish: bestCheap, saving: exp.cost - dishCost(bestCheap, units) });
      }
    }
    return result;
  }, [plan, units, p, totalCost, target]);

  if (totalCost <= target || swaps.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4" data-testid="budget-warning">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 text-amber-600 shrink-0" size={18} />
        <div className="flex-1">
          <h4 className="text-sm font-bold text-amber-800 dark:text-amber-500">Gợi ý giảm chi phí ({money(totalCost - target)} vượt ngân sách)</h4>
          <p className="mt-1 text-xs leading-5 text-amber-700/80 dark:text-amber-500/80">Bạn có thể đổi vài món đạm đắt tiền lấy trứng, đậu hũ, gà hoặc cá basa để ép về ngân sách:</p>
          <ul className="mt-3 space-y-2">
            {swaps.map((s, i) => (
              <li key={i} className="text-[11px] flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background/50 p-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium line-through text-muted-foreground">{s.oldDish.name}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-bold text-foreground">{s.newDish.name}</span>
                </div>
                <span className="text-primary font-bold whitespace-nowrap">- {money(s.saving)}</span>
              </li>
            ))}
          </ul>
          <button 
            onClick={forceBudget}
            className="tactile mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-bold text-white shadow-[0_3px_0_#d97706] hover:bg-amber-600 active:translate-y-[3px] active:shadow-none"
            data-testid="button-auto-budget"
          >
            ⚡ Bấm 1-chạm để tự động ép về đúng ngân sách
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><Shell /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

function Shell() {
  const [location, setLocation] = useLocation();
  const [prefs, setPrefs] = useState(readStoredPreferences);
  const [seed, setSeed] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isPro, setIsPro] = useState(() => window.localStorage.getItem(PRO_STORAGE_KEY) === 'true');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [globalPhone, setGlobalPhone] = useState(() => window.localStorage.getItem('30phut-user-phone') || '');
  const [globalEmail, setGlobalEmail] = useState(() => window.localStorage.getItem('30phut-user-email') || '');
  const [deviceId] = useState(getDeviceId);
  const [plan, setPlan] = useState(() => readStoredPlan(prefs));
  const [spendLog, setSpendLog] = useState<SpendRecord[]>(readSpendLog);
  const [bought, setBought] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(window.localStorage.getItem(BOUGHT_STORAGE_KEY) || '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  const [customItems, setCustomItems] = useState<{ name: string; bought: boolean }[]>([]);
  const [quantityOverrides, setQuantityOverrides] = useState<Record<string, number>>({});
  const [favoriteDishes, setFavoriteDishes] = useState<Set<string>>(new Set());
  const [budgetNotice, setBudgetNotice] = useState('');
  const [swapNotice, setSwapNotice] = useState('');
  const [expandedDay, setExpandedDay] = useState(0);
  const [activeMeal, setActiveMeal] = useState<'all' | 'breakfast' | 'lunch' | 'dinner'>('all');
  const units = unitsOf(prefs);
  const accessiblePlan = isPro ? plan : plan.slice(0, FREE_DAY_LIMIT);
  const shopping = useMemo(() => {
    const base = aggregate(accessiblePlan, units, prefs);
    Object.entries(quantityOverrides).forEach(([name, qty]) => {
      if (base[name] && qty >= 0) base[name] = { ...base[name], qty };
    });
    return base;
  }, [accessiblePlan, units, quantityOverrides, prefs]);
  const totalCost = useMemo(() => Object.entries(shopping).reduce((sum, [name, item]) => bought.has(name) ? sum : sum + priceFor(name, item.qty), 0) + PANTRY_COST[prefs.budget], [shopping, bought, prefs.budget]);
  useEffect(() => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);
  useEffect(() => {
    let active = true;
    fetch(apiUrl(`/api/profile/${deviceId}`))
      .then((response) => response.ok ? response.json() : null)
      .then((profile: { email?: string | null; phone?: string | null; preferences?: Partial<Preferences> } | null) => {
        if (!active || !profile) return;
        if (profile.email) setGlobalEmail(profile.email);
        if (profile.phone) setGlobalPhone(profile.phone);
        if (profile.preferences) setPrefs((current) => ({ ...current, ...profile.preferences }));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [deviceId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch(apiUrl('/api/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, email: globalEmail, phone: globalPhone, preferences: prefs }),
      }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [deviceId, globalEmail, globalPhone, prefs]);
  useEffect(() => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);
  useEffect(() => {
    window.localStorage.setItem(BOUGHT_STORAGE_KEY, JSON.stringify([...bought]));
  }, [bought]);
  useEffect(() => {
    window.localStorage.setItem(SPEND_LOG_STORAGE_KEY, JSON.stringify(spendLog));
  }, [spendLog]);
  // Actual Spend Tracker: upserts this ISO week's record (estimate taken at record time) so the gap
  // between app dự toán and thực chi tại Bách Hóa Xanh becomes visible instead of silent.
  const recordActualSpend = (actual: number) => {
    const weekKey = isoWeekKey();
    setSpendLog((current) => [{ weekKey, estimated: totalCost, actual, recordedAt: new Date().toISOString() }, ...current.filter((record) => record.weekKey !== weekKey)].slice(0, 12));
    trackEvent('actual_spend_recorded', { estimated: Math.round(totalCost), actual: Math.round(actual) });
  };
  useEffect(() => {
    const syncPlanWithVietnamDate = () => {
      setPlan((current) => {
        const rotated = rotatePlanToToday(current);
        if (rotated[0]?.day === current[0]?.day) return current;
        setExpandedDay(0);
        return rotated;
      });
    };
    const timer = window.setInterval(syncPlanWithVietnamDate, 30_000);
    document.addEventListener('visibilitychange', syncPlanWithVietnamDate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', syncPlanWithVietnamDate);
    };
  }, []);
  const regenerate = () => { const nextSeed = seed + 1; setSeed(nextSeed); setPlan(generatePlan(prefs, nextSeed)); setBought(new Set()); setQuantityOverrides({}); trackEvent('menu_regenerated', { membership: isPro ? 'pro' : 'free' }); };
  const updatePrefs = (next: Partial<Preferences>) => setPrefs((current) => ({ ...current, ...next }));
  const saveSettings = () => { setPlan(generatePlan(prefs, seed + 1)); setSeed(seed + 1); setSettingsOpen(false); setBought(new Set()); setQuantityOverrides({}); setBudgetNotice(''); };
  const swapDish = useCallback((dayIndex: number, slot: DishSlot) => {
    const [meal, field] = slot.split('.');
    const current = meal === 'breakfast' ? plan[dayIndex].breakfast : plan[dayIndex][meal as 'lunch' | 'dinner'][field as keyof MealSet];
    const pool = meal === 'breakfast' ? BREAKFAST : field === 'rau' ? RAU : field === 'canh' ? CANH : DAM;
    const used = new Set<string>();
    plan.forEach((day, index) => {
      const entries = [day.breakfast, day.lunch.dam, day.lunch.rau, day.lunch.canh, day.dinner.dam, day.dinner.rau, day.dinner.canh];
      entries.forEach((dish) => {
        if (index !== dayIndex || dish.name !== current.name) used.add(dish.name);
      });
    });
    const costRank = (dish: Dish) => dish.costTier === 'cao' ? 3 : dish.costTier === 'vua' ? 2 : 1;
    const allowed = poolAllowed(pool, prefs).filter((dish) => dish.name !== current.name && !used.has(dish.name));
    const samePrice = allowed.filter((dish) => Math.abs(costRank(dish) - costRank(current)) <= 1);
    const candidates = samePrice.length ? samePrice : allowed;
    if (!candidates.length) {
      setSwapNotice(`Chưa tìm được món thay thế an toàn cho “${current.name}”. Hãy nới bộ lọc hoặc đổi mức ngân sách.`);
      return;
    }
    const candidate = candidates[(seed + dayIndex + current.name.length) % candidates.length];
    const next = plan.map((day) => ({ ...day, lunch: { ...day.lunch }, dinner: { ...day.dinner } }));
    if (meal === 'breakfast') next[dayIndex].breakfast = candidate;
    else next[dayIndex][meal as 'lunch' | 'dinner'][field as keyof MealSet] = candidate;
    setPlan(next);
    setSwapNotice(`Đã đổi “${current.name}” thành “${candidate.name}”. Các món khác được giữ nguyên.`);
    trackEvent('single_dish_swapped', { slot, from: current.name, to: candidate.name });
  }, [plan, prefs, seed]);
  const unlockPro = () => {
    window.localStorage.setItem(PRO_STORAGE_KEY, 'true');
    setIsPro(true);
    setUpgradeOpen(false);
    trackEvent('pro_unlocked', { plan: 'monthly_49000' });
  };
  const openUpgrade = (source: string) => {
    trackEvent('pro_upgrade_opened', { source });
    setUpgradeOpen(true);
  };
  
  const forceBudget = useCallback(() => {
    let newPlan = plan.map(d => ({...d, lunch: {...d.lunch}, dinner: {...d.dinner}}));
    let currentCost = Object.entries(aggregate(newPlan, units, prefs)).reduce((sum, [name, item]) => bought.has(name) ? sum : sum + priceFor(name, item.qty), 0) + PANTRY_COST[prefs.budget];
    const target = prefs.targetBudget || 1200000;
    
    const cheapPool = poolAllowed(DAM, prefs).filter(d => ['Đậu hũ', 'Trứng gà', 'Cá basa', 'Ức gà'].some(ing => d.ing.some(i => i[0].includes(ing))));
    if (cheapPool.length === 0) return;

    let iterations = 0;
    while (currentCost > target && iterations < 20) {
      iterations++;
      const nutritionTarget = {
        cal: (prefs.kids * DAILY_TARGET.kid.calories + prefs.elderly * DAILY_TARGET.elderly.calories + prefs.adults * DAILY_TARGET.adult.calories) * 7,
        protein: (prefs.kids * DAILY_TARGET.kid.protein + prefs.elderly * DAILY_TARGET.elderly.protein + prefs.adults * DAILY_TARGET.adult.protein) * 7,
      };
      const currentNutrition = newPlan.reduce((sum, day) => {
        const value = mealCalories(day, prefs);
        return { cal: sum.cal + value.cal * units, protein: sum.protein + value.protein * units };
      }, { cal: 0, protein: 0 });
      let bestSwap: { dayIdx: number; meal: 'lunch' | 'dinner'; dish: Dish; saving: number } | null = null;
      newPlan.forEach((day, dayIdx) => {
        (['lunch', 'dinner'] as const).forEach((meal) => {
          const oldDish = day[meal].dam;
          const oldValue = nutrition(oldDish);
          cheapPool.forEach((candidate) => {
            const saving = dishCost(oldDish, units) - dishCost(candidate, units);
            if (saving <= 0) return;
            const nextValue = nutrition(candidate);
            const nextCal = currentNutrition.cal + (nextValue.cal - oldValue.cal) * units;
            const nextProtein = currentNutrition.protein + (nextValue.protein - oldValue.protein) * units;
            if (nextCal < nutritionTarget.cal || nextProtein < nutritionTarget.protein) return;
            if (!bestSwap || saving > bestSwap.saving) bestSwap = { dayIdx, meal, dish: candidate, saving };
          });
        });
      });
      const selected = bestSwap as { dayIdx: number; meal: 'lunch' | 'dinner'; dish: Dish; saving: number } | null;
      if (!selected) break;
      newPlan[selected.dayIdx][selected.meal].dam = selected.dish;
      currentCost = Object.entries(aggregate(newPlan, units, prefs)).reduce((sum, [name, item]) => bought.has(name) ? sum : sum + priceFor(name, item.qty), 0) + PANTRY_COST[prefs.budget];
    }
    const changed = JSON.stringify(newPlan) !== JSON.stringify(plan);
    setPlan(newPlan);
    setBudgetNotice(changed ? '' : 'Không thể giảm thêm mà vẫn giữ đủ calo và đạm khuyến nghị. Hãy tăng ngân sách mục tiêu một chút.');
    trackEvent('force_budget_applied');
  }, [plan, units, prefs, bought]);

  let page;
  if (location === '/shopping') page = <ShoppingPageV2 shopping={shopping} bought={bought} setBought={setBought} customItems={customItems} setCustomItems={setCustomItems} totalCost={totalCost} setQuantityOverrides={setQuantityOverrides} targetBudget={prefs.targetBudget || 1200000} prefs={prefs} spendLog={spendLog} onRecordSpend={recordActualSpend} />;
  else if (location === '/costs') page = <div className="space-y-5"><CostsPage shopping={shopping} prefs={prefs} totalCost={totalCost} plan={accessiblePlan} spendLog={spendLog} /><KitchenEquityCard weeklySaving={Math.max(0, (prefs.targetBudget || 1200000) - totalCost)} /></div>;
  else if (location === '/ask-ai') page = <AskAiPageV2 prefs={prefs} isPro={isPro} onUpgrade={() => openUpgrade('ai_limit')} />;
  else page = <HomePage plan={plan} isPro={isPro} onUpgrade={() => openUpgrade('locked_week')} prefs={prefs} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} updatePrefs={updatePrefs} saveSettings={saveSettings} regenerate={regenerate} expandedDay={expandedDay} setExpandedDay={setExpandedDay} activeMeal={activeMeal} setActiveMeal={setActiveMeal} favoriteDishes={favoriteDishes} setFavoriteDishes={setFavoriteDishes} totalCost={totalCost} forceBudget={forceBudget} budgetNotice={budgetNotice} swapNotice={swapNotice} onSwapDish={swapDish} />;
  return <div className="app-shell grain"><DesktopSidebar location={location} /><header className="site-header border-b border-black/5"><div className="site-header-inner flex items-center justify-between gap-3"><Link href="/" className="site-header-brand flex items-center gap-3 no-underline" data-testid="link-home"><span className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,hsl(113_25%_42%),hsl(113_34%_64%))] text-white shadow-[0_8px_18px_rgba(74,124,89,0.22)]"><ChefHat size={23} strokeWidth={2.4} /></span><span><span className="display-font block text-xl font-bold tracking-tight text-[hsl(113_25%_32%)]">30 Phút</span><span className="block text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Yêu thương</span></span></Link><div className="top-actions flex items-center gap-2">{isPro ? <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-[hsl(31_90%_83%)] px-3 py-1.5 text-xs font-bold text-[hsl(24_28%_18%)]"><Crown size={13} /> Thành viên Pro</span> : <button onClick={() => openUpgrade('header')} className="tactile hidden md:inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,hsl(113_25%_42%),hsl(113_34%_64%))] px-3 py-2 text-xs font-bold text-white" data-testid="button-header-upgrade"><Crown size={13} /> Nâng cấp Pro</button>}<button onClick={() => window.print()} className="tactile hidden md:flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(36_40%_88%)] bg-white text-muted-foreground" aria-label="In trang" data-testid="button-print"><Printer size={17} /></button>
<button onClick={() => setDrawerOpen(true)} className="tactile flex h-11 w-11 items-center justify-center rounded-[18px] border border-[hsl(36_40%_88%)] bg-white text-[hsl(24_30%_17%)] shadow-[0_8px_16px_rgba(110,84,58,0.05)]" data-testid="button-open-drawer" aria-label="Mở menu"><Menu size={19} /></button></div></div></header><main className="content-wrap page-enter">{page}</main><BlogFooter /><BottomNav location={location} /><InstallAppBanner /><MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} isPro={isPro} phone={globalPhone} onUpgrade={() => { setDrawerOpen(false); openUpgrade('drawer'); }} onOpenSettings={() => { if (location !== '/') { setLocation('/'); } setSettingsOpen(true); }} />
<ProUpgradeModal globalPhone={globalPhone} setGlobalPhone={setGlobalPhone} globalEmail={globalEmail} setGlobalEmail={setGlobalEmail} open={upgradeOpen} onClose={() => setUpgradeOpen(false)} onUnlocked={unlockPro} /></div>;
}

function InstallAppBanner() {
  const [visible, setVisible] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone) return;

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const timer = window.setTimeout(() => setVisible(true), 5_000);
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
    };
  }, []);

  if (!visible) return null;

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setVisible(false);
    setInstallPrompt(null);
  };

  return <aside className="install-banner fixed inset-x-3 bottom-24 z-[60] mx-auto max-w-xl rounded-2xl border border-primary/25 bg-card/95 p-3 shadow-[0_16px_45px_rgba(69,38,16,.22)] backdrop-blur md:bottom-5" role="status" data-testid="pwa-install-banner">
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Smartphone size={19} /></span>
      <p className="min-w-0 flex-1 text-xs font-bold leading-5">📲 Thêm 30 Phút Yêu Thương vào Màn hình chính để mở nhanh như App!</p>
      {installPrompt && <button onClick={install} className="tactile shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" data-testid="button-install-pwa">Thêm</button>}
      <button onClick={() => setVisible(false)} className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Đóng thông báo cài ứng dụng" data-testid="button-dismiss-pwa"><X size={16} /></button>
    </div>
    {!installPrompt && <p className="mt-1 pl-[52px] pr-8 text-[10px] leading-4 text-muted-foreground">Mở menu trình duyệt và chọn “Thêm vào Màn hình chính”.</p>}
  </aside>;
}

const healingModeOptions: { value: HealingMode; icon: string; title: string; description: string }[] = [
  { value: 'stress', icon: '🌿', title: 'Chữa lành tâm trí & Giảm stress', description: 'Ưu tiên Magnesium, B-complex và Omega-3 từ rau xanh đậm, yến mạch, đậu và cá.' },
  { value: 'hormone', icon: '🌸', title: 'Cân bằng nội tiết tố U40–U50', description: 'Ưu tiên phytoestrogen tự nhiên từ đậu hũ, đậu, rau họ cải và rau xanh.' },
  { value: 'realfood', icon: '🧘', title: 'Real Food & Thực dưỡng nhàn bếp', description: 'Nguyên liệu nguyên bản; hạn chế đồ chế biến sẵn, chiên và xào; ưu tiên hấp, luộc, cháo và canh.' },
];

function HealingModeSettings({ prefs, updatePrefs, saveSettings }: { prefs: Preferences; updatePrefs: (value: Partial<Preferences>) => void; saveSettings: () => void }) {
  const toggle = (mode: HealingMode) => updatePrefs({
    healingModes: prefs.healingModes.includes(mode) ? prefs.healingModes.filter((item) => item !== mode) : [...prefs.healingModes, mode],
  });
  return <section className="paper-card border-[hsl(38_55%_72%)] bg-[linear-gradient(145deg,hsl(38_100%_96%),hsl(18_72%_97%))] p-4 md:p-5" data-testid="healing-mode-settings">
    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(38_70%_86%)] text-xl">🌿</span><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(24_42%_35%)]">Chế độ ăn chuyên sâu</p><h2 className="display-font mt-1 text-2xl font-bold">Bếp Chữa Lành & Năng Lượng</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Có thể chọn nhiều chế độ. Bếp sẽ kết hợp các ưu tiên khi tạo thực đơn mới.</p></div></div>
    <div className="mt-4 grid gap-3">{healingModeOptions.map((option) => { const active = prefs.healingModes.includes(option.value); return <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors ${active ? 'border-[hsl(113_40%_45%)] bg-white shadow-sm' : 'bg-white/55 hover:bg-white'}`} data-testid={`label-healing-${option.value}`}><input type="checkbox" checked={active} onChange={() => toggle(option.value)} className="mt-1 h-4 w-4 accent-[hsl(113_40%_40%)]" data-testid={`checkbox-healing-${option.value}`} /><span className="text-lg" aria-hidden="true">{option.icon}</span><span><span className="block text-sm font-bold leading-5">{option.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span></span></label>; })}</div>
    <button onClick={saveSettings} className="tactile mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_4px_0_hsl(18_58%_36%)]" data-testid="button-save-healing-modes"><Sparkles size={16} /> Áp dụng và tạo thực đơn chữa lành</button>
  </section>;
}

function AdvancedPreferences({ prefs, updatePrefs }: { prefs: Preferences; updatePrefs: (value: Partial<Preferences>) => void }) {
  const meals = [['breakfast', 'Bữa sáng'], ['lunch', 'Bữa trưa'], ['dinner', 'Bữa tối']] as const;
  const toggleMeal = (key: keyof Preferences['selectedMeals'], checked: boolean) => {
    const next = { ...prefs.selectedMeals, [key]: checked };
    if (Object.values(next).some(Boolean)) updatePrefs({ selectedMeals: next });
  };
  return <section className="paper-card border-primary/15 bg-card p-4 md:p-5" data-testid="advanced-profile-settings">
    <div className="flex items-start gap-3"><span className="text-2xl">✨</span><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Hồ sơ cá nhân nâng cao</p><h2 className="display-font mt-1 text-2xl font-bold">Nhà mình ăn thế nào?</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Chọn đúng nhịp ăn để thực đơn, chi phí và dinh dưỡng khớp với gia đình.</p></div></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <SelectField label="Mục tiêu dinh dưỡng" value={prefs.specialNutrition} onChange={(value) => updatePrefs({ specialNutrition: value as SpecialNutrition, healingModes: ['stress', 'hormone', 'realfood'].includes(value) ? [value as HealingMode] : [] })} options={[['none','Không chọn'],['stress','Phục hồi stress'],['hormone','Cân bằng nội tiết U40–U50'],['realfood','Ít muối & thực phẩm nguyên bản'],['lowcarb','Ít tinh bột / kiểm soát cân nặng'],['who','Gia đình theo khuyến nghị WHO']]} testId="select-special-nutrition" />
      <SelectField label="Số món chính mỗi bữa" value={String(prefs.dishesPerMainMeal)} onChange={(value) => updatePrefs({ dishesPerMainMeal: Number(value) as 1 | 2 | 3 })} options={[['1','1 món: chỉ món đạm'],['2','2 món: đạm + rau'],['3','3 món: đạm + rau + canh']]} testId="select-dishes-per-main-meal" />
    </div>
    <div className="mt-4"><p className="mb-2 text-xs font-bold text-muted-foreground">Bữa muốn lên thực đơn</p><div className="grid gap-2 sm:grid-cols-3">{meals.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-xs font-bold"><input type="checkbox" checked={prefs.selectedMeals[key]} onChange={(event) => toggleMeal(key, event.target.checked)} className="h-4 w-4 accent-primary" data-testid={`checkbox-meal-${key}`} />{label}</label>)}</div></div>
  </section>;
}

function MindfulKitchenMessage() {
  return <aside className="rounded-2xl border border-[hsl(113_40%_75%)] bg-[hsl(113_40%_96%)] px-4 py-3.5 shadow-[0_8px_22px_rgba(71,105,45,.07)]" data-testid="mindful-kitchen-message"><p className="text-sm leading-6 text-[hsl(113_33%_25%)]"><strong>🌿 Hít một hơi thật sâu chị nhé!</strong> 30 phút tới là khoảng thời gian thiền bếp dành riêng cho chị. Hãy thả lỏng đôi vai, cảm nhận mùi thơm tự nhiên và nuôi dưỡng sức khỏe gia đình.</p></aside>;
}

function CountStepper({ label, value, onChange, testId }: { label: string; value: number; onChange: (value: number) => void; testId: string }) {
  return <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5"><span className="text-sm font-bold text-foreground">{label}</span><span className="flex items-center gap-2"><button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="flex h-10 w-10 items-center justify-center rounded-full border text-lg font-bold text-primary" aria-label={`Giảm ${label}`} data-testid={`${testId}-decrease`}>−</button><span className="flex h-10 w-10 items-center justify-center text-base font-bold text-foreground" aria-live="polite">{value}</span><button type="button" onClick={() => onChange(Math.min(12, value + 1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground" aria-label={`Tăng ${label}`} data-testid={`${testId}-increase`}>+</button></span></div>;
}

function SettingsModal({ prefs, setOpen, updatePrefs, saveSettings }: { prefs: Preferences; setOpen: (value: boolean) => void; updatePrefs: (value: Partial<Preferences>) => void; saveSettings: () => void }) {
  const [tab, setTab] = useState<'members' | 'taste' | 'healing'>('members');
  const minimumSafeBudget = Math.round((prefs.kids * 0.55 + prefs.adults + prefs.elderly * 0.8) * 35_000 * 7);
  const comfortableBudget = Math.round(minimumSafeBudget * 2.2);
  const currentBudget = prefs.targetBudget || 0;
  const budgetStatus = currentBudget < minimumSafeBudget ? 'low' : currentBudget > comfortableBudget ? 'high' : 'balanced';
  const formatBudget = (value: number) => `${value.toLocaleString('vi-VN')}đ`;
  const setPresetBudget = (budget: Budget) => updatePrefs({ budget, targetBudget: presetBudgets[budget] });
  const toggleMeal = (key: keyof Preferences['selectedMeals']) => {
    const next = { ...prefs.selectedMeals, [key]: !prefs.selectedMeals[key] };
    if (Object.values(next).some(Boolean)) updatePrefs({ selectedMeals: next });
  };
  const toggleAllergy = (value: string) => updatePrefs({ allergies: prefs.allergies.includes(value) ? prefs.allergies.filter((item) => item !== value) : [...prefs.allergies, value] });
  const toggleHealing = (mode: HealingMode) => updatePrefs({ healingModes: prefs.healingModes.includes(mode) ? prefs.healingModes.filter((item) => item !== mode) : [...prefs.healingModes, mode] });
  return <div className="settings-modal fixed inset-0 z-[70] flex items-end justify-center bg-foreground/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
    <div className="settings-modal-panel flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[24px] bg-card shadow-2xl sm:rounded-[24px]">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Nhà mình</p><h2 id="settings-modal-title" className="display-font text-2xl font-bold">Thiết lập nhà mình</h2></div><button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Đóng thiết lập"><X size={19} /></button></div>
      <div className="flex gap-1 overflow-x-auto border-b bg-muted/40 p-2" role="tablist" aria-label="Nhóm thiết lập"><button type="button" onClick={() => setTab('members')} className={`settings-tab ${tab === 'members' ? 'settings-tab-active' : ''}`} role="tab" aria-selected={tab === 'members'}>👨‍👩‍👧‍👦 Thành viên & Ngân sách</button><button type="button" onClick={() => setTab('taste')} className={`settings-tab ${tab === 'taste' ? 'settings-tab-active' : ''}`} role="tab" aria-selected={tab === 'taste'}>🥗 Khẩu vị & Dị ứng</button><button type="button" onClick={() => setTab('healing')} className={`settings-tab ${tab === 'healing' ? 'settings-tab-active' : ''}`} role="tab" aria-selected={tab === 'healing'}>🌿 Bếp Chữa Lành</button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'members' && <div className="space-y-3"><div className="grid gap-2 sm:grid-cols-3"><CountStepper label="Trẻ nhỏ" value={prefs.kids} onChange={(value) => updatePrefs({ kids: value })} testId="stepper-kids" /><CountStepper label="Người già" value={prefs.elderly} onChange={(value) => updatePrefs({ elderly: value })} testId="stepper-elderly" /><CountStepper label="Người lớn" value={prefs.adults} onChange={(value) => updatePrefs({ adults: value })} testId="stepper-adults" /></div><div className="grid gap-3 sm:grid-cols-2"><SelectField label="Thời gian nấu" value={String(prefs.maxTime)} onChange={(value) => updatePrefs({ maxTime: Number(value) })} options={[['20', '20 phút'], ['30', '30 phút'], ['45', '45 phút']]} testId="modal-select-time" /><SelectField label="Mục tiêu dinh dưỡng" value={prefs.specialNutrition} onChange={(value) => updatePrefs({ specialNutrition: value as SpecialNutrition })} options={[['none', 'Không chọn'], ['lowcarb', 'Ít tinh bột'], ['who', 'Theo khuyến nghị WHO']]} testId="modal-select-nutrition" /></div><div><p className="mb-2 text-xs font-bold text-muted-foreground">Ngân sách đi chợ</p><div className="grid grid-cols-3 gap-2">{(['tietkiem', 'vua', 'thoaimai'] as Budget[]).map((budget) => <button type="button" key={budget} onClick={() => setPresetBudget(budget)} className={`rounded-xl border px-2 py-3 text-xs font-bold ${prefs.targetBudget === presetBudgets[budget] ? 'border-primary bg-secondary text-primary' : 'bg-card text-muted-foreground'}`}>{budgetLabels[budget]}</button>)}</div><input type="number" min="0" value={prefs.targetBudget || ''} onChange={(event) => updatePrefs({ targetBudget: Math.max(0, Number(event.target.value) || 0), budget: 'vua' })} placeholder="Hoặc tự nhập số tiền (VNĐ/tuần)..." className="mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm text-foreground outline-none ring-primary focus:ring-2" data-testid="input-custom-weekly-budget" /><div className={`mt-2 rounded-lg p-2.5 text-[13px] leading-5 ${budgetStatus === 'low' ? 'budget-alert-low' : budgetStatus === 'high' ? 'budget-alert-high' : 'budget-alert-balanced'}`}>{budgetStatus === 'low' ? <><p>⚠️ Chị ơi, ngân sách này hơi 'hẹp' so với số thành viên nhà mình. Bếp sẽ ưu tiên món đạm thực vật/trứng, nhưng chị nhớ cân nhắc bổ sung dinh dưỡng nhé!</p><button type="button" onClick={() => updatePrefs({ targetBudget: minimumSafeBudget })} className="mt-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-primary">⚡ Nâng lên mức an toàn {formatBudget(minimumSafeBudget)}</button></> : budgetStatus === 'high' ? <p>💡 Ngân sách tuần này rất dồi dào! Bếp sẽ lên món ngon cao cấp. Chị có muốn trích phần tiền thừa dư ra vào Quỹ Tích Sản 2036 không?</p> : <p>✨ Ngân sách khéo vén chuẩn chỉnh!</p>}</div></div></div>}
        {tab === 'taste' && <div className="space-y-4"><div><p className="mb-2 text-xs font-bold text-muted-foreground">Bữa muốn lên thực đơn</p><div className="flex flex-wrap gap-2">{([['breakfast', '🌅 Bữa sáng'], ['lunch', '☀️ Bữa trưa'], ['dinner', '🌙 Bữa tối']] as const).map(([key, label]) => <button type="button" key={key} onClick={() => toggleMeal(key)} className={`rounded-full border px-3.5 py-2.5 text-xs font-bold ${prefs.selectedMeals[key] ? 'border-primary bg-secondary text-primary' : 'bg-card text-muted-foreground'}`}>{label}</button>)}</div></div><div><p className="mb-2 text-xs font-bold text-muted-foreground">Dị ứng cần tránh</p><div className="flex flex-wrap gap-2">{allergyOptions.map((option) => <button type="button" key={option.value} onClick={() => toggleAllergy(option.value)} className={`rounded-full border px-3 py-2 text-xs font-bold ${prefs.allergies.includes(option.value) ? 'border-accent bg-accent/15 text-primary' : 'bg-card text-muted-foreground'}`}>{option.label}</button>)}</div></div><label className="block text-xs font-bold text-muted-foreground">Dị ứng khác<input value={prefs.allergyOther} onChange={(event) => updatePrefs({ allergyOther: event.target.value })} placeholder="Ví dụ: đậu phộng" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-3 text-sm text-foreground outline-none ring-primary focus:ring-2" /></label></div>}
        {tab === 'healing' && <div className="space-y-2">{healingModeOptions.map((option) => { const active = prefs.healingModes.includes(option.value); return <button type="button" key={option.value} onClick={() => toggleHealing(option.value)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left ${active ? 'border-primary bg-secondary' : 'bg-card'}`}><span className="flex items-center gap-2 text-sm font-bold"><span>{option.icon}</span>{option.title}</span><span className={`settings-switch ${active ? 'settings-switch-on' : ''}`} aria-hidden="true"><span /></span></button>; })}<p className="pt-2 text-xs leading-5 text-muted-foreground">Bếp sẽ ưu tiên nguyên liệu và cách nấu phù hợp với trạng thái nhà mình.</p></div>}
      </div>
      <div className="border-t bg-card p-4"><button type="button" onClick={() => { saveSettings(); setOpen(false); }} className="warm-cta flex w-full items-center justify-center gap-2 bg-primary" data-testid="button-save-settings"><Sparkles size={17} /> Áp dụng & Tạo thực đơn mới</button></div>
    </div>
  </div>;
}

function ZeroScrollMealPlanner({ plan, prefs, favorites, setFavorites, onSwap }: { plan: DayPlan[]; prefs: Preferences; favorites: Set<string>; setFavorites: (value: Set<string>) => void; onSwap: (dayIndex: number, slot: DishSlot) => void }) {
  const [, setLocation] = useLocation();
  const [selectedDay, setSelectedDay] = useState(plan[0]?.day || DAY_NAMES[0]);
  const [selectedMeal, setSelectedMeal] = useState<'lunch' | 'dinner' | 'breakfast'>('lunch');
  useEffect(() => {
    setSelectedDay(plan[0]?.day || DAY_NAMES[0]);
  }, [plan]);
  const dayIndex = DAY_NAMES.indexOf(selectedDay);
  const planIndex = plan.findIndex((day) => day.day === selectedDay);
  const day = planIndex >= 0 ? plan[planIndex] : null;
  const mealOptions = [
    { key: 'lunch' as const, label: 'Bữa Trưa', icon: '☀️' },
    { key: 'dinner' as const, label: 'Bữa Tối', icon: '🌙' },
    { key: 'breakfast' as const, label: 'Bữa Sáng', icon: '🌅' },
  ];
  const dishes = day && selectedMeal === 'breakfast'
    ? [{ dish: day.breakfast, slot: 'breakfast' as DishSlot }]
    : day && selectedMeal === 'lunch'
      ? [{ dish: day.lunch.dam, slot: 'lunch.dam' as DishSlot }, ...(prefs.dishesPerMainMeal >= 2 ? [{ dish: day.lunch.rau, slot: 'lunch.rau' as DishSlot }] : []), ...(prefs.dishesPerMainMeal >= 3 ? [{ dish: day.lunch.canh, slot: 'lunch.canh' as DishSlot }] : [])]
      : day
        ? [{ dish: day.dinner.dam, slot: 'dinner.dam' as DishSlot }, ...(prefs.dishesPerMainMeal >= 2 ? [{ dish: day.dinner.rau, slot: 'dinner.rau' as DishSlot }] : []), ...(prefs.dishesPerMainMeal >= 3 ? [{ dish: day.dinner.canh, slot: 'dinner.canh' as DishSlot }] : [])]
        : [];
  const mealLabel = mealOptions.find((meal) => meal.key === selectedMeal)?.label || 'Bữa Trưa';
  const units = unitsOf(prefs);
  return <section className="menu-planner space-y-3" aria-label="Thực đơn theo ngày và bữa">
    <div className="menu-day-selector flex gap-2 overflow-x-auto" role="tablist" aria-label="Chọn ngày">
      {DAY_NAMES.map((name, index) => { const isActive = selectedDay === name; const isToday = name === plan[0]?.day; const isLocked = !plan.some((item) => item.day === name); return <button key={name} onClick={() => setSelectedDay(name)} className={`relative flex min-w-[52px] shrink-0 flex-col items-center justify-center rounded-xl px-3 py-2 text-xs font-bold transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card text-muted-foreground'} ${isLocked ? 'opacity-60' : ''}`} role="tab" aria-selected={isActive} data-testid={`button-day-selector-${index + 1}`}><span>{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index]}</span>{isToday && <span className={`mt-1 h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-accent'}`} aria-label="Hôm nay" />}</button>; })}
    </div>
    <div className="flex rounded-xl bg-muted p-1" role="tablist" aria-label="Chọn bữa">
      {mealOptions.map((meal) => <button key={meal.key} onClick={() => setSelectedMeal(meal.key)} className={`flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold transition-colors ${selectedMeal === meal.key ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`} role="tab" aria-selected={selectedMeal === meal.key} data-testid={`button-meal-tab-${meal.key}`}>{meal.icon} {meal.label}</button>)}
    </div>
    <div className="paper-card !mb-0 p-3" data-testid="zero-scroll-meal-panel">
      <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">{selectedDay}</p><h2 className="display-font text-xl font-bold">{mealLabel}</h2></div><span className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold text-secondary-foreground">{day ? `${dishes.length} món` : 'Đang khóa'}</span></div>
      {day ? <MealGrid dishes={dishes} favorites={favorites} setFavorites={setFavorites} onSwap={(slot) => onSwap(planIndex, slot)} /> : <div className="rounded-xl bg-secondary/60 p-5 text-center"><p className="text-sm font-bold">Ngày này đang được khóa</p><p className="mt-1 text-xs text-muted-foreground">Mở khóa Pro để xem trọn thực đơn 7 ngày.</p></div>}
      <button type="button" onClick={() => { const target = document.getElementById('bhx-daily-cart'); target ? target.scrollIntoView({ behavior: 'smooth', block: 'start' }) : setLocation('/shopping'); }} className="warm-cta mt-3 flex w-full items-center justify-center gap-2 text-center" data-testid="button-meal-shopping"><ShoppingBasket size={17} /> Xem Danh Sách Đi Chợ Cho {selectedMeal === 'dinner' ? 'Bữa Tối' : mealLabel}</button>
    </div>
    {day && <BhxDailyCartCard key={`${selectedDay}-${selectedMeal}`} dishes={dishes} units={units} mealLabel={mealLabel} selectedDay={selectedDay} />}
  </section>;
}

function BhxDailyCartCard({ dishes, units, mealLabel, selectedDay }: { dishes: { dish: Dish; slot: DishSlot }[]; units: number; mealLabel: string; selectedDay: string }) {
  const ingredients = useMemo(() => dailyFreshIngredients(dishes, units), [dishes, units]);
  const [haveAlready, setHaveAlready] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  if (ingredients.length === 0) return null;
  const toggleHave = (name: string) => setHaveAlready((current) => { const next = new Set(current); next.has(name) ? next.delete(name) : next.add(name); return next; });
  const cartTotal = ingredients.reduce((sum, item) => haveAlready.has(item.name) ? sum : sum + priceFor(item.name, item.qty), 0);
  const freeshipGap = 100000 - cartTotal;
  const shareDailyList = async () => {
    const text = [
      `🛒 DANH SÁCH ĐI CHỢ - ${mealLabel.toUpperCase()} ${selectedDay.toUpperCase()} - 30 PHÚT YÊU THƯƠNG`,
      ...ingredients.map((item) => `${haveAlready.has(item.name) ? '✅' : '⬜'} ${item.name}: ${displayQuantity(item)}${haveAlready.has(item.name) ? ' (nhà đã có sẵn)' : ''} — ${money(priceFor(item.name, item.qty))}`),
      `\n📦 Chi phí nguyên liệu tươi BHX dự toán: ~${money(cartTotal)}`,
      `Mở ứng dụng: ${new URL('/', window.location.href).href}`,
    ].join('\n');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopied(true);
      trackEvent('bhx_daily_cart_shared', { day: selectedDay, meal: mealLabel, total: cartTotal });
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return <section id="bhx-daily-cart" className="paper-card !mb-0 bhx-cart-card p-3.5" data-testid="card-bhx-daily-cart">
    <div className="mb-2 flex items-center justify-between gap-2"><h3 className="min-w-0 truncate text-xs font-bold">🧾 Nguyên liệu tươi cho {mealLabel} {selectedDay}</h3><div className="flex shrink-0 items-center gap-1.5"><span className="text-[10px] font-bold text-muted-foreground">{ingredients.length} món</span><button type="button" onClick={shareDailyList} className="tactile inline-flex items-center gap-1 rounded-full border border-[hsl(43_31%_85%)] bg-white px-2 py-1 text-[10px] font-bold text-primary" aria-label="Gửi danh sách nguyên liệu ngày qua Zalo" data-testid="button-bhx-daily-share">{copied ? <Check size={11} /> : <Share2 size={11} />}{copied ? 'Đã copy' : 'Gửi Zalo'}</button></div></div>
    <div className="space-y-1">{ingredients.map((item) => { const checked = haveAlready.has(item.name); return <label key={item.name} className={`bhx-cart-row ${checked ? 'bhx-cart-row-done' : ''}`}>
      <input type="checkbox" checked={checked} onChange={() => toggleHave(item.name)} className="h-4 w-4 shrink-0" style={{ accentColor: '#008848' }} aria-label={`Nhà đã có sẵn ${item.name}`} data-testid={`checkbox-bhx-have-${item.name}`} />
      <span className={`min-w-0 flex-1 truncate text-xs font-bold ${checked ? 'text-muted-foreground line-through' : ''}`}>{item.name}</span>
      <span className="shrink-0 text-[10px] font-bold text-muted-foreground">{displayQuantity(item)}</span>
      <span className="shrink-0 text-[10px] font-bold text-primary">{money(priceFor(item.name, item.qty))}</span>
    </label>; })}</div>
    <div className="mt-3 border-t border-[hsl(43_31%_90%)] pt-3">
      <p className="text-xs font-bold">📦 Chi phí nguyên liệu tươi BHX dự toán: <span style={{ color: '#008848' }}>~{money(cartTotal)}</span></p>
      {cartTotal > 0 && freeshipGap > 0 && <p className="mt-1.5 text-[11px] font-semibold leading-4 text-amber-700" data-testid="text-bhx-freeship-hint">🚚 Mua thêm Đồ khô/Sữa/Gia vị (~{Math.ceil(freeshipGap / 1000)}k) để đạt mốc FREESHIP của Bách Hóa Xanh</p>}
      <a href={BACH_HOA_XANH_AFFILIATE_URL} target="_blank" rel="nofollow sponsored noopener" onClick={() => trackEvent('bhx_daily_cart_opened', { day: selectedDay, meal: mealLabel, total: cartTotal })} className="bhx-cta tactile mt-2.5 flex w-full items-center justify-center gap-2 text-center no-underline" data-testid="button-bhx-daily-cart"><ShoppingBasket size={16} /> 🛒 Đặt Giao Tươi Sáng Mai Qua Bách Hóa Xanh</a>
    </div>
  </section>;
}

function HomePage({ plan, isPro, onUpgrade, prefs, settingsOpen, setSettingsOpen, updatePrefs, saveSettings, regenerate, expandedDay, setExpandedDay, activeMeal, setActiveMeal, favoriteDishes, setFavoriteDishes, totalCost, forceBudget, budgetNotice, swapNotice, onSwapDish }: { plan: DayPlan[]; isPro: boolean; onUpgrade: () => void; prefs: Preferences; settingsOpen: boolean; setSettingsOpen: (value: boolean) => void; updatePrefs: (value: Partial<Preferences>) => void; saveSettings: () => void; regenerate: () => void; expandedDay: number; setExpandedDay: (value: number) => void; activeMeal: 'all' | 'breakfast' | 'lunch' | 'dinner'; setActiveMeal: (value: 'all' | 'breakfast' | 'lunch' | 'dinner') => void; favoriteDishes: Set<string>; setFavoriteDishes: (value: Set<string>) => void; totalCost: number; forceBudget: () => void; budgetNotice: string; swapNotice: string; onSwapDish: (dayIndex: number, slot: DishSlot) => void }) {
  const today = plan[0];
  const visiblePlan = isPro ? plan : plan.slice(0, FREE_DAY_LIMIT);
  const units = unitsOf(prefs);
  return <div className="space-y-5 pb-5">
    <div className="compact-message" aria-label="Thông điệp bếp"><span>🌿 Nấu nhanh một chút, thương nhau nhiều hơn.</span></div>
    {settingsOpen && <SettingsModal prefs={prefs} setOpen={setSettingsOpen} updatePrefs={updatePrefs} saveSettings={saveSettings} />}
    <div className="hidden md:block"><MindfulKitchenMessage /></div>
    <ZeroScrollMealPlanner plan={visiblePlan} prefs={prefs} favorites={favoriteDishes} setFavorites={setFavoriteDishes} onSwap={onSwapDish} />
    <button type="button" onClick={() => setSettingsOpen(true)} className="settings-launch tactile flex w-full items-center justify-between rounded-2xl border bg-card px-4 py-3 text-left shadow-sm" data-testid="button-toggle-settings"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><SlidersHorizontal size={17} /></span><span><span className="block text-sm font-bold">Thiết lập nhà mình</span><span className="block text-xs text-muted-foreground">{prefs.kids} trẻ nhỏ · {prefs.elderly} người già · {prefs.adults} người lớn</span></span></span><ChevronDown size={18} className="text-muted-foreground" /></button>
    <section className="hidden">
      <div className="min-w-0 space-y-4"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">{isPro ? 'Trọn tuần' : 'Gói miễn phí · 3 ngày đầu'}</p><h2 className="display-font mt-1 text-3xl font-bold tracking-tight">Mình ăn gì nhỉ?</h2></div><button onClick={regenerate} className="tactile inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3.5 py-2 text-xs font-bold text-primary" data-testid="button-regenerate"><RefreshCw size={14} /> Đổi tuần khác</button></div><div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist">{[['all','Tất cả'],['breakfast','Bữa sáng'],['lunch','Bữa trưa'],['dinner','Bữa tối']].filter(([value]) => value === 'all' || prefs.selectedMeals[value as keyof Preferences['selectedMeals']]).map(([value,label]) => <button key={value} onClick={() => setActiveMeal(value as typeof activeMeal)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors ${activeMeal === value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`} data-testid={`button-filter-${value}`}>{label}</button>)}</div><BudgetWarning plan={plan} units={units} p={prefs} totalCost={totalCost} forceBudget={forceBudget} />{budgetNotice && <p className="rounded-xl border border-amber-400/40 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800" role="status" data-testid="budget-infeasible-notice">{budgetNotice}</p>}{swapNotice && <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs font-bold leading-5 text-foreground" role="status" data-testid="status-dish-swap">{swapNotice}</p>}{visiblePlan.map((day, index) => <DayCard key={day.day} day={day} index={index} open={expandedDay === index} setOpen={() => setExpandedDay(expandedDay === index ? -1 : index)} activeMeal={activeMeal} favorites={favoriteDishes} setFavorites={setFavoriteDishes} prefs={prefs} onSwap={(slot) => onSwapDish(index, slot)} />)}{!isPro && <LockedWeekBanner onUpgrade={onUpgrade} />}</div>
      <aside className="space-y-4"><div className="paper-card p-5"><h3 className="text-sm font-bold flex items-center gap-2 mb-4"><WalletCards size={17} className="text-primary" /> Ngân sách tuần này</h3><BudgetProgress totalCost={totalCost} targetBudget={prefs.targetBudget || 1200000} /></div><TodayCard day={today} prefs={prefs} /><NutritionCard plan={visiblePlan} prefs={prefs} /><NewsletterSignup /><div className="paper-card hidden overflow-hidden p-5 md:block"><div className="flex items-center gap-2 text-sm font-bold"><Sparkles size={17} className="text-primary" /> Mẹo để bếp nhẹ tênh</div><p className="mt-3 text-sm leading-6 text-muted-foreground">Sơ chế hành, gừng và rau củ ngay sau khi đi chợ. Đến bữa chỉ cần mở nồi hấp — 30 phút đủ cho cả nhà ngồi vào mâm.</p></div></aside>
    </section>
  </div>;
}

function LockedWeekBanner({ onUpgrade }: { onUpgrade: () => void }) {
  return <section className="relative overflow-hidden rounded-[28px] border border-[hsl(43_100%_61%/.55)] bg-[linear-gradient(135deg,hsl(43_100%_61%/.25),hsl(18_80%_56%/.12))] p-5 shadow-[0_12px_28px_rgba(112,64,25,.08)] md:p-6">
    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/30 blur-2xl" />
    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-accent"><LockKeyhole size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Ngày 4–7 đang khóa</p><h3 className="display-font mt-1 text-xl font-bold">🔒 Mở khóa thực đơn trọn tuần & Hỏi AI không giới hạn chỉ 49k/tháng</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Ăn đủ 7 ngày, nhận công thức đầy đủ và dùng trợ lý AI không giới hạn.</p></div></div>
      <button onClick={onUpgrade} className="warm-cta tactile inline-flex shrink-0 items-center justify-center gap-2 shadow-[0_4px_0_hsl(18_58%_36%)]" data-testid="button-upgrade-locked"><Crown size={15} /> Nâng cấp Pro</button>
    </div>
  </section>;
}

function NewsletterSignup() {
  const [email, setEmail] = useState(() => window.localStorage.getItem(NEWSLETTER_STORAGE_KEY) || '');
  const [saved, setSaved] = useState(() => Boolean(window.localStorage.getItem(NEWSLETTER_STORAGE_KEY)));
  const subscribe = () => {
    if (!email.trim() || !email.includes('@')) return;
    window.localStorage.setItem(NEWSLETTER_STORAGE_KEY, email.trim());
    setEmail(email.trim());
    setSaved(true);
    trackEvent('newsletter_subscribed', { placement: 'home_sidebar' });
  };
  return <section className="paper-card overflow-hidden border-primary/20 bg-primary/5 p-5">
    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Mail size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">Bản tin Chủ Nhật</p><h3 className="display-font mt-1 text-xl font-bold">Sáng Chủ Nhật, mình gửi món mới nhé?</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Nhận gợi ý thực đơn tuần mới và mẹo đi chợ gọn hơn qua email.</p></div></div>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setSaved(false); }} placeholder="email của bạn@example.com" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2" data-testid="input-newsletter-email" /><button onClick={subscribe} className="tactile inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground" data-testid="button-newsletter-subscribe"><Mail size={14} /> Nhận bản tin</button></div>
    {saved && <p className="mt-2 text-xs font-bold text-[hsl(113_33%_30%)]" role="status"><Check size={13} className="mr-1 inline" /> Đã lưu email. Hẹn nhà mình sáng Chủ Nhật!</p>}
  </section>;
}

function ProUpgradeModal({ open, onClose, onUnlocked, globalPhone, setGlobalPhone, globalEmail, setGlobalEmail }: { open: boolean; onClose: () => void; onUnlocked: () => void; globalPhone?: string; setGlobalPhone?: (p: string) => void; globalEmail?: string; setGlobalEmail?: (email: string) => void }) {
  const [phone, setPhone] = useState(globalPhone || '');
  const [email, setEmail] = useState(globalEmail || '');
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');

  useEffect(() => {
    if (phone && setGlobalPhone) {
      setGlobalPhone(phone);
      window.localStorage.setItem('30phut-user-phone', phone);
    }
  }, [phone, setGlobalPhone]);

  useEffect(() => {
    if (email && setGlobalEmail) {
      setGlobalEmail(email);
      window.localStorage.setItem('30phut-user-email', email);
    }
  }, [email, setGlobalEmail]);

  useEffect(() => {
    if (open && globalPhone && !phone) {
      setPhone(globalPhone);
    }
    if (open && globalEmail && !email) {
      setEmail(globalEmail);
    }
  }, [open, globalPhone, globalEmail]);
  const [qr, setQr] = useState<ProQr | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setPhone('');
      setEmail('');
      setQr(null);
      setSelectedPlan('annual');
      setLoading(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;
  const createQr = async () => {
    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length < 8 || normalizedPhone.length > 15) {
      setError('Bạn hãy nhập số điện thoại từ 8 đến 15 số.');
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail && !trimmedEmail.includes('@')) {
      setError('Email không hợp lệ. Vui lòng kiểm tra lại email của bạn.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/pro/qr'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalizedPhone, email: trimmedEmail || undefined, plan: selectedPlan }) });
      const rawText = await response.text();
      let data: ProQr | { error?: string } | null = null;

      if (rawText) {
        try {
          data = JSON.parse(rawText) as ProQr | { error?: string };
        } catch {
          throw new Error('Phản hồi từ máy chủ không hợp lệ.');
        }
      }

      if (!response.ok) {
        const errorMessage = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'Chưa tạo được mã QR.';
        throw new Error(errorMessage);
      }

      if (!data || typeof data !== 'object' || !('qrUrl' in data) || !('transferContent' in data) || !('amount' in data)) {
        throw new Error('Phản hồi từ máy chủ không hợp lệ.');
      }
      setQr(data);
      trackEvent('pro_qr_created', { plan: selectedPlan, has_email: Boolean(trimmedEmail) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chưa tạo được mã QR. Bạn thử lại nhé.');
    } finally {
      setLoading(false);
    }
  };

  return <div className="pro-sales-backdrop fixed inset-0 z-[2000] flex items-end justify-center bg-foreground/55 p-0 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pro-upgrade-title">
    <div className="pro-sales-sheet max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-card p-5 shadow-2xl sm:rounded-[24px] md:p-7">
      <div className="flex items-start justify-between gap-4"><div><h2 id="pro-upgrade-title" className="display-font text-2xl font-bold text-primary">👑 NÂNG CẤP BẾP VIP PRO</h2><p className="mt-2 text-sm italic leading-6 text-muted-foreground">Mỗi ngày 1.600đ — Mua lại 10 giờ tự do & Tiết kiệm hàng triệu tiền chợ!</p></div><button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Đóng popup nâng cấp" data-testid="button-close-upgrade"><X size={19} /></button></div>
      <div className="mt-4 grid gap-2 text-sm"><span>✅ Thực đơn đủ 7 ngày, đủ chất</span><span>✅ Hỏi AI không giới hạn</span><span>✅ Công thức và danh sách đi chợ thông minh</span><span>✅ Hỗ trợ gia đình nhiều thành viên</span></div>
      <div className="mt-5 space-y-2" role="radiogroup" aria-label="Chọn gói Pro"><button type="button" onClick={() => setSelectedPlan('annual')} className={`pro-plan-card ${selectedPlan === 'annual' ? 'pro-plan-selected' : ''}`} role="radio" aria-checked={selectedPlan === 'annual'}><span><strong>🌟 GÓI NĂM</strong><span className="block text-xs">{PRO_ANNUAL_PRICE.toLocaleString('vi-VN')} đ/năm · Tiết kiệm 32%</span></span><span className="pro-plan-badge">Khuyên dùng</span></button><button type="button" onClick={() => setSelectedPlan('monthly')} className={`pro-plan-card ${selectedPlan === 'monthly' ? 'pro-plan-selected' : ''}`} role="radio" aria-checked={selectedPlan === 'monthly'}><span><strong>🌿 GÓI THÁNG</strong><span className="block text-xs">{PRO_PRICE.toLocaleString('vi-VN')} đ/tháng</span></span></button></div>
      <div className="mt-5 rounded-2xl bg-secondary/70 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-bold">Gói Pro đã chọn</span><span className="display-font text-2xl font-bold text-primary">{selectedPlan === 'annual' ? PRO_ANNUAL_PRICE.toLocaleString('vi-VN') : PRO_PRICE.toLocaleString('vi-VN')}đ</span></div><p className="mt-2 text-xs text-muted-foreground">Thanh toán một lần qua VietQR, mở khóa ngay trên thiết bị này.</p></div>
      {!qr ? <div className="mt-5 space-y-4"><label className="block text-xs font-bold text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Mail size={14} /> Email người dùng</span><input value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && createQr()} placeholder="email@example.com" type="email" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none ring-primary focus:ring-2" data-testid="input-pro-email" /></label><label className="block text-xs font-bold text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Smartphone size={14} /> Số điện thoại người dùng</span><input value={phone} onChange={(event) => setPhone(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && createQr()} placeholder="Ví dụ: 0912 345 678" inputMode="tel" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none ring-primary focus:ring-2" data-testid="input-pro-phone" /></label><p className="mt-2 text-xs leading-5 text-muted-foreground">Nội dung chuyển khoản sẽ tự điền: <strong>PRO [Số điện thoại]</strong>.</p><button onClick={createQr} disabled={loading} className="tactile mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_4px_0_hsl(18_72%_43%)] disabled:opacity-60" data-testid="button-create-vietqr">{loading ? <><LoaderCircle size={17} className="animate-spin" /> Đang tạo mã QR...</> : <><QrCode size={17} /> Hiện mã QR chuyển khoản</>}</button></div> : <div className="mt-5 text-center"><div className="mx-auto w-fit rounded-2xl border bg-white p-3 shadow-sm"><img src={qr.qrUrl} alt={`Mã VietQR chuyển khoản ${PRO_PRICE.toLocaleString('vi-VN')} đồng`} className="h-64 w-64 object-contain" /></div><p className="mt-3 text-sm font-bold">Quét mã bằng ứng dụng ngân hàng</p><p className="mt-1 text-xs text-muted-foreground">Số tiền: <strong className="text-foreground">{qr.amount.toLocaleString('vi-VN')}đ</strong> · Nội dung: <strong className="text-primary">{qr.transferContent}</strong></p><button onClick={() => { setQr(null); }} className="mt-3 text-xs font-bold text-primary underline" data-testid="button-change-pro-phone">Đổi thông tin</button><button onClick={onUnlocked} className="tactile mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(113_40%_45%)] px-4 py-3 text-sm font-bold text-white shadow-[0_4px_0_hsl(113_40%_35%)]" data-testid="button-confirm-pro"><Check size={17} /> Tôi đã chuyển khoản — mở khóa Pro</button><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Sau khi chuyển khoản thành công, hãy bấm xác nhận để mở khóa trên thiết bị này.</p></div>}
      {error && <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive" role="alert">{error}</p>}
    </div>
  </div>;
}

function SettingsPanel({ open, setOpen, prefs, updatePrefs, saveSettings }: { open: boolean; setOpen: (value: boolean) => void; prefs: Preferences; updatePrefs: (value: Partial<Preferences>) => void; saveSettings: () => void }) {
  return <section className={`paper-card overflow-hidden transition-[max-height] duration-300 ${open ? 'max-h-[900px]' : 'max-h-24'}`}><button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 p-4 text-left md:p-5" data-testid="button-toggle-settings"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><SlidersHorizontal size={17} /></span><span><span className="block text-sm font-bold">Thiết lập nhà mình</span><span className="block text-xs text-muted-foreground">{prefs.kids} trẻ nhỏ · {prefs.elderly} người già · {prefs.adults} người lớn</span></span></span>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>{open && <div className="border-t bg-[hsl(39_67%_96%/.55)] p-4 md:p-5"><div className="grid gap-4 sm:grid-cols-3"><NumberField label="Trẻ nhỏ" hint="hệ số 0,55" value={prefs.kids} onChange={(value) => updatePrefs({ kids: value })} testId="input-kids" /><NumberField label="Người già" hint="hệ số 0,8" value={prefs.elderly} onChange={(value) => updatePrefs({ elderly: value })} testId="input-elderly" /><NumberField label="Người lớn" hint="hệ số 1,0" value={prefs.adults} onChange={(value) => updatePrefs({ adults: value })} testId="input-adults" /></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><SelectField label="Thời gian nấu" value={String(prefs.maxTime)} onChange={(value) => updatePrefs({ maxTime: Number(value) })} options={[['20','20 phút'],['30','30 phút'],['45','45 phút']]} testId="select-time" /><div><label className="text-xs font-bold text-muted-foreground block mb-1.5">Ngân sách đi chợ</label><div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="radiogroup">{(['tietkiem','vua','thoaimai'] as Budget[]).map((b) => <button key={b} role="radio" aria-checked={prefs.budget === b} onClick={() => updatePrefs({ budget: b })} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${prefs.budget === b ? 'border-primary bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>{budgetLabels[b]}</button>)}</div></div><SelectField label="Ăn chay" value={prefs.veg} onChange={(value) => updatePrefs({ veg: value as VegMode })} options={[['0','Không cần'],['1','Xen kẽ'],['2','Hoàn toàn']]} testId="select-vegetarian" /></div><div className="mt-4"><label className="block text-xs font-bold text-muted-foreground">Mục tiêu ngân sách (VNĐ / tuần)</label><div className="relative mt-1.5"><input type="number" step="50000" value={prefs.targetBudget || 1200000} onChange={(event) => updatePrefs({ targetBudget: Number(event.target.value) || 0 })} className="w-full rounded-xl border bg-card px-4 py-2.5 pl-10 text-sm font-bold outline-none ring-primary focus:ring-2" data-testid="input-target-budget" /><WalletCards size={16} className="absolute left-3 top-3 text-muted-foreground" /></div><p className="mt-1 text-[10px] font-medium text-muted-foreground">Tự động ưu tiên món ăn để tổng chi phí không vượt mức này.</p></div><div className="mt-4"><p className="mb-2 text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Dị ứng cần tránh</p><div className="flex flex-wrap gap-2">{allergyOptions.map((option) => { const active = prefs.allergies.includes(option.value); return <button key={option.value} onClick={() => updatePrefs({ allergies: active ? prefs.allergies.filter((item) => item !== option.value) : [...prefs.allergies, option.value] })} className={`rounded-full border px-3 py-2 text-xs font-bold transition-colors ${active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`} data-testid={`button-allergy-${option.label}`}>{active && <Check size={13} className="mr-1 inline" />}{option.label}</button>; })}</div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-muted-foreground">Dị ứng khác<input value={prefs.allergyOther} onChange={(event) => updatePrefs({ allergyOther: event.target.value })} placeholder="Ví dụ: mè, đậu nành" className="mt-1.5 w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2" data-testid="input-allergy-other" /></label><label className="text-xs font-bold text-muted-foreground">Món / nguyên liệu nhà mình thích<input value={prefs.favoriteIngredients} onChange={(event) => updatePrefs({ favoriteIngredients: event.target.value })} placeholder="Ví dụ: cá, bí đỏ, đậu hũ" className="mt-1.5 w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2" data-testid="input-favorites" /></label></div><button onClick={saveSettings} className="tactile mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_4px_0_hsl(18_72%_43%)]" data-testid="button-save-settings"><Check size={16} /> Lưu và tạo thực đơn mới</button></div>}</section>;
}

function NumberField({ label, hint, value, onChange, testId }: { label: string; hint: string; value: number; onChange: (value: number) => void; testId: string }) { return <label className="block text-xs font-bold text-muted-foreground">{label}<input type="number" min="0" max="12" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} className="mt-1.5 w-full rounded-xl border bg-card px-3 py-2.5 text-center text-base font-bold text-foreground outline-none ring-primary focus:ring-2" data-testid={testId} /><span className="mt-1 block text-[10px] font-medium text-muted-foreground">{hint}</span></label>; }
function SelectField({ label, value, onChange, options, testId }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; testId: string }) { return <label className="block text-xs font-bold text-muted-foreground">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border bg-card px-3 py-2.5 text-sm font-bold text-foreground outline-none ring-primary focus:ring-2" data-testid={testId}>{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>; }

function DayCard({ day, index, open, setOpen, activeMeal, favorites, setFavorites, prefs, onSwap }: { day: DayPlan; index: number; open: boolean; setOpen: () => void; activeMeal: 'all' | 'breakfast' | 'lunch' | 'dinner'; favorites: Set<string>; setFavorites: (value: Set<string>) => void; prefs: Preferences; onSwap: (slot: DishSlot) => void }) {
  const total = mealCalories(day, prefs);
  const count = prefs.dishesPerMainMeal;
  const mealEntries: { key: 'breakfast' | 'lunch' | 'dinner'; label: string; dishes: { dish: Dish; slot: DishSlot }[]; color: string }[] = [
    { key: 'breakfast', label: 'Sáng', dishes: prefs.selectedMeals.breakfast ? [{ dish: day.breakfast, slot: 'breakfast' }] : [], color: 'bg-[hsl(43_100%_61%/.22)]' },
    { key: 'lunch', label: 'Trưa', dishes: prefs.selectedMeals.lunch ? [{ dish: day.lunch.dam, slot: 'lunch.dam' }, ...(count >= 2 ? [{ dish: day.lunch.rau, slot: 'lunch.rau' as DishSlot }] : []), ...(count >= 3 ? [{ dish: day.lunch.canh, slot: 'lunch.canh' as DishSlot }] : [])] : [], color: 'bg-[hsl(113_40%_90%)]' },
    { key: 'dinner', label: 'Tối', dishes: prefs.selectedMeals.dinner ? [{ dish: day.dinner.dam, slot: 'dinner.dam' }, ...(count >= 2 ? [{ dish: day.dinner.rau, slot: 'dinner.rau' as DishSlot }] : []), ...(count >= 3 ? [{ dish: day.dinner.canh, slot: 'dinner.canh' as DishSlot }] : [])] : [], color: 'bg-[hsl(12_100%_93%)]' },
  ];
  const available = mealEntries.filter((entry) => entry.dishes.length > 0);
  const visible = activeMeal === 'all' ? available : available.filter((entry) => entry.key === activeMeal);
  const summaryDish = available[0]?.dishes[0]?.dish;
  return <article className={`paper-card overflow-hidden transition-shadow ${open ? 'shadow-[0_14px_32px_rgba(86,51,22,.11)]' : ''}`}>
    <button onClick={setOpen} className="flex w-full items-center justify-between gap-4 p-4 text-left md:p-5" data-testid={`button-day-${index}`}>
      <span className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold ${index === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>{index === 0 ? 'Nay' : String(index + 1).padStart(2, '0')}</span><span><span className="block text-sm font-bold">{day.day}{index === 0 && <span className="ml-2 rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary">Hôm nay</span>}</span><span className="mt-0.5 block text-xs text-muted-foreground">{summaryDish?.name || 'Chưa chọn bữa'} · {total.cal.toFixed(0)} kcal / khẩu phần</span></span></span>
      <span className="text-muted-foreground">{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
    </button>
    {open && <div className="space-y-3 border-t px-4 pb-4 pt-3 md:px-5 md:pb-5">{visible.map((meal) => <div key={meal.key} className={`rounded-2xl p-3 ${meal.color}`}>
      <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[.15em] text-muted-foreground">{meal.label}</span><span className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground"><Clock3 size={12} /> {Math.max(...meal.dishes.map(({ dish }) => dish.time)) + (meal.key === 'breakfast' ? 0 : 8)} phút</span></div>
      <div className="space-y-2">{meal.dishes.map(({ dish, slot }) => <DishRow key={slot} dish={dish} favorite={favorites.has(dish.name)} onSwap={() => onSwap(slot)} onFavorite={() => { const next = new Set(favorites); next.has(dish.name) ? next.delete(dish.name) : next.add(dish.name); setFavorites(next); }} />)}</div>
    </div>)}</div>}
  </article>;
}
// Image Thumbnail stand-in: dishes carry no photo asset, so each ô vuông Mâm Cơm gets a vivid
// pastel emoji thumbnail (bo tròn 12px) keyed off the dish's protein/veg group instead.
const DISH_THUMB_BY_PROTEIN: Record<string, { emoji: string; bg: string }> = {
  fish: { emoji: '🐟', bg: '#DCEEF7' },
  seafood: { emoji: '🦐', bg: '#FDEBD8' },
  pork: { emoji: '🥩', bg: '#FBE3D3' },
  beef: { emoji: '🥩', bg: '#F3D6CE' },
  chicken: { emoji: '🍗', bg: '#FDF1D3' },
  egg: { emoji: '🥚', bg: '#FFF3CD' },
  soy: { emoji: '🍄', bg: '#EFE6F7' },
  plant: { emoji: '🥦', bg: '#D8F3DC' },
};
function dishThumb(dish: Dish): { emoji: string; bg: string } {
  if (dish.type === 'canh') return { emoji: '🍲', bg: '#E9F5EA' };
  if (dish.proteinGroup && DISH_THUMB_BY_PROTEIN[dish.proteinGroup]) return DISH_THUMB_BY_PROTEIN[dish.proteinGroup];
  return { emoji: '🥕', bg: '#FBE9D9' };
}
function cookingSteps(dish: Dish) {
  const ingredients = dish.ing.map(([name]) => name).join(', ');
  const preparation = dish.preparation || 'boil';
  const steps: Record<string, string[]> = {
    steam: [`Sơ chế ${ingredients.toLowerCase()}, ướp nhẹ với gia vị.`, `Cho nguyên liệu vào xửng, hấp trong khoảng ${dish.time} phút.`, 'Kiểm tra chín mềm, rắc hành hoặc tiêu và dùng nóng.'],
    boil: [`Rửa sạch và cắt ${ingredients.toLowerCase()} vừa ăn.`, `Đun sôi nước, cho nguyên liệu vào luộc trong khoảng ${dish.time} phút.`, 'Vớt ra để ráo, nêm lại hoặc dùng kèm nước chấm.'],
    braise: [`Sơ chế ${ingredients.toLowerCase()} và ướp với gia vị trong 5 phút.`, 'Phi thơm hành tỏi, cho nguyên liệu vào đảo săn rồi thêm một ít nước.', `Kho lửa nhỏ khoảng ${dish.time} phút đến khi thấm vị.`],
    stirfry: [`Sơ chế ${ingredients.toLowerCase()} và để ráo.`, 'Làm nóng chảo với một ít dầu, cho nguyên liệu lâu chín vào trước.', `Xào nhanh trên lửa vừa khoảng ${dish.time} phút, nêm vừa ăn rồi tắt bếp.`],
    soup: [`Rửa sạch và cắt ${ingredients.toLowerCase()} vừa ăn.`, 'Đun sôi nước, cho nguyên liệu chính vào nấu chín rồi hớt bọt.', `Cho rau hoặc nguyên liệu còn lại vào, nêm vừa ăn và nấu thêm khoảng ${Math.max(3, dish.time - 5)} phút.`],
    porridge: [`Vo gạo, sơ chế ${ingredients.toLowerCase()} và cắt nhỏ.`, 'Nấu gạo với nước đến khi nở mềm, khuấy đều để cháo không bén nồi.', `Cho nguyên liệu còn lại vào nấu thêm khoảng ${dish.time} phút, nêm nhạt rồi dùng ấm.`],
    grill: [`Sơ chế ${ingredients.toLowerCase()} và ướp nhẹ với gia vị.`, 'Làm nóng nồi chiên không dầu hoặc lò nướng ở 180°C.', `Nướng trong khoảng ${dish.time} phút, trở mặt giữa chừng và kiểm tra chín kỹ.`],
    raw: [`Rửa sạch ${ingredients.toLowerCase()} và để thật ráo.`, 'Cắt hoặc trộn các nguyên liệu theo khẩu vị.', 'Dùng ngay; nếu có nguyên liệu đóng gói, làm nóng theo hướng dẫn trên bao bì.'],
  };
  return steps[preparation] || steps.boil;
}
function DishRow({ dish, favorite, onFavorite, onSwap }: { dish: Dish; favorite: boolean; onFavorite: () => void; onSwap?: () => void }) { const n = nutrition(dish); const steps = cookingSteps(dish); return <div className="rounded-[16px] border border-[hsl(36_40%_90%)] bg-[#FFFDF8] p-3 shadow-[0_10px_20px_rgba(86,51,22,0.04)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold leading-5 text-foreground">{dish.name}</p><div className="mt-1 flex flex-wrap gap-1.5">{(dish.tags || []).slice(0, 2).map((tag) => <span key={tag} className="rounded-full border border-[hsl(36_40%_88%)] bg-white px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{tag}</span>)}<span className="rounded-full bg-[hsl(43_100%_61%/.18)] px-2 py-0.5 text-[10px] font-bold text-foreground">{Math.round(n.cal)} kcal</span></div></div><div className="flex shrink-0 items-center gap-1.5"><button onClick={onSwap} className="flex h-11 items-center gap-1.5 rounded-full border border-[hsl(113_25%_52%)] bg-white px-3 text-[11px] font-bold text-[hsl(113_25%_36%)] shadow-sm" aria-label="🔄 Đổi món này" data-testid={`button-swap-${dish.name}`} title="🔄 Đổi món này"><RefreshCw size={13} /> <span className="hidden sm:inline">Đổi món</span></button><button onClick={onFavorite} className={`flex h-11 w-11 items-center justify-center rounded-full border ${favorite ? 'border-[hsl(113_25%_36%)] bg-[hsl(113_25%_36%)] text-white' : 'border-[hsl(36_40%_88%)] bg-white text-muted-foreground'}`} aria-label="Đánh dấu món yêu thích" data-testid={`button-favorite-${dish.name}`}><Heart size={15} fill={favorite ? 'currentColor' : 'none'} /></button></div></div><details className="mt-3 border-t border-[hsl(36_40%_90%)] pt-2"><summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-bold text-[hsl(113_25%_36%)]"><ChefHat size={14} /> Hướng dẫn nấu</summary><ol className="mt-2 space-y-1.5 pl-5 text-xs leading-5 text-muted-foreground">{steps.map((step, index) => <li key={`${dish.name}-step-${index}`} className="pl-1">{step}</li>)}</ol></details></div>; }
function MealGrid({ dishes, favorites, setFavorites, onSwap }: { dishes: { dish: Dish; slot: DishSlot }[]; favorites: Set<string>; setFavorites: (value: Set<string>) => void; onSwap: (slot: DishSlot) => void }) {
  const groupLabels = ['Món đạm', 'Món rau', 'Món canh'];
  return <div className="meal-grid-wrap"><div className="meal-grid">{dishes.map(({ dish, slot }, index) => { const thumb = dishThumb(dish); return <article key={slot} className="meal-grid-card"><div className="meal-grid-top"><span className="meal-grid-thumb" style={{ background: thumb.bg }} aria-hidden="true">{thumb.emoji}</span><p className="meal-grid-group">{groupLabels[index] || 'Món ăn'}</p></div><p className="meal-grid-name">{dish.name}</p><div className="flex flex-wrap items-center gap-1"><span className="meal-grid-kcal">{Math.round(nutrition(dish).cal)} kcal</span>{dish.veg && <span className="meal-grid-veg">🌱 Chay</span>}</div><div className="meal-grid-actions"><button type="button" onClick={() => onSwap(slot)} className="meal-grid-action" aria-label={`Đổi ${dish.name}`} data-testid={`button-grid-swap-${dish.name}`}><RefreshCw size={13} /> Đổi</button><button type="button" onClick={() => { const next = new Set(favorites); next.has(dish.name) ? next.delete(dish.name) : next.add(dish.name); setFavorites(next); }} className={`meal-grid-favorite ${favorites.has(dish.name) ? 'is-favorite' : ''}`} aria-label={`Yêu thích ${dish.name}`} data-testid={`button-grid-favorite-${dish.name}`}><Heart size={15} fill={favorites.has(dish.name) ? 'currentColor' : 'none'} /></button></div></article>; })}</div><details className="meal-guide"><summary>📖 Xem hướng dẫn nấu {dishes.length} món này</summary><div className="meal-guide-content">{dishes.map(({ dish }) => <div key={dish.name}><strong>{dish.name}</strong><ol>{cookingSteps(dish).map((step) => <li key={step}>{step}</li>)}</ol></div>)}</div></details></div>;
}

function TodayCard({ day, prefs }: { day: DayPlan; prefs: Preferences }) {
  const total = mealCalories(day, prefs);
  const activeCount = Object.values(prefs.selectedMeals).filter(Boolean).length;
  return <section className="paper-card overflow-hidden">
    <div className="flex items-center justify-between bg-foreground px-5 py-4 text-background"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] opacity-65">Mâm cơm hôm nay</p><h3 className="display-font mt-1 text-2xl font-bold">{day.day}</h3></div><span className="rounded-full bg-background/10 px-3 py-1.5 text-xs font-bold">{prefs.maxTime} phút</span></div>
    <div className="space-y-3 p-5">
      {prefs.selectedMeals.breakfast && <div className="rounded-2xl bg-secondary/70 p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-secondary-foreground">Bữa sáng</p><p className="mt-1 text-sm font-bold">{day.breakfast.name}</p></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {prefs.selectedMeals.lunch && <div className="rounded-2xl bg-[hsl(113_40%_90%)] p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(113_33%_30%)]">Trưa</p><p className="mt-1 text-xs font-bold leading-5">{day.lunch.dam.name}</p></div>}
        {prefs.selectedMeals.dinner && <div className="rounded-2xl bg-[hsl(12_100%_93%)] p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Tối</p><p className="mt-1 text-xs font-bold leading-5">{day.dinner.dam.name}</p></div>}
      </div>
      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><BadgeCheck size={14} className="text-[hsl(113_33%_30%)]" /> {activeCount} bữa đã chọn</span><span className="font-bold text-foreground">{Math.round(total.cal).toLocaleString('vi-VN')} kcal</span></div>
    </div>
  </section>;
}
function NutritionCard({ plan, prefs }: { plan: DayPlan[]; prefs: Preferences }) { const avg = plan.reduce((sum, day) => sum + mealCalories(day, prefs).cal, 0) / plan.length * unitsOf(prefs); const target = prefs.kids * DAILY_TARGET.kid.calories + prefs.elderly * DAILY_TARGET.elderly.calories + prefs.adults * DAILY_TARGET.adult.calories; const ratio = Math.min(100, Math.round(avg / target * 100)); return <section className="paper-card p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Dinh dưỡng dự kiến</p><h3 className="display-font mt-1 text-xl font-bold">Vừa đủ cho cả nhà</h3></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(113_40%_90%)] text-[hsl(113_33%_30%)]"><Leaf size={20} /></span></div><div className="mt-5"><div className="mb-2 flex justify-between text-xs font-bold"><span>Trung bình / ngày</span><span className="text-[hsl(113_33%_30%)]">{ratio}% mục tiêu</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[hsl(113_40%_45%)] transition-[width] duration-500" style={{ width: `${ratio}%` }} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Tính theo khẩu phần của {prefs.adults + prefs.elderly + prefs.kids} thành viên và công thức dinh dưỡng từ kho món địa phương.</p></div></section>; }

function ShoppingPage({ shopping, bought, setBought, customItems, setCustomItems, totalCost }: { shopping: Aggregate; bought: Set<string>; setBought: (value: Set<string>) => void; customItems: { name: string; bought: boolean }[]; setCustomItems: (value: { name: string; bought: boolean }[]) => void; totalCost: number }) {
  const [newItem, setNewItem] = useState('');
  const groups = Object.entries(shopping).reduce<Record<string, [string, { qty: number; unit?: string }][]>>((result, item) => { const category = getCategory(item[0]); result[category] = result[category] || []; result[category].push(item); return result; }, {});
  const toggle = (name: string) => { const next = new Set(bought); next.has(name) ? next.delete(name) : next.add(name); setBought(next); };
  const add = () => { if (newItem.trim()) { setCustomItems([...customItems, { name: newItem.trim(), bought: false }]); setNewItem(''); } };
  const boughtCount = [...bought].length + customItems.filter((item) => item.bought).length;
  const totalCount = Object.keys(shopping).length + customItems.length;
  return <div className="space-y-5"><section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-primary">Đi chợ</p><h1 className="display-font mt-1 text-4xl font-bold tracking-tight">Túi đi chợ tuần này</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Đã tính theo đúng số người và 3 bữa mỗi ngày. Chạm vào món đã có sẵn để trừ khỏi dự toán.</p></div><button onClick={() => window.print()} className="tactile inline-flex w-fit items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-xs font-bold" data-testid="button-print-shopping"><Printer size={15} /> In danh sách</button></section><div className="paper-card flex flex-wrap items-center justify-between gap-4 bg-[hsl(41_100%_91%)] p-4 md:p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent"><ShoppingBasket size={19} /></span><div><p className="text-xs font-bold text-muted-foreground">Tiến độ đi chợ</p><p className="text-xl font-bold">{boughtCount}<span className="text-sm font-medium text-muted-foreground"> / {totalCount} món</span></p></div></div><div className="text-right"><p className="text-xs font-bold text-muted-foreground">Ước tính còn cần chi</p><p className="text-xl font-bold text-primary">{money(totalCost)}</p></div></div><div className="grid gap-4 md:grid-cols-2">{Object.entries(groups).map(([category, items]) => <ShoppingGroup key={category} category={category} items={items} bought={bought} toggle={toggle} />)}</div><section className="paper-card p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Tự thêm</p><h2 className="display-font mt-1 text-2xl font-bold">Món cần nhớ</h2></div><Plus size={20} className="text-primary" /></div><div className="mt-4 flex gap-2"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} placeholder="Ví dụ: khăn giấy, nước rửa rau" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-3 text-sm outline-none ring-primary focus:ring-2" data-testid="input-custom-shopping" /><button onClick={add} className="tactile rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="button-add-shopping"><Plus size={16} /></button></div><div className="mt-3 space-y-2">{customItems.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Chưa có món tự thêm. Danh sách này chỉ của riêng nhà mình.</p> : customItems.map((item, index) => <div key={`${item.name}-${index}`} className={`flex items-center justify-between rounded-xl border bg-background px-3 py-3 ${item.bought ? 'opacity-50' : ''}`}><button onClick={() => setCustomItems(customItems.map((entry, i) => i === index ? { ...entry, bought: !entry.bought } : entry))} className="flex min-w-0 items-center gap-3 text-left text-sm font-bold" data-testid={`button-toggle-custom-${index}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${item.bought ? 'border-[hsl(113_40%_45%)] bg-[hsl(113_40%_45%)] text-white' : ''}`}>{item.bought && <Check size={12} />}</span><span className={item.bought ? 'line-through' : ''}>{item.name}</span></button><button onClick={() => setCustomItems(customItems.filter((_, i) => i !== index))} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Xóa món tự thêm" data-testid={`button-remove-custom-${index}`}><Trash2 size={15} /></button></div>)}</div></section></div>;
}
function ShoppingGroup({ category, items, bought, toggle }: { category: string; items: [string, { qty: number; unit?: string }][]; bought: Set<string>; toggle: (name: string) => void }) { return <section className="paper-card overflow-hidden"><div className="flex items-center justify-between border-b bg-muted/45 px-4 py-3"><h2 className="text-sm font-bold">{category}</h2><span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{items.length} món</span></div><div className="divide-y">{items.map(([name, value]) => { const done = bought.has(name); return <div key={name} className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-opacity ${done ? 'opacity-45' : ''}`}><button onClick={() => toggle(name)} className="flex min-w-0 items-center gap-3 text-left" data-testid={`button-bought-${name}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${done ? 'border-[hsl(113_40%_45%)] bg-[hsl(113_40%_45%)] text-white' : 'border-[hsl(37_43%_74%)] bg-card'}`}>{done && <Check size={14} strokeWidth={3} />}</span><span className={`text-sm font-semibold ${done ? 'line-through' : ''}`}>{name}</span></button><span className="shrink-0 text-xs font-bold text-muted-foreground">{displayQuantity(value)}</span></div>; })}</div></section>; }

function ShoppingPageV2({ shopping, bought, setBought, customItems, setCustomItems, totalCost, setQuantityOverrides, targetBudget, prefs, spendLog, onRecordSpend }: { shopping: Aggregate; bought: Set<string>; setBought: (value: Set<string>) => void; customItems: { name: string; bought: boolean }[]; setCustomItems: (value: { name: string; bought: boolean }[]) => void; totalCost: number; setQuantityOverrides: (value: Record<string, number> | ((current: Record<string, number>) => Record<string, number>)) => void; targetBudget: number; prefs: Preferences; spendLog: SpendRecord[]; onRecordSpend: (actual: number) => void }) {
  const [newItem, setNewItem] = useState('');
  const [copied, setCopied] = useState(false);
  const entries = Object.entries(shopping) as [string, { qty: number; unit?: string }][];
  const freshItems = entries.filter(([name]) => shoppingGroup(name) === 'fresh');
  const dryItems = entries.filter(([name]) => shoppingGroup(name) === 'dry');
  const toggle = (name: string) => {
    const next = new Set(bought);
    next.has(name) ? next.delete(name) : next.add(name);
    setBought(next);
  };
  const updateQuantity = (name: string, value: string) => {
    const qty = Number(value);
    if (!Number.isFinite(qty) || qty < 0) return;
    setQuantityOverrides((current) => ({ ...current, [name]: qty }));
  };
  const add = () => {
    if (newItem.trim()) {
      setCustomItems([...customItems, { name: newItem.trim(), bought: false }]);
      setNewItem('');
    }
  };
  const copyShoppingList = async () => {
    const formatItems = (title: string, items: [string, { qty: number; unit?: string }][]) => [
      `\n${title}`,
      ...items.map(([name, value]) => `${bought.has(name) ? '✅' : '⬜'} ${name}: ${displayQuantity(value)}${bought.has(name) ? ' (nhà đã có sẵn)' : ''}`),
    ];
    const text = [
      '🛒 DANH SÁCH ĐI CHỢ - 30 PHÚT YÊU THƯƠNG',
      ...formatItems('THỰC PHẨM TƯƠI SỐNG', freshItems),
      ...formatItems('ĐỒ KHÔ & GIA VỊ', dryItems),
      ...(customItems.length ? ['\nMÓN TỰ THÊM', ...customItems.map((item) => `${item.bought ? '✅' : '⬜'} ${item.name}${item.bought ? ' (nhà đã có sẵn)' : ''}`)] : []),
      `\nƯớc tính còn cần chi: ${money(totalCost)}`,
      `Mở ứng dụng: ${new URL('/', window.location.href).href}`,
    ].join('\n');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };
  const boughtCount = [...bought].filter((name) => shopping[name]).length + customItems.filter((item) => item.bought).length;
  const totalCount = entries.length + customItems.length;
  const budgetPercent = targetBudget > 0 ? Math.min(100, Math.round((totalCost / targetBudget) * 100)) : 0;
  const remainingBudget = Math.max(0, targetBudget - totalCost);
  return <div className="space-y-5 pb-5">
    <section className="shopping-page-header">
      <div className="shopping-title-row"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Đi chợ</p><h1 className="shopping-page-title">Túi đi chợ tuần này</h1></div>
      <div className="flex flex-wrap gap-2">
        <button onClick={copyShoppingList} className="shopping-action warm-cta tactile inline-flex items-center justify-center gap-1.5" data-testid="button-share-zalo">{copied ? <Check size={14} /> : <Share2 size={14} />}{copied ? 'Đã copy' : '📱 Gửi Zalo'}</button>
        <button onClick={() => window.print()} className="shopping-action tactile inline-flex items-center gap-1.5 rounded-full border border-[hsl(34_31%_90%)] bg-white font-bold shadow-sm" data-testid="button-print-shopping"><Printer size={14} /> In</button>
      </div></div>
      <div className="shopping-budget-strip" aria-label="Tiến độ ngân sách tuần"><span className="shrink-0">💰 Đã chi: {money(totalCost)} / {money(targetBudget)}</span><span className="shopping-budget-track" aria-hidden="true"><span style={{ width: `${budgetPercent}%` }} /></span><span className="shrink-0">Còn lại: {money(remainingBudget)} ({boughtCount}/{totalCount} món)</span>
      </div>
    </section>
    <ActualSpendTracker estimated={totalCost} spendLog={spendLog} onRecordSpend={onRecordSpend} />
    <ShoppingGroupV2 title="Thực phẩm tươi sống" subtitle="Thịt, cá, tôm, rau và củ" items={freshItems} bought={bought} toggle={toggle} updateQuantity={updateQuantity} kind="fresh" />
    <ShoppingGroupV2 title="Đồ khô & gia vị" subtitle="Gạo, bún, tôm khô và các món để dành" items={dryItems} bought={bought} toggle={toggle} updateQuantity={updateQuantity} kind="dry" />
    <section className="paper-card border-[hsl(113_40%_45%/.3)] bg-secondary/45 p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(113_33%_30%)]">Mua tươi sống tiện hơn</p><p className="mt-1 text-sm font-semibold">Đặt một lần, giao đủ rau củ và thịt cá cho cả tuần.</p></div><a href={BACH_HOA_XANH_AFFILIATE_URL} target="_blank" rel="nofollow sponsored noopener" className="tactile inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(113_40%_45%)] px-4 py-3 text-xs font-bold text-white shadow-[0_4px_0_hsl(113_40%_35%)]" data-testid="link-bach-hoa-xanh"><ShoppingBasket size={16} /> 🛒 Đặt giao tận nhà qua Bách Hóa Xanh <ExternalLink size={13} /></a></div>
    </section>
    <CustomBagAiCard prefs={prefs} />
    <section className="paper-card p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Tự thêm</p><h2 className="display-font mt-1 text-2xl font-bold">Món cần nhớ</h2></div><Plus size={20} className="text-primary" /></div><div className="mt-4 flex gap-2"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} placeholder="Ví dụ: khăn giấy, nước rửa rau" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-3 text-sm outline-none ring-primary focus:ring-2" data-testid="input-custom-shopping" /><button onClick={add} className="tactile rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="button-add-shopping"><Plus size={16} /></button></div><div className="mt-3 space-y-2">{customItems.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Chưa có món tự thêm. Danh sách này chỉ của riêng nhà mình.</p> : customItems.map((item, index) => <div key={`${item.name}-${index}`} className={`flex items-center justify-between rounded-xl border bg-background px-3 py-3 ${item.bought ? 'opacity-50' : ''}`}><button onClick={() => setCustomItems(customItems.map((entry, i) => i === index ? { ...entry, bought: !entry.bought } : entry))} className="flex min-w-0 items-center gap-3 text-left text-sm font-bold" data-testid={`button-toggle-custom-${index}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${item.bought ? 'border-[hsl(113_40%_45%)] bg-[hsl(113_40%_45%)] text-white' : ''}`}>{item.bought && <Check size={12} />}</span><span className={item.bought ? 'line-through' : ''}>{item.name}</span></button><button onClick={() => setCustomItems(customItems.filter((_, i) => i !== index))} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Xóa món tự thêm" data-testid={`button-remove-custom-${index}`}><Trash2 size={15} /></button></div>)}</div></section>
  </div>;
}

// Actual Spend Tracker: closes the loop between app dự toán và số tiền thực chi tại BHX, vì app
// không thể khoá giỏ hàng bên ngoài — chỉ có thể làm cho khoảng lệch đó hiện rõ ra sau mỗi lần đi chợ.
function ActualSpendTracker({ estimated, spendLog, onRecordSpend }: { estimated: number; spendLog: SpendRecord[]; onRecordSpend: (actual: number) => void }) {
  const weekKey = isoWeekKey();
  const thisWeek = spendLog.find((record) => record.weekKey === weekKey);
  const [value, setValue] = useState(thisWeek ? String(Math.round(thisWeek.actual)) : '');
  const [editing, setEditing] = useState(!thisWeek);

  const submit = () => {
    const actual = Number(value);
    if (!Number.isFinite(actual) || actual <= 0) return;
    onRecordSpend(actual);
    setEditing(false);
  };

  if (thisWeek && !editing) {
    const delta = thisWeek.actual - thisWeek.estimated;
    const deltaPercent = thisWeek.estimated > 0 ? Math.round((delta / thisWeek.estimated) * 100) : 0;
    const isClose = Math.abs(deltaPercent) <= 5;
    const isOver = delta > 0 && !isClose;
    return <section className="paper-card p-4 md:p-5" data-testid="card-actual-spend-summary">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Đối chiếu chi tiêu thực tế · Tuần {weekKeyLabel(weekKey)}</p><p className="mt-1 text-sm leading-6">Dự toán <strong>{money(thisWeek.estimated)}</strong> · Thực chi <strong>{money(thisWeek.actual)}</strong></p></div>
        <button onClick={() => { setEditing(true); setValue(String(Math.round(thisWeek.actual))); }} className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Sửa số tiền thực chi" data-testid="button-edit-actual-spend"><RefreshCw size={14} /></button>
      </div>
      <div className={`mt-3 rounded-xl px-3 py-2.5 text-xs font-bold leading-5 ${isOver ? 'budget-alert-low' : 'budget-alert-high'}`} data-testid="text-actual-spend-delta">
        {isClose ? `🎯 Sát dự toán! Chỉ lệch ${money(Math.abs(delta))} (${Math.abs(deltaPercent)}%) — kỷ luật chi tiêu rất tốt.` : isOver ? `⚠️ Vượt dự toán ${money(delta)} (${deltaPercent}%) so với app tính. Lần đi chợ tới, mang theo checklist và bám sát giá từng món trong danh sách nhé.` : `✅ Chi ít hơn dự toán ${money(Math.abs(delta))} (${Math.abs(deltaPercent)}%) — có thể trích khoản dư này vào Quỹ Tích Sản 2036!`}
      </div>
    </section>;
  }

  return <section className="paper-card p-4 md:p-5" data-testid="card-actual-spend-input">
    <p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Đối chiếu chi tiêu thực tế</p>
    <p className="mt-1 text-sm leading-6 text-muted-foreground">App đang dự toán tuần này <strong className="text-foreground">{money(estimated)}</strong>. Đi chợ xong rồi? Ghi lại số tiền thực đã chi ở Bách Hóa Xanh để biết mình có mua đúng dự toán không.</p>
    <div className="mt-3 flex gap-2">
      <input inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, ''))} onKeyDown={(event) => event.key === 'Enter' && submit()} placeholder="VD: 520000" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-3 text-sm outline-none ring-primary focus:ring-2" data-testid="input-actual-spend" />
      <button onClick={submit} className="tactile shrink-0 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="button-record-actual-spend">Ghi lại</button>
    </div>
  </section>;
}

function ShoppingGroupV2({ title, subtitle, items, bought, toggle, updateQuantity, kind }: { title: string; subtitle: string; items: [string, { qty: number; unit?: string }][]; bought: Set<string>; toggle: (name: string) => void; updateQuantity: (name: string, value: string) => void; kind: 'fresh' | 'dry' }) {
  const [open, setOpen] = useState(true);
  const groupTotal = items.reduce((sum, [name, value]) => sum + priceFor(name, value.qty), 0);
  const subGroups = kind === 'fresh' ? groupFreshItems(items) : null;
  return <section className="shopping-group paper-card overflow-hidden !mb-2">
    <button type="button" onClick={() => setOpen(!open)} className="shopping-group-header flex w-full items-center justify-between gap-3 border-b bg-muted/45 px-3 py-2.5 text-left" aria-expanded={open} data-testid={`button-toggle-shopping-group-${kind}`}><div className="min-w-0"><h2 className="truncate text-sm font-bold">{kind === 'fresh' ? '🥩 ' : '🧂 '}{title} <span className="font-medium text-muted-foreground">({items.length} món · {money(groupTotal)})</span></h2><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{subtitle}</p></div><ChevronDown size={17} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} /></button>
    {open && (items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Tuần này chưa có món thuộc nhóm này.</p> : subGroups ? <div className="space-y-3 p-2">{subGroups.map((sub) => { const subTotal = sub.items.reduce((sum, [name, value]) => sum + priceFor(name, value.qty), 0); return <div key={sub.label}><p className="px-1 pb-1.5 text-[11px] font-bold text-muted-foreground">{sub.icon} {sub.label} <span className="font-medium">({sub.items.length} món · {money(subTotal)})</span></p><div className="shopping-items-grid">{sub.items.map(([name, value]) => <ShoppingItemRow key={name} name={name} value={value} done={bought.has(name)} toggle={toggle} updateQuantity={updateQuantity} kind={kind} />)}</div></div>; })}</div> : <div className="shopping-items-grid p-2">{items.map(([name, value]) => <ShoppingItemRow key={name} name={name} value={value} done={bought.has(name)} toggle={toggle} updateQuantity={updateQuantity} kind={kind} />)}</div>)}
  </section>;
}
function ShoppingItemRow({ name, value, done, toggle, updateQuantity, kind }: { name: string; value: { qty: number; unit?: string }; done: boolean; toggle: (name: string) => void; updateQuantity: (name: string, value: string) => void; kind: 'fresh' | 'dry' }) {
  const affiliateUrl = SHOPPING_AFFILIATE_LINKS[name];
  // Left side (checkbox + name) gets flex-1 min-w-0 with no truncate so the ingredient name is always
  // fully readable; the right side (qty/price/link cluster) is shrink-0 + whitespace-nowrap so those
  // numbers never get squeezed — this is what was hiding names in the old 2-col mobile grid.
  return <div className={`shopping-item flex items-center justify-between gap-2 rounded-xl border px-4 py-3 transition-opacity ${done ? 'shopping-item-done' : 'bg-card'}`}>
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <input type="checkbox" checked={done} onChange={() => toggle(name)} className="h-4 w-4 shrink-0 accent-[hsl(113_40%_45%)]" data-testid={`checkbox-have-${name}`} aria-label={`Nhà đã có ${name}`} />
      <span className={`min-w-0 flex-1 text-xs font-bold ${done ? 'line-through' : ''}`}>{name}</span>
    </div>
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
      <span className="text-[10px] font-bold text-muted-foreground">{displayQuantity(value)}</span>
      <input type="number" min="0" step={value.unit ? '0.1' : '5'} value={quantityEditorValue(value)} onChange={(event) => updateQuantity(name, event.target.value)} className="shopping-quantity" aria-label={`Số lượng ${name}`} data-testid={`input-quantity-${name}`} />
      <span className="text-[10px] font-bold text-primary">{money(priceFor(name, value.qty))}</span>
      {kind === 'dry' && affiliateUrl && <a href={affiliateUrl} target="_blank" rel="nofollow sponsored noopener" className="shopping-link-icon" aria-label={`Mua ${name} trên Shopee`} data-testid={`link-shopee-${name}`}><ExternalLink size={13} /></a>}
    </div>
  </div>;
}

function CustomBagAiCard({ prefs }: { prefs: Preferences }) {
  const [open, setOpen] = useState(true);
  const [bagItems, setBagItems] = useState<BagItem[]>([]);
  const [bagText, setBagText] = useState('');
  const [weekSpread, setWeekSpread] = useState<BagDaySpread[] | null>(null);
  const headcount = prefs.adults + prefs.elderly + prefs.kids;

  const addItem = (name: string, qty = 300, unit: 'g' | 'kg' = 'g') => {
    const { group, pricePerKg } = classifyBagIngredient(name);
    setBagItems((current) => [...current, { id: `bag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, qty, unit, pricePerKg, group }]);
    setWeekSpread(null);
  };
  const addFromText = () => {
    const parsed = parseBagText(bagText);
    if (!parsed.length) return;
    parsed.forEach((item) => addItem(item.name, item.qty, item.unit));
    setBagText('');
  };
  const updateItem = (id: string, patch: Partial<BagItem>) => {
    setBagItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    setWeekSpread(null);
  };
  const removeItem = (id: string) => {
    setBagItems((current) => current.filter((item) => item.id !== id));
    setWeekSpread(null);
  };
  const estimate = useMemo(() => estimateBagWeek(bagItems, prefs), [bagItems, prefs]);
  const runAiSpread = () => { if (bagItems.length) setWeekSpread(spreadBagAcrossWeek(bagItems)); };

  return <section className="paper-card overflow-hidden !mb-2 bag-ai-card">
    <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={open} data-testid="button-toggle-bag-ai">
      <div className="min-w-0"><h2 className="truncate text-sm font-bold">🛒 Tự Nhập Túi Đồ Đã Mua / Sẽ Mua</h2><p className="mt-0.5 truncate text-[10px] text-muted-foreground">Nhập tự do hoặc chọn nhanh, để AI dự toán & rải món cho cả tuần</p></div>
      <ChevronDown size={17} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="mt-3 space-y-3">
      <div className="flex gap-2">
        <input value={bagText} onChange={(event) => setBagText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addFromText()} placeholder="VD: 1kg thịt heo, 500g rau muống, 2 quả cà chua" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-xs outline-none ring-primary focus:ring-2" data-testid="input-bag-text" />
        <button onClick={addFromText} className="tactile shrink-0 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground" aria-label="Thêm từ văn bản" data-testid="button-add-bag-text"><Plus size={15} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">{BAG_QUICK_CHIPS.map((chip) => <button key={chip.label} onClick={() => addItem(chip.label)} className="bag-chip" data-group={chip.group} data-testid={`button-chip-${chip.label}`}>{chip.emoji} {chip.label}</button>)}</div>
      {bagItems.length > 0 && <div className="space-y-1.5">{bagItems.map((item) => {
        const itemDays = bagItemGrams(item) / estimate.perDayNeed[item.group];
        return <div key={item.id} className="bag-item-row">
          <span className="bag-item-name truncate">{item.group === 'dam' ? '🍖' : '🥬'} {item.name}</span>
          <input type="number" min="0" value={item.qty} onChange={(event) => updateItem(item.id, { qty: Math.max(0, Number(event.target.value) || 0) })} className="bag-item-input" aria-label={`Khối lượng ${item.name}`} data-testid={`input-bag-qty-${item.id}`} />
          <button type="button" onClick={() => updateItem(item.id, { unit: item.unit === 'kg' ? 'g' : 'kg' })} className="bag-item-unit-toggle" data-testid={`button-bag-unit-${item.id}`}>{item.unit}</button>
          <input type="number" min="0" value={item.pricePerKg} onChange={(event) => updateItem(item.id, { pricePerKg: Math.max(0, Number(event.target.value) || 0) })} className="bag-item-input" aria-label={`Đơn giá ${item.name} mỗi kg`} data-testid={`input-bag-price-${item.id}`} />
          <span className="shrink-0 text-[10px] font-bold text-primary" data-testid={`text-bag-days-${item.id}`}>{money(bagItemCost(item))} · Đủ {itemDays.toFixed(1)} ngày</span>
          <button onClick={() => removeItem(item.id)} className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={`Xóa ${item.name}`} data-testid={`button-remove-bag-${item.id}`}><Trash2 size={13} /></button>
        </div>;
      })}</div>}
      {bagItems.length > 0 && <div className="bag-estimate-card">
        <p className="bag-estimate-title">🛒 Dự toán túi đồ tuần này ({BAG_MEALS_PER_WEEK} bữa · {headcount} người)</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold">📊 Tổng chi phí: <span className="text-primary">{money(estimate.totalCost)}</span></span>
          <span className="text-[11px] font-bold text-muted-foreground">💡 ~{money(estimate.totalCost / BAG_MEALS_PER_WEEK)} / bữa mâm cơm 3 món</span>
        </div>
        {estimate.shortages.length > 0 ? <div className="mt-2 space-y-1.5">{estimate.shortages.map((shortage) => <div key={shortage.group} className="budget-alert-low rounded-xl px-3 py-2 text-[11px] font-bold leading-5" data-testid={`text-bag-shortage-${shortage.group}`}>⚠️ Thiếu {BAG_GROUP_LABELS[shortage.group]} cho khoảng {shortage.missingDays.toFixed(1)} ngày cuối tuần. Gợi ý mua thêm ~{money(shortage.missingCost)} {shortage.topup} để đủ 7 ngày.</div>)}</div> : <div className="budget-alert-high mt-2 rounded-xl px-3 py-2 text-[11px] font-bold leading-5" data-testid="text-bag-surplus">{estimate.surplusDays > 0.4 ? `✅ Túi đồ đủ ăn trong ${Math.floor(estimate.overallDays)} ngày, dư ra ${money(estimate.surplusCost)} có thể trích vào Quỹ Tích Sản 2036.` : '✅ Túi đồ vừa khớp trọn 7 ngày, không dư không thiếu.'}</div>}
      </div>}
      {bagItems.length > 0 && <button onClick={runAiSpread} className="bag-ai-button tactile flex w-full items-center justify-center gap-1.5" data-testid="button-ai-spread-week"><Sparkles size={14} /> ⚡ AI Tự Động Phân Bổ Vào Thực Đơn 7 Ngày ({BAG_MEALS_PER_WEEK} Bữa)</button>}
      {weekSpread && <div className="space-y-1.5 pt-1">{weekSpread.map((day) => <div key={day.day} className="bag-day-row">
        <span className="bag-day-name">{day.day}</span>
        <span className="bag-day-dish">{day.dam ? <>🍖 {day.dam.name} <em>({day.damMethod})</em></> : <span className="text-muted-foreground">Chưa có món đạm</span>}</span>
        <span className="bag-day-dish">{day.rau ? <>🥬 {day.rau.name}</> : <span className="text-muted-foreground">Chưa có rau</span>}</span>
      </div>)}</div>}
    </div>}
  </section>;
}

function CostsPage({ shopping, prefs, totalCost, plan, spendLog }: { shopping: Aggregate; prefs: Preferences; totalCost: number; plan: DayPlan[]; spendLog: SpendRecord[] }) { const ingredients = Object.entries(shopping).reduce((sum, [name, value]) => sum + priceFor(name, value.qty), 0); const remaining = (prefs.targetBudget || 1200000) - totalCost; const bars = plan.map((day) => Math.round(mealCalories(day).cal * unitsOf(prefs))); const max = Math.max(...bars); const avgDeltaPercent = spendLog.length ? Math.round(spendLog.reduce((sum, record) => sum + (record.estimated > 0 ? (record.actual - record.estimated) / record.estimated : 0), 0) / spendLog.length * 100) : 0; const spendInsight = avgDeltaPercent > 8 ? `Trung bình bạn chi vượt dự toán khoảng ${avgDeltaPercent}%. Thử dùng checklist "Tự Nhập Túi Đồ" ở tab Đi Chợ và bám sát giá từng món khi đứng ở Bách Hóa Xanh.` : avgDeltaPercent < -8 ? `Trung bình bạn chi ít hơn dự toán khoảng ${Math.abs(avgDeltaPercent)}% — có thể hạ nhẹ ngân sách mục tiêu hoặc trích thêm khoản dư vào Quỹ Tích Sản 2036.` : `Mức chi của bạn khá sát dự toán (lệch trung bình ${Math.abs(avgDeltaPercent)}%). Cứ tiếp tục giữ kỷ luật này nhé!`; return <div className="space-y-5"><section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-primary">Chi phí</p><h1 className="display-font mt-1 text-4xl font-bold tracking-tight">Tiền đi chợ, nhìn là hiểu.</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Không cần cộng tay. Công thức giá lấy theo lượng nguyên liệu thật trong thực đơn tuần.</p></div><Link href="/shopping" className="tactile inline-flex w-fit items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-xs font-bold" data-testid="link-costs-shopping">Xem danh sách <ArrowUpRight size={14} /></Link></section><div className="paper-card p-5"><h3 className="text-sm font-bold flex items-center gap-2 mb-4"><WalletCards size={17} className="text-primary" /> Ngân sách tuần này</h3><BudgetProgress totalCost={totalCost} targetBudget={prefs.targetBudget || 1200000} /></div><section className="grid gap-4 sm:grid-cols-3"><StatCard label="Dự kiến cả tuần" value={money(totalCost)} accent="primary" /><StatCard label="Nguyên liệu chính" value={money(ingredients)} /><StatCard label={remaining >= 0 ? 'Còn trong ngân sách' : 'Vượt ngân sách'} value={money(Math.abs(remaining))} accent={remaining >= 0 ? 'sage' : 'berry'} /></section><section className="paper-card p-5 md:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Nhịp chi tiêu</p><h2 className="display-font mt-1 text-2xl font-bold">Mức {budgetLabels[prefs.budget].toLowerCase()}</h2></div><WalletCards size={21} className="text-primary" /></div><div className="mt-6 flex h-44 items-end gap-2 border-b border-l px-2 pb-0 pt-4 sm:gap-4">{bars.map((value, index) => <div key={DAY_NAMES[index]} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-9 rounded-t-lg bg-[hsl(18_80%_56%/.82)] transition-[height] duration-500" style={{ height: `${Math.max(13, value / max * 100)}%` }} /><span className="text-[10px] font-bold text-muted-foreground">{index === 6 ? 'CN' : `T${index + 2}`}</span></div>)}</div><p className="mt-4 text-xs leading-5 text-muted-foreground">Mỗi ngày gồm sáng, trưa, tối và phần gia vị phân bổ theo tuần. Mức này là ước tính tham khảo — giá chợ có thể thay đổi theo mùa.</p></section><section className="paper-card p-5 md:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Đối chiếu thực tế</p><h2 className="display-font mt-1 text-2xl font-bold">Dự toán so với thực chi</h2></div><WalletCards size={21} className="text-primary" /></div>{spendLog.length === 0 ? <p className="mt-4 rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground" data-testid="text-spend-history-empty">Chưa có dữ liệu. Sau khi đi chợ, ghi lại số tiền thực chi ở tab Đi Chợ (mục "Đối chiếu chi tiêu thực tế") để so sánh với dự toán mỗi tuần.</p> : <><div className="mt-4 space-y-2">{spendLog.slice(0, 6).map((record) => { const delta = record.actual - record.estimated; const deltaPercent = record.estimated > 0 ? Math.round(delta / record.estimated * 100) : 0; const isOver = deltaPercent > 5; const isUnder = deltaPercent < -5; return <div key={record.weekKey} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2.5 text-xs" data-testid={`row-spend-history-${record.weekKey}`}><span className="font-bold text-muted-foreground">Tuần {weekKeyLabel(record.weekKey)}</span><span className="font-semibold">{money(record.estimated)} → {money(record.actual)}</span><span className={`rounded-full px-2.5 py-1 font-bold ${isOver ? 'budget-alert-low' : isUnder ? 'budget-alert-high' : 'budget-alert-balanced'}`}>{deltaPercent > 0 ? '+' : ''}{deltaPercent}%</span></div>; })}</div><p className="mt-4 text-xs leading-5 text-muted-foreground" data-testid="text-spend-insight">{spendInsight}</p></>}</section><section className="paper-card p-5 md:p-6"><h2 className="display-font text-2xl font-bold">Nếu muốn tiết kiệm thêm</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-secondary p-4"><p className="text-sm font-bold">Đổi 1 bữa cá hồi</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Cá basa hấp gừng vẫn giữ đạm và omega-3, nhẹ ví hơn khoảng 28.000 đ / khẩu phần.</p></div><div className="rounded-2xl bg-[hsl(41_100%_91%)] p-4"><p className="text-sm font-bold">Mua theo mùa</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Rau luộc trong tuần có thể thay bằng loại đang tươi nhất ở chợ, công thức vẫn đủ chất.</p></div></div></section></div>; }

function KitchenEquityCard({ weeklySaving }: { weeklySaving: number }) {
  const weeklyRate = 0.08 / 52;
  const weeks = 10 * 52;
  const futureValue = weeklySaving * ((Math.pow(1 + weeklyRate, weeks) - 1) / weeklyRate);
  const futureMillions = Math.round(futureValue / 1_000_000);
  return <section className="overflow-hidden rounded-[24px] border border-[hsl(43_70%_70%)] bg-[linear-gradient(135deg,hsl(41_100%_93%),hsl(113_40%_94%))] p-5 shadow-[0_12px_30px_rgba(86,51,22,.07)] md:p-6" data-testid="kitchen-equity-calculator">
    <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">💡</span><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(113_33%_30%)]">Dự báo Tiết Kiệm Tích Sản</p><h2 className="display-font mt-1 text-2xl font-bold">Căn bếp cũng xây tự do tài chính</h2></div></div>
    {weeklySaving > 0 ? <p className="mt-4 text-sm leading-7 text-foreground" data-testid="text-kitchen-equity-forecast">Khéo vén tuần này giúp chị tiết kiệm khoảng <strong className="text-primary">{money(weeklySaving)}</strong>. Nếu trích số tiền này tích sản dài hạn, sau 10 năm chị có thể có thêm khoảng <strong className="text-[hsl(113_33%_30%)]">{futureMillions.toLocaleString('vi-VN')} triệu VNĐ</strong> cho mục tiêu Tự Do Tài Chính!</p> : <p className="mt-4 text-sm leading-7 text-foreground" data-testid="text-kitchen-equity-forecast">Tuần này chưa có khoản dư so với ngân sách mục tiêu. Hãy thử các gợi ý đổi món để bắt đầu tạo một khoản tích sản nhỏ từ căn bếp.</p>}
    <p className="mt-2 text-[10px] leading-5 text-muted-foreground">Minh họa với khoản tiết kiệm được góp đều mỗi tuần và lợi suất giả định 8%/năm. Lợi suất thực tế có thể thay đổi và không được đảm bảo.</p>
    <a href="https://35to53.com" target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('blog_35to53_opened', { source: 'kitchen_equity' })} className="tactile mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-center text-sm font-bold text-background sm:w-auto" data-testid="link-kitchen-equity-blog">Đọc bài viết chia sẻ cách tích sản từ căn bếp trên 35to53.com <ExternalLink size={15} /></a>
  </section>;
}

function BlogFooter() {
  return <footer className="content-wrap no-print pb-28 pt-1 md:pb-6 md:pt-3"><a href="https://35to53.com" target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('blog_35to53_opened', { source: 'footer' })} className="group flex items-center justify-between gap-3 rounded-2xl border border-[hsl(36_70%_82%)] bg-card px-4 py-3.5 text-sm leading-6 shadow-[0_8px_22px_rgba(86,51,22,.05)] transition-colors hover:bg-[hsl(41_100%_96%)]" data-testid="link-footer-35to53"><span><strong>📖 Tìm hiểu thêm</strong> về Triết lý Căn Bếp Chữa Lành &amp; Tự Do Tài Chính tại Blog 35to53.com</span><ArrowUpRight size={17} className="shrink-0 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></a></footer>;
}

function StatCard({ label, value, accent = '' }: { label: string; value: string; accent?: string }) { const primary = accent === 'primary'; return <section className={`paper-card p-5 ${accent === 'sage' ? 'bg-secondary' : accent === 'berry' ? 'bg-[hsl(12_100%_93%)]' : ''}`} style={primary ? { backgroundColor: 'hsl(18 80% 56%)', color: 'white' } : undefined}><p className={`text-xs font-bold ${primary ? 'text-white/80' : 'text-muted-foreground'}`}>{label}</p><p className="display-font mt-2 text-2xl font-bold">{value}</p></section>; }

function AskAiPage({ prefs, plan }: { prefs: Preferences; plan: DayPlan[] }) { const [question, setQuestion] = useState(''); const [messages, setMessages] = useState<{ from: 'ai' | 'me'; text: string }[]>([{ from: 'ai', text: 'Mình ở đây để giúp bữa cơm hôm nay nhẹ đầu hơn. Bạn có thể hỏi về món thay thế, lượng ăn của bé, hoặc cách tận dụng nguyên liệu trong danh sách.' }]); const ask = () => { const text = question.trim(); if (!text) return; const lower = normalize(text); let answer = 'Theo thực đơn tuần này, bạn có thể giữ món chính và đổi phần rau hoặc canh sang món cùng nhóm. Như vậy danh sách đi chợ và dinh dưỡng vẫn cân bằng.'; if (lower.includes('be') || lower.includes('tre')) answer = 'Phần của trẻ nhỏ đang được tính theo hệ số 0,55. Bạn nên múc phần nhạt trước, cắt nhỏ cá và rau, rồi mới nêm đậm hơn cho người lớn.'; else if (lower.includes('nhanh') || lower.includes('phut')) answer = `Bữa nhanh nhất hôm nay là ${plan[0].breakfast.name}, khoảng ${plan[0].breakfast.time} phút. Với bữa chính, ưu tiên hấp đạm và luộc rau cùng lúc để giữ mốc ${prefs.maxTime} phút.`; else if (lower.includes('di ung') || lower.includes('tranh')) answer = prefs.allergies.length || prefs.allergyOther ? `Mình đã loại ${prefs.allergies.join(', ')}${prefs.allergyOther ? ` và ${prefs.allergyOther}` : ''} khỏi gợi ý. Nếu thấy món nào chưa phù hợp, hãy mở Thiết lập nhà mình để cập nhật.` : 'Nhà mình chưa ghi nhận dị ứng nào. Bạn có thể mở Thiết lập nhà mình và thêm ngay, thực đơn sẽ lọc lại.'; else if (lower.includes('nguyen lieu') || lower.includes('con gi')) answer = 'Bạn có thể ưu tiên dùng hết bí đỏ, cà chua và đậu hũ trong tuần này — đây là những nguyên liệu xuất hiện ở nhiều món và dễ bảo quản.'; setMessages([...messages, { from: 'me', text }, { from: 'ai', text: answer }]); setQuestion(''); }; return <div className="mx-auto max-w-3xl space-y-5"><section className="rounded-[28px] bg-foreground p-6 text-background md:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-accent">Bếp nhà mình</p><h1 className="display-font mt-2 text-4xl font-bold tracking-tight">Hỏi gì cũng được.</h1><p className="mt-3 max-w-lg text-sm leading-6 text-background/70">Một trợ lý nhỏ, nhớ thực đơn và những điều gia đình bạn cần tránh.</p></div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Sparkles size={22} /></span></div><div className="mt-6 flex flex-wrap gap-2">{['Món nào nhanh nhất?', 'Bé ăn phần nào?', 'Có thể đổi nguyên liệu không?'].map((prompt) => <button key={prompt} onClick={() => setQuestion(prompt)} className="rounded-full border border-background/15 bg-background/10 px-3 py-2 text-xs font-bold text-background/80 hover:bg-background/15" data-testid={`button-prompt-${prompt}`}>{prompt}</button>)}</div></section><section className="paper-card flex min-h-[390px] flex-col p-4 md:p-6"><div className="flex-1 space-y-4">{messages.map((message, index) => <div key={`${message.from}-${index}`} className={`flex gap-3 ${message.from === 'me' ? 'justify-end' : ''}`}><span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${message.from === 'ai' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>{message.from === 'ai' ? <MessageCircle size={15} /> : <Users size={15} />}</span><p className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.from === 'ai' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`} data-testid={`text-ai-message-${index}`}>{message.text}</p></div>)}</div><div className="mt-6 flex items-center gap-2 rounded-2xl border bg-background p-2 focus-within:ring-2 focus-within:ring-primary"><Search size={17} className="ml-2 text-muted-foreground" /><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && ask()} placeholder="Hỏi về bữa cơm nhà mình..." className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none" data-testid="input-ask-ai" /><button onClick={ask} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-label="Gửi câu hỏi" data-testid="button-ask-ai"><Send size={16} /></button></div></section><p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><CircleHelp size={15} className="mt-0.5 shrink-0" /> Gợi ý địa phương, không thay thế tư vấn y khoa. Luôn kiểm tra dị ứng trước khi nấu cho trẻ nhỏ.</p></div>; }

type FridgeAiResult = { ingredients: { name: string; confidence: number }[]; dishes: { name: string; why: string; ingredients: string[]; steps: string[]; nutrition: { calories: number; protein: number; fat: number } }[]; safetyNotes: string[] };
type RecipeAiResult = { dishName: string; servings: number; ingredients: { name: string; amount: string }[]; steps: string[]; nutrition: { calories: number; protein: number; fat: number }; safetyNotes: string[] };

function AskAiPageV2({ prefs, isPro, onUpgrade }: { prefs: Preferences; isPro: boolean; onUpgrade: () => void }) {
  const [mode, setMode] = useState<'fridge' | 'recipe'>('fridge');
  const [imageData, setImageData] = useState('');
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [imagePreview, setImagePreview] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [fridgeResult, setFridgeResult] = useState<FridgeAiResult | null>(null);
  const [recipeResult, setRecipeResult] = useState<RecipeAiResult | null>(null);
  const [loading, setLoading] = useState<'fridge' | 'recipe' | null>(null);
  const [error, setError] = useState('');
  const [aiUsage, setAiUsage] = useState<AiUsage>(readAiUsage);
  const safety = { kids: prefs.kids, allergies: prefs.allergies, allergyOther: prefs.allergyOther };
  const allergyText = [...prefs.allergies, ...prefs.allergyOther.split(',').map((item) => item.trim()).filter(Boolean)];
  const aiRemaining = isPro ? null : Math.max(0, FREE_AI_LIMIT - aiUsage.count);
  const hasAiAccess = isPro || aiUsage.count < FREE_AI_LIMIT;

  const ensureAiAccess = (requestMode: 'fridge' | 'recipe') => {
    if (hasAiAccess) return true;
    trackEvent('ai_limit_reached', { mode: requestMode, limit: FREE_AI_LIMIT });
    onUpgrade();
    return false;
  };

  const consumeAiUse = (requestMode: 'fridge' | 'recipe') => {
    if (!isPro) {
      const next = { month: currentMonth(), count: aiUsage.count + 1 };
      window.localStorage.setItem(AI_USAGE_STORAGE_KEY, JSON.stringify(next));
      setAiUsage(next);
    }
    trackEvent('ai_request_succeeded', { mode: requestMode, membership: isPro ? 'pro' : 'free' });
  };

  const onImageSelected = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Bạn hãy chọn một tệp hình ảnh.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Ảnh quá lớn. Bạn hãy chọn ảnh dưới 8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setImageData(dataUrl);
      setImagePreview(dataUrl);
      setImageMime(file.type || 'image/jpeg');
      setFridgeResult(null);
      setError('');
    };
    reader.onerror = () => setError('Không đọc được ảnh. Bạn hãy thử lại.');
    reader.readAsDataURL(file);
  };

  const analyzeFridge = async () => {
    if (!ensureAiAccess('fridge')) return;
    if (!imageData) {
      setError('Hãy chụp hoặc tải ảnh tủ lạnh trước nhé.');
      return;
    }
    setLoading('fridge');
    setError('');
    try {
      const response = await fetch(apiUrl('/api/ai/fridge'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageData, mimeType: imageMime, safety }) });
      const data = await response.json() as FridgeAiResult & { error?: string };
      if (!response.ok) throw new Error(data.error || 'AI chưa trả lời được.');
      setFridgeResult(data);
      consumeAiUse('fridge');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI chưa trả lời được. Bạn hãy thử lại.');
      trackEvent('ai_request_failed', { mode: 'fridge', membership: isPro ? 'pro' : 'free' });
    } finally {
      setLoading(null);
    }
  };

  const lookupRecipe = async () => {
    if (!ensureAiAccess('recipe')) return;
    const dishName = recipeName.trim();
    if (!dishName) {
      setError('Hãy nhập tên món bạn muốn tra.');
      return;
    }
    setLoading('recipe');
    setError('');
    try {
      const response = await fetch(apiUrl('/api/ai/recipe'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dishName, safety }) });
      const data = await response.json() as RecipeAiResult & { error?: string };
      if (!response.ok) throw new Error(data.error || 'AI chưa trả lời được.');
      setRecipeResult(data);
      consumeAiUse('recipe');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI chưa trả lời được. Bạn hãy thử lại.');
      trackEvent('ai_request_failed', { mode: 'recipe', membership: isPro ? 'pro' : 'free' });
    } finally {
      setLoading(null);
    }
  };

  return <div className="mx-auto max-w-5xl space-y-5 pb-5">
    <section className="rounded-[28px] bg-foreground p-6 text-background md:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-accent">Trợ lý bếp Gemini</p><h1 className="display-font mt-2 text-4xl font-bold tracking-tight">Hỏi gì cũng được.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-background/70">Đưa ảnh tủ lạnh hoặc tên món ăn. AI sẽ gợi ý cách nấu nhanh, nhạt và hợp với nhà mình.</p></div><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Sparkles size={22} /></span></div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2"><button onClick={() => setMode('fridge')} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${mode === 'fridge' ? 'border-accent bg-accent text-foreground' : 'border-background/15 bg-background/10 text-background'}`} data-testid="button-ai-fridge-mode"><Camera size={19} /><span><span className="block text-sm font-bold">📷 Nhìn ảnh tủ lạnh</span><span className="mt-0.5 block text-[11px] opacity-75">Nhận diện nguyên liệu, gợi ý 3 món</span></span></button><button onClick={() => setMode('recipe')} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${mode === 'recipe' ? 'border-accent bg-accent text-foreground' : 'border-background/15 bg-background/10 text-background'}`} data-testid="button-ai-recipe-mode"><BookOpen size={19} /><span><span className="block text-sm font-bold">📖 Tra cách nấu</span><span className="mt-0.5 block text-[11px] opacity-75">Định lượng 1 khẩu phần và dinh dưỡng</span></span></button></div>
    </section>
    <div className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${isPro ? 'border-accent/40 bg-accent/15' : aiRemaining === 0 ? 'border-primary/30 bg-primary/5' : 'bg-card'}`}><div className="flex items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isPro ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{isPro ? <Crown size={18} /> : <Sparkles size={18} />}</span><div><p className="text-sm font-bold">{isPro ? 'Hỏi AI không giới hạn' : `Còn ${aiRemaining} / ${FREE_AI_LIMIT} lượt AI miễn phí tháng này`}</p><p className="mt-0.5 text-xs text-muted-foreground">{isPro ? 'Đặc quyền thành viên Pro đang hoạt động.' : 'Lượt dùng được đặt lại vào đầu tháng.'}</p></div></div>{!isPro && aiRemaining === 0 && <button onClick={onUpgrade} className="tactile inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground" data-testid="button-ai-limit-upgrade"><Crown size={14} /> Nâng cấp Pro</button>}</div>
    {allergyText.length > 0 && <div className="flex items-start gap-3 rounded-2xl border border-[hsl(18_80%_56%/.3)] bg-[hsl(12_100%_93%)] p-4 text-sm"><AlertCircle size={18} className="mt-0.5 shrink-0 text-primary" /><p><span className="font-bold">AI sẽ tự né:</span> {allergyText.join(', ')}.</p></div>}
    {prefs.kids > 0 && <div className="flex items-start gap-3 rounded-2xl border border-[hsl(113_40%_45%/.3)] bg-secondary p-4 text-sm"><Utensils size={18} className="mt-0.5 shrink-0 text-[hsl(113_33%_30%)]" /><p><span className="font-bold">Quy tắc an toàn đang bật:</span> không gợi ý mật ong cho gia đình có trẻ nhỏ; luôn ưu tiên vị nhạt và ít dầu mỡ.</p></div>}
    {error && <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{error}</p><button onClick={() => setError('')} className="ml-auto rounded-full p-1" aria-label="Đóng thông báo lỗi"><X size={15} /></button></div>}
    {mode === 'fridge' ? <section className="space-y-4">
      <div className="paper-card p-5 md:p-6"><div className="grid gap-5 md:grid-cols-[.9fr_1.1fr] md:items-center"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Bước 1</p><h2 className="display-font mt-1 text-2xl font-bold">Cho mình xem tủ lạnh</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Ảnh càng đủ sáng, AI càng dễ nhận diện rau, thịt, cá và gia vị.</p><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/10"><ImagePlus size={18} /> Chụp hoặc tải ảnh<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => onImageSelected(event.target.files?.[0])} data-testid="input-fridge-image" /></label></div><div className="relative flex min-h-44 items-center justify-center overflow-hidden rounded-2xl bg-muted">{imagePreview ? <><img src={imagePreview} alt="Ảnh nguyên liệu đã chọn" className="max-h-64 w-full object-cover" /><button onClick={() => { setImageData(''); setImagePreview(''); setFridgeResult(null); }} className="absolute right-2 top-2 rounded-full bg-foreground/80 p-2 text-background" aria-label="Xóa ảnh đã chọn" data-testid="button-remove-fridge-image"><X size={15} /></button></> : <div className="text-center text-muted-foreground"><Upload size={24} className="mx-auto" /><p className="mt-2 text-xs">Chưa có ảnh</p></div>}</div></div><button onClick={analyzeFridge} disabled={loading !== null || !imageData} className="tactile mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_4px_0_hsl(18_72%_43%)] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-analyze-fridge">{loading === 'fridge' ? <><LoaderCircle size={17} className="animate-spin" /> AI đang nhìn ảnh...</> : <><Camera size={17} /> Nhận diện nguyên liệu & gợi ý món</>}</button></div>
      {loading === 'fridge' && <AiLoadingCard text="AI đang xem tủ lạnh và cân đối 3 món trong 30 phút..." />}
      {fridgeResult && <FridgeResultCard result={fridgeResult} />}
    </section> : <section className="space-y-4">
      <div className="paper-card p-5 md:p-6"><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Tên món muốn tra</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={recipeName} onChange={(event) => setRecipeName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && lookupRecipe()} placeholder="Ví dụ: cá basa hấp gừng" className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none ring-primary focus:ring-2" data-testid="input-recipe-name" /><button onClick={lookupRecipe} disabled={loading !== null} className="tactile inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-lookup-recipe">{loading === 'recipe' ? <LoaderCircle size={17} className="animate-spin" /> : <Search size={17} />} Tra cách nấu</button></div><div className="mt-3 flex flex-wrap gap-2">{['Canh bí đỏ nấu tôm khô', 'Ức gà áp chảo rau củ', 'Cháo trứng bí đỏ'].map((suggestion) => <button key={suggestion} onClick={() => setRecipeName(suggestion)} className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold text-secondary-foreground" data-testid={`button-recipe-suggestion-${suggestion}`}>{suggestion}</button>)}</div></div>
      {loading === 'recipe' && <AiLoadingCard text="AI đang định lượng, giảm dầu và tính dinh dưỡng..." />}
      {recipeResult && <RecipeResultCard result={recipeResult} />}
    </section>}
    <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><CircleHelp size={15} className="mt-0.5 shrink-0" /> Gợi ý AI chỉ mang tính tham khảo. Luôn kiểm tra dị ứng, độ chín của thịt cá và độ tuổi của trẻ trước khi ăn.</p>
  </div>;
}

function AiLoadingCard({ text }: { text: string }) {
  return <div className="paper-card flex items-center gap-3 border-primary/20 bg-primary/5 p-5" aria-live="polite"><LoaderCircle size={21} className="animate-spin text-primary" /><div><p className="text-sm font-bold">Gemini đang suy nghĩ</p><p className="mt-1 text-xs text-muted-foreground">{text}</p></div><span className="ml-auto flex gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" /></span></div>;
}

function NutritionSummaryCard({ nutrition }: { nutrition: { calories: number; protein: number; fat: number } }) {
  return <div className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-[hsl(43_100%_61%/.18)] p-3 text-center"><p className="text-[10px] font-bold uppercase text-muted-foreground">Calo</p><p className="mt-1 text-lg font-bold">{Math.round(nutrition.calories)}</p><p className="text-[10px] text-muted-foreground">kcal</p></div><div className="rounded-xl bg-secondary p-3 text-center"><p className="text-[10px] font-bold uppercase text-muted-foreground">Đạm</p><p className="mt-1 text-lg font-bold">{nutrition.protein.toFixed(1)}</p><p className="text-[10px] text-muted-foreground">g</p></div><div className="rounded-xl bg-[hsl(12_100%_93%)] p-3 text-center"><p className="text-[10px] font-bold uppercase text-muted-foreground">Béo</p><p className="mt-1 text-lg font-bold">{nutrition.fat.toFixed(1)}</p><p className="text-[10px] text-muted-foreground">g</p></div></div>;
}

function FridgeResultCard({ result }: { result: FridgeAiResult }) {
  return <div className="space-y-4"><section className="paper-card p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">AI nhìn thấy</p><h2 className="display-font mt-1 text-2xl font-bold">Nguyên liệu trong ảnh</h2></div><Check size={21} className="text-[hsl(113_40%_45%)]" /></div><div className="mt-4 flex flex-wrap gap-2">{result.ingredients.map((ingredient) => <span key={ingredient.name} className="rounded-full bg-secondary px-3 py-2 text-xs font-bold">{ingredient.name}<span className="ml-1 text-[10px] font-normal text-muted-foreground">{Math.round(ingredient.confidence * 100)}%</span></span>)}</div></section><div className="grid gap-4 lg:grid-cols-3">{result.dishes.map((dish, index) => <article key={`${dish.name}-${index}`} className="paper-card flex flex-col p-5"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Món {index + 1}</span><h3 className="display-font mt-1 text-xl font-bold">{dish.name}</h3></div><Utensils size={19} className="shrink-0 text-secondary-foreground" /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{dish.why}</p><div className="mt-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Nguyên liệu</p><ul className="mt-2 space-y-1 text-sm">{dish.ingredients.map((item) => <li key={item} className="flex gap-2"><span className="text-primary">•</span>{item}</li>)}</ul></div><div className="mt-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Cách làm nhanh</p><ol className="mt-2 space-y-2 text-sm leading-5">{dish.steps.map((step, stepIndex) => <li key={step} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{stepIndex + 1}</span>{step}</li>)}</ol></div><div className="mt-auto pt-5"><NutritionSummaryCard nutrition={dish.nutrition} /></div></article>)}</div>{result.safetyNotes.length > 0 && <section className="paper-card border-secondary bg-secondary/50 p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-secondary-foreground">Lưu ý an toàn</p><ul className="mt-2 space-y-1 text-sm leading-5">{result.safetyNotes.map((note) => <li key={note}>• {note}</li>)}</ul></section>}</div>;
}

function RecipeResultCard({ result }: { result: RecipeAiResult }) {
  return <section className="paper-card p-5 md:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Công thức 1 khẩu phần</p><h2 className="display-font mt-1 text-3xl font-bold">{result.dishName}</h2></div><span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-xs font-bold"><Clock3 size={14} /> Nhạt · ít dầu</span></div><div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Định lượng nguyên liệu</p><ul className="mt-3 divide-y rounded-2xl border bg-background">{result.ingredients.map((ingredient) => <li key={ingredient.name} className="flex justify-between gap-3 px-3 py-2.5 text-sm"><span>{ingredient.name}</span><span className="font-bold text-primary">{ingredient.amount}</span></li>)}</ul><div className="mt-4"><NutritionSummaryCard nutrition={result.nutrition} /></div></div><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Các bước nấu</p><ol className="mt-3 space-y-3">{result.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span><span>{step}</span></li>)}</ol></div></div>{result.safetyNotes.length > 0 && <div className="mt-5 rounded-2xl bg-secondary/70 p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-secondary-foreground">Lưu ý cho nhà mình</p><ul className="mt-2 space-y-1 text-sm leading-5">{result.safetyNotes.map((note) => <li key={note}>• {note}</li>)}</ul></div>}</section>;
}

function DesktopSidebar({ location }: { location: string }) { const items = [{ href: '/', label: 'Thực Đơn', icon: CalendarDays }, { href: '/shopping', label: 'Đi Chợ', icon: ShoppingBasket }, { href: '/costs', label: 'Chi Phí', icon: WalletCards }, { href: '/ask-ai', label: 'Bếp AI', icon: Sparkles }]; return <aside className="desktop-sidebar" aria-label="Điều hướng chính"><Link href="/" className="desktop-sidebar-brand no-underline" data-testid="link-sidebar-home"><span className="desktop-sidebar-mark"><ChefHat size={22} /></span><span><strong>30 Phút</strong><small>Yêu thương</small></span></Link><nav className="desktop-sidebar-nav">{items.map(({ href, label, icon: Icon }) => { const active = href === '/' ? location === '/' : location.startsWith(href); return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`desktop-sidebar-item ${active ? 'desktop-sidebar-item-active' : ''}`} data-testid={`link-sidebar-${label}`}><Icon size={19} /><span>{label}</span></Link>; })}</nav></aside>; }

function BottomNav({ location }: { location: string }) { const items = [{ href: '/', label: 'Thực Đơn', icon: CalendarDays }, { href: '/shopping', label: 'Đi Chợ', icon: ShoppingBasket }, { href: '/costs', label: 'Chi Phí', icon: WalletCards }, { href: '/ask-ai', label: 'Bếp AI', icon: Sparkles }]; return <nav aria-label="Điều hướng chính" className="bottom-nav safe-bottom fixed inset-x-0 bottom-0 z-[9999] px-2 pt-1"><div className="mx-auto grid h-[65px] max-w-xl grid-cols-4 gap-1">{items.map(({ href, label, icon: Icon }) => { const active = href === '/' ? location === '/' : location.startsWith(href); return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`nav-item flex h-full flex-col items-center justify-center gap-1 px-1.5 py-2 ${active ? 'nav-item-active' : 'nav-item-inactive'}`} data-testid={`link-nav-${label}`}><Icon size={18} strokeWidth={active ? 2.6 : 2} /><span>{label}</span></Link>; })}</div></nav>; }

export default App;


function MobileDrawer({ open, onClose, isPro, phone, onUpgrade, onOpenSettings }: { open: boolean, onClose: () => void, isPro: boolean, phone: string, onUpgrade: () => void, onOpenSettings: () => void }) {
  useEffect(() => {
    if (!open) return;
    {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Menu ứng dụng">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={onClose} aria-hidden="true" data-testid="drawer-backdrop" />
      <div className="relative flex w-full max-w-[280px] flex-col bg-card shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="display-font text-lg font-bold text-primary">Tài khoản</span>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Đóng menu" data-testid="button-close-drawer">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-secondary/30 p-4 border border-secondary">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">
                {phone ? phone : 'Chưa cập nhật SĐT'}
              </p>
              <div className="mt-1">
                {isPro ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                    <Crown size={12} /> VIP Pro
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Gói miễn phí
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <button onClick={() => { onClose(); onOpenSettings(); }} className="flex min-h-[44px] w-full items-center justify-between rounded-xl p-3 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="button-drawer-settings">
              <span className="flex items-center gap-3 text-sm font-bold text-foreground"><Settings size={18} className="text-muted-foreground" /> ⚙️ Cài đặt Hồ sơ & Dị ứng</span>
              <ArrowRight size={16} className="text-muted-foreground" />
            </button>
            
            {!isPro && (
              <button onClick={() => { onClose(); onUpgrade(); }} className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-[linear-gradient(135deg,hsl(18_80%_56%/.1),hsl(43_100%_61%/.15))] p-3 text-primary hover:bg-[linear-gradient(135deg,hsl(18_80%_56%/.15),hsl(43_100%_61%/.2))] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="button-drawer-upgrade">
                <span className="flex items-center gap-3 text-sm font-bold"><Crown size={18} /> 👑 Nâng cấp VIP Pro (VietQR)</span>
                <ArrowRight size={16} />
              </button>
            )}
            
            <a
              href="https://zalo.me/g/2obzl3fbbbaienldhm7m"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] w-full items-center justify-between rounded-xl p-3 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              data-testid="link-drawer-zalo"
              aria-label="Tham gia nhóm Zalo VIP"
            >
              <span className="flex items-center gap-3 text-sm font-bold text-foreground"><MessageCircle size={18} className="text-blue-500" /> 💬 Group Zalo VIP</span>
              <ExternalLink size={16} className="text-muted-foreground" />
            </a>
            
            <a href="https://35to53.com" target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] w-full items-center justify-between rounded-xl p-3 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="link-drawer-blog">
              <span className="flex items-center gap-3 text-sm font-bold text-foreground"><BookOpen size={18} className="text-muted-foreground" /> 📖 Góc Thảnh Thơi (35to53.com)</span>
              <ExternalLink size={16} className="text-muted-foreground" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
