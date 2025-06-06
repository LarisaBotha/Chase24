import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Define routes for user-related operations
export const fetchSortedPlayersBySession = async (session_key) => {
  try {
    const result = await pool.query(
      `
      SELECT 
          players.name, 
          players.avatar,
          SUM(COALESCE(teams.score, (SELECT COUNT(*) + 1 
                                     FROM teams 
                                     WHERE teams.leg_id = teams.leg_id))) AS rank_var,
          SUM(teams.task_count) AS task_count,
          SUM(EXTRACT(EPOCH FROM (teams.end_time - legs.start_time))) AS total_time_seconds,
          SUM(CASE 
            WHEN teams.end_time IS NOT NULL THEN COALESCE(teams.score, 0)
            ELSE 0
          END) AS total_score,
          SUM(CASE 
              WHEN teams.end_time IS NULL THEN COALESCE(teams.score, 0)
              ELSE 0
          END) AS task_rank
      FROM players
      JOIN player_teams ON players.id = player_teams.player_id
      JOIN teams ON player_teams.team_id = teams.id
      JOIN legs ON teams.leg_id = legs.id
      WHERE players.session_key = $1
      GROUP BY players.name, players.avatar
      ORDER BY rank_var ASC, total_score ASC, task_count DESC, total_time_seconds ASC, task_rank ASC
      `,
      [session_key]
    );

    const players = result.rows;

    // console.log('Sorted by score')
    // console.log(players)

    // Helper Variables
    let currentGroup = [];
    let prev = null;

    const ScoreGroupedPlayers = [];

    // Group players array by score
    players.forEach(player => {
      // If it should be part of the current grouping (By Total Score)
      if (player.rank_var === prev) {
        currentGroup.push(player);
      } else {
        // Push the previous group if it exists
        if (currentGroup.length === 1) {
          ScoreGroupedPlayers.push(currentGroup[0]); // If only one player in group, add as an object
        } else if (currentGroup.length > 1) {
          ScoreGroupedPlayers.push(currentGroup); // If multiple players, add as an array
        }
        
        // Start a new group
        currentGroup = [player];
        prev = player.rank_var;
      }
    });

    // Push the last group if it exists
    if (currentGroup.length === 1) {
      ScoreGroupedPlayers.push(currentGroup[0]); // If only one player in group, add as an object
    } else if (currentGroup.length > 1) {
      ScoreGroupedPlayers.push(currentGroup); // If multiple players, add as an array
    }

    // console.log('Grouped by score');
    // console.log(ScoreGroupedPlayers);

    // Sort each group withing the task grouped players array by taskcount
    ScoreGroupedPlayers.forEach(group => {
      if (Array.isArray(group)) {
        group.sort((a, b) => b.task_count - a.task_count); // Sort descending by taskcount
      }
    });
    
    // console.log('Sorted by taskcount');
    // console.log(ScoreGroupedPlayers);

    const TaskGroupedPlayers = [];

    ScoreGroupedPlayers.forEach(scoreGroup => {
      if (!Array.isArray(scoreGroup)){ // If it is not a group but a single player
        TaskGroupedPlayers.push(scoreGroup) 
      } else {

        // Reset helper variables
        currentGroup = [];
        prev = null;

        scoreGroup.forEach(player => {
          // If it should be part of the current grouping (By Task Count)
          if (player.task_count === prev) {
            currentGroup.push(player);
          } else {
            // Push old grouping
            if (currentGroup.length === 1) {
              TaskGroupedPlayers.push(currentGroup[0]); // If only one player in group, add as an object
            } else if (currentGroup.length > 1) {
              TaskGroupedPlayers.push(currentGroup); // If multiple players, add as an array
            }
            // Start a new grouping
            currentGroup = [player];
            prev = player.task_count;
          }
        })
      
        // Push the last group based on taskCount
        if (currentGroup.length === 1) {
          TaskGroupedPlayers.push(currentGroup[0]); // If only one player in group, add as an object
        } else if (currentGroup.length > 1) {
          TaskGroupedPlayers.push(currentGroup); // If multiple players, add as an array
        }
      }
    })

    // console.log('Grouped by task');
    // console.log(TaskGroupedPlayers);

    // Sort each group by completion time if it's an array
    TaskGroupedPlayers.forEach(group => {
      if (Array.isArray(group)) {
        group.sort((a, b) => a.total_time_seconds - b.total_time_seconds); // Sort descending by completion time
      }
    });

    // console.log('Sorted by time');
    // console.log(TaskGroupedPlayers);

    const TimeGroupedPlayers = [];

    TaskGroupedPlayers.forEach(scoreGroup => {
      if (!Array.isArray(scoreGroup)){ // If it is not a group but a single player
        TimeGroupedPlayers.push(scoreGroup) 
      } else {

        // Reset helper variables
        currentGroup = [];
        prev = null;

        scoreGroup.forEach(player => {
          // If it should be part of the current grouping (By Time)
          if (player.total_time_seconds === prev) {
            currentGroup.push(player);
          } else {
            // Push old grouping
            if (currentGroup.length === 1) {
              TimeGroupedPlayers.push(currentGroup[0]); // If only one player in group, add as an object
            } else if (currentGroup.length > 1) {
              TimeGroupedPlayers.push(currentGroup); // If multiple players, add as an array
            }
            // Start a new grouping
            currentGroup = [player];
            prev = player.total_time_seconds;
          }
        })
      
        // Push the last group based on taskCount
        if (currentGroup.length === 1) {
          TimeGroupedPlayers.push(currentGroup[0]); // If only one player in group, add as an object
        } else if (currentGroup.length > 1) {
          TimeGroupedPlayers.push(currentGroup); // If multiple players, add as an array
        }
      }
    })

    // console.log('Grouped by time');
    // console.log(TimeGroupedPlayers);

     // Sort each group by task rank if it's an array
     TimeGroupedPlayers.forEach(group => {
      if (Array.isArray(group)) {
        group.sort((a, b) => a.task_rank - b.task_rank); // Sort ascending by task rank
      }
    });

    const flattenedPlayers = TimeGroupedPlayers.flatMap(group => {
      if (Array.isArray(group)) {
        return group; // If the group is an array of players, include each player individually
      } else {
        return [group]; // If it's a single player, wrap it in an array so flatMap includes it
      }
    });

    // console.log('Flattened');
    // console.log(flattenedPlayers);

    return JSON.stringify(flattenedPlayers);
  } catch (error) {
    console.error('Error executing query', error.stack);
    throw error;
  }
};


export default router;