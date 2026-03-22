import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Search foods (local DB first, then APIs)
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query) {
      res.json({ foods: [] });
      return;
    }

    const db = getDb();
    // Search local foods first (user's custom + cached)
    const local = db.prepare(`
      SELECT * FROM foods
      WHERE (user_id = ? OR user_id IS NULL)
        AND (name LIKE ? OR brand LIKE ?)
      ORDER BY
        CASE WHEN user_id = ? THEN 0 ELSE 1 END,
        name
      LIMIT 20
    `).all(req.user!.userId, `%${query}%`, `%${query}%`, req.user!.userId) as any[];

    // Search external APIs
    const [offResults, usdaResults] = await Promise.allSettled([
      searchOpenFoodFacts(query),
      searchUSDA(query),
    ]);

    const external: any[] = [];
    if (offResults.status === 'fulfilled') external.push(...offResults.value);
    if (usdaResults.status === 'fulfilled') external.push(...usdaResults.value);

    res.json({ foods: local, external });
  } catch (e) {
    console.error('Food search error:', e);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Barcode lookup
router.get('/barcode/:code', requireAuth, async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const db = getDb();

    // Check local cache first
    const cached = db.prepare('SELECT * FROM foods WHERE barcode = ?').get(code) as any;
    if (cached) {
      res.json({ food: cached });
      return;
    }

    // Try Open Food Facts
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
    if (!response.ok) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const data = await response.json();
    if (data.status !== 1 || !data.product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const p = data.product;
    const nutriments = p.nutriments || {};
    const food = {
      name: p.product_name || 'Unknown Product',
      brand: p.brands || null,
      barcode: code,
      serving_size: parseFloat(p.serving_quantity) || 100,
      serving_unit: p.serving_quantity_unit || 'g',
      calories: nutriments['energy-kcal_serving'] || nutriments['energy-kcal_100g'] || 0,
      carbs_g: nutriments.carbohydrates_serving || nutriments.carbohydrates_100g || 0,
      protein_g: nutriments.proteins_serving || nutriments.proteins_100g || 0,
      fat_g: nutriments.fat_serving || nutriments.fat_100g || 0,
      fiber_g: nutriments.fiber_serving || nutriments.fiber_100g || 0,
      sugar_g: nutriments.sugars_serving || nutriments.sugars_100g || 0,
      source: 'openfoodfacts',
      source_id: code,
    };

    // Cache it
    const result = db.prepare(`
      INSERT INTO foods (name, brand, barcode, serving_size, serving_unit, calories, carbs_g, protein_g, fat_g, fiber_g, sugar_g, source, source_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(food.name, food.brand, food.barcode, food.serving_size, food.serving_unit,
           food.calories, food.carbs_g, food.protein_g, food.fat_g, food.fiber_g, food.sugar_g,
           food.source, food.source_id);

    res.json({ food: { id: result.lastInsertRowid, ...food } });
  } catch (e) {
    console.error('Barcode lookup error:', e);
    res.status(500).json({ error: 'Barcode lookup failed' });
  }
});

// Get user's custom foods
router.get('/custom', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const foods = db.prepare("SELECT * FROM foods WHERE user_id = ? AND source = 'manual' ORDER BY name").all(req.user!.userId);
  res.json({ foods });
});

// Get recent foods (foods the user has logged recently)
router.get('/recent', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const foods = db.prepare(`
    SELECT DISTINCT f.* FROM foods f
    JOIN meal_logs m ON (m.food_id = f.id)
    WHERE m.user_id = ?
    ORDER BY m.created_at DESC
    LIMIT 20
  `).all(req.user!.userId);
  res.json({ foods });
});

// Create custom food
router.post('/', requireAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, brand, barcode, servingSize, servingUnit, calories, carbsG, proteinG, fatG, fiberG, sugarG } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO foods (user_id, name, brand, barcode, serving_size, serving_unit, calories, carbs_g, protein_g, fat_g, fiber_g, sugar_g, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(req.user!.userId, name, brand || null, barcode || null,
           servingSize || 1, servingUnit || 'serving',
           calories || 0, carbsG || 0, proteinG || 0, fatG || 0, fiberG || 0, sugarG || 0);

    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(result.lastInsertRowid);
    res.json({ food });
  } catch (e) {
    console.error('Create food error:', e);
    res.status(500).json({ error: 'Failed to create food' });
  }
});

// Update custom food
router.put('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const food = db.prepare('SELECT * FROM foods WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as any;
    if (!food) {
      res.status(404).json({ error: 'Food not found' });
      return;
    }

    const { name, brand, barcode, servingSize, servingUnit, calories, carbsG, proteinG, fatG, fiberG, sugarG } = req.body;
    db.prepare(`
      UPDATE foods SET
        name = COALESCE(?, name), brand = COALESCE(?, brand), barcode = COALESCE(?, barcode),
        serving_size = COALESCE(?, serving_size), serving_unit = COALESCE(?, serving_unit),
        calories = COALESCE(?, calories), carbs_g = COALESCE(?, carbs_g),
        protein_g = COALESCE(?, protein_g), fat_g = COALESCE(?, fat_g),
        fiber_g = COALESCE(?, fiber_g), sugar_g = COALESCE(?, sugar_g)
      WHERE id = ?
    `).run(name, brand, barcode, servingSize, servingUnit, calories, carbsG, proteinG, fatG, fiberG, sugarG, req.params.id);

    const updated = db.prepare('SELECT * FROM foods WHERE id = ?').get(req.params.id);
    res.json({ food: updated });
  } catch (e) {
    console.error('Update food error:', e);
    res.status(500).json({ error: 'Failed to update food' });
  }
});

// Delete custom food
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM foods WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Food not found' });
    return;
  }
  res.json({ success: true });
});

// Save an external food result to local DB for logging
router.post('/save-external', requireAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, brand, barcode, servingSize, servingUnit, calories, carbsG, proteinG, fatG, fiberG, sugarG, source, sourceId } = req.body;

    // Check if already cached
    if (sourceId) {
      const existing = db.prepare('SELECT * FROM foods WHERE source = ? AND source_id = ?').get(source, sourceId) as any;
      if (existing) {
        res.json({ food: existing });
        return;
      }
    }

    const result = db.prepare(`
      INSERT INTO foods (name, brand, barcode, serving_size, serving_unit, calories, carbs_g, protein_g, fat_g, fiber_g, sugar_g, source, source_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, brand || null, barcode || null, servingSize || 1, servingUnit || 'serving',
           calories || 0, carbsG || 0, proteinG || 0, fatG || 0, fiberG || 0, sugarG || 0,
           source || 'manual', sourceId || null);

    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(result.lastInsertRowid);
    res.json({ food });
  } catch (e) {
    console.error('Save external food error:', e);
    res.status(500).json({ error: 'Failed to save food' });
  }
});

// Helper: search Open Food Facts
async function searchOpenFoodFacts(query: string): Promise<any[]> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,brands,code,nutriments,serving_quantity,serving_quantity_unit`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.products || [])
      .filter((p: any) => p.product_name)
      .map((p: any) => {
        const n = p.nutriments || {};
        return {
          name: p.product_name,
          brand: p.brands || null,
          barcode: p.code || null,
          servingSize: parseFloat(p.serving_quantity) || 100,
          servingUnit: p.serving_quantity_unit || 'g',
          calories: Math.round(n['energy-kcal_serving'] || n['energy-kcal_100g'] || 0),
          carbsG: Math.round((n.carbohydrates_serving || n.carbohydrates_100g || 0) * 10) / 10,
          proteinG: Math.round((n.proteins_serving || n.proteins_100g || 0) * 10) / 10,
          fatG: Math.round((n.fat_serving || n.fat_100g || 0) * 10) / 10,
          fiberG: Math.round((n.fiber_serving || n.fiber_100g || 0) * 10) / 10,
          sugarG: Math.round((n.sugars_serving || n.sugars_100g || 0) * 10) / 10,
          source: 'openfoodfacts',
          sourceId: p.code || null,
        };
      });
  } catch {
    return [];
  }
}

// Helper: search USDA FoodData Central
async function searchUSDA(query: string): Promise<any[]> {
  try {
    const apiKey = process.env.USDA_API_KEY || 'DEMO_KEY';
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=10&api_key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.foods || []).map((f: any) => {
      const get = (name: string) => {
        const n = (f.foodNutrients || []).find((n: any) => n.nutrientName === name);
        return n ? Math.round(n.value * 10) / 10 : 0;
      };
      return {
        name: f.description || 'Unknown',
        brand: f.brandName || f.brandOwner || null,
        barcode: f.gtinUpc || null,
        servingSize: f.servingSize || 100,
        servingUnit: f.servingSizeUnit || 'g',
        calories: Math.round(get('Energy')),
        carbsG: get('Carbohydrate, by difference'),
        proteinG: get('Protein'),
        fatG: get('Total lipid (fat)'),
        fiberG: get('Fiber, total dietary'),
        sugarG: get('Sugars, total including NLEA') || get('Total Sugars'),
        source: 'usda',
        sourceId: String(f.fdcId),
      };
    });
  } catch {
    return [];
  }
}

export default router;
