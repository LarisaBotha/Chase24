import express from 'express';
import pool from '../db.js';
import { sendUpdateToSessionClients } from '../server.js'

const router = express.Router();

// Start a leg
router.post('/start', async (req, res) => {
    const { leg_id, session_key } = req.body;

    try {
        await pool.query('BEGIN');

        // Update the start_time of the specified leg to the current timestamp
        const legResult = await pool.query(
            `UPDATE legs 
             SET start_time = NOW() 
             WHERE id = $1
             RETURNING *;`,
            [leg_id]
        );

        if (legResult.rowCount === 0) {
            return res.status(404).json({ message: 'Leg not found' });
        }

        await pool.query(
            `UPDATE teams 
            SET task_count = task_count + 1 
            WHERE leg_id = $1
            RETURNING *`,
            [leg_id]
        );

        await pool.query('COMMIT');

        sendUpdateToSessionClients(session_key);

        res.json({ message: 'Leg started', leg: legResult.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error starting leg' });
    }
});

export default router;
