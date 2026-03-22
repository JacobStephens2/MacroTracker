import type { User, Food, ExternalFood, MealLog, Recipe, RecipeIngredient, WeightLog } from './types';

const GUEST_KEY = 'guest_mode';

export function isGuestMode(): boolean {
  return localStorage.getItem(GUEST_KEY) === 'true';
}

export function setGuestMode(enabled: boolean) {
  if (enabled) localStorage.setItem(GUEST_KEY, 'true');
  else localStorage.removeItem(GUEST_KEY);
}

export function clearGuestData() {
  localStorage.removeItem(GUEST_KEY);
  localStorage.removeItem('guest_user');
  localStorage.removeItem('guest_foods');
  localStorage.removeItem('guest_meals');
  localStorage.removeItem('guest_recipes');
  localStorage.removeItem('guest_recipe_ingredients');
  localStorage.removeItem('guest_weight');
  localStorage.removeItem('guest_next_id');
}

function getStore<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function setStore<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function nextId(): number {
  const id = getStore('guest_next_id', 1);
  setStore('guest_next_id', id + 1);
  return id;
}

const DEFAULT_GUEST_USER: User = {
  id: 0,
  email: '',
  firstName: 'Guest',
  emailVerified: false,
  heightInches: 0,
  currentWeightLbs: 0,
  targetCalories: 2000,
  targetCarbsG: 250,
  targetProteinG: 150,
  targetFatG: 65,
};

export function getGuestUser(): User {
  return getStore('guest_user', DEFAULT_GUEST_USER);
}

// Auth
export const localAuth = {
  me: async (): Promise<{ user: User }> => {
    return { user: getGuestUser() };
  },

  updateProfile: async (data: Partial<User>): Promise<{ user: User }> => {
    const user = getGuestUser();
    Object.assign(user, data);
    setStore('guest_user', user);
    return { user };
  },

  logout: async (): Promise<{ success: boolean }> => {
    setGuestMode(false);
    return { success: true };
  },
};

// Foods
export const localFoods = {
  search: async (q: string): Promise<{ foods: Food[]; external: ExternalFood[] }> => {
    const all = getStore<Food[]>('guest_foods', []);
    const query = q.toLowerCase();
    const foods = all.filter(
      (f) => f.name.toLowerCase().includes(query) || (f.brand && f.brand.toLowerCase().includes(query))
    );
    return { foods, external: [] };
  },

  barcode: async (_code: string): Promise<{ food: Food }> => {
    throw new Error('Barcode lookup requires an account');
  },

  recent: async (): Promise<{ foods: Food[] }> => {
    const foods = getStore<Food[]>('guest_foods', []);
    return { foods: [...foods].reverse().slice(0, 20) };
  },

  custom: async (): Promise<{ foods: Food[] }> => {
    return { foods: getStore<Food[]>('guest_foods', []) };
  },

  create: async (data: Partial<Food>): Promise<{ food: Food }> => {
    const foods = getStore<Food[]>('guest_foods', []);
    const food: Food = {
      id: nextId(),
      user_id: 0,
      name: data.name || '',
      brand: data.brand || null,
      barcode: data.barcode || null,
      serving_size: data.serving_size || 1,
      serving_unit: data.serving_unit || 'serving',
      calories: data.calories || 0,
      carbs_g: data.carbs_g || 0,
      protein_g: data.protein_g || 0,
      fat_g: data.fat_g || 0,
      fiber_g: data.fiber_g || 0,
      sugar_g: data.sugar_g || 0,
      source: 'manual',
      source_id: null,
      measures: data.measures || null,
    };
    foods.push(food);
    setStore('guest_foods', foods);
    return { food };
  },

  saveExternal: async (_data: ExternalFood): Promise<{ food: Food }> => {
    throw new Error('External food database requires an account');
  },

  saveExternalToLocal: async (data: ExternalFood): Promise<{ food: Food }> => {
    const foods = getStore<Food[]>('guest_foods', []);
    const food: Food = {
      id: nextId(),
      user_id: 0,
      name: data.name,
      brand: data.brand || null,
      barcode: data.barcode || null,
      serving_size: data.servingSize || 1,
      serving_unit: data.servingUnit || 'serving',
      calories: data.calories || 0,
      carbs_g: data.carbsG || 0,
      protein_g: data.proteinG || 0,
      fat_g: data.fatG || 0,
      fiber_g: data.fiberG || 0,
      sugar_g: data.sugarG || 0,
      source: data.source || 'manual',
      source_id: data.sourceId || null,
      measures: data.measures ? JSON.stringify(data.measures) : null,
    };
    foods.push(food);
    setStore('guest_foods', foods);
    return { food };
  },

  delete: async (id: number): Promise<{ success: boolean }> => {
    const foods = getStore<Food[]>('guest_foods', []).filter((f) => f.id !== id);
    setStore('guest_foods', foods);
    return { success: true };
  },
};

