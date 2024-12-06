import express from 'express';
import pool from '../db.js';
import format from 'pg-format';
import sharedFuncs from '../shared/sharedFuncs.js';

const router = express.Router();

// Create a new session, Register players and rivals
router.post('/create', async (req, res) => {
  let { players, rivalries, driver_groups, legs } = req.body;

  let leg_count;
  if (legs) {
    leg_count = legs.length;
    if(driver_groups) {
      legs.forEach(leg => {
        if(driver_groups.length != leg.teamNames.length) { // Amount of Teams
          console.log('Driver groups does not match team count');
          return res.status(400).json({ error: 'Driver groups does not match team count' });
        }
      });
    }
  } 

  if (!players) {
    console.log('Missing players data');
    return res.status(400).json({ error: 'Missing players data' });
  }

  if (rivalries) {
    rivalries.forEach(rivalry => {
      if (rivalry.length != 2) {
        console.log('Rivals must be in pairs');
        return res.status(400).json({ error: 'Rivals must be in pairs' });
      }
    })
  }

  const session_key = "ognl24"; //generateSessionKey();

  try {
      // Start the transaction
      await pool.query('BEGIN');

      // Register session
      await pool.query(
        'INSERT INTO sessions (session_key) VALUES ($1) RETURNING *',
        [session_key]
      )

      // Create an array of player name and session key tuples
      const player_values = players.map(player => [player.name, player.avatar, session_key]);

      // console.log(player_values);

      // Format the query for bulk insertion using pg-format
      const playerInsertQuery = format(`
        INSERT INTO players (name, avatar, session_key)
        VALUES %L
        RETURNING id, name
      `, player_values);

      // Insert players
      const playerInsertResult = await pool.query(playerInsertQuery);

      // Create a map of player names to their IDs
      let playerMap = {};
      playerInsertResult.rows.forEach(player => {
          playerMap[player.name] = player.id;
      });

      let my_rivalry_array = []
      let my_driver_array = driver_groups.map(group => decodeURIComponent(group).split(','));
      if (rivalries)
      {     
        my_rivalry_array = rivalries.map(rivalry => decodeURIComponent(rivalry).split(','));
        const rival_values = my_rivalry_array.map(rivalry => {
          let player1_index = parseInt(rivalry[0]);
          let player1_name = players[player1_index].name;
          let player1_id = playerMap[player1_name];

          let player2_index =  parseInt(rivalry[1]);
          let player2_name = players[player2_index].name;
          let player2_id = playerMap[player2_name];

          return [player1_id, player2_id];
        });

        // console.log(rival_values);

        // Insert Rivalries
        const rivalInsertQuery = format(`
            INSERT INTO rivals (player1_id, player2_id)
            VALUES %L
        `, rival_values);

        await pool.query(rivalInsertQuery);
      }

      // Generate teams
      const my_teams = sharedFuncs.generateTeams(leg_count, players, my_rivalry_array, my_driver_array);

      // my_teams.forEach(leg => {
      //   console.log("[")
      //   leg.forEach(team => {
      //     console.log("[")
      //     team.forEach(player => {
      //       console.log(player.name)
      //     })
      //     console.log("]")
      //   })
      //   console.log("]")
      // });

      const leg_values = legs.map(leg => [leg.legName, leg.taskCount]);
      // console.log(leg_values);

      // Insert Legs
      const legInsertQuery = format(`
        INSERT INTO legs (name, task_count)
        VALUES %L
        RETURNING id, name
      `, leg_values);
      
      const legInsertResult = await pool.query(legInsertQuery);
      
      // Create a map of leg names to their IDs
      let legMap = {};
      legInsertResult.rows.forEach(leg => {
          legMap[leg.name] = leg.id;
      });
      
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        const team_values = leg.teamNames.map(teamName => [teamName, legMap[leg.legName]]);

        // console.log(team_values);

        // Insert Teams
        const teamInsertQuery = format(`
            INSERT INTO teams (name, leg_id)
            VALUES %L
            RETURNING id, name
        `, team_values);

        const teamInsertResult = await pool.query(teamInsertQuery);

        // Create a map of team names to their IDs for the current leg
        let teamMap = {};
        teamInsertResult.rows.forEach(team => {
            teamMap[team.name] = team.id;
        });

        // Assign Players to the teams
        const currentTeams = my_teams[i];

        for (let teamIndex = 0; teamIndex < currentTeams.length; teamIndex++) {
            const players_indexs = currentTeams[teamIndex];
            const team_id = teamMap[leg.teamNames[teamIndex]];

            const player_team_values = players_indexs.map(player_index => [playerMap[players[player_index].name], team_id]);

            // console.log(player_team_values);

            const playerTeamInsertQuery = format(`
                INSERT INTO player_teams (player_id, team_id)
                VALUES %L
            `, player_team_values);

            await pool.query(playerTeamInsertQuery);
        }
      }

      // Commit the transaction
      await pool.query('COMMIT');

      res.json({ session_key });
  } catch (error) {
      // Rollback if there's an error
      await pool.query('ROLLBACK');
      console.error('Error during transaction:', error);
      res.status(500).json({ error: 'Failed to register players and rivalries' });
  }
});

// Join a session
router.post('/join', async (req, res) => {
  const { session_key } = req.body;

  try {
    const result = await pool.query('SELECT * FROM sessions WHERE session_key = $1', [session_key]);

    if (result.rows.length === 0) {
      res.status(404).send('Session not found');
    } else {
      res.render('leaderboard', { session_key });
    }
  } catch (error) {
    console.error('Error joining session', error.stack);
    res.status(500).send('Error joining session');
  }
});

// Function to generate session key
function generateSessionKey() {
  return Math.random().toString(36).substring(2, 8); // Generates a random 6-character string
}

export default router;
