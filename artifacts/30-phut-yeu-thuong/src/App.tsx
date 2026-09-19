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
const FREE_DAY_LIMIT = 3;
const FREE_AI_LIMIT = 3;
const PRO_PRICE = 49_000;
const PRO_STORAGE_KEY = '30phut-pro-unlocked';
const AI_USAGE_STORAGE_KEY = '30phut-ai-usage';
const NEWSLETTER_STORAGE_KEY = '30phut-newsletter-email';
const PREFS_STORAGE_KEY = '30phut-preferences';
const PLAN_STORAGE_KEY = '30phut-plan';
const BOUGHT_STORAGE_KEY = '30phut-bought';
const DEVICE_ID_STORAGE_KEY = '30phut-device-id';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
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
function quantityEditorUnit(value: { qty: number; unit?: string }) {
  return value.unit || 'g';
}
function quantityEditorValue(value: { qty: number; unit?: string }) {
  return Number.isInteger(value.qty) ? value.qty : Number(value.qty.toFixed(1));
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
  if (location === '/shopping') page = <ShoppingPageV2 shopping={shopping} bought={bought} setBought={setBought} customItems={customItems} setCustomItems={setCustomItems} totalCost={totalCost} setQuantityOverrides={setQuantityOverrides} targetBudget={prefs.targetBudget || 1200000} />;
  else if (location === '/costs') page = <div className="space-y-5"><CostsPage shopping={shopping} prefs={prefs} totalCost={totalCost} plan={accessiblePlan} /><KitchenEquityCard weeklySaving={Math.max(0, (prefs.targetBudget || 1200000) - totalCost)} /></div>;
  else if (location === '/ask-ai') page = <AskAiPageV2 prefs={prefs} isPro={isPro} onUpgrade={() => openUpgrade('ai_limit')} />;
  else page = <HomePage plan={plan} isPro={isPro} onUpgrade={() => openUpgrade('locked_week')} prefs={prefs} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} updatePrefs={updatePrefs} saveSettings={saveSettings} regenerate={regenerate} expandedDay={expandedDay} setExpandedDay={setExpandedDay} activeMeal={activeMeal} setActiveMeal={setActiveMeal} favoriteDishes={favoriteDishes} setFavoriteDishes={setFavoriteDishes} totalCost={totalCost} forceBudget={forceBudget} budgetNotice={budgetNotice} swapNotice={swapNotice} onSwapDish={swapDish} />;
  return <div className="app-shell grain"><header className="content-wrap border-b border-white/60 px-0 pb-3 pt-4 md:pt-6"><div className="flex items-center justify-between gap-3 rounded-[26px] border border-[hsl(34_31%_90%)] bg-[rgba(255,255,255,0.72)] px-3 py-2.5 shadow-[0_12px_30px_rgba(110,84,58,0.05)] backdrop-blur-md"><Link href="/" className="flex items-center gap-3 no-underline" data-testid="link-home"><span className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,hsl(154_25%_42%),hsl(146_34%_64%))] text-white shadow-[0_8px_18px_rgba(74,124,89,0.22)]"><ChefHat size={23} strokeWidth={2.4} /></span><span><span className="display-font block text-xl font-bold tracking-tight text-[hsl(154_25%_32%)]">30 Phút</span><span className="block text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Yêu thương</span></span></Link><div className="top-actions flex items-center gap-2">{isPro ? <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-[hsl(31_90%_83%)] px-3 py-1.5 text-xs font-bold text-[hsl(24_28%_18%)]"><Crown size={13} /> Thành viên Pro</span> : <button onClick={() => openUpgrade('header')} className="tactile hidden md:inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,hsl(154_25%_42%),hsl(146_34%_64%))] px-3 py-2 text-xs font-bold text-white" data-testid="button-header-upgrade"><Crown size={13} /> Nâng cấp Pro</button>}<button onClick={() => window.print()} className="tactile hidden md:flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(36_40%_88%)] bg-white text-muted-foreground" aria-label="In trang" data-testid="button-print"><Printer size={17} /></button>
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
    <div className="mt-4 grid gap-3">{healingModeOptions.map((option) => { const active = prefs.healingModes.includes(option.value); return <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors ${active ? 'border-[hsl(105_40%_45%)] bg-white shadow-sm' : 'bg-white/55 hover:bg-white'}`} data-testid={`label-healing-${option.value}`}><input type="checkbox" checked={active} onChange={() => toggle(option.value)} className="mt-1 h-4 w-4 accent-[hsl(105_40%_40%)]" data-testid={`checkbox-healing-${option.value}`} /><span className="text-lg" aria-hidden="true">{option.icon}</span><span><span className="block text-sm font-bold leading-5">{option.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span></span></label>; })}</div>
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
  return <aside className="rounded-2xl border border-[hsl(105_40%_75%)] bg-[hsl(103_40%_96%)] px-4 py-3.5 shadow-[0_8px_22px_rgba(71,105,45,.07)]" data-testid="mindful-kitchen-message"><p className="text-sm leading-6 text-[hsl(105_33%_25%)]"><strong>🌿 Hít một hơi thật sâu chị nhé!</strong> 30 phút tới là khoảng thời gian thiền bếp dành riêng cho chị. Hãy thả lỏng đôi vai, cảm nhận mùi thơm tự nhiên và nuôi dưỡng sức khỏe gia đình.</p></aside>;
}

function HomePage({ plan, isPro, onUpgrade, prefs, settingsOpen, setSettingsOpen, updatePrefs, saveSettings, regenerate, expandedDay, setExpandedDay, activeMeal, setActiveMeal, favoriteDishes, setFavoriteDishes, totalCost, forceBudget, budgetNotice, swapNotice, onSwapDish }: { plan: DayPlan[]; isPro: boolean; onUpgrade: () => void; prefs: Preferences; settingsOpen: boolean; setSettingsOpen: (value: boolean) => void; updatePrefs: (value: Partial<Preferences>) => void; saveSettings: () => void; regenerate: () => void; expandedDay: number; setExpandedDay: (value: number) => void; activeMeal: 'all' | 'breakfast' | 'lunch' | 'dinner'; setActiveMeal: (value: 'all' | 'breakfast' | 'lunch' | 'dinner') => void; favoriteDishes: Set<string>; setFavoriteDishes: (value: Set<string>) => void; totalCost: number; forceBudget: () => void; budgetNotice: string; swapNotice: string; onSwapDish: (dayIndex: number, slot: DishSlot) => void }) {
  const today = plan[0];
  const household = `${prefs.kids + prefs.elderly + prefs.adults} người`;
  const visiblePlan = isPro ? plan : plan.slice(0, FREE_DAY_LIMIT);
  const units = unitsOf(prefs);
  return <div className="space-y-5 pb-5">
    <section className="relative overflow-hidden rounded-[32px] border border-[hsl(34_31%_90%)] bg-[linear-gradient(135deg,#FFF7F2_0%,#F9F5F0_34%,#EEF8F1_100%)] px-5 py-6 shadow-[0_18px_38px_rgba(110,84,58,0.08)] md:px-9 md:py-9"><div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[rgba(255,197,168,0.35)] blur-2xl" /><div className="absolute left-4 top-4 h-20 w-20 rounded-full border-[10px] border-[rgba(115,162,134,0.18)]" /><div className="relative max-w-2xl"><p className="mb-2 text-xs font-bold uppercase tracking-[.19em] text-[hsl(154_25%_32%)]">Bữa cơm hôm nay</p><h1 className="display-font max-w-xl text-[clamp(2.15rem,7vw,4.2rem)] font-bold leading-[.98] tracking-[-.04em] text-[hsl(24_28%_18%)]">Nấu nhanh một chút,<br /><span className="text-[hsl(154_25%_32%)]">thương nhau nhiều hơn.</span></h1><p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">Một tuần đủ chất, vừa túi tiền và không làm bạn phải đứng bếp cả tối.</p><div className="mt-5 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-2 text-xs font-bold text-foreground shadow-sm"><Users size={14} className="text-[hsl(154_25%_32%)]" /> {household}</span><span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-2 text-xs font-bold text-foreground shadow-sm"><Clock3 size={14} className="text-[hsl(154_25%_32%)]" /> {prefs.maxTime} phút / bữa</span><span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-2 text-xs font-bold text-foreground shadow-sm"><Leaf size={14} className="text-[hsl(154_25%_32%)]" /> {budgetLabels[prefs.budget]}</span></div></div></section>
    <SettingsPanel open={settingsOpen} setOpen={setSettingsOpen} prefs={prefs} updatePrefs={updatePrefs} saveSettings={saveSettings} />
     {settingsOpen && <><AdvancedPreferences prefs={prefs} updatePrefs={updatePrefs} /><HealingModeSettings prefs={prefs} updatePrefs={updatePrefs} saveSettings={saveSettings} /></>}
    <MindfulKitchenMessage />
    <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <div className="min-w-0 space-y-4"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">{isPro ? 'Trọn tuần' : 'Gói miễn phí · 3 ngày đầu'}</p><h2 className="display-font mt-1 text-3xl font-bold tracking-tight">Mình ăn gì nhỉ?</h2></div><button onClick={regenerate} className="tactile inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3.5 py-2 text-xs font-bold text-primary" data-testid="button-regenerate"><RefreshCw size={14} /> Đổi tuần khác</button></div><div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist">{[['all','Tất cả'],['breakfast','Bữa sáng'],['lunch','Bữa trưa'],['dinner','Bữa tối']].filter(([value]) => value === 'all' || prefs.selectedMeals[value as keyof Preferences['selectedMeals']]).map(([value,label]) => <button key={value} onClick={() => setActiveMeal(value as typeof activeMeal)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors ${activeMeal === value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`} data-testid={`button-filter-${value}`}>{label}</button>)}</div><BudgetWarning plan={plan} units={units} p={prefs} totalCost={totalCost} forceBudget={forceBudget} />{budgetNotice && <p className="rounded-xl border border-amber-400/40 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800" role="status" data-testid="budget-infeasible-notice">{budgetNotice}</p>}{swapNotice && <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs font-bold leading-5 text-foreground" role="status" data-testid="status-dish-swap">{swapNotice}</p>}{visiblePlan.map((day, index) => <DayCard key={day.day} day={day} index={index} open={expandedDay === index} setOpen={() => setExpandedDay(expandedDay === index ? -1 : index)} activeMeal={activeMeal} favorites={favoriteDishes} setFavorites={setFavoriteDishes} prefs={prefs} onSwap={(slot) => onSwapDish(index, slot)} />)}{!isPro && <LockedWeekBanner onUpgrade={onUpgrade} />}</div>
      <aside className="space-y-4"><div className="paper-card p-5"><h3 className="text-sm font-bold flex items-center gap-2 mb-4"><WalletCards size={17} className="text-primary" /> Ngân sách tuần này</h3><BudgetProgress totalCost={totalCost} targetBudget={prefs.targetBudget || 1200000} /></div><TodayCard day={today} prefs={prefs} /><NutritionCard plan={visiblePlan} prefs={prefs} /><NewsletterSignup /><div className="paper-card hidden overflow-hidden p-5 md:block"><div className="flex items-center gap-2 text-sm font-bold"><Sparkles size={17} className="text-primary" /> Mẹo để bếp nhẹ tênh</div><p className="mt-3 text-sm leading-6 text-muted-foreground">Sơ chế hành, gừng và rau củ ngay sau khi đi chợ. Đến bữa chỉ cần mở nồi hấp — 30 phút đủ cho cả nhà ngồi vào mâm.</p></div></aside>
    </section>
  </div>;
}

