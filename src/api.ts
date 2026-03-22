import type { User, Food, ExternalFood, MealLog, Recipe, RecipeIngredient, WeightLog } from './types';

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

// Auth
export const auth = {
  register: (email: string, password: string, firstName: string) =>
    request<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName }),
    }),

  login: (email: string, password: string) =>
    request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: User }>('/auth/me'),

  updateProfile: (data: Partial<User>) =>
    request<{ user: User }>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

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
export const foods = {
  search: (q: string) =>
    request<{ foods: Food[]; external: ExternalFood[] }>(`/foods/search?q=${encodeURIComponent(q)}`),

  barcode: (code: string) => request<{ food: Food }>(`/foods/barcode/${code}`),

  recent: () => request<{ foods: Food[] }>('/foods/recent'),

  custom: () => request<{ foods: Food[] }>('/foods/custom'),

  create: (data: Partial<Food>) =>
    request<{ food: Food }>('/foods', {
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

  saveExternal: (data: ExternalFood) =>
    request<{ food: Food }>('/foods/save-external', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<{ success: boolean }>(`/foods/${id}`, { method: 'DELETE' }),
};

// Meals
export const meals = {
  getByDate: (date: string) =>
    request<{ meals: MealLog[] }>(`/meals/${date}`),

  getTotals: (startDate: string, endDate: string) =>
    request<{ totals: { date: string; total_calories: number; total_carbs: number; total_protein: number; total_fat: number }[] }>(
      `/meals/totals/${startDate}/${endDate}`
    ),

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
  }) =>
    request<{ meal: MealLog }>('/meals', {
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
    request<{ meal: MealLog }>('/meals/quick', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: { servings?: number; mealType?: string; calories?: number; carbsG?: number; proteinG?: number; fatG?: number }) =>
    request<{ meal: MealLog }>(`/meals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<{ success: boolean }>(`/meals/${id}`, { method: 'DELETE' }),

  copy: (fromDate: string, toDate: string) =>
    request<{ copied: number }>('/meals/copy', {
      method: 'POST',
      body: JSON.stringify({ fromDate, toDate }),
    }),
};

// Recipes
export const recipes = {
  list: () => request<{ recipes: Recipe[] }>('/recipes'),

  get: (id: number) =>
    request<{ recipe: Recipe; ingredients: RecipeIngredient[] }>(`/recipes/${id}`),

  create: (data: {
    name: string; totalServings: number; servingUnit?: string;
    ingredients: { foodId: number; servings: number; qty?: number; unitLabel?: string }[];
    manualCalories?: number | null; manualCarbsG?: number | null;
    manualProteinG?: number | null; manualFatG?: number | null;
  }) =>
    request<{ recipe: { id: number } }>('/recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: {
    name?: string; totalServings?: number; servingUnit?: string;
    ingredients?: { foodId: number; servings: number; qty?: number; unitLabel?: string }[];
    manualCalories?: number | null; manualCarbsG?: number | null;
    manualProteinG?: number | null; manualFatG?: number | null;
  }) =>
    request<{ success: boolean }>(`/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<{ success: boolean }>(`/recipes/${id}`, { method: 'DELETE' }),
};

// Weight
export const weight = {
  list: (limit?: number) =>
    request<{ logs: WeightLog[] }>(`/weight${limit ? `?limit=${limit}` : ''}`),

  log: (date: string, weightLbs: number, notes?: string) =>
    request<{ log: WeightLog }>('/weight', {
      method: 'POST',
      body: JSON.stringify({ date, weightLbs, notes }),
    }),

  delete: (id: number) =>
    request<{ success: boolean }>(`/weight/${id}`, { method: 'DELETE' }),
};
