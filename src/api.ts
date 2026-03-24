import type { User, Food, ExternalFood, MealLog, Recipe, RecipeIngredient, WeightLog } from './types';
import {
  isGuestMode,
  clearGuestData,
  localAuth,
  localFoods,
  localMeals,
  localRecipes,
  localWeight,
} from './local-db';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'same-origin',
  });

  if (res.status === 401) {
    window.location.hash = '#/login';
    throw new Error('Not authenticated');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Like request() but doesn't redirect to login on 401 (for endpoints that support optional auth)
async function requestNoAuthRedirect<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'same-origin',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Auth
export const auth = {
  register: (email: string, password: string, firstName: string) => {
    clearGuestData();
    return request<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName }),
    });
  },

  login: (email: string, password: string) => {
    clearGuestData();
    return request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  me: () => (isGuestMode() ? localAuth.me() : request<{ user: User }>('/auth/me')),

  updateProfile: (data: Partial<User>) =>
    isGuestMode()
      ? localAuth.updateProfile(data)
      : request<{ user: User }>('/auth/me', {
          method: 'PUT',
          body: JSON.stringify(data),
        }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  logout: () => (isGuestMode() ? localAuth.logout() : request<{ success: boolean }>('/auth/logout', { method: 'POST' })),

  verifyEmail: (token: string) =>
    request<{ success: boolean }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  forgotPassword: (email: string) =>
    request<{ success: boolean }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ success: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
};

// Foods
// Search, barcode, and save-external always hit the server (endpoints allow unauthenticated access).
// Guest mode uses local-db for user-specific operations (recent, custom, create, delete).
export const foods = {
  search: (q: string) => {
    if (!isGuestMode()) {
      return request<{ foods: Food[]; external: ExternalFood[] }>(`/foods/search?q=${encodeURIComponent(q)}`);
    }
    // Merge local custom foods with server external results
    return (async () => {
      const [local, remote] = await Promise.allSettled([
        localFoods.search(q),
        requestNoAuthRedirect<{ foods: Food[]; external: ExternalFood[] }>(`/foods/search?q=${encodeURIComponent(q)}`),
      ]);
      const localResult = local.status === 'fulfilled' ? local.value : { foods: [], external: [] };
      const remoteResult = remote.status === 'fulfilled' ? remote.value : { foods: [], external: [] };
      return {
        foods: localResult.foods,
        external: remoteResult.external,
      };
    })();
  },

  barcode: async (code: string) => {
    if (isGuestMode()) {
      const result = await requestNoAuthRedirect<{ food: Food }>(`/foods/barcode/${code}`);
      // Save to local-db so it can be referenced when logging meals
      const saved = await localFoods.saveExternalToLocal({
        name: result.food.name,
        brand: result.food.brand,
        barcode: result.food.barcode,
        servingSize: result.food.serving_size,
        servingUnit: result.food.serving_unit,
        calories: result.food.calories,
        carbsG: result.food.carbs_g,
        proteinG: result.food.protein_g,
        fatG: result.food.fat_g,
        fiberG: result.food.fiber_g,
        sugarG: result.food.sugar_g,
        source: result.food.source,
        sourceId: result.food.source_id,
        measures: result.food.measures ? JSON.parse(result.food.measures) : undefined,
      });
      return saved;
    }
    return request<{ food: Food }>(`/foods/barcode/${code}`);
  },

  recent: () => (isGuestMode() ? localFoods.recent() : request<{ foods: Food[] }>('/foods/recent')),

  custom: () => (isGuestMode() ? localFoods.custom() : request<{ foods: Food[] }>('/foods/custom')),

  create: (data: Partial<Food>) =>
    isGuestMode()
      ? localFoods.create(data)
      : request<{ food: Food }>('/foods', {
          method: 'POST',
          body: JSON.stringify({
            name: data.name,
            brand: data.brand,
            barcode: data.barcode,
            servingSize: data.serving_size,
            servingUnit: data.serving_unit,
            calories: data.calories,
            carbsG: data.carbs_g,
            proteinG: data.protein_g,
            fatG: data.fat_g,
            fiberG: data.fiber_g,
            sugarG: data.sugar_g,
          }),
        }),

  saveExternal: (data: ExternalFood) => {
    if (isGuestMode()) {
      // Save to local-db instead of server
      return localFoods.saveExternalToLocal(data);
    }
    return request<{ food: Food }>('/foods/save-external', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete: (id: number) =>
    isGuestMode() ? localFoods.delete(id) : request<{ success: boolean }>(`/foods/${id}`, { method: 'DELETE' }),
};

// Meals
export const meals = {
  getByDate: (date: string) =>
    isGuestMode() ? localMeals.getByDate(date) : request<{ meals: MealLog[] }>(`/meals/${date}`),

  getTotals: (startDate: string, endDate: string) =>
    isGuestMode()
      ? localMeals.getTotals(startDate, endDate)
      : request<{
          totals: { date: string; total_calories: number; total_carbs: number; total_protein: number; total_fat: number }[];
        }>(`/meals/totals/${startDate}/${endDate}`),

  log: (data: {
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
    unitLabel?: string;
    unitScale?: number;
  }) =>
    isGuestMode()
      ? localMeals.log(data)
      : request<{ meal: MealLog }>('/meals', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

  quickLog: (data: {
    date: string;
    mealType: string;
    name?: string;
    calories?: number;
    carbsG?: number;
    proteinG?: number;
    fatG?: number;
  }) =>
    isGuestMode()
      ? localMeals.quickLog(data)
      : request<{ meal: MealLog }>('/meals/quick', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

  update: (id: number, data: { servings?: number; mealType?: string; calories?: number; carbsG?: number; proteinG?: number; fatG?: number }) =>
    isGuestMode()
      ? localMeals.update(id, data)
      : request<{ meal: MealLog }>(`/meals/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),

  delete: (id: number) =>
    isGuestMode() ? localMeals.delete(id) : request<{ success: boolean }>(`/meals/${id}`, { method: 'DELETE' }),

  copy: (fromDate: string, toDate: string) =>
    isGuestMode()
      ? localMeals.copy(fromDate, toDate)
      : request<{ copied: number }>('/meals/copy', {
          method: 'POST',
          body: JSON.stringify({ fromDate, toDate }),
        }),
};

// Recipes
export const recipes = {
  list: () => (isGuestMode() ? localRecipes.list() : request<{ recipes: Recipe[] }>('/recipes')),

  get: (id: number) =>
    isGuestMode()
      ? localRecipes.get(id)
      : request<{ recipe: Recipe; ingredients: RecipeIngredient[] }>(`/recipes/${id}`),

  create: (data: {
    name: string;
    totalServings: number;
    servingUnit?: string;
    ingredients: { foodId: number; servings: number; qty?: number; unitLabel?: string }[];
    manualCalories?: number | null;
    manualCarbsG?: number | null;
    manualProteinG?: number | null;
    manualFatG?: number | null;
  }) =>
    isGuestMode()
      ? localRecipes.create(data)
      : request<{ recipe: { id: number } }>('/recipes', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

  update: (
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
  ) =>
    isGuestMode()
      ? localRecipes.update(id, data)
      : request<{ success: boolean }>(`/recipes/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),

  delete: (id: number) =>
    isGuestMode() ? localRecipes.delete(id) : request<{ success: boolean }>(`/recipes/${id}`, { method: 'DELETE' }),

  copy: (id: number) =>
    isGuestMode()
      ? localRecipes.copy(id)
      : request<{ recipe: { id: number } }>(`/recipes/${id}/copy`, { method: 'POST' }),
};

// Weight
export const weight = {
  list: (limit?: number) =>
    isGuestMode()
      ? localWeight.list(limit)
      : request<{ logs: WeightLog[] }>(`/weight${limit ? `?limit=${limit}` : ''}`),

  log: (date: string, weightLbs: number, time?: string, notes?: string) =>
    isGuestMode()
      ? localWeight.log(date, weightLbs, time, notes)
      : request<{ log: WeightLog }>('/weight', {
          method: 'POST',
          body: JSON.stringify({ date, weightLbs, time, notes }),
        }),

  delete: (id: number) =>
    isGuestMode() ? localWeight.delete(id) : request<{ success: boolean }>(`/weight/${id}`, { method: 'DELETE' }),
};
