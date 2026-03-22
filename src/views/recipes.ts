import { recipes as recipesApi, foods as foodsApi } from '../api';
import { navigate } from '../router';
import type { Food, RecipeIngredient } from '../types';

export function recipesView() {
  return {
    html: `
      <div class="page">
        <header class="page-header">
          <h1>Recipes</h1>
        </header>
        <button id="new-recipe-btn" class="btn btn-primary btn-block" style="margin-bottom:16px">+ New Recipe</button>
        <div id="recipe-list" class="food-list">
          <div class="loading-spinner">Loading...</div>
        </div>
      </div>
    `,
    init: () => {
      document.getElementById('new-recipe-btn')!.addEventListener('click', () => navigate('#/recipes/new'));
      loadRecipes();
    },
  };
}

async function loadRecipes() {
  const container = document.getElementById('recipe-list')!;
  try {
    const { recipes } = await recipesApi.list();
    if (recipes.length === 0) {
      container.innerHTML = '<p class="text-muted">No recipes yet. Create one to save your favorite meals!</p>';
      return;
    }

    container.innerHTML = '';
    for (const recipe of recipes) {
      const el = document.createElement('div');
      el.className = 'food-item';
      const servLabel = recipe.serving_unit && recipe.serving_unit !== 'serving'
        ? `${recipe.total_servings} ${recipe.serving_unit}${recipe.total_servings !== 1 ? 's' : ''}`
        : `${recipe.total_servings} serving${recipe.total_servings !== 1 ? 's' : ''}`;
      const detail = recipe.manual_calories != null
        ? `Manual macros &middot; ${servLabel}`
        : `${recipe.ingredientCount} ingredient${recipe.ingredientCount !== 1 ? 's' : ''} &middot; ${servLabel}`;
      el.innerHTML = `
        <div class="food-item-info">
          <span class="food-item-name">${recipe.name}</span>
          <span class="food-serving">${detail}</span>
        </div>
        <div class="food-item-macros">
          <span class="macro-chip chip-calories">${recipe.perServing.calories}</span>
          <span class="macro-chip chip-carbs">${recipe.perServing.carbsG}c</span>
          <span class="macro-chip chip-protein">${recipe.perServing.proteinG}p</span>
          <span class="macro-chip chip-fat">${recipe.perServing.fatG}f</span>
        </div>
      `;
      el.addEventListener('click', () => navigate(`#/recipes/${recipe.id}`));
      container.appendChild(el);
    }
  } catch {
    container.innerHTML = '<p class="form-error">Failed to load recipes</p>';
  }
}

