// Recipe Diversity System — Kho Món Ăn (Recipe Matrix) for the Gemini meal-tray / meal-week AI
// service. This is a curated, hand-tagged dish bank (independent from the client's own
// deterministic data.ts bank) used two ways by routes/ai.ts:
//   1. As a hard, code-level allergen + recent-history FILTER applied *before* the Gemini call —
//      the model only ever sees a candidate pool that is already 100% safe and non-repetitive,
//      instead of relying purely on a prompt instruction it could ignore.
//   2. As the fallback source when a *post-response* safety check finds Gemini slipped an
//      allergen or a recently-eaten main dish into its answer — the offending dish is swapped
//      for a matrix entry that is guaranteed safe, instead of shipping the unsafe result.

export type RecipeTag =
  | 'Chay'
  | 'WHO_Healthy'
  | 'U40_Estrogen'
  | 'Trẻ_Nhỏ'
  | 'Đa_Thế_Hệ'
  | 'Món_Trend'
  | 'Hàn_Nhật'
  | 'Truyền_Thống_3Mien';

export type RecipeCategory = 'Món Đạm' | 'Món Rau' | 'Món Canh';

export type DietaryMode = 'u40_estrogen' | 'tre_nho_da_the_he' | 'chay_thanh_tinh' | 'doi_vi_a_au';

export type RecipeMatrixEntry = {
  name: string;
  category: RecipeCategory;
  tags: RecipeTag[];
  /** Nguyên liệu/nhóm dị ứng có trong món — dùng để hard-filter, không phải free-text mô tả. */
  allergens: string[];
  /** Chi phí ước tính cho 1 khẩu phần người lớn, VNĐ. */
  estimated_cost: number;
};

