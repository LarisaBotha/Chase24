import express from 'express';
import pool from '../db.js';
import { sendUpdateToSessionClients } from '../server.js'

const router = express.Router();

// Define routes for user-related operations
router.get('/AllForSession', async (req, res) => {
  try {
    const { session_key } = req.query;

    // Query to fetch all players for the session
    const playersResult = await pool.query(
      `SELECT id, name, avatar FROM players WHERE session_key = $1`,
      [session_key]
    );
    const players = playersResult.rows;

    // Query to fetch only relevant legs, teams, and players for the session
    const teamsResult = await pool.query(
      `SELECT legs.id AS leg_id, legs.name AS leg_name, legs.task_count as leg_task_count, legs.start_time as leg_start_time,
              teams.id AS team_id, teams.name AS team_name, teams.task_count AS team_task_count, teams.end_time AS team_end_time,
              player_teams.player_id
       FROM legs
       JOIN teams ON legs.id = teams.leg_id
       JOIN player_teams ON teams.id = player_teams.team_id
       JOIN players ON player_teams.player_id = players.id
       WHERE players.session_key = $1
       ORDER BY legs.id, teams.id, player_teams.player_id`,
      [session_key]
    );

    // Structure teams and players by leg
    const teamsByLeg = {};
    const legs = [];

    teamsResult.rows.forEach(row => {
      // Initialize the structure for each leg
      if (!teamsByLeg[row.leg_id]) {
        teamsByLeg[row.leg_id] = {};
        let time_differance;
        if (row.leg_start_time){
          const temp = new Date(row.leg_start_time).getTime();
          time_differance = Date.now() - temp;
        } else {
          time_differance = null;
        }
        legs.push({id: row.leg_id, name: row.leg_name, tasks: row.leg_task_count, started:row.leg_start_time});
      }

      // Initialize each team under the leg
      if (!teamsByLeg[row.leg_id][row.team_id]) {
        teamsByLeg[row.leg_id][row.team_id] = [];
      }

      // Get the index of the player in the players array
      const playerIndex = players.findIndex(player => player.id === row.player_id);
      teamsByLeg[row.leg_id][row.team_id].push(playerIndex);
    });

    // Convert the structured data into the desired format for `playerteams`
    const playerteams = Object.keys(teamsByLeg).map(legId => {
      const teamsForLeg = teamsByLeg[legId];  // Get teams for this leg
      return Object.values(teamsForLeg);  // Return array of arrays (team players) for each leg
    });

    // Get unique team names across all relevant legs
    const teamNames = Array.from(
      new Map(teamsResult.rows.map(row => [row.team_id, { id: row.team_id, 
                                                          name: row.team_name, 
                                                          task_count: row.team_task_count,
                                                          end_time: row.team_end_time }])).values()
  );

    // Return response in the desired format
    res.json({ players, teams: teamNames, legs: legs, playerteams });
  } catch (error) {
    console.error('Error executing query', error.stack);
    res.status(500).send('Error fetching teams, players, and legs');
  }
});

router.post('/Stop', async (req, res) => {
  const { team_id } = req.body;

  try {
    // Update the end_time and score of the specified team
    const result = await pool.query(
      `UPDATE teams AS t1
       SET end_time = NOW(),
           score = (
               SELECT COALESCE(MAX(t2.score), 0) + 1
               FROM teams AS t2
               WHERE t2.leg_id = t1.leg_id
           )
       WHERE t1.id = $1
       RETURNING *;`,
      [team_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Retrieve the session_key associated with the team_id
    const sessionQuery = await pool.query(
      `SELECT players.session_key 
       FROM players 
       JOIN player_teams ON players.id = player_teams.player_id
       JOIN teams ON player_teams.team_id = teams.id
       WHERE teams.id = $1
       LIMIT 1`,
      [team_id]
    );

    if (sessionQuery.rows.length === 0) {
      return res.status(404).send('Session not found for the specified team');
    }

    const session_key = sessionQuery.rows[0].session_key;

    sendUpdateToSessionClients(session_key); // Send update with session context

    res.json({ message: 'Team Stopped', team: result.rows[0] });

  } catch (error) {
    console.error('Error executing query', error.stack);
    res.status(500).send('Error stopping team');
  }
});

router.post('/Advance', async (req, res) => {
  const { team_id } = req.body;

  try {
    // Increment task_count by 1 for the specified team_id
    const result = await pool.query(
      `UPDATE teams 
       SET task_count = task_count + 1 
       WHERE id = $1 
       RETURNING *`, 
      [team_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Team not found');
    }

    // Retrieve the session_key associated with the team_id
    const sessionQuery = await pool.query(
      `SELECT players.session_key 
       FROM players 
       JOIN player_teams ON players.id = player_teams.player_id
       JOIN teams ON player_teams.team_id = teams.id
       WHERE teams.id = $1
       LIMIT 1`,
      [team_id]
    );

    if (sessionQuery.rows.length === 0) {
      return res.status(404).send('Session not found for the specified team');
    }

    const session_key = sessionQuery.rows[0].session_key;

    sendUpdateToSessionClients(session_key); // Pass the session key and sorted players

    res.json({ message: 'Team Advanced', team: result.rows[0] });
  } catch (error) {
    console.error('Error executing query', error.stack);
    res.status(500).send('Error advancing team task count');
  }
});

export default router;