export function recipeEditView(params: Record<string, string>) {
  const isNew = params.id === 'new';

  return {
    html: `
      <div class="page">
        <header class="page-header">
          <button id="back-btn" class="btn-icon">&larr;</button>
          <h1>${isNew ? 'New Recipe' : 'Edit Recipe'}</h1>
        </header>
        <form id="recipe-form">
          <div class="form-group">
            <label for="recipe-name">Recipe Name *</label>
            <input type="text" id="recipe-name" required placeholder="e.g. Green Smoothie" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="recipe-servings">Total Servings</label>
              <input type="number" id="recipe-servings" value="1" min="0.25" step="0.25" />
            </div>
            <div class="form-group">
              <label for="recipe-unit">Serving Unit</label>
              <input type="text" id="recipe-unit" value="serving" placeholder="e.g. cup, bowl, scoop" />
            </div>
          </div>

          <div class="tab-bar" style="margin-bottom:12px">
            <button type="button" class="tab active" data-mode="ingredients">From Ingredients</button>
            <button type="button" class="tab" data-mode="manual">Manual Macros</button>
          </div>

          <div id="ingredients-section">
            <div id="ingredients-list" class="ingredients-list"></div>
            <div class="ingredient-search">
              <input type="search" id="ing-search" placeholder="Search to add ingredient..." autocomplete="off" />
              <div id="ing-results" class="food-list hidden"></div>
            </div>
          </div>

          <div id="manual-section" class="hidden">
            <p class="text-muted" style="margin-bottom:12px">Enter the macros for the entire recipe (all servings combined).</p>
            <div class="form-row">
              <div class="form-group">
                <label for="manual-carbs">Carbs (g)</label>
                <input type="number" id="manual-carbs" min="0" step="0.1" />
              </div>
              <div class="form-group">
                <label for="manual-protein">Protein (g)</label>
                <input type="number" id="manual-protein" min="0" step="0.1" />
              </div>
              <div class="form-group">
                <label for="manual-fat">Fat (g)</label>
                <input type="number" id="manual-fat" min="0" step="0.1" />
              </div>
            </div>
            <div class="form-group">
              <label for="manual-cal">Calories <span class="form-hint" id="manual-cal-hint">(auto-calculated)</span></label>
              <input type="number" id="manual-cal" min="0" step="1" />
            </div>
          </div>

          <div id="recipe-totals" class="recipe-totals"></div>

          <button type="submit" class="btn btn-primary btn-block">${isNew ? 'Create Recipe' : 'Save Changes'}</button>
          ${!isNew ? '<button type="button" id="delete-recipe" class="btn btn-danger btn-block">Delete Recipe</button>' : ''}
        </form>
      </div>
    `,
    init: () => {
      const ingredients: { foodId: number; servings: number; food: Food | RecipeIngredient }[] = [];
      let searchTimeout: ReturnType<typeof setTimeout>;
      let mode: 'ingredients' | 'manual' = 'ingredients';

      document.getElementById('back-btn')!.addEventListener('click', () => navigate('#/recipes'));

      // Mode toggle
      document.querySelectorAll('[data-mode]').forEach((tab) => {
        tab.addEventListener('click', () => {
          document.querySelector('[data-mode].active')?.classList.remove('active');
          tab.classList.add('active');
          mode = (tab as HTMLElement).dataset.mode as 'ingredients' | 'manual';
          document.getElementById('ingredients-section')!.classList.toggle('hidden', mode === 'manual');
          document.getElementById('manual-section')!.classList.toggle('hidden', mode === 'ingredients');
          updateTotals(ingredients, mode);
        });
      });

      // Auto-calc calories for manual mode
      const manualCalInput = document.getElementById('manual-cal') as HTMLInputElement;
      let manualCalManual = false;
      manualCalInput.addEventListener('input', () => { manualCalManual = true; });
      const autoCalcManual = () => {
        if (manualCalManual) return;
        const c = parseFloat((document.getElementById('manual-carbs') as HTMLInputElement).value) || 0;
        const p = parseFloat((document.getElementById('manual-protein') as HTMLInputElement).value) || 0;
        const f = parseFloat((document.getElementById('manual-fat') as HTMLInputElement).value) || 0;
        manualCalInput.value = String(Math.round(c * 4 + p * 4 + f * 9));
        updateTotals(ingredients, mode);
      };
      ['manual-carbs', 'manual-protein', 'manual-fat'].forEach(id =>
        document.getElementById(id)!.addEventListener('input', autoCalcManual)
      );
      manualCalInput.addEventListener('input', () => updateTotals(ingredients, mode));

      // Servings/unit changes update totals
      document.getElementById('recipe-servings')!.addEventListener('input', () => updateTotals(ingredients, mode));

      // Load existing recipe
      if (!isNew) {
        loadExistingRecipe(parseInt(params.id), ingredients, (recipeMode) => {
          mode = recipeMode;
          if (mode === 'manual') {
            document.querySelector('[data-mode="ingredients"]')?.classList.remove('active');
            document.querySelector('[data-mode="manual"]')?.classList.add('active');
            document.getElementById('ingredients-section')!.classList.add('hidden');
            document.getElementById('manual-section')!.classList.remove('hidden');
          }
        });
      }

      // Ingredient search
      const searchInput = document.getElementById('ing-search') as HTMLInputElement;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (q.length < 2) {
          document.getElementById('ing-results')!.classList.add('hidden');
          searchInput.classList.remove('searching');
          return;
        }
        searchInput.classList.add('searching');
        searchTimeout = setTimeout(async () => {
          try {
            const { foods, external } = await foodsApi.search(q);
            const results = document.getElementById('ing-results')!;
            results.innerHTML = '';
            results.classList.remove('hidden');

            for (const food of foods) {
              const item = document.createElement('div');
              item.className = 'food-item food-item-sm';
              item.innerHTML = `
                <div class="food-item-info">
                  <span class="food-item-name">${food.name}${food.brand ? ` (${food.brand})` : ''}</span>
                  <span class="food-serving">${food.serving_size}${food.serving_unit} · ${Math.round(food.calories)} kcal</span>
                </div>
                <div class="food-item-macros">
                  <span class="macro-chip chip-carbs">${Math.round(food.carbs_g)}c</span>
                  <span class="macro-chip chip-protein">${Math.round(food.protein_g)}p</span>
                  <span class="macro-chip chip-fat">${Math.round(food.fat_g)}f</span>
                </div>
              `;
              item.addEventListener('click', () => {
                ingredients.push({ foodId: food.id, servings: 1, food: food as any });
                renderIngredients(ingredients, mode);
                results.classList.add('hidden');
                searchInput.value = '';
              });
              results.appendChild(item);
            }

            for (const ext of external) {
              const item = document.createElement('div');
              item.className = 'food-item food-item-sm';
              item.innerHTML = `
                <div class="food-item-info">
                  <span class="food-item-name">${ext.name}${ext.brand ? ` (${ext.brand})` : ''}</span>
                  <span class="food-serving">${ext.servingSize}${ext.servingUnit} · ${Math.round(ext.calories)} kcal</span>
                </div>
                <div class="food-item-macros">
                  <span class="macro-chip chip-carbs">${Math.round(ext.carbsG)}c</span>
                  <span class="macro-chip chip-protein">${Math.round(ext.proteinG)}p</span>
                  <span class="macro-chip chip-fat">${Math.round(ext.fatG)}f</span>
                </div>
              `;
              item.addEventListener('click', async () => {
                try {
                  const { food } = await foodsApi.saveExternal(ext);
                  ingredients.push({ foodId: food.id, servings: 1, food: food as any });
                  renderIngredients(ingredients, mode);
                  results.classList.add('hidden');
                  searchInput.value = '';
                } catch {
                  alert('Failed to save food');
                }
              });
              results.appendChild(item);
            }

            if (foods.length === 0 && external.length === 0) {
              results.innerHTML = '<p class="text-muted" style="padding:8px">No results</p>';
            }
          } finally {
            searchInput.classList.remove('searching');
          }
        }, 400);
      });

      // Form submit
      document.getElementById('recipe-form')!.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (document.getElementById('recipe-name') as HTMLInputElement).value;
        const totalServings = parseFloat((document.getElementById('recipe-servings') as HTMLInputElement).value) || 1;
        const servingUnit = (document.getElementById('recipe-unit') as HTMLInputElement).value.trim() || 'serving';
        const btn = (e.target as HTMLFormElement).querySelector('button[type=submit]') as HTMLButtonElement;
        btn.disabled = true;

        try {
          const ingData = ingredients.map((i) => ({ foodId: i.foodId, servings: i.servings }));
          const manualCalories = mode === 'manual' ? (parseFloat(manualCalInput.value) || null) : null;
          const manualCarbsG = mode === 'manual' ? (parseFloat((document.getElementById('manual-carbs') as HTMLInputElement).value) || null) : null;
          const manualProteinG = mode === 'manual' ? (parseFloat((document.getElementById('manual-protein') as HTMLInputElement).value) || null) : null;
          const manualFatG = mode === 'manual' ? (parseFloat((document.getElementById('manual-fat') as HTMLInputElement).value) || null) : null;

          if (isNew) {
            await recipesApi.create({ name, totalServings, servingUnit, ingredients: ingData, manualCalories, manualCarbsG, manualProteinG, manualFatG });
          } else {
            await recipesApi.update(parseInt(params.id), { name, totalServings, servingUnit, ingredients: ingData, manualCalories, manualCarbsG, manualProteinG, manualFatG });
          }
          navigate('#/recipes');
        } catch {
          btn.disabled = false;
          btn.textContent = 'Failed - Retry';
        }
      });

      // Delete
      document.getElementById('delete-recipe')?.addEventListener('click', async () => {
        if (confirm('Delete this recipe?')) {
          await recipesApi.delete(parseInt(params.id));
          navigate('#/recipes');
        }
      });
    },
  };
}