export function normalizeVi(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Mirrors the alias table the client keeps in App.tsx (allergyTerms) so "Cua/Hải sản" also blocks
// tôm/mực, and "Đậu nành" also blocks đậu hũ, etc. Kept in sync manually — small, stable list.
const ALLERGY_ALIASES: Record<string, string[]> = {
  'tom': ['tom', 'hai san', 'muc'],
  'cua/hai san': ['cua', 'tom', 'muc', 'hai san'],
  'trung': ['trung'],
  'dau nanh': ['dau nanh', 'dau hu'],
  'thit bo': ['thit bo'],
  'mang': ['mang'],
  'nam': ['nam'],
};

/** Expands the family's declared allergies/allergyOther into normalized (no-diacritics) block terms. */
export function expandAllergyTerms(allergies: string[], allergyOther: string): string[] {
  const raw = [...allergies, ...allergyOther.split(',').map((item) => item.trim()).filter(Boolean)];
  return raw.flatMap((item) => ALLERGY_ALIASES[normalizeVi(item)] || [normalizeVi(item)]);
}

/** Does this free-text blob (dish name + ingredients) contain any blocked allergen term? */
export function textHasBlockedAllergen(text: string, blockedTerms: string[]): boolean {
  if (!blockedTerms.length) return false;
  const normalized = normalizeVi(text);
  return blockedTerms.some((term) => term && normalized.includes(term));
}

function entryIsAllergySafe(entry: RecipeMatrixEntry, blockedTerms: string[]): boolean {
  return !textHasBlockedAllergen(`${entry.name} ${entry.allergens.join(' ')}`, blockedTerms);
}

/** Hard filter #1 (Anti-Repetition Engine step 1): loại bỏ 100% món thuộc danh sách dị ứng. */
export function filterMatrixByAllergens(pool: RecipeMatrixEntry[], blockedTerms: string[]): RecipeMatrixEntry[] {
  return pool.filter((entry) => entryIsAllergySafe(entry, blockedTerms));
}

/**
 * Hard filter #2: loại các món mặn (Món Đạm) đã ăn trong tối đa 3 ngày gần nhất. `recentDishesHistory`
 * may hold up to 7 days of history (oldest → newest) — only the last 3 are the hard-exclude window,
 * matching "KHÔNG lặp lại món mặn đã xuất hiện trong 3 ngày trước đó".
 */
export function filterOutRecentMainDishes(pool: RecipeMatrixEntry[], recentDishesHistory: string[]): RecipeMatrixEntry[] {
  const last3 = recentDishesHistory.slice(-3).map(normalizeVi);
  if (!last3.length) return pool;
  return pool.filter((entry) => entry.category !== 'Món Đạm' || !last3.includes(normalizeVi(entry.name)));
}

const DIETARY_MODE_TAGS: Record<DietaryMode, RecipeTag[]> = {
  u40_estrogen: ['U40_Estrogen'],
  tre_nho_da_the_he: ['Trẻ_Nhỏ', 'Đa_Thế_Hệ'],
  chay_thanh_tinh: ['Chay'],
  // No dedicated "Âu-Mỹ" tag in the 8-tag matrix; Âu-Mỹ tinh gọn dishes are filed under Món_Trend
  // (fusion/trend-leaning) alongside Hàn_Nhật so "Đổi vị Á-Âu" still pulls a full Á + Âu spread.
  doi_vi_a_au: ['Hàn_Nhật', 'Món_Trend'],
};

/**
 * Sáng Tạo Đa Dạng Theo Chế Độ (Dynamic Cuisine Transformer), applied to a pool: `chay_thanh_tinh`
 * is a HARD filter (100% mâm chay, no soft fallback — a chay request must never surface meat), the
 * other modes are a soft boost/sort so the pool never empties out if a category is thin on tag matches.
 */
export function applyDietaryModes(pool: RecipeMatrixEntry[], modes: DietaryMode[]): RecipeMatrixEntry[] {
  if (modes.includes('chay_thanh_tinh')) {
    const chayOnly = pool.filter((entry) => entry.tags.includes('Chay'));
    if (chayOnly.length) pool = chayOnly;
  }
  const wantedTags = new Set(modes.flatMap((mode) => DIETARY_MODE_TAGS[mode]));
  if (!wantedTags.size) return pool;
  return [...pool].sort((a, b) => {
    const score = (entry: RecipeMatrixEntry) => entry.tags.reduce((sum, tag) => sum + (wantedTags.has(tag) ? 1 : 0), 0);
    return score(b) - score(a);
  });
}

/** Renders a compact bullet list grouped by category, for embedding as the AI's candidate pool. */
export function formatMatrixForPrompt(pool: RecipeMatrixEntry[]): string {
  const categories: RecipeCategory[] = ['Món Đạm', 'Món Rau', 'Món Canh'];
  return categories
    .map((category) => {
      const items = pool.filter((entry) => entry.category === category);
      if (!items.length) return '';
      const lines = items
        .slice(0, 12)
        .map((entry) => `  - ${entry.name} [${entry.tags.join(', ')}] (~${entry.estimated_cost.toLocaleString('vi-VN')}đ)`)
        .join('\n');
      return `${category}:\n${lines}`;
    })
    .filter(Boolean)
    .join('\n');
}

/** Picks a single safe replacement for a slot that failed post-response validation. */
export function pickFallbackDish(
  category: RecipeCategory,
  blockedTerms: string[],
  recentDishesHistory: string[],
  modes: DietaryMode[],
  avoidNames: string[] = [],
): RecipeMatrixEntry | null {
  let pool = RECIPE_MATRIX.filter((entry) => entry.category === category);
  pool = filterMatrixByAllergens(pool, blockedTerms);
  pool = filterOutRecentMainDishes(pool, recentDishesHistory);
  pool = pool.filter((entry) => !avoidNames.map(normalizeVi).includes(normalizeVi(entry.name)));
  pool = applyDietaryModes(pool, modes);
  return pool[0] || null;
}

export const RECIPE_MATRIX: RecipeMatrixEntry[] = [
  // ---- Món Đạm --------------------------------------------------------------------------------
  { name: 'Cá basa hấp gừng hành', category: 'Món Đạm', tags: ['WHO_Healthy', 'Truyền_Thống_3Mien'], allergens: [], estimated_cost: 28000 },
  { name: 'Cá hồi áp chảo sốt mè rang', category: 'Món Đạm', tags: ['U40_Estrogen', 'WHO_Healthy'], allergens: [], estimated_cost: 42000 },
  { name: 'Đậu hũ non sốt nấm đậu nành', category: 'Món Đạm', tags: ['Chay', 'U40_Estrogen'], allergens: ['đậu nành'], estimated_cost: 16000 },
  { name: 'Trứng hấp thịt băm mềm cho bé', category: 'Món Đạm', tags: ['Trẻ_Nhỏ', 'Đa_Thế_Hệ'], allergens: ['trứng'], estimated_cost: 15000 },
  { name: 'Thịt viên sốt cà chua mềm', category: 'Món Đạm', tags: ['Trẻ_Nhỏ', 'Đa_Thế_Hệ', 'WHO_Healthy'], allergens: [], estimated_cost: 22000 },
  { name: 'Gà hấp lá chanh xé nhỏ', category: 'Món Đạm', tags: ['Đa_Thế_Hệ', 'WHO_Healthy'], allergens: [], estimated_cost: 24000 },
  { name: 'Cá diêu hồng hấp xì dầu', category: 'Món Đạm', tags: ['WHO_Healthy', 'Truyền_Thống_3Mien'], allergens: [], estimated_cost: 26000 },
  { name: 'Cá bống kho tiêu', category: 'Món Đạm', tags: ['Truyền_Thống_3Mien'], allergens: [], estimated_cost: 27000 },
  { name: 'Thịt kho tàu trứng cút', category: 'Món Đạm', tags: ['Truyền_Thống_3Mien', 'Đa_Thế_Hệ'], allergens: ['trứng'], estimated_cost: 30000 },
  { name: 'Đậu hũ chiên sả kiểu miền Nam', category: 'Món Đạm', tags: ['Chay', 'Truyền_Thống_3Mien'], allergens: ['đậu nành'], estimated_cost: 15000 },
  { name: 'Bulgogi bò áp chảo tinh gọn', category: 'Món Đạm', tags: ['Hàn_Nhật', 'Món_Trend'], allergens: ['thịt bò'], estimated_cost: 45000 },
  { name: 'Cá hồi sốt Teriyaki', category: 'Món Đạm', tags: ['Hàn_Nhật', 'U40_Estrogen'], allergens: [], estimated_cost: 44000 },
  { name: 'Đậu hũ sốt Miso nấm', category: 'Món Đạm', tags: ['Hàn_Nhật', 'Chay', 'U40_Estrogen'], allergens: ['đậu nành'], estimated_cost: 18000 },
  { name: 'Ức gà sốt mật ong mù tạt (Trend)', category: 'Món Đạm', tags: ['Món_Trend', 'WHO_Healthy'], allergens: [], estimated_cost: 26000 },
  { name: 'Cơm cuộn rong biển chà bông (Trend)', category: 'Món Đạm', tags: ['Món_Trend', 'Trẻ_Nhỏ'], allergens: ['trứng'], estimated_cost: 20000 },
  { name: 'Bò lúc lắc phô mai tan chảy (Trend)', category: 'Món Đạm', tags: ['Món_Trend'], allergens: ['thịt bò', 'sữa'], estimated_cost: 48000 },
  { name: 'Mì Ý sốt kem thịt bằm tinh gọn', category: 'Món Đạm', tags: ['Món_Trend'], allergens: ['sữa', 'gluten'], estimated_cost: 32000 },
  { name: 'Salad ức gà mè rang phong cách Âu', category: 'Món Đạm', tags: ['Món_Trend', 'WHO_Healthy'], allergens: [], estimated_cost: 30000 },
  { name: 'Đậu hũ hấp nấm rau mầm', category: 'Món Đạm', tags: ['Chay', 'U40_Estrogen', 'WHO_Healthy'], allergens: ['đậu nành'], estimated_cost: 17000 },
  { name: 'Tôm hấp sả kiểu nhẹ', category: 'Món Đạm', tags: ['WHO_Healthy', 'Truyền_Thống_3Mien'], allergens: ['tôm'], estimated_cost: 35000 },

  // ---- Món Rau/Xào ------------------------------------------------------------------------------
  { name: 'Rau mầm trộn dầu mè', category: 'Món Rau', tags: ['U40_Estrogen', 'WHO_Healthy'], allergens: [], estimated_cost: 12000 },
  { name: 'Nấm bào ngư xào mè rang', category: 'Món Rau', tags: ['U40_Estrogen', 'Chay'], allergens: [], estimated_cost: 14000 },
  { name: 'Bông cải xanh hấp cà rốt tỉa hoa', category: 'Món Rau', tags: ['Trẻ_Nhỏ', 'Đa_Thế_Hệ', 'WHO_Healthy'], allergens: [], estimated_cost: 12000 },
  { name: 'Bí đỏ hấp nghiền sốt cà nhẹ', category: 'Món Rau', tags: ['Trẻ_Nhỏ', 'Đa_Thế_Hệ'], allergens: [], estimated_cost: 9000 },
  { name: 'Su su xào cà rốt cắt hoa', category: 'Món Rau', tags: ['Trẻ_Nhỏ', 'Đa_Thế_Hệ'], allergens: [], estimated_cost: 10000 },
  { name: 'Cải thìa luộc tỏi thanh nhạt', category: 'Món Rau', tags: ['WHO_Healthy', 'Truyền_Thống_3Mien'], allergens: [], estimated_cost: 8000 },
  { name: 'Rau muống xào tỏi đồng quê', category: 'Món Rau', tags: ['Truyền_Thống_3Mien', 'WHO_Healthy'], allergens: [], estimated_cost: 7000 },
  { name: 'Kim chi cải thảo lên men nhẹ', category: 'Món Rau', tags: ['Hàn_Nhật'], allergens: [], estimated_cost: 11000 },
  { name: 'Salad rong biển kiểu Nhật', category: 'Món Rau', tags: ['Hàn_Nhật', 'U40_Estrogen'], allergens: [], estimated_cost: 15000 },
  { name: 'Đậu bắp luộc chấm mè rang (Trend)', category: 'Món Rau', tags: ['Món_Trend', 'U40_Estrogen'], allergens: [], estimated_cost: 10000 },
  { name: 'Ớt chuông áp chảo bơ tỏi kiểu Âu', category: 'Món Rau', tags: ['Món_Trend'], allergens: ['sữa'], estimated_cost: 16000 },
  { name: 'Giá đỗ xào đậu hũ non', category: 'Món Rau', tags: ['Chay', 'U40_Estrogen'], allergens: ['đậu nành'], estimated_cost: 9000 },
  { name: 'Bắp cải tím trộn dầu giấm (Trend)', category: 'Món Rau', tags: ['Món_Trend', 'WHO_Healthy'], allergens: [], estimated_cost: 11000 },
  { name: 'Măng tây áp chảo kiểu Âu', category: 'Món Rau', tags: ['Món_Trend', 'WHO_Healthy'], allergens: [], estimated_cost: 20000 },

  // ---- Món Canh ---------------------------------------------------------------------------------
  { name: 'Canh nấm đậu hũ rau mầm', category: 'Món Canh', tags: ['Chay', 'U40_Estrogen'], allergens: ['đậu nành'], estimated_cost: 13000 },
  { name: 'Canh bí đỏ nấu tôm thanh nhạt', category: 'Món Canh', tags: ['Trẻ_Nhỏ', 'Đa_Thế_Hệ', 'WHO_Healthy'], allergens: ['tôm'], estimated_cost: 14000 },
  { name: 'Canh trứng cà chua mềm cho bé', category: 'Món Canh', tags: ['Trẻ_Nhỏ', 'Đa_Thế_Hệ'], allergens: ['trứng'], estimated_cost: 10000 },
  { name: 'Canh chua cá lóc miền Tây', category: 'Món Canh', tags: ['Truyền_Thống_3Mien'], allergens: [], estimated_cost: 18000 },
  { name: 'Canh sấu thịt bằm miền Bắc', category: 'Món Canh', tags: ['Truyền_Thống_3Mien'], allergens: [], estimated_cost: 15000 },
  { name: 'Canh khổ qua nhồi thịt', category: 'Món Canh', tags: ['Truyền_Thống_3Mien', 'WHO_Healthy'], allergens: [], estimated_cost: 20000 },
  { name: 'Canh kim chi đậu hũ', category: 'Món Canh', tags: ['Hàn_Nhật', 'Chay'], allergens: ['đậu nành'], estimated_cost: 14000 },
  { name: 'Súp Miso rong biển đậu hũ', category: 'Món Canh', tags: ['Hàn_Nhật', 'U40_Estrogen', 'Chay'], allergens: ['đậu nành'], estimated_cost: 15000 },
  { name: 'Súp kem bí đỏ kiểu Âu (Trend)', category: 'Món Canh', tags: ['Món_Trend'], allergens: ['sữa'], estimated_cost: 16000 },
  { name: 'Canh rau ngót chay thanh tịnh', category: 'Món Canh', tags: ['Chay', 'WHO_Healthy'], allergens: [], estimated_cost: 8000 },
  { name: 'Canh nấm rơm chay đủ đạm thực vật', category: 'Món Canh', tags: ['Chay', 'WHO_Healthy'], allergens: [], estimated_cost: 12000 },
  { name: 'Canh bí xanh nấu nấm bào ngư mè', category: 'Món Canh', tags: ['U40_Estrogen', 'WHO_Healthy'], allergens: [], estimated_cost: 13000 },
];
