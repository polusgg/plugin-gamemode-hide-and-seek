# Polus.gg Hide and Seek plugin for NodePolus
Gamemode for Polus.gg implementing hide and seek gamemode (WIP)

## Original idea (Twitter: @hideamongseek)
1. we immediately start an emergency meeting at the beginning of the game to reveal who is the impostor (killer) among us 
2. after the reveal, players will skip vote to continue the game
3. as the game starts, let the crewmates run and hide. The impostor needs to stay and wait for 15 seconds 4. the Impostor will be searching for crewmates to kill while the rest of the team avoids the impostor 
5. crewmates have to finish their tasks while avoiding the imposter

## Current implementation details
1. Seekers are being showed on introcutscene (maybe also a name color)
2. Seekers are frozen (by the plugin) for configurable amount of time in their spawn location and limited vision
3. Seekers will be searching for hiders to kill, they win if **all hiders** are killed. Seekers have no kill cooldown
4. Dead bodies despawn after a kill
5. Hiders have to finish their tasks while avoiding the seekers
6. Hiders are less visible (transparent) while standing still
7. No one can call emergency meetings and report bodies
8. Seekers can't use sabotages, but vision of hiders is limited (lighting sabotage)
