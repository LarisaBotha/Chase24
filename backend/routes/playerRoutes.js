import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Define routes for user-related operations
router.get('/AllForSessionSorted', async (req, res) => {
  try {
    const { session_key } = req.query;

    const result = await pool.query(
      `SELECT players.name, 
              players.avatar,
              SUM(COALESCE(teams.score, (SELECT COUNT(*) + 1 
                                         FROM teams 
                                         WHERE teams.leg_id = teams.leg_id))) AS total_score,
              SUM(teams.task_count) AS task_count,
              SUM(EXTRACT(EPOCH FROM (teams.end_time - legs.start_time))) AS total_time_seconds
       FROM players
       JOIN player_teams ON players.id = player_teams.player_id
       JOIN teams ON player_teams.team_id = teams.id
       JOIN legs ON teams.leg_id = legs.id
       WHERE players.session_key = $1
       GROUP BY players.name, players.avatar
       ORDER BY total_score ASC;`,
      [session_key]
    );

    const players = result.rows;

    // Process the players into grouped arrays
    const groupedPlayers = [];
    let currentGroup = [];
    let previousScore = null;

    players.forEach(player => {
      if (player.total_score === previousScore) {
        // Add to the current group if score is the same as previous
        currentGroup.push(player);
      } else {
        // Push the previous group if it exists, and reset the group
        if (currentGroup.length === 1) {
          groupedPlayers.push(currentGroup[0]); // If only one player in group, add as an object
        } else if (currentGroup.length > 1) {
          groupedPlayers.push(currentGroup); // If multiple players, add as an array
        }
        
        // Start a new group
        currentGroup = [player];
        previousScore = player.total_score;
      }
    });

    if (currentGroup.length === 1) {
      groupedPlayers.push(currentGroup[0]); // If only one player in group, add as an object
    } else if (currentGroup.length > 1) {
      groupedPlayers.push(currentGroup); // If multiple players, add as an array
    }

    // Sort each group by taskcount if it's an array
    groupedPlayers.forEach(group => {
      if (Array.isArray(group)) {
        group.sort((a, b) => b.task_count - a.task_count); // Sort descending by taskcount
      }
    });

    const finalGroupedPlayers = groupedPlayers.map(group => {
      if (!Array.isArray(group)) return group; // Return single players as is

      const groupedByTaskCount = [];
      let currentTaskGroup = [];
      let previousTaskCount = null;

      group.forEach(player => {
        if (player.task_count === previousTaskCount) {
          currentTaskGroup.push(player);
        } else {
          if (currentTaskGroup.length === 1) {
            groupedByTaskCount.push(currentTaskGroup[0]);
          } else if (currentTaskGroup.length > 1) {
            groupedByTaskCount.push(currentTaskGroup);
          }
          currentTaskGroup = [player];
          previousTaskCount = player.task_count;
        }
      });

      // Push the last group based on taskCount
      if (currentTaskGroup.length === 1) {
        groupedByTaskCount.push(currentTaskGroup[0]);
      } else if (currentTaskGroup.length > 1) {
        groupedByTaskCount.push(currentTaskGroup);
      }

      return groupedByTaskCount.length === 1 ? groupedByTaskCount[0] : groupedByTaskCount;
    });

    // Sort each group by completion time if it's an array
    finalGroupedPlayers.forEach(group => {
      if (Array.isArray(group)) {
        group.sort((a, b) => Date(b.end_time) - Date(a.end_time)); // Sort descending by completion time
      }
    });

    const flattenedPlayers = finalGroupedPlayers.flatMap(group => {
      if (Array.isArray(group)) {
        return group; // If the group is an array of players, include each player individually
      } else {
        return [group]; // If it's a single player, wrap it in an array so flatMap includes it
      }
    });

    res.json(flattenedPlayers);
  } catch (error) {
    console.error('Error executing query', error.stack);
    res.status(500).send('Error fetching players');
  }
});

export default router;