async function loadExistingRecipe(
  id: number,
  ingredients: { foodId: number; servings: number; food: Food | RecipeIngredient }[],
  onMode: (mode: 'ingredients' | 'manual') => void
) {
  try {
    const { recipe, ingredients: ings } = await recipesApi.get(id);
    (document.getElementById('recipe-name') as HTMLInputElement).value = recipe.name;
    (document.getElementById('recipe-servings') as HTMLInputElement).value = String(recipe.total_servings);
    (document.getElementById('recipe-unit') as HTMLInputElement).value = recipe.serving_unit || 'serving';

    if (recipe.manual_calories != null) {
      // Manual mode
      (document.getElementById('manual-cal') as HTMLInputElement).value = String(recipe.manual_calories);
      (document.getElementById('manual-carbs') as HTMLInputElement).value = String(recipe.manual_carbs_g || '');
      (document.getElementById('manual-protein') as HTMLInputElement).value = String(recipe.manual_protein_g || '');
      (document.getElementById('manual-fat') as HTMLInputElement).value = String(recipe.manual_fat_g || '');
      onMode('manual');
      updateTotals(ingredients, 'manual');
    } else {
      for (const ing of ings) {
        ingredients.push({ foodId: ing.food_id, servings: ing.servings, food: ing });
      }
      renderIngredients(ingredients, 'ingredients');
    }
  } catch {
    // Ignore
  }
}

