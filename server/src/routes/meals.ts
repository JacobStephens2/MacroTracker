import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Get meals for a date
router.get('/:date', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const meals = db.prepare(`
    SELECT m.*, f.name as food_name, f.brand as food_brand, f.serving_size, f.serving_unit,
           r.name as recipe_name
    FROM meal_logs m
    LEFT JOIN foods f ON m.food_id = f.id
    LEFT JOIN recipes r ON m.recipe_id = r.id
    WHERE m.user_id = ? AND m.date = ?
    ORDER BY
      CASE m.meal_type
        WHEN 'breakfast' THEN 1
        WHEN 'lunch' THEN 2
        WHEN 'dinner' THEN 3
        WHEN 'snack' THEN 4
      END,
      m.created_at
  `).all(req.user!.userId, req.params.date);
  res.json({ meals });
});

// Get daily totals for a date range
router.get('/totals/:startDate/:endDate', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const totals = db.prepare(`
    SELECT date,
      SUM(calories) as total_calories,
      SUM(carbs_g) as total_carbs,
      SUM(protein_g) as total_protein,
      SUM(fat_g) as total_fat
    FROM meal_logs
    WHERE user_id = ? AND date BETWEEN ? AND ?
    GROUP BY date
    ORDER BY date
  `).all(req.user!.userId, req.params.startDate, req.params.endDate);
  res.json({ totals });
});

// Log a meal
router.post('/', requireAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { date, mealType, foodId, recipeId, servings, calories, carbsG, proteinG, fatG, note } = req.body;

    if (!date || !mealType) {
      res.status(400).json({ error: 'Date and meal type are required' });
      return;
    }
    if (!foodId && !recipeId && calories === undefined) {
      res.status(400).json({ error: 'A food, recipe, or manual macros are required' });
      return;
    }

    let finalCalories = calories || 0;
    let finalCarbs = carbsG || 0;
    let finalProtein = proteinG || 0;
    let finalFat = fatG || 0;
    const finalServings = servings || 1;

    // Calculate from food
    if (foodId) {
      const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId) as any;
      if (food) {
        finalCalories = food.calories * finalServings;
        finalCarbs = food.carbs_g * finalServings;
        finalProtein = food.protein_g * finalServings;
        finalFat = food.fat_g * finalServings;
      }
    }

    // Calculate from recipe
    if (recipeId) {
      const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?').get(recipeId, req.user!.userId) as any;
      if (recipe) {
        const ingredients = db.prepare(`
          SELECT ri.servings, f.calories, f.carbs_g, f.protein_g, f.fat_g
          FROM recipe_ingredients ri
          JOIN foods f ON ri.food_id = f.id
          WHERE ri.recipe_id = ?
        `).all(recipeId) as any[];

        let totalCal = 0, totalCarbs = 0, totalProtein = 0, totalFat = 0;
        for (const ing of ingredients) {
          totalCal += ing.calories * ing.servings;
          totalCarbs += ing.carbs_g * ing.servings;
          totalProtein += ing.protein_g * ing.servings;
          totalFat += ing.fat_g * ing.servings;
        }
        // Divide by recipe's total_servings to get per-serving
        const perServing = recipe.total_servings || 1;
        finalCalories = (totalCal / perServing) * finalServings;
        finalCarbs = (totalCarbs / perServing) * finalServings;
        finalProtein = (totalProtein / perServing) * finalServings;
        finalFat = (totalFat / perServing) * finalServings;
      }
    }

    const result = db.prepare(`
      INSERT INTO meal_logs (user_id, date, meal_type, food_id, recipe_id, servings, calories, carbs_g, protein_g, fat_g, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user!.userId, date, mealType, foodId || null, recipeId || null,
           finalServings,
           Math.round(finalCalories * 10) / 10,
           Math.round(finalCarbs * 10) / 10,
           Math.round(finalProtein * 10) / 10,
           Math.round(finalFat * 10) / 10,
           note || null);

    const meal = db.prepare(`
      SELECT m.*, f.name as food_name, f.brand as food_brand, f.serving_size, f.serving_unit,
             r.name as recipe_name
      FROM meal_logs m
      LEFT JOIN foods f ON m.food_id = f.id
      LEFT JOIN recipes r ON m.recipe_id = r.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    res.json({ meal });
  } catch (e) {
    console.error('Log meal error:', e);
    res.status(500).json({ error: 'Failed to log meal' });
  }
});

// Update a meal log
router.put('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM meal_logs WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId);
    if (!existing) {
      res.status(404).json({ error: 'Meal log not found' });
      return;
    }

    const { servings, mealType, calories, carbsG, proteinG, fatG, note } = req.body;
    db.prepare(`
      UPDATE meal_logs SET
        servings = COALESCE(?, servings),
        meal_type = COALESCE(?, meal_type),
        calories = COALESCE(?, calories),
        carbs_g = COALESCE(?, carbs_g),
        protein_g = COALESCE(?, protein_g),
        fat_g = COALESCE(?, fat_g),
        note = COALESCE(?, note)
      WHERE id = ?
    `).run(servings, mealType, calories, carbsG, proteinG, fatG, note, req.params.id);

    const meal = db.prepare(`
      SELECT m.*, f.name as food_name, f.brand as food_brand, f.serving_size, f.serving_unit,
             r.name as recipe_name
      FROM meal_logs m
      LEFT JOIN foods f ON m.food_id = f.id
      LEFT JOIN recipes r ON m.recipe_id = r.id
      WHERE m.id = ?
    `).get(req.params.id);

    res.json({ meal });
  } catch (e) {
    console.error('Update meal error:', e);
    res.status(500).json({ error: 'Failed to update meal' });
  }
});

// Delete a meal log
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM meal_logs WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Meal log not found' });
    return;
  }
  res.json({ success: true });
});

// Quick log (manual entry without food reference)
router.post('/quick', requireAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { date, mealType, name, calories, carbsG, proteinG, fatG } = req.body;
    if (!date || !mealType) {
      res.status(400).json({ error: 'Date and meal type are required' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO meal_logs (user_id, date, meal_type, servings, calories, carbs_g, protein_g, fat_g, note)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
    `).run(req.user!.userId, date, mealType, calories || 0, carbsG || 0, proteinG || 0, fatG || 0, name || null);

    const meal = db.prepare('SELECT * FROM meal_logs WHERE id = ?').get(result.lastInsertRowid);
    res.json({ meal });
  } catch (e) {
    console.error('Quick log error:', e);
    res.status(500).json({ error: 'Failed to log meal' });
  }
});

export default router;
