import { meals as mealsApi } from '../api';
import { state, formatDate } from '../state';
import { navigate } from '../router';
import type { MealLog, MealType } from '../types';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export function dashboardView() {
  const date = state.selectedDate;

  return {
    html: `
      <div class="page dashboard-page">
        <header class="page-header">
          <h1>Macro Tracker</h1>
        </header>

        <div class="date-nav">
          <button id="date-prev" class="btn-icon" aria-label="Previous day">&larr;</button>
          <button id="date-label" class="date-label">${formatDate(date)}</button>
          <button id="date-next" class="btn-icon" aria-label="Next day">&rarr;</button>
        </div>

        <div id="macro-summary" class="macro-summary">
          <div class="macro-ring" data-macro="calories">
            <div class="macro-ring-inner">
              <span class="macro-value" id="cal-value">0</span>
              <span class="macro-label">kcal</span>
            </div>
            <svg class="ring-svg" viewBox="0 0 100 100">
              <circle class="ring-bg" cx="50" cy="50" r="42" />
              <circle class="ring-fill ring-calories" id="cal-ring" cx="50" cy="50" r="42" />
            </svg>
          </div>
          <div class="macro-bars">
            <div class="macro-bar-row">
              <span class="macro-bar-label">Carbs</span>
              <div class="macro-bar-track">
                <div class="macro-bar-fill bar-carbs" id="carbs-bar"></div>
              </div>
              <span class="macro-bar-value" id="carbs-value">0 / ${state.user?.targetCarbsG || 340}g</span>
            </div>
            <div class="macro-bar-row">
              <span class="macro-bar-label">Protein</span>
              <div class="macro-bar-track">
                <div class="macro-bar-fill bar-protein" id="protein-bar"></div>
              </div>
              <span class="macro-bar-value" id="protein-value">0 / ${state.user?.targetProteinG || 150}g</span>
            </div>
            <div class="macro-bar-row">
              <span class="macro-bar-label">Fat</span>
              <div class="macro-bar-track">
                <div class="macro-bar-fill bar-fat" id="fat-bar"></div>
              </div>
              <span class="macro-bar-value" id="fat-value">0 / ${state.user?.targetFatG || 70}g</span>
            </div>
          </div>
        </div>

        <div id="meals-container" class="meals-container">
          <div class="loading-spinner">Loading...</div>
        </div>
      </div>
    `,
    init: () => {
      // Date navigation
      document.getElementById('date-prev')!.addEventListener('click', () => {
        const d = new Date(state.selectedDate + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        state.selectedDate = d.toISOString().slice(0, 10);
        navigate('#/');
      });

      document.getElementById('date-next')!.addEventListener('click', () => {
        const d = new Date(state.selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        state.selectedDate = d.toISOString().slice(0, 10);
        navigate('#/');
      });

      document.getElementById('date-label')!.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'date';
        input.value = state.selectedDate;
        input.style.position = 'absolute';
        input.style.opacity = '0';
        input.style.pointerEvents = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', () => {
          if (input.value) {
            state.selectedDate = input.value;
            navigate('#/');
          }
          input.remove();
        });
        input.showPicker?.();
        // Fallback if showPicker not supported
        input.focus();
        input.click();
      });

      loadMeals(state.selectedDate);
    },
  };
}

async function loadMeals(date: string) {
  const container = document.getElementById('meals-container');
  if (!container) return;

  try {
    const { meals: mealList } = await mealsApi.getByDate(date);
    renderMeals(container, mealList, date);
    updateMacroSummary(mealList);
  } catch {
    container.innerHTML = '<p class="text-muted">Failed to load meals.</p>';
  }
}