function LockedWeekBanner({ onUpgrade }: { onUpgrade: () => void }) {
  return <section className="relative overflow-hidden rounded-[28px] border border-[hsl(43_100%_61%/.55)] bg-[linear-gradient(135deg,hsl(43_100%_61%/.25),hsl(13_80%_56%/.12))] p-5 shadow-[0_12px_28px_rgba(112,64,25,.08)] md:p-6">
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
    {saved && <p className="mt-2 text-xs font-bold text-[hsl(105_33%_30%)]" role="status"><Check size={13} className="mr-1 inline" /> Đã lưu email. Hẹn nhà mình sáng Chủ Nhật!</p>}
  </section>;
}

function ProUpgradeModal({ open, onClose, onUnlocked, globalPhone, setGlobalPhone, globalEmail, setGlobalEmail }: { open: boolean; onClose: () => void; onUnlocked: () => void; globalPhone?: string; setGlobalPhone?: (p: string) => void; globalEmail?: string; setGlobalEmail?: (email: string) => void }) {
  const [phone, setPhone] = useState(globalPhone || '');
  const [email, setEmail] = useState(globalEmail || '');

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
      const response = await fetch(apiUrl('/api/pro/qr'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalizedPhone, email: trimmedEmail || undefined }) });
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
      trackEvent('pro_qr_created', { plan: 'monthly_49000', has_email: Boolean(trimmedEmail) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chưa tạo được mã QR. Bạn thử lại nhé.');
    } finally {
      setLoading(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pro-upgrade-title">
    <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-card p-5 shadow-2xl sm:rounded-[28px] md:p-7">
      <div className="flex items-start justify-between gap-4"><div><span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em]"><Crown size={13} /> Thành viên Pro</span><h2 id="pro-upgrade-title" className="display-font mt-3 text-3xl font-bold">Nấu đủ cả tuần</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Chuyển khoản VietQR một lần, mở khóa ngay trên thiết bị này.</p></div><button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Đóng popup nâng cấp" data-testid="button-close-upgrade"><X size={19} /></button></div>
      <div className="mt-5 rounded-2xl bg-secondary/70 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-bold">Pro hàng tháng</span><span className="display-font text-2xl font-bold text-primary">{PRO_PRICE.toLocaleString('vi-VN')}đ</span></div><div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><span>✓ Thực đơn đủ 7 ngày</span><span>✓ Hỏi AI không giới hạn</span><span>✓ Công thức và danh sách đi chợ</span><span>✓ Hỗ trợ gia đình nhiều thành viên</span></div></div>
      {!qr ? <div className="mt-5 space-y-4"><label className="block text-xs font-bold text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Mail size={14} /> Email người dùng</span><input value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && createQr()} placeholder="email@example.com" type="email" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none ring-primary focus:ring-2" data-testid="input-pro-email" /></label><label className="block text-xs font-bold text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Smartphone size={14} /> Số điện thoại người dùng</span><input value={phone} onChange={(event) => setPhone(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && createQr()} placeholder="Ví dụ: 0912 345 678" inputMode="tel" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none ring-primary focus:ring-2" data-testid="input-pro-phone" /></label><p className="mt-2 text-xs leading-5 text-muted-foreground">Nội dung chuyển khoản sẽ tự điền: <strong>PRO [Số điện thoại]</strong>.</p><button onClick={createQr} disabled={loading} className="tactile mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_4px_0_hsl(13_72%_43%)] disabled:opacity-60" data-testid="button-create-vietqr">{loading ? <><LoaderCircle size={17} className="animate-spin" /> Đang tạo mã QR...</> : <><QrCode size={17} /> Hiện mã QR chuyển khoản</>}</button></div> : <div className="mt-5 text-center"><div className="mx-auto w-fit rounded-2xl border bg-white p-3 shadow-sm"><img src={qr.qrUrl} alt={`Mã VietQR chuyển khoản ${PRO_PRICE.toLocaleString('vi-VN')} đồng`} className="h-64 w-64 object-contain" /></div><p className="mt-3 text-sm font-bold">Quét mã bằng ứng dụng ngân hàng</p><p className="mt-1 text-xs text-muted-foreground">Số tiền: <strong className="text-foreground">{qr.amount.toLocaleString('vi-VN')}đ</strong> · Nội dung: <strong className="text-primary">{qr.transferContent}</strong></p><button onClick={() => { setQr(null); }} className="mt-3 text-xs font-bold text-primary underline" data-testid="button-change-pro-phone">Đổi thông tin</button><button onClick={onUnlocked} className="tactile mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(105_40%_45%)] px-4 py-3 text-sm font-bold text-white shadow-[0_4px_0_hsl(105_40%_35%)]" data-testid="button-confirm-pro"><Check size={17} /> Tôi đã chuyển khoản — mở khóa Pro</button><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Sau khi chuyển khoản thành công, hãy bấm xác nhận để mở khóa trên thiết bị này.</p></div>}
      {error && <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive" role="alert">{error}</p>}
    </div>
  </div>;
}

function SettingsPanel({ open, setOpen, prefs, updatePrefs, saveSettings }: { open: boolean; setOpen: (value: boolean) => void; prefs: Preferences; updatePrefs: (value: Partial<Preferences>) => void; saveSettings: () => void }) {
  return <section className={`paper-card overflow-hidden transition-[max-height] duration-300 ${open ? 'max-h-[900px]' : 'max-h-24'}`}><button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 p-4 text-left md:p-5" data-testid="button-toggle-settings"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><SlidersHorizontal size={17} /></span><span><span className="block text-sm font-bold">Thiết lập nhà mình</span><span className="block text-xs text-muted-foreground">{prefs.kids} trẻ nhỏ · {prefs.elderly} người già · {prefs.adults} người lớn</span></span></span>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>{open && <div className="border-t bg-[hsl(39_67%_96%/.55)] p-4 md:p-5"><div className="grid gap-4 sm:grid-cols-3"><NumberField label="Trẻ nhỏ" hint="hệ số 0,55" value={prefs.kids} onChange={(value) => updatePrefs({ kids: value })} testId="input-kids" /><NumberField label="Người già" hint="hệ số 0,8" value={prefs.elderly} onChange={(value) => updatePrefs({ elderly: value })} testId="input-elderly" /><NumberField label="Người lớn" hint="hệ số 1,0" value={prefs.adults} onChange={(value) => updatePrefs({ adults: value })} testId="input-adults" /></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><SelectField label="Thời gian nấu" value={String(prefs.maxTime)} onChange={(value) => updatePrefs({ maxTime: Number(value) })} options={[['20','20 phút'],['30','30 phút'],['45','45 phút']]} testId="select-time" /><div><label className="text-xs font-bold text-muted-foreground block mb-1.5">Ngân sách đi chợ</label><div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="radiogroup">{(['tietkiem','vua','thoaimai'] as Budget[]).map((b) => <button key={b} role="radio" aria-checked={prefs.budget === b} onClick={() => updatePrefs({ budget: b })} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${prefs.budget === b ? 'border-primary bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>{budgetLabels[b]}</button>)}</div></div><SelectField label="Ăn chay" value={prefs.veg} onChange={(value) => updatePrefs({ veg: value as VegMode })} options={[['0','Không cần'],['1','Xen kẽ'],['2','Hoàn toàn']]} testId="select-vegetarian" /></div><div className="mt-4"><label className="block text-xs font-bold text-muted-foreground">Mục tiêu ngân sách (VNĐ / tuần)</label><div className="relative mt-1.5"><input type="number" step="50000" value={prefs.targetBudget || 1200000} onChange={(event) => updatePrefs({ targetBudget: Number(event.target.value) || 0 })} className="w-full rounded-xl border bg-card px-4 py-2.5 pl-10 text-sm font-bold outline-none ring-primary focus:ring-2" data-testid="input-target-budget" /><WalletCards size={16} className="absolute left-3 top-3 text-muted-foreground" /></div><p className="mt-1 text-[10px] font-medium text-muted-foreground">Tự động ưu tiên món ăn để tổng chi phí không vượt mức này.</p></div><div className="mt-4"><p className="mb-2 text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Dị ứng cần tránh</p><div className="flex flex-wrap gap-2">{allergyOptions.map((option) => { const active = prefs.allergies.includes(option.value); return <button key={option.value} onClick={() => updatePrefs({ allergies: active ? prefs.allergies.filter((item) => item !== option.value) : [...prefs.allergies, option.value] })} className={`rounded-full border px-3 py-2 text-xs font-bold transition-colors ${active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`} data-testid={`button-allergy-${option.label}`}>{active && <Check size={13} className="mr-1 inline" />}{option.label}</button>; })}</div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-muted-foreground">Dị ứng khác<input value={prefs.allergyOther} onChange={(event) => updatePrefs({ allergyOther: event.target.value })} placeholder="Ví dụ: mè, đậu nành" className="mt-1.5 w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2" data-testid="input-allergy-other" /></label><label className="text-xs font-bold text-muted-foreground">Món / nguyên liệu nhà mình thích<input value={prefs.favoriteIngredients} onChange={(event) => updatePrefs({ favoriteIngredients: event.target.value })} placeholder="Ví dụ: cá, bí đỏ, đậu hũ" className="mt-1.5 w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2" data-testid="input-favorites" /></label></div><button onClick={saveSettings} className="tactile mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_4px_0_hsl(13_72%_43%)]" data-testid="button-save-settings"><Check size={16} /> Lưu và tạo thực đơn mới</button></div>}</section>;
}

function NumberField({ label, hint, value, onChange, testId }: { label: string; hint: string; value: number; onChange: (value: number) => void; testId: string }) { return <label className="block text-xs font-bold text-muted-foreground">{label}<input type="number" min="0" max="12" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} className="mt-1.5 w-full rounded-xl border bg-card px-3 py-2.5 text-center text-base font-bold text-foreground outline-none ring-primary focus:ring-2" data-testid={testId} /><span className="mt-1 block text-[10px] font-medium text-muted-foreground">{hint}</span></label>; }
function SelectField({ label, value, onChange, options, testId }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; testId: string }) { return <label className="block text-xs font-bold text-muted-foreground">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border bg-card px-3 py-2.5 text-sm font-bold text-foreground outline-none ring-primary focus:ring-2" data-testid={testId}>{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>; }

function DayCard({ day, index, open, setOpen, activeMeal, favorites, setFavorites, prefs, onSwap }: { day: DayPlan; index: number; open: boolean; setOpen: () => void; activeMeal: 'all' | 'breakfast' | 'lunch' | 'dinner'; favorites: Set<string>; setFavorites: (value: Set<string>) => void; prefs: Preferences; onSwap: (slot: DishSlot) => void }) {
  const total = mealCalories(day, prefs);
  const count = prefs.dishesPerMainMeal;
  const mealEntries: { key: 'breakfast' | 'lunch' | 'dinner'; label: string; dishes: { dish: Dish; slot: DishSlot }[]; color: string }[] = [
    { key: 'breakfast', label: 'Sáng', dishes: prefs.selectedMeals.breakfast ? [{ dish: day.breakfast, slot: 'breakfast' }] : [], color: 'bg-[hsl(43_100%_61%/.22)]' },
    { key: 'lunch', label: 'Trưa', dishes: prefs.selectedMeals.lunch ? [{ dish: day.lunch.dam, slot: 'lunch.dam' }, ...(count >= 2 ? [{ dish: day.lunch.rau, slot: 'lunch.rau' as DishSlot }] : []), ...(count >= 3 ? [{ dish: day.lunch.canh, slot: 'lunch.canh' as DishSlot }] : [])] : [], color: 'bg-[hsl(103_40%_90%)]' },
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
function DishRow({ dish, favorite, onFavorite, onSwap }: { dish: Dish; favorite: boolean; onFavorite: () => void; onSwap?: () => void }) { const n = nutrition(dish); const steps = cookingSteps(dish); return <div className="rounded-[16px] border border-[hsl(36_40%_90%)] bg-[#FFFDF8] p-3 shadow-[0_10px_20px_rgba(86,51,22,0.04)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold leading-5 text-foreground">{dish.name}</p><div className="mt-1 flex flex-wrap gap-1.5">{(dish.tags || []).slice(0, 2).map((tag) => <span key={tag} className="rounded-full border border-[hsl(36_40%_88%)] bg-white px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{tag}</span>)}<span className="rounded-full bg-[hsl(43_100%_61%/.18)] px-2 py-0.5 text-[10px] font-bold text-foreground">{Math.round(n.cal)} kcal</span></div></div><div className="flex shrink-0 items-center gap-1.5"><button onClick={onSwap} className="flex h-11 items-center gap-1.5 rounded-full border border-[hsl(144_25%_52%)] bg-white px-3 text-[11px] font-bold text-[hsl(148_25%_36%)] shadow-sm" aria-label="🔄 Đổi món này" data-testid={`button-swap-${dish.name}`} title="🔄 Đổi món này"><RefreshCw size={13} /> <span className="hidden sm:inline">Đổi món</span></button><button onClick={onFavorite} className={`flex h-11 w-11 items-center justify-center rounded-full border ${favorite ? 'border-[hsl(148_25%_36%)] bg-[hsl(148_25%_36%)] text-white' : 'border-[hsl(36_40%_88%)] bg-white text-muted-foreground'}`} aria-label="Đánh dấu món yêu thích" data-testid={`button-favorite-${dish.name}`}><Heart size={15} fill={favorite ? 'currentColor' : 'none'} /></button></div></div><details className="mt-3 border-t border-[hsl(36_40%_90%)] pt-2"><summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-bold text-[hsl(148_25%_36%)]"><ChefHat size={14} /> Hướng dẫn nấu</summary><ol className="mt-2 space-y-1.5 pl-5 text-xs leading-5 text-muted-foreground">{steps.map((step, index) => <li key={`${dish.name}-step-${index}`} className="pl-1">{step}</li>)}</ol></details></div>; }
function TodayCard({ day, prefs }: { day: DayPlan; prefs: Preferences }) {
  const total = mealCalories(day, prefs);
  const activeCount = Object.values(prefs.selectedMeals).filter(Boolean).length;
  return <section className="paper-card overflow-hidden">
    <div className="flex items-center justify-between bg-foreground px-5 py-4 text-background"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] opacity-65">Mâm cơm hôm nay</p><h3 className="display-font mt-1 text-2xl font-bold">{day.day}</h3></div><span className="rounded-full bg-background/10 px-3 py-1.5 text-xs font-bold">{prefs.maxTime} phút</span></div>
    <div className="space-y-3 p-5">
      {prefs.selectedMeals.breakfast && <div className="rounded-2xl bg-secondary/70 p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-secondary-foreground">Bữa sáng</p><p className="mt-1 text-sm font-bold">{day.breakfast.name}</p></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {prefs.selectedMeals.lunch && <div className="rounded-2xl bg-[hsl(103_40%_90%)] p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(105_33%_30%)]">Trưa</p><p className="mt-1 text-xs font-bold leading-5">{day.lunch.dam.name}</p></div>}
        {prefs.selectedMeals.dinner && <div className="rounded-2xl bg-[hsl(12_100%_93%)] p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Tối</p><p className="mt-1 text-xs font-bold leading-5">{day.dinner.dam.name}</p></div>}
      </div>
      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><BadgeCheck size={14} className="text-[hsl(105_33%_30%)]" /> {activeCount} bữa đã chọn</span><span className="font-bold text-foreground">{Math.round(total.cal).toLocaleString('vi-VN')} kcal</span></div>
    </div>
  </section>;
}
function NutritionCard({ plan, prefs }: { plan: DayPlan[]; prefs: Preferences }) { const avg = plan.reduce((sum, day) => sum + mealCalories(day, prefs).cal, 0) / plan.length * unitsOf(prefs); const target = prefs.kids * DAILY_TARGET.kid.calories + prefs.elderly * DAILY_TARGET.elderly.calories + prefs.adults * DAILY_TARGET.adult.calories; const ratio = Math.min(100, Math.round(avg / target * 100)); return <section className="paper-card p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Dinh dưỡng dự kiến</p><h3 className="display-font mt-1 text-xl font-bold">Vừa đủ cho cả nhà</h3></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(103_40%_90%)] text-[hsl(105_33%_30%)]"><Leaf size={20} /></span></div><div className="mt-5"><div className="mb-2 flex justify-between text-xs font-bold"><span>Trung bình / ngày</span><span className="text-[hsl(105_33%_30%)]">{ratio}% mục tiêu</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[hsl(105_40%_45%)] transition-[width] duration-500" style={{ width: `${ratio}%` }} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Tính theo khẩu phần của {prefs.adults + prefs.elderly + prefs.kids} thành viên và công thức dinh dưỡng từ kho món địa phương.</p></div></section>; }

function ShoppingPage({ shopping, bought, setBought, customItems, setCustomItems, totalCost }: { shopping: Aggregate; bought: Set<string>; setBought: (value: Set<string>) => void; customItems: { name: string; bought: boolean }[]; setCustomItems: (value: { name: string; bought: boolean }[]) => void; totalCost: number }) {
  const [newItem, setNewItem] = useState('');
  const groups = Object.entries(shopping).reduce<Record<string, [string, { qty: number; unit?: string }][]>>((result, item) => { const category = getCategory(item[0]); result[category] = result[category] || []; result[category].push(item); return result; }, {});
  const toggle = (name: string) => { const next = new Set(bought); next.has(name) ? next.delete(name) : next.add(name); setBought(next); };
  const add = () => { if (newItem.trim()) { setCustomItems([...customItems, { name: newItem.trim(), bought: false }]); setNewItem(''); } };
  const boughtCount = [...bought].length + customItems.filter((item) => item.bought).length;
  const totalCount = Object.keys(shopping).length + customItems.length;
  return <div className="space-y-5"><section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-primary">Đi chợ</p><h1 className="display-font mt-1 text-4xl font-bold tracking-tight">Túi đi chợ tuần này</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Đã tính theo đúng số người và 3 bữa mỗi ngày. Chạm vào món đã có sẵn để trừ khỏi dự toán.</p></div><button onClick={() => window.print()} className="tactile inline-flex w-fit items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-xs font-bold" data-testid="button-print-shopping"><Printer size={15} /> In danh sách</button></section><div className="paper-card flex flex-wrap items-center justify-between gap-4 bg-[hsl(41_100%_91%)] p-4 md:p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent"><ShoppingBasket size={19} /></span><div><p className="text-xs font-bold text-muted-foreground">Tiến độ đi chợ</p><p className="text-xl font-bold">{boughtCount}<span className="text-sm font-medium text-muted-foreground"> / {totalCount} món</span></p></div></div><div className="text-right"><p className="text-xs font-bold text-muted-foreground">Ước tính còn cần chi</p><p className="text-xl font-bold text-primary">{money(totalCost)}</p></div></div><div className="grid gap-4 md:grid-cols-2">{Object.entries(groups).map(([category, items]) => <ShoppingGroup key={category} category={category} items={items} bought={bought} toggle={toggle} />)}</div><section className="paper-card p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Tự thêm</p><h2 className="display-font mt-1 text-2xl font-bold">Món cần nhớ</h2></div><Plus size={20} className="text-primary" /></div><div className="mt-4 flex gap-2"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} placeholder="Ví dụ: khăn giấy, nước rửa rau" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-3 text-sm outline-none ring-primary focus:ring-2" data-testid="input-custom-shopping" /><button onClick={add} className="tactile rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="button-add-shopping"><Plus size={16} /></button></div><div className="mt-3 space-y-2">{customItems.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Chưa có món tự thêm. Danh sách này chỉ của riêng nhà mình.</p> : customItems.map((item, index) => <div key={`${item.name}-${index}`} className={`flex items-center justify-between rounded-xl border bg-background px-3 py-3 ${item.bought ? 'opacity-50' : ''}`}><button onClick={() => setCustomItems(customItems.map((entry, i) => i === index ? { ...entry, bought: !entry.bought } : entry))} className="flex min-w-0 items-center gap-3 text-left text-sm font-bold" data-testid={`button-toggle-custom-${index}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${item.bought ? 'border-[hsl(105_40%_45%)] bg-[hsl(105_40%_45%)] text-white' : ''}`}>{item.bought && <Check size={12} />}</span><span className={item.bought ? 'line-through' : ''}>{item.name}</span></button><button onClick={() => setCustomItems(customItems.filter((_, i) => i !== index))} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Xóa món tự thêm" data-testid={`button-remove-custom-${index}`}><Trash2 size={15} /></button></div>)}</div></section></div>;
}
function ShoppingGroup({ category, items, bought, toggle }: { category: string; items: [string, { qty: number; unit?: string }][]; bought: Set<string>; toggle: (name: string) => void }) { return <section className="paper-card overflow-hidden"><div className="flex items-center justify-between border-b bg-muted/45 px-4 py-3"><h2 className="text-sm font-bold">{category}</h2><span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{items.length} món</span></div><div className="divide-y">{items.map(([name, value]) => { const done = bought.has(name); return <div key={name} className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-opacity ${done ? 'opacity-45' : ''}`}><button onClick={() => toggle(name)} className="flex min-w-0 items-center gap-3 text-left" data-testid={`button-bought-${name}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${done ? 'border-[hsl(105_40%_45%)] bg-[hsl(105_40%_45%)] text-white' : 'border-[hsl(37_43%_74%)] bg-card'}`}>{done && <Check size={14} strokeWidth={3} />}</span><span className={`text-sm font-semibold ${done ? 'line-through' : ''}`}>{name}</span></button><span className="shrink-0 text-xs font-bold text-muted-foreground">{displayQuantity(value)}</span></div>; })}</div></section>; }

function ShoppingPageV2({ shopping, bought, setBought, customItems, setCustomItems, totalCost, setQuantityOverrides, targetBudget }: { shopping: Aggregate; bought: Set<string>; setBought: (value: Set<string>) => void; customItems: { name: string; bought: boolean }[]; setCustomItems: (value: { name: string; bought: boolean }[]) => void; totalCost: number; setQuantityOverrides: (value: Record<string, number> | ((current: Record<string, number>) => Record<string, number>)) => void; targetBudget: number }) {
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
  return <div className="space-y-5 pb-5">
    <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[.17em] text-primary">Đi chợ</p><h1 className="display-font mt-1 text-4xl font-bold tracking-tight">Túi đi chợ tuần này</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Tươi sống mua nhanh, đồ khô mua đúng chỗ. Chạm vào món nhà mình đã có để trừ khỏi dự toán.</p></div>
      <div className="flex flex-wrap gap-2">
        <button onClick={copyShoppingList} className="warm-cta tactile inline-flex items-center justify-center gap-2 shadow-[0_8px_18px_rgba(217,107,67,0.22)]" data-testid="button-share-zalo">{copied ? <Check size={15} /> : <Share2 size={15} />}{copied ? 'Đã copy danh sách' : '📱 Gửi Danh Sách Đi Chợ Cho Chồng Qua Zalo'}</button>
        <button onClick={() => window.print()} className="tactile inline-flex items-center gap-2 rounded-full border border-[hsl(34_31%_90%)] bg-white px-4 py-2.5 text-xs font-bold shadow-sm" data-testid="button-print-shopping"><Printer size={15} /> In danh sách</button>
      </div>
    </section>
    <div className="paper-card p-5">
      <BudgetProgress totalCost={totalCost} targetBudget={targetBudget} />
    </div>
    <div className="paper-card flex flex-wrap items-center justify-between gap-4 bg-[hsl(41_100%_91%)] p-4 md:p-5">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent"><ShoppingBasket size={19} /></span><div><p className="text-xs font-bold text-muted-foreground">Tiến độ đi chợ</p><p className="text-xl font-bold">{boughtCount}<span className="text-sm font-medium text-muted-foreground"> / {totalCount} món</span></p></div></div>
      <div className="text-right"><p className="text-xs font-bold text-muted-foreground">Ước tính còn cần chi</p><p className="text-xl font-bold text-primary">{money(totalCost)}</p><p className="mt-1 text-[10px] text-muted-foreground">Đã trừ món nhà mình có sẵn</p></div>
    </div>
    <ShoppingGroupV2 title="Thực phẩm tươi sống" subtitle="Thịt, cá, tôm, rau và củ" items={freshItems} bought={bought} toggle={toggle} updateQuantity={updateQuantity} kind="fresh" />
    <ShoppingGroupV2 title="Đồ khô & gia vị" subtitle="Gạo, bún, tôm khô và các món để dành" items={dryItems} bought={bought} toggle={toggle} updateQuantity={updateQuantity} kind="dry" />
    <section className="paper-card border-[hsl(105_40%_45%/.3)] bg-secondary/45 p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(105_33%_30%)]">Mua tươi sống tiện hơn</p><p className="mt-1 text-sm font-semibold">Đặt một lần, giao đủ rau củ và thịt cá cho cả tuần.</p></div><a href={BACH_HOA_XANH_AFFILIATE_URL} target="_blank" rel="nofollow sponsored noopener" className="tactile inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(105_40%_45%)] px-4 py-3 text-xs font-bold text-white shadow-[0_4px_0_hsl(105_40%_35%)]" data-testid="link-bach-hoa-xanh"><ShoppingBasket size={16} /> 🛒 Đặt giao tận nhà qua Bách Hóa Xanh <ExternalLink size={13} /></a></div>
    </section>
    <section className="paper-card p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Tự thêm</p><h2 className="display-font mt-1 text-2xl font-bold">Món cần nhớ</h2></div><Plus size={20} className="text-primary" /></div><div className="mt-4 flex gap-2"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} placeholder="Ví dụ: khăn giấy, nước rửa rau" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-3 text-sm outline-none ring-primary focus:ring-2" data-testid="input-custom-shopping" /><button onClick={add} className="tactile rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="button-add-shopping"><Plus size={16} /></button></div><div className="mt-3 space-y-2">{customItems.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Chưa có món tự thêm. Danh sách này chỉ của riêng nhà mình.</p> : customItems.map((item, index) => <div key={`${item.name}-${index}`} className={`flex items-center justify-between rounded-xl border bg-background px-3 py-3 ${item.bought ? 'opacity-50' : ''}`}><button onClick={() => setCustomItems(customItems.map((entry, i) => i === index ? { ...entry, bought: !entry.bought } : entry))} className="flex min-w-0 items-center gap-3 text-left text-sm font-bold" data-testid={`button-toggle-custom-${index}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${item.bought ? 'border-[hsl(105_40%_45%)] bg-[hsl(105_40%_45%)] text-white' : ''}`}>{item.bought && <Check size={12} />}</span><span className={item.bought ? 'line-through' : ''}>{item.name}</span></button><button onClick={() => setCustomItems(customItems.filter((_, i) => i !== index))} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Xóa món tự thêm" data-testid={`button-remove-custom-${index}`}><Trash2 size={15} /></button></div>)}</div></section>
  </div>;
}

function ShoppingGroupV2({ title, subtitle, items, bought, toggle, updateQuantity, kind }: { title: string; subtitle: string; items: [string, { qty: number; unit?: string }][]; bought: Set<string>; toggle: (name: string) => void; updateQuantity: (name: string, value: string) => void; kind: 'fresh' | 'dry' }) {
  return <section className="paper-card overflow-hidden">
    <div className="flex flex-col gap-3 border-b bg-muted/45 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-bold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p></div>{kind === 'fresh' ? <a href={BACH_HOA_XANH_AFFILIATE_URL} target="_blank" rel="nofollow sponsored noopener" className="tactile inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(105_40%_45%)] px-3.5 py-2.5 text-xs font-bold text-white shadow-[0_3px_0_hsl(105_40%_35%)]" data-testid="link-bach-hoa-xanh-group"><ShoppingBasket size={15} /> 🛒 Đặt giao tận nhà qua Bách Hóa Xanh <ExternalLink size={12} /></a> : <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/50 px-3 py-1.5 text-[10px] font-bold text-foreground"><Copy size={12} /> Có thể mua online từng món</span>}</div>
    {items.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Tuần này chưa có món thuộc nhóm này.</p> : <div className="divide-y">{items.map(([name, value]) => { const done = bought.has(name); const affiliateUrl = SHOPPING_AFFILIATE_LINKS[name]; return <div key={name} className={`flex flex-col gap-3 px-4 py-4 transition-opacity sm:flex-row sm:items-center sm:justify-between ${done ? 'opacity-45' : ''}`}><div className="flex min-w-0 items-start gap-3"><label className="mt-0.5 flex shrink-0 items-center gap-2 text-[10px] font-bold text-muted-foreground"><input type="checkbox" checked={done} onChange={() => toggle(name)} className="h-5 w-5 accent-[hsl(105_40%_45%)]" data-testid={`checkbox-have-${name}`} /><span className="whitespace-nowrap">Nhà đã có sẵn</span></label><div className="min-w-0"><p className={`text-sm font-semibold ${done ? 'line-through' : ''}`}>{name}</p><p className="mt-1 text-xs font-bold text-primary">{money(priceFor(name, value.qty))}</p></div></div><div className="flex items-center justify-between gap-3 sm:justify-end"><label className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground"><span className="sr-only">Số lượng {name}</span><input type="number" min="0" step={value.unit ? '0.1' : '5'} value={quantityEditorValue(value)} onChange={(event) => updateQuantity(name, event.target.value)} className="w-24 rounded-lg border bg-background px-2.5 py-2 text-right text-sm font-bold outline-none ring-primary focus:ring-2" data-testid={`input-quantity-${name}`} /><span>{quantityEditorUnit(value)}</span></label>{kind === 'dry' && affiliateUrl && <a href={affiliateUrl} target="_blank" rel="nofollow sponsored noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2 text-[11px] font-bold text-primary hover:bg-primary/10" data-testid={`link-shopee-${name}`}>Xem trên Shopee <ExternalLink size={12} /></a>}</div></div>; })}</div>}
  </section>;
}

function CostsPage({ shopping, prefs, totalCost, plan }: { shopping: Aggregate; prefs: Preferences; totalCost: number; plan: DayPlan[] }) { const ingredients = Object.entries(shopping).reduce((sum, [name, value]) => sum + priceFor(name, value.qty), 0); const remaining = (prefs.targetBudget || 1200000) - totalCost; const bars = plan.map((day) => Math.round(mealCalories(day).cal * unitsOf(prefs))); const max = Math.max(...bars); return <div className="space-y-5"><section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-primary">Chi phí</p><h1 className="display-font mt-1 text-4xl font-bold tracking-tight">Tiền đi chợ, nhìn là hiểu.</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Không cần cộng tay. Công thức giá lấy theo lượng nguyên liệu thật trong thực đơn tuần.</p></div><Link href="/shopping" className="tactile inline-flex w-fit items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-xs font-bold" data-testid="link-costs-shopping">Xem danh sách <ArrowUpRight size={14} /></Link></section><div className="paper-card p-5"><h3 className="text-sm font-bold flex items-center gap-2 mb-4"><WalletCards size={17} className="text-primary" /> Ngân sách tuần này</h3><BudgetProgress totalCost={totalCost} targetBudget={prefs.targetBudget || 1200000} /></div><section className="grid gap-4 sm:grid-cols-3"><StatCard label="Dự kiến cả tuần" value={money(totalCost)} accent="primary" /><StatCard label="Nguyên liệu chính" value={money(ingredients)} /><StatCard label={remaining >= 0 ? 'Còn trong ngân sách' : 'Vượt ngân sách'} value={money(Math.abs(remaining))} accent={remaining >= 0 ? 'sage' : 'berry'} /></section><section className="paper-card p-5 md:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Nhịp chi tiêu</p><h2 className="display-font mt-1 text-2xl font-bold">Mức {budgetLabels[prefs.budget].toLowerCase()}</h2></div><WalletCards size={21} className="text-primary" /></div><div className="mt-6 flex h-44 items-end gap-2 border-b border-l px-2 pb-0 pt-4 sm:gap-4">{bars.map((value, index) => <div key={DAY_NAMES[index]} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-9 rounded-t-lg bg-[hsl(13_80%_56%/.82)] transition-[height] duration-500" style={{ height: `${Math.max(13, value / max * 100)}%` }} /><span className="text-[10px] font-bold text-muted-foreground">{index === 6 ? 'CN' : `T${index + 2}`}</span></div>)}</div><p className="mt-4 text-xs leading-5 text-muted-foreground">Mỗi ngày gồm sáng, trưa, tối và phần gia vị phân bổ theo tuần. Mức này là ước tính tham khảo — giá chợ có thể thay đổi theo mùa.</p></section><section className="paper-card p-5 md:p-6"><h2 className="display-font text-2xl font-bold">Nếu muốn tiết kiệm thêm</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-secondary p-4"><p className="text-sm font-bold">Đổi 1 bữa cá hồi</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Cá basa hấp gừng vẫn giữ đạm và omega-3, nhẹ ví hơn khoảng 28.000 đ / khẩu phần.</p></div><div className="rounded-2xl bg-[hsl(41_100%_91%)] p-4"><p className="text-sm font-bold">Mua theo mùa</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Rau luộc trong tuần có thể thay bằng loại đang tươi nhất ở chợ, công thức vẫn đủ chất.</p></div></div></section></div>; }

function KitchenEquityCard({ weeklySaving }: { weeklySaving: number }) {
  const weeklyRate = 0.08 / 52;
  const weeks = 10 * 52;
  const futureValue = weeklySaving * ((Math.pow(1 + weeklyRate, weeks) - 1) / weeklyRate);
  const futureMillions = Math.round(futureValue / 1_000_000);
  return <section className="overflow-hidden rounded-[24px] border border-[hsl(43_70%_70%)] bg-[linear-gradient(135deg,hsl(41_100%_93%),hsl(103_40%_94%))] p-5 shadow-[0_12px_30px_rgba(86,51,22,.07)] md:p-6" data-testid="kitchen-equity-calculator">
    <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">💡</span><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(105_33%_30%)]">Dự báo Tiết Kiệm Tích Sản</p><h2 className="display-font mt-1 text-2xl font-bold">Căn bếp cũng xây tự do tài chính</h2></div></div>
    {weeklySaving > 0 ? <p className="mt-4 text-sm leading-7 text-foreground" data-testid="text-kitchen-equity-forecast">Khéo vén tuần này giúp chị tiết kiệm khoảng <strong className="text-primary">{money(weeklySaving)}</strong>. Nếu trích số tiền này tích sản dài hạn, sau 10 năm chị có thể có thêm khoảng <strong className="text-[hsl(105_33%_30%)]">{futureMillions.toLocaleString('vi-VN')} triệu VNĐ</strong> cho mục tiêu Tự Do Tài Chính!</p> : <p className="mt-4 text-sm leading-7 text-foreground" data-testid="text-kitchen-equity-forecast">Tuần này chưa có khoản dư so với ngân sách mục tiêu. Hãy thử các gợi ý đổi món để bắt đầu tạo một khoản tích sản nhỏ từ căn bếp.</p>}
    <p className="mt-2 text-[10px] leading-5 text-muted-foreground">Minh họa với khoản tiết kiệm được góp đều mỗi tuần và lợi suất giả định 8%/năm. Lợi suất thực tế có thể thay đổi và không được đảm bảo.</p>
    <a href="https://35to53.com" target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('blog_35to53_opened', { source: 'kitchen_equity' })} className="tactile mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-center text-sm font-bold text-background sm:w-auto" data-testid="link-kitchen-equity-blog">Đọc bài viết chia sẻ cách tích sản từ căn bếp trên 35to53.com <ExternalLink size={15} /></a>
  </section>;
}

function BlogFooter() {
  return <footer className="content-wrap no-print pb-28 pt-1 md:pb-6 md:pt-3"><a href="https://35to53.com" target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('blog_35to53_opened', { source: 'footer' })} className="group flex items-center justify-between gap-3 rounded-2xl border border-[hsl(36_70%_82%)] bg-card px-4 py-3.5 text-sm leading-6 shadow-[0_8px_22px_rgba(86,51,22,.05)] transition-colors hover:bg-[hsl(41_100%_96%)]" data-testid="link-footer-35to53"><span><strong>📖 Tìm hiểu thêm</strong> về Triết lý Căn Bếp Chữa Lành &amp; Tự Do Tài Chính tại Blog 35to53.com</span><ArrowUpRight size={17} className="shrink-0 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></a></footer>;
}

function StatCard({ label, value, accent = '' }: { label: string; value: string; accent?: string }) { const primary = accent === 'primary'; return <section className={`paper-card p-5 ${accent === 'sage' ? 'bg-secondary' : accent === 'berry' ? 'bg-[hsl(12_100%_93%)]' : ''}`} style={primary ? { backgroundColor: 'hsl(13 80% 56%)', color: 'white' } : undefined}><p className={`text-xs font-bold ${primary ? 'text-white/80' : 'text-muted-foreground'}`}>{label}</p><p className="display-font mt-2 text-2xl font-bold">{value}</p></section>; }

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
    {allergyText.length > 0 && <div className="flex items-start gap-3 rounded-2xl border border-[hsl(13_80%_56%/.3)] bg-[hsl(12_100%_93%)] p-4 text-sm"><AlertCircle size={18} className="mt-0.5 shrink-0 text-primary" /><p><span className="font-bold">AI sẽ tự né:</span> {allergyText.join(', ')}.</p></div>}
    {prefs.kids > 0 && <div className="flex items-start gap-3 rounded-2xl border border-[hsl(105_40%_45%/.3)] bg-secondary p-4 text-sm"><Utensils size={18} className="mt-0.5 shrink-0 text-[hsl(105_33%_30%)]" /><p><span className="font-bold">Quy tắc an toàn đang bật:</span> không gợi ý mật ong cho gia đình có trẻ nhỏ; luôn ưu tiên vị nhạt và ít dầu mỡ.</p></div>}
    {error && <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{error}</p><button onClick={() => setError('')} className="ml-auto rounded-full p-1" aria-label="Đóng thông báo lỗi"><X size={15} /></button></div>}
    {mode === 'fridge' ? <section className="space-y-4">
      <div className="paper-card p-5 md:p-6"><div className="grid gap-5 md:grid-cols-[.9fr_1.1fr] md:items-center"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Bước 1</p><h2 className="display-font mt-1 text-2xl font-bold">Cho mình xem tủ lạnh</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Ảnh càng đủ sáng, AI càng dễ nhận diện rau, thịt, cá và gia vị.</p><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/10"><ImagePlus size={18} /> Chụp hoặc tải ảnh<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => onImageSelected(event.target.files?.[0])} data-testid="input-fridge-image" /></label></div><div className="relative flex min-h-44 items-center justify-center overflow-hidden rounded-2xl bg-muted">{imagePreview ? <><img src={imagePreview} alt="Ảnh nguyên liệu đã chọn" className="max-h-64 w-full object-cover" /><button onClick={() => { setImageData(''); setImagePreview(''); setFridgeResult(null); }} className="absolute right-2 top-2 rounded-full bg-foreground/80 p-2 text-background" aria-label="Xóa ảnh đã chọn" data-testid="button-remove-fridge-image"><X size={15} /></button></> : <div className="text-center text-muted-foreground"><Upload size={24} className="mx-auto" /><p className="mt-2 text-xs">Chưa có ảnh</p></div>}</div></div><button onClick={analyzeFridge} disabled={loading !== null || !imageData} className="tactile mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_4px_0_hsl(13_72%_43%)] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-analyze-fridge">{loading === 'fridge' ? <><LoaderCircle size={17} className="animate-spin" /> AI đang nhìn ảnh...</> : <><Camera size={17} /> Nhận diện nguyên liệu & gợi ý món</>}</button></div>
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
  return <div className="space-y-4"><section className="paper-card p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">AI nhìn thấy</p><h2 className="display-font mt-1 text-2xl font-bold">Nguyên liệu trong ảnh</h2></div><Check size={21} className="text-[hsl(105_40%_45%)]" /></div><div className="mt-4 flex flex-wrap gap-2">{result.ingredients.map((ingredient) => <span key={ingredient.name} className="rounded-full bg-secondary px-3 py-2 text-xs font-bold">{ingredient.name}<span className="ml-1 text-[10px] font-normal text-muted-foreground">{Math.round(ingredient.confidence * 100)}%</span></span>)}</div></section><div className="grid gap-4 lg:grid-cols-3">{result.dishes.map((dish, index) => <article key={`${dish.name}-${index}`} className="paper-card flex flex-col p-5"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Món {index + 1}</span><h3 className="display-font mt-1 text-xl font-bold">{dish.name}</h3></div><Utensils size={19} className="shrink-0 text-secondary-foreground" /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{dish.why}</p><div className="mt-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Nguyên liệu</p><ul className="mt-2 space-y-1 text-sm">{dish.ingredients.map((item) => <li key={item} className="flex gap-2"><span className="text-primary">•</span>{item}</li>)}</ul></div><div className="mt-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Cách làm nhanh</p><ol className="mt-2 space-y-2 text-sm leading-5">{dish.steps.map((step, stepIndex) => <li key={step} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{stepIndex + 1}</span>{step}</li>)}</ol></div><div className="mt-auto pt-5"><NutritionSummaryCard nutrition={dish.nutrition} /></div></article>)}</div>{result.safetyNotes.length > 0 && <section className="paper-card border-secondary bg-secondary/50 p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-secondary-foreground">Lưu ý an toàn</p><ul className="mt-2 space-y-1 text-sm leading-5">{result.safetyNotes.map((note) => <li key={note}>• {note}</li>)}</ul></section>}</div>;
}

function RecipeResultCard({ result }: { result: RecipeAiResult }) {
  return <section className="paper-card p-5 md:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Công thức 1 khẩu phần</p><h2 className="display-font mt-1 text-3xl font-bold">{result.dishName}</h2></div><span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-xs font-bold"><Clock3 size={14} /> Nhạt · ít dầu</span></div><div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Định lượng nguyên liệu</p><ul className="mt-3 divide-y rounded-2xl border bg-background">{result.ingredients.map((ingredient) => <li key={ingredient.name} className="flex justify-between gap-3 px-3 py-2.5 text-sm"><span>{ingredient.name}</span><span className="font-bold text-primary">{ingredient.amount}</span></li>)}</ul><div className="mt-4"><NutritionSummaryCard nutrition={result.nutrition} /></div></div><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Các bước nấu</p><ol className="mt-3 space-y-3">{result.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span><span>{step}</span></li>)}</ol></div></div>{result.safetyNotes.length > 0 && <div className="mt-5 rounded-2xl bg-secondary/70 p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-secondary-foreground">Lưu ý cho nhà mình</p><ul className="mt-2 space-y-1 text-sm leading-5">{result.safetyNotes.map((note) => <li key={note}>• {note}</li>)}</ul></div>}</section>;
}

function BottomNav({ location }: { location: string }) { const items = [{ href: '/', label: 'Thực Đơn', icon: CalendarDays }, { href: '/shopping', label: 'Đi Chợ', icon: ShoppingBasket }, { href: '/costs', label: 'Chi Phí', icon: WalletCards }, { href: '/ask-ai', label: 'Bếp AI', icon: Sparkles }]; return <nav aria-label="Điều hướng chính" className="bottom-nav safe-bottom fixed inset-x-0 bottom-0 z-[1000] border-t border-[hsl(36_30%_88%)] bg-[rgba(255,255,255,0.96)] px-2 pt-1 shadow-[0_-10px_30px_rgba(32,26,20,0.08)] backdrop-blur-md md:hidden"><div className="mx-auto grid h-[65px] max-w-xl grid-cols-4 gap-1">{items.map(({ href, label, icon: Icon }) => { const active = href === '/' ? location === '/' : location.startsWith(href); return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`nav-item flex h-full flex-col items-center justify-center gap-1 rounded-[14px] px-1.5 py-2 text-[10px] font-bold transition-all duration-200 ${active ? 'scale-[1.02] bg-[rgba(74,124,89,0.1)] text-[hsl(148_25%_36%)]' : 'text-[hsl(220_13%_60%)] hover:bg-[hsl(39_44%_95%)]'}`} data-testid={`link-nav-${label}`}><Icon size={18} strokeWidth={active ? 2.6 : 2} /><span>{label}</span></Link>; })}</div></nav>; }

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
              <button onClick={() => { onClose(); onUpgrade(); }} className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-[linear-gradient(135deg,hsl(13_80%_56%/.1),hsl(43_100%_61%/.15))] p-3 text-primary hover:bg-[linear-gradient(135deg,hsl(13_80%_56%/.15),hsl(43_100%_61%/.2))] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="button-drawer-upgrade">
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