// Meals
export const localMeals = {
  getByDate: async (date: string): Promise<{ meals: MealLog[] }> => {
    const all = getStore<MealLog[]>('guest_meals', []);
    return { meals: all.filter((m) => m.date === date) };
  },

  getTotals: async (
    startDate: string,
    endDate: string
  ): Promise<{
    totals: { date: string; total_calories: number; total_carbs: number; total_protein: number; total_fat: number }[];
  }> => {
    const all = getStore<MealLog[]>('guest_meals', []);
    const byDate: Record<string, { total_calories: number; total_carbs: number; total_protein: number; total_fat: number }> = {};
    for (const m of all) {
      if (m.date >= startDate && m.date <= endDate) {
        if (!byDate[m.date]) byDate[m.date] = { total_calories: 0, total_carbs: 0, total_protein: 0, total_fat: 0 };
        byDate[m.date].total_calories += m.calories;
        byDate[m.date].total_carbs += m.carbs_g;
        byDate[m.date].total_protein += m.protein_g;
        byDate[m.date].total_fat += m.fat_g;
      }
    }
    return { totals: Object.entries(byDate).map(([date, t]) => ({ date, ...t })) };
  },

  log: async (data: {
    date: string;
    mealType: string;
    foodId?: number;
    recipeId?: number;
    servings?: number;
    calories?: number;
    carbsG?: number;
    proteinG?: number;
    fatG?: number;
    note?: string;
  }): Promise<{ meal: MealLog }> => {
    const meals = getStore<MealLog[]>('guest_meals', []);
    const servings = data.servings || 1;
    let calories = data.calories || 0;
    let carbs_g = data.carbsG || 0;
    let protein_g = data.proteinG || 0;
    let fat_g = data.fatG || 0;
    let food_name: string | null = null;
    let food_brand: string | null = null;
    let serving_size: number | null = null;
    let serving_unit: string | null = null;
    let recipe_name: string | null = null;

    if (data.foodId) {
      const foods = getStore<Food[]>('guest_foods', []);
      const food = foods.find((f) => f.id === data.foodId);
      if (food) {
        calories = food.calories * servings;
        carbs_g = food.carbs_g * servings;
        protein_g = food.protein_g * servings;
        fat_g = food.fat_g * servings;
        food_name = food.name;
        food_brand = food.brand;
        serving_size = food.serving_size;
        serving_unit = food.serving_unit;
      }
    }

    if (data.recipeId) {
      const recipes = getStore<Recipe[]>('guest_recipes', []);
      const recipe = recipes.find((r) => r.id === data.recipeId);
      if (recipe) {
        calories = recipe.perServing.calories * servings;
        carbs_g = recipe.perServing.carbsG * servings;
        protein_g = recipe.perServing.proteinG * servings;
        fat_g = recipe.perServing.fatG * servings;
        recipe_name = recipe.name;
      }
    }

    const meal: MealLog = {
      id: nextId(),
      user_id: 0,
      date: data.date,
      meal_type: data.mealType as MealLog['meal_type'],
      food_id: data.foodId || null,
      recipe_id: data.recipeId || null,
      servings,
      calories,
      carbs_g,
      protein_g,
      fat_g,
      note: data.note || null,
      food_name,
      food_brand,
      serving_size,
      serving_unit,
      recipe_name,
    };
    meals.push(meal);
    setStore('guest_meals', meals);
    return { meal };
  },

  quickLog: async (data: {
    date: string;
    mealType: string;
    name?: string;
    calories?: number;
    carbsG?: number;
    proteinG?: number;
    fatG?: number;
  }): Promise<{ meal: MealLog }> => {
    const meals = getStore<MealLog[]>('guest_meals', []);
    const meal: MealLog = {
      id: nextId(),
      user_id: 0,
      date: data.date,
      meal_type: data.mealType as MealLog['meal_type'],
      food_id: null,
      recipe_id: null,
      servings: 1,
      calories: data.calories || 0,
      carbs_g: data.carbsG || 0,
      protein_g: data.proteinG || 0,
      fat_g: data.fatG || 0,
      note: data.name || null,
      food_name: null,
      food_brand: null,
      serving_size: null,
      serving_unit: null,
      recipe_name: null,
    };
    meals.push(meal);
    setStore('guest_meals', meals);
    return { meal };
  },

  update: async (
    id: number,
    data: { servings?: number; mealType?: string; calories?: number; carbsG?: number; proteinG?: number; fatG?: number }
  ): Promise<{ meal: MealLog }> => {
    const meals = getStore<MealLog[]>('guest_meals', []);
    const meal = meals.find((m) => m.id === id);
    if (!meal) throw new Error('Meal not found');
    if (data.servings !== undefined) meal.servings = data.servings;
    if (data.mealType !== undefined) meal.meal_type = data.mealType as MealLog['meal_type'];
    if (data.calories !== undefined) meal.calories = data.calories;
    if (data.carbsG !== undefined) meal.carbs_g = data.carbsG;
    if (data.proteinG !== undefined) meal.protein_g = data.proteinG;
    if (data.fatG !== undefined) meal.fat_g = data.fatG;
    setStore('guest_meals', meals);
    return { meal };
  },

  delete: async (id: number): Promise<{ success: boolean }> => {
    const meals = getStore<MealLog[]>('guest_meals', []).filter((m) => m.id !== id);
    setStore('guest_meals', meals);
    return { success: true };
  },

  copy: async (fromDate: string, toDate: string): Promise<{ copied: number }> => {
    const meals = getStore<MealLog[]>('guest_meals', []);
    const toCopy = meals.filter((m) => m.date === fromDate);
    if (toCopy.length === 0) throw new Error('No meals to copy');
    for (const m of toCopy) {
      meals.push({ ...m, id: nextId(), date: toDate });
    }
    setStore('guest_meals', meals);
    return { copied: toCopy.length };
  },
};

