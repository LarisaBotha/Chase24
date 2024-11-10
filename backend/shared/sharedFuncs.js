// Generate a random number with max
function Random(min, max) {
    return Math.floor(Math.random() * max) + min;
}

// Wraps a given integer around a specified interval.
// If the value is less than the minimum, it wraps around to the maximum.
// If the value is greater than the maximum, it wraps around to the minimum.

// Example:
// wrapValue(1, 2, 5)  => 5
// wrapValue(7, 2, 5)  => 3
function wrapValue(value, min, max) {
    const range = max - min + 1;
    return ((value - min) % range + range) % range + min;
}

// Function to randomly generate teams
// players (Array of Objects = {name, avatar})
// rivals (Array of arrays of int (index of players))
// driver_groups (Array of arrays of int (index of players))
function generateTeams(leg_count, players, rivals, driver_groups) {
    let teams_per_leg = []

    for (let j = 0; j < leg_count; j ++){
        let teams = [];
        let remaining_players = Array.from({ length: players.length }, (_, i) => i); //create an array that represents each player's index

        for (let i = 0; i < driver_groups.length; i++) { // randomly assign a driver to each team
            let number_of_drivers = driver_groups[i].length;
            // Randomly generate index (of driver group) of driver in current driver group
            let random_driver_group_index = Random(0, number_of_drivers - 1); 
            // Get the index of the player from the driver group
            let random_driver_player_index = driver_groups[i][random_driver_group_index]; 


            // Get the index of the player index within the remaining players array
            // let random_driver_index = remaining_players.indexOf(random_driver_player_index);

            // Create team
            teams[i] = [];
            // Add driver to team
            teams[i].push(random_driver_player_index);

            // console.log("player");
            // console.log(players[random_driver_player_index])

            // Remove driver from remaining_players array
            remaining_players.splice(random_driver_player_index - i, 1);     

            // console.log("remaining players after delete")
            // remaining_players.forEach(index => {
            //     console.log(index)
            //     console.log(players[index].name)
            // })
            
        }
        
        while (remaining_players.length > 0) {
            for (const team of teams) {
                if (remaining_players.length <= 0) { // incase uneven teams
                    break;
                }
                let random_player_index = Random(0, remaining_players.length - 1);
                let current_player_index = random_player_index; 

                do {
                    let hasRival = false;
                    current_player_index = wrapValue(current_player_index + 1, 0, remaining_players.length - 1);

                    // Check rivals
                    for (let k = 0; k < rivals.length; k++) {
                        let pair = rivals[k]; // pair of players represented by index of players array
                        if((players[pair[0]] == players[remaining_players[current_player_index]] && team.includes(pair[1])) 
                            || (players[pair[1]] == players[remaining_players[current_player_index]] && team.includes(pair[0]))){
                            hasRival = true
                        } 
                    }

                    if (!hasRival)
                    {
                        break; // index is a good fit
                    }
            
                } while(current_player_index != random_player_index);

                // Create new rivals for next round (TODO: Should this be stored?)
                team.forEach(team_player_index => {
                    rivals.push([team_player_index, remaining_players[current_player_index]]);
                })

                // Add player to team
                team.push(remaining_players[current_player_index]);
                // Remove player from remaining_players array
                remaining_players.splice(current_player_index, 1);
            }
        }
        teams_per_leg.push(teams);
    }
    return teams_per_leg;
}

export default {
    Random,
    generateTeams
  };
