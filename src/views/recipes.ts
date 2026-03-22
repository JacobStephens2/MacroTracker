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
      el.innerHTML = `
        <div class="food-item-info">
          <span class="food-item-name">${recipe.name}</span>
          <span class="food-serving">${recipe.ingredientCount} ingredient${recipe.ingredientCount !== 1 ? 's' : ''} &middot; ${recipe.total_servings} serving${recipe.total_servings !== 1 ? 's' : ''}</span>
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
          <div class="form-group">
            <label for="recipe-servings">Total Servings</label>
            <input type="number" id="recipe-servings" value="1" min="0.25" step="0.25" />
          </div>

          <h3>Ingredients</h3>
          <div id="ingredients-list" class="ingredients-list"></div>
          <div class="ingredient-search">
            <input type="search" id="ing-search" placeholder="Search to add ingredient..." autocomplete="off" />
            <div id="ing-results" class="food-list hidden"></div>
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

      document.getElementById('back-btn')!.addEventListener('click', () => navigate('#/recipes'));

      // Load existing recipe
      if (!isNew) {
        loadExistingRecipe(parseInt(params.id), ingredients);
      }

      // Ingredient search
      const searchInput = document.getElementById('ing-search') as HTMLInputElement;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (q.length < 2) {
          document.getElementById('ing-results')!.classList.add('hidden');
          return;
        }
        searchTimeout = setTimeout(async () => {
          try {
            const { foods, external } = await foodsApi.search(q);
            const results = document.getElementById('ing-results')!;
            results.innerHTML = '';
            results.classList.remove('hidden');

            const allFoods = [...foods];
            // For external, we need to save them first when clicked
            for (const food of allFoods) {
              const item = document.createElement('div');
              item.className = 'food-item food-item-sm';
              item.innerHTML = `
                <span class="food-item-name">${food.name}${food.brand ? ` (${food.brand})` : ''}</span>
                <span class="food-serving">${Math.round(food.calories)} kcal</span>
              `;
              item.addEventListener('click', () => {
                ingredients.push({ foodId: food.id, servings: 1, food: food as any });
                renderIngredients(ingredients);
                results.classList.add('hidden');
                searchInput.value = '';
              });
              results.appendChild(item);
            }

            for (const ext of external) {
              const item = document.createElement('div');
              item.className = 'food-item food-item-sm';
              item.innerHTML = `
                <span class="food-item-name">${ext.name}${ext.brand ? ` (${ext.brand})` : ''}</span>
                <span class="food-serving">${Math.round(ext.calories)} kcal</span>
              `;
              item.addEventListener('click', async () => {
                try {
                  const { food } = await foodsApi.saveExternal(ext);
                  ingredients.push({ foodId: food.id, servings: 1, food: food as any });
                  renderIngredients(ingredients);
                  results.classList.add('hidden');
                  searchInput.value = '';
                } catch {
                  alert('Failed to save food');
                }
              });
              results.appendChild(item);
            }

            if (allFoods.length === 0 && external.length === 0) {
              results.innerHTML = '<p class="text-muted" style="padding:8px">No results</p>';
            }
          } catch {
            // Ignore
          }
        }, 400);
      });

      // Form submit
      document.getElementById('recipe-form')!.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (document.getElementById('recipe-name') as HTMLInputElement).value;
        const totalServings = parseFloat((document.getElementById('recipe-servings') as HTMLInputElement).value) || 1;
        const btn = (e.target as HTMLFormElement).querySelector('button[type=submit]') as HTMLButtonElement;
        btn.disabled = true;

        try {
          const ingData = ingredients.map((i) => ({ foodId: i.foodId, servings: i.servings }));
          if (isNew) {
            await recipesApi.create({ name, totalServings, ingredients: ingData });
          } else {
            await recipesApi.update(parseInt(params.id), { name, totalServings, ingredients: ingData });
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
  ingredients: { foodId: number; servings: number; food: Food | RecipeIngredient }[]
) {
  try {
    const { recipe, ingredients: ings } = await recipesApi.get(id);
    (document.getElementById('recipe-name') as HTMLInputElement).value = recipe.name;
    (document.getElementById('recipe-servings') as HTMLInputElement).value = String(recipe.total_servings);

    for (const ing of ings) {
      ingredients.push({ foodId: ing.food_id, servings: ing.servings, food: ing });
    }
    renderIngredients(ingredients);
  } catch {
    // Ignore
  }
}

function renderIngredients(
  ingredients: { foodId: number; servings: number; food: Food | RecipeIngredient }[]
) {
  const container = document.getElementById('ingredients-list')!;
  let totalCal = 0, totalC = 0, totalP = 0, totalF = 0;

  container.innerHTML = '';
  ingredients.forEach((ing, idx) => {
    const f = ing.food;
    const cal = (f.calories || 0) * ing.servings;
    const c = (f.carbs_g || 0) * ing.servings;
    const p = (f.protein_g || 0) * ing.servings;
    const fat = (f.fat_g || 0) * ing.servings;
    totalCal += cal;
    totalC += c;
    totalP += p;
    totalF += fat;

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

  // Update totals
  const servings = parseFloat((document.getElementById('recipe-servings') as HTMLInputElement)?.value) || 1;
  const totalsEl = document.getElementById('recipe-totals');
  if (totalsEl) {
    totalsEl.innerHTML = `
      <h4>Per Serving (of ${servings})</h4>
      <div class="modal-macros">
        <div class="modal-macro"><strong>${Math.round(totalCal / servings)}</strong> kcal</div>
        <div class="modal-macro"><strong>${Math.round(totalC / servings * 10) / 10}g</strong> carbs</div>
        <div class="modal-macro"><strong>${Math.round(totalP / servings * 10) / 10}g</strong> protein</div>
        <div class="modal-macro"><strong>${Math.round(totalF / servings * 10) / 10}g</strong> fat</div>
      </div>
    `;
  }

  // Servings change handlers
  container.querySelectorAll('.ing-servings').forEach((input) => {
    input.addEventListener('change', () => {
      const idx = parseInt((input as HTMLElement).dataset.idx || '0');
      ingredients[idx].servings = parseFloat((input as HTMLInputElement).value) || 1;
      renderIngredients(ingredients);
    });
  });

  // Remove handlers
  container.querySelectorAll('.btn-remove-ing').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).dataset.idx || '0');
      ingredients.splice(idx, 1);
      renderIngredients(ingredients);
    });
  });
}