// Recipes
export const localRecipes = {
  list: async (): Promise<{ recipes: Recipe[] }> => {
    return { recipes: getStore<Recipe[]>('guest_recipes', []) };
  },

  get: async (id: number): Promise<{ recipe: Recipe; ingredients: RecipeIngredient[] }> => {
    const recipes = getStore<Recipe[]>('guest_recipes', []);
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) throw new Error('Recipe not found');
    const allIngredients = getStore<Record<string, RecipeIngredient[]>>('guest_recipe_ingredients', {});
    return { recipe, ingredients: allIngredients[id] || [] };
  },

  create: async (data: {
    name: string;
    totalServings: number;
    servingUnit?: string;
    ingredients: { foodId: number; servings: number; qty?: number; unitLabel?: string }[];
    manualCalories?: number | null;
    manualCarbsG?: number | null;
    manualProteinG?: number | null;
    manualFatG?: number | null;
  }): Promise<{ recipe: { id: number } }> => {
    const recipes = getStore<Recipe[]>('guest_recipes', []);
    const foods = getStore<Food[]>('guest_foods', []);
    const id = nextId();

    const ingredients: RecipeIngredient[] = data.ingredients.map((ing) => {
      const food = foods.find((f) => f.id === ing.foodId);
      return {
        id: nextId(),
        food_id: ing.foodId,
        servings: ing.servings,
        qty: ing.qty || null,
        unit_label: ing.unitLabel || null,
        name: food?.name || '',
        brand: food?.brand || null,
        serving_size: food?.serving_size || 1,
        serving_unit: food?.serving_unit || 'serving',
        calories: food?.calories || 0,
        carbs_g: food?.carbs_g || 0,
        protein_g: food?.protein_g || 0,
        fat_g: food?.fat_g || 0,
        measures: food?.measures || null,
      };
    });

    let totalCal = 0,
      totalC = 0,
      totalP = 0,
      totalF = 0;
    if (data.manualCalories != null) {
      totalCal = data.manualCalories;
      totalC = data.manualCarbsG || 0;
      totalP = data.manualProteinG || 0;
      totalF = data.manualFatG || 0;
    } else {
      for (const ing of ingredients) {
        const origIng = data.ingredients.find((i) => i.foodId === ing.food_id);
        totalCal += ing.calories * (origIng?.servings || 1);
        totalC += ing.carbs_g * (origIng?.servings || 1);
        totalP += ing.protein_g * (origIng?.servings || 1);
        totalF += ing.fat_g * (origIng?.servings || 1);
      }
    }

    const servings = data.totalServings || 1;
    const recipe: Recipe = {
      id,
      user_id: 0,
      name: data.name,
      total_servings: servings,
      serving_unit: data.servingUnit || 'serving',
      manual_calories: data.manualCalories ?? null,
      manual_carbs_g: data.manualCarbsG ?? null,
      manual_protein_g: data.manualProteinG ?? null,
      manual_fat_g: data.manualFatG ?? null,
      ingredientCount: ingredients.length,
      perServing: {
        calories: Math.round(totalCal / servings),
        carbsG: Math.round((totalC / servings) * 10) / 10,
        proteinG: Math.round((totalP / servings) * 10) / 10,
        fatG: Math.round((totalF / servings) * 10) / 10,
      },
    };

    recipes.push(recipe);
    setStore('guest_recipes', recipes);
    const allIngredients = getStore<Record<string, RecipeIngredient[]>>('guest_recipe_ingredients', {});
    allIngredients[id] = ingredients;
    setStore('guest_recipe_ingredients', allIngredients);

    return { recipe: { id } };
  },

  update: async (
    id: number,
    data: {
      name?: string;
      totalServings?: number;
      servingUnit?: string;
      ingredients?: { foodId: number; servings: number; qty?: number; unitLabel?: string }[];
      manualCalories?: number | null;
      manualCarbsG?: number | null;
      manualProteinG?: number | null;
      manualFatG?: number | null;
    }
  ): Promise<{ success: boolean }> => {
    const recipes = getStore<Recipe[]>('guest_recipes', []);
    const idx = recipes.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Recipe not found');
    const recipe = recipes[idx];
    const foods = getStore<Food[]>('guest_foods', []);

    if (data.name !== undefined) recipe.name = data.name;
    if (data.totalServings !== undefined) recipe.total_servings = data.totalServings;
    if (data.servingUnit !== undefined) recipe.serving_unit = data.servingUnit;
    if (data.manualCalories !== undefined) recipe.manual_calories = data.manualCalories;
    if (data.manualCarbsG !== undefined) recipe.manual_carbs_g = data.manualCarbsG;
    if (data.manualProteinG !== undefined) recipe.manual_protein_g = data.manualProteinG;
    if (data.manualFatG !== undefined) recipe.manual_fat_g = data.manualFatG;

    if (data.ingredients !== undefined) {
      const ingredients: RecipeIngredient[] = data.ingredients.map((ing) => {
        const food = foods.find((f) => f.id === ing.foodId);
        return {
          id: nextId(),
          food_id: ing.foodId,
          servings: ing.servings,
          qty: ing.qty || null,
          unit_label: ing.unitLabel || null,
          name: food?.name || '',
          brand: food?.brand || null,
          serving_size: food?.serving_size || 1,
          serving_unit: food?.serving_unit || 'serving',
          calories: food?.calories || 0,
          carbs_g: food?.carbs_g || 0,
          protein_g: food?.protein_g || 0,
          fat_g: food?.fat_g || 0,
          measures: food?.measures || null,
        };
      });

      recipe.ingredientCount = ingredients.length;
      const allIngredients = getStore<Record<string, RecipeIngredient[]>>('guest_recipe_ingredients', {});
      allIngredients[id] = ingredients;
      setStore('guest_recipe_ingredients', allIngredients);

      let totalCal = 0,
        totalC = 0,
        totalP = 0,
        totalF = 0;
      if (recipe.manual_calories != null) {
        totalCal = recipe.manual_calories;
        totalC = recipe.manual_carbs_g || 0;
        totalP = recipe.manual_protein_g || 0;
        totalF = recipe.manual_fat_g || 0;
      } else {
        for (const ing of ingredients) {
          const origIng = data.ingredients!.find((i) => i.foodId === ing.food_id);
          totalCal += ing.calories * (origIng?.servings || 1);
          totalC += ing.carbs_g * (origIng?.servings || 1);
          totalP += ing.protein_g * (origIng?.servings || 1);
          totalF += ing.fat_g * (origIng?.servings || 1);
        }
      }
      const s = recipe.total_servings || 1;
      recipe.perServing = {
        calories: Math.round(totalCal / s),
        carbsG: Math.round((totalC / s) * 10) / 10,
        proteinG: Math.round((totalP / s) * 10) / 10,
        fatG: Math.round((totalF / s) * 10) / 10,
      };
    }

    recipes[idx] = recipe;
    setStore('guest_recipes', recipes);
    return { success: true };
  },

  delete: async (id: number): Promise<{ success: boolean }> => {
    const recipes = getStore<Recipe[]>('guest_recipes', []).filter((r) => r.id !== id);
    setStore('guest_recipes', recipes);
    const allIngredients = getStore<Record<string, RecipeIngredient[]>>('guest_recipe_ingredients', {});
    delete allIngredients[id];
    setStore('guest_recipe_ingredients', allIngredients);
    return { success: true };
  },
};

// Weight
export const localWeight = {
  list: async (limit?: number): Promise<{ logs: WeightLog[] }> => {
    let logs = getStore<WeightLog[]>('guest_weight', []);
    logs.sort((a, b) => b.date.localeCompare(a.date));
    if (limit) logs = logs.slice(0, limit);
    return { logs };
  },

  log: async (date: string, weightLbs: number, notes?: string): Promise<{ log: WeightLog }> => {
    const logs = getStore<WeightLog[]>('guest_weight', []);
    const existing = logs.findIndex((l) => l.date === date);
    const log: WeightLog = {
      id: existing >= 0 ? logs[existing].id : nextId(),
      date,
      weight_lbs: weightLbs,
      notes: notes || null,
    };
    if (existing >= 0) logs[existing] = log;
    else logs.push(log);
    setStore('guest_weight', logs);
    return { log };
  },

  delete: async (id: number): Promise<{ success: boolean }> => {
    const logs = getStore<WeightLog[]>('guest_weight', []).filter((l) => l.id !== id);
    setStore('guest_weight', logs);
    return { success: true };
  },
};
