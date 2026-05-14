import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/:date', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM workout_days WHERE user_id = ? AND date = ?')
    .get(req.user!.userId, req.params.date);
  res.json({ isWorkoutDay: !!row });
});

router.put('/:date', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const { isWorkoutDay } = req.body;
  if (isWorkoutDay) {
    db.prepare('INSERT OR IGNORE INTO workout_days (user_id, date) VALUES (?, ?)')
      .run(req.user!.userId, req.params.date);
  } else {
    db.prepare('DELETE FROM workout_days WHERE user_id = ? AND date = ?')
      .run(req.user!.userId, req.params.date);
  }
  res.json({ isWorkoutDay: !!isWorkoutDay });
});

export default router;