function updateTotals(
  ingredients: { foodId: number; servings: number; food: Food | RecipeIngredient }[],
  mode: 'ingredients' | 'manual'
) {
  const servings = parseFloat((document.getElementById('recipe-servings') as HTMLInputElement)?.value) || 1;
  const unit = (document.getElementById('recipe-unit') as HTMLInputElement)?.value.trim() || 'serving';
  const totalsEl = document.getElementById('recipe-totals');
  if (!totalsEl) return;

  let totalCal = 0, totalC = 0, totalP = 0, totalF = 0;

  if (mode === 'manual') {
    totalCal = parseFloat((document.getElementById('manual-cal') as HTMLInputElement)?.value) || 0;
    totalC = parseFloat((document.getElementById('manual-carbs') as HTMLInputElement)?.value) || 0;
    totalP = parseFloat((document.getElementById('manual-protein') as HTMLInputElement)?.value) || 0;
    totalF = parseFloat((document.getElementById('manual-fat') as HTMLInputElement)?.value) || 0;
  } else {
    for (const ing of ingredients) {
      const f = ing.food;
      totalCal += (f.calories || 0) * ing.servings;
      totalC += (f.carbs_g || 0) * ing.servings;
      totalP += (f.protein_g || 0) * ing.servings;
      totalF += (f.fat_g || 0) * ing.servings;
    }
  }

  const unitLabel = unit + (servings !== 1 ? 's' : '');
  totalsEl.innerHTML = `
    <h4>Per ${unit} (of ${servings} ${unitLabel})</h4>
    <div class="modal-macros">
      <div class="modal-macro"><strong>${Math.round(totalCal / servings)}</strong> kcal</div>
      <div class="modal-macro"><strong>${Math.round(totalC / servings * 10) / 10}g</strong> carbs</div>
      <div class="modal-macro"><strong>${Math.round(totalP / servings * 10) / 10}g</strong> protein</div>
      <div class="modal-macro"><strong>${Math.round(totalF / servings * 10) / 10}g</strong> fat</div>
    </div>
  `;
}

function renderIngredients(
  ingredients: { foodId: number; servings: number; food: Food | RecipeIngredient }[],
  mode: 'ingredients' | 'manual'
) {
  const container = document.getElementById('ingredients-list')!;

  container.innerHTML = '';
  ingredients.forEach((ing, idx) => {
    const f = ing.food;
    const cal = (f.calories || 0) * ing.servings;

    const el = document.createElement('div');
    el.className = 'ingredient-row';
    el.innerHTML = `
      <span class="ingredient-name">${f.name}</span>
      <input type="number" class="ing-servings" value="${ing.servings}" min="0.25" step="0.25" data-idx="${idx}" />
      <span class="ingredient-cal">${Math.round(cal)} kcal</span>
      <button type="button" class="btn-icon btn-remove-ing" data-idx="${idx}">&times;</button>
    `;
    container.appendChild(el);
  });

  updateTotals(ingredients, mode);

  // Servings change handlers
  container.querySelectorAll('.ing-servings').forEach((input) => {
    input.addEventListener('change', () => {
      const idx = parseInt((input as HTMLElement).dataset.idx || '0');
      ingredients[idx].servings = parseFloat((input as HTMLInputElement).value) || 1;
      renderIngredients(ingredients, mode);
    });
  });

  // Remove handlers
  container.querySelectorAll('.btn-remove-ing').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).dataset.idx || '0');
      ingredients.splice(idx, 1);
      renderIngredients(ingredients, mode);
    });
  });
}
