import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Get all recipes for user
router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const recipes = db.prepare('SELECT * FROM recipes WHERE user_id = ? ORDER BY name').all(req.user!.userId) as any[];

  // Attach computed nutrition for each recipe
  const withNutrition = recipes.map((r) => {
    const ingredients = db.prepare(`
      SELECT ri.servings, f.name, f.calories, f.carbs_g, f.protein_g, f.fat_g, f.serving_unit
      FROM recipe_ingredients ri
      JOIN foods f ON ri.food_id = f.id
      WHERE ri.recipe_id = ?
    `).all(r.id) as any[];

    let totalCalories = 0, totalCarbs = 0, totalProtein = 0, totalFat = 0;
    for (const ing of ingredients) {
      totalCalories += ing.calories * ing.servings;
      totalCarbs += ing.carbs_g * ing.servings;
      totalProtein += ing.protein_g * ing.servings;
      totalFat += ing.fat_g * ing.servings;
    }

    const perServing = r.total_servings || 1;
    return {
      ...r,
      ingredientCount: ingredients.length,
      perServing: {
        calories: Math.round(totalCalories / perServing),
        carbsG: Math.round((totalCarbs / perServing) * 10) / 10,
        proteinG: Math.round((totalProtein / perServing) * 10) / 10,
        fatG: Math.round((totalFat / perServing) * 10) / 10,
      },
    };
  });

  res.json({ recipes: withNutrition });
});

// Get single recipe with ingredients
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as any;
  if (!recipe) {
    res.status(404).json({ error: 'Recipe not found' });
    return;
  }

  const ingredients = db.prepare(`
    SELECT ri.id, ri.servings, ri.food_id,
           f.name, f.brand, f.serving_size, f.serving_unit,
           f.calories, f.carbs_g, f.protein_g, f.fat_g
    FROM recipe_ingredients ri
    JOIN foods f ON ri.food_id = f.id
    WHERE ri.recipe_id = ?
  `).all(recipe.id);

  res.json({ recipe, ingredients });
});

// Create recipe
router.post('/', requireAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, totalServings, ingredients } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const result = db.prepare('INSERT INTO recipes (user_id, name, total_servings) VALUES (?, ?, ?)').run(
      req.user!.userId, name, totalServings || 1
    );
    const recipeId = result.lastInsertRowid;

    if (ingredients && Array.isArray(ingredients)) {
      const insert = db.prepare('INSERT INTO recipe_ingredients (recipe_id, food_id, servings) VALUES (?, ?, ?)');
      for (const ing of ingredients) {
        insert.run(recipeId, ing.foodId, ing.servings || 1);
      }
    }

    res.json({ recipe: { id: recipeId, name, totalServings: totalServings || 1 } });
  } catch (e) {
    console.error('Create recipe error:', e);
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

// Update recipe
router.put('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId);
    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }

    const { name, totalServings, ingredients } = req.body;
    db.prepare('UPDATE recipes SET name = COALESCE(?, name), total_servings = COALESCE(?, total_servings) WHERE id = ?').run(
      name, totalServings, req.params.id
    );

    // Replace ingredients if provided
    if (ingredients && Array.isArray(ingredients)) {
      db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(req.params.id);
      const insert = db.prepare('INSERT INTO recipe_ingredients (recipe_id, food_id, servings) VALUES (?, ?, ?)');
      for (const ing of ingredients) {
        insert.run(req.params.id, ing.foodId, ing.servings || 1);
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Update recipe error:', e);
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

// Delete recipe
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM recipes WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Recipe not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