function updateMacroSummary(mealList: MealLog[]) {
  const totals = mealList.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      carbs: acc.carbs + m.carbs_g,
      protein: acc.protein + m.protein_g,
      fat: acc.fat + m.fat_g,
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 }
  );

  const user = state.user;
  const targetCal = user?.targetCalories || 2590;
  const targetCarbs = user?.targetCarbsG || 340;
  const targetProtein = user?.targetProteinG || 150;
  const targetFat = user?.targetFatG || 70;

  // Update calorie ring
  const calValue = document.getElementById('cal-value');
  const calRing = document.getElementById('cal-ring') as SVGCircleElement | null;
  if (calValue) calValue.textContent = Math.round(totals.calories).toString();
  if (calRing) {
    const pct = Math.min(totals.calories / targetCal, 1);
    const circumference = 2 * Math.PI * 42;
    calRing.style.strokeDasharray = `${circumference}`;
    calRing.style.strokeDashoffset = `${circumference * (1 - pct)}`;
  }

  // Update bars
  updateBar('carbs', totals.carbs, targetCarbs);
  updateBar('protein', totals.protein, targetProtein);
  updateBar('fat', totals.fat, targetFat);
}

function updateBar(macro: string, current: number, target: number) {
  const bar = document.getElementById(`${macro}-bar`) as HTMLElement | null;
  const value = document.getElementById(`${macro}-value`) as HTMLElement | null;
  if (bar) {
    const pct = Math.min((current / target) * 100, 100);
    bar.style.width = `${pct}%`;
    if (current > target) bar.classList.add('over');
    else bar.classList.remove('over');
  }
  if (value) {
    value.textContent = `${Math.round(current)} / ${target}g`;
  }
}

function renderMeals(container: HTMLElement, mealList: MealLog[], date: string) {
  const grouped: Record<MealType, MealLog[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  mealList.forEach((m) => grouped[m.meal_type]?.push(m));

  let html = '';
  for (const type of MEAL_ORDER) {
    const items = grouped[type];
    const subtotals = items.reduce(
      (acc, m) => ({
        cal: acc.cal + m.calories,
        c: acc.c + m.carbs_g,
        p: acc.p + m.protein_g,
        f: acc.f + m.fat_g,
      }),
      { cal: 0, c: 0, p: 0, f: 0 }
    );

    html += `
      <div class="meal-section">
        <div class="meal-header">
          <h3>${MEAL_LABELS[type]}</h3>
          <span class="meal-subtotal">${Math.round(subtotals.cal)} kcal</span>
        </div>
        <div class="meal-items">
    `;

    if (items.length === 0) {
      html += `<p class="text-muted meal-empty">No items logged</p>`;
    } else {
      for (const item of items) {
        const name = item.food_name || item.recipe_name || item.note || 'Quick entry';
        const brand = item.food_brand ? `<span class="food-brand">${item.food_brand}</span>` : '';
        const servingsLabel = item.servings !== 1 ? `${item.servings}x ` : '';
        html += `
          <div class="meal-item" data-id="${item.id}">
            <div class="meal-item-info">
              <span class="meal-item-name">${servingsLabel}${name}</span>
              ${brand}
            </div>
            <div class="meal-item-macros">
              <span class="macro-chip chip-calories">${Math.round(item.calories)}</span>
              <span class="macro-chip chip-carbs">${Math.round(item.carbs_g)}c</span>
              <span class="macro-chip chip-protein">${Math.round(item.protein_g)}p</span>
              <span class="macro-chip chip-fat">${Math.round(item.fat_g)}f</span>
            </div>
            <button class="btn-icon btn-delete-meal" data-meal-id="${item.id}" aria-label="Delete">&times;</button>
          </div>
        `;
      }
    }

    html += `
        </div>
        <button class="btn btn-add-meal" data-meal-type="${type}" data-date="${date}">+ Add Food</button>
      </div>
    `;
  }

  container.innerHTML = html;

  // Add food buttons
  container.querySelectorAll('.btn-add-meal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mealType = (btn as HTMLElement).dataset.mealType;
      const mealDate = (btn as HTMLElement).dataset.date;
      navigate(`#/log?meal=${mealType}&date=${mealDate}`);
    });
  });

  // Delete buttons
  container.querySelectorAll('.btn-delete-meal').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mealId = parseInt((btn as HTMLElement).dataset.mealId || '0');
      if (mealId && confirm('Remove this entry?')) {
        try {
          await mealsApi.delete(mealId);
          loadMeals(date);
        } catch {
          // Silently fail
        }
      }
    });
  });
}
