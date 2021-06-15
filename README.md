# Polus.gg Hide and Seek plugin for NodePolus
Gamemode for Polus.gg implementing hide and seek gamemode (WIP)

## Original idea (Twitter: @hideamongseek)
1. we immediately start an emergency meeting at the beginning of the game to reveal who is the impostor (killer) among us 
2. after the reveal, players will skip vote to continue the game
3. as the game starts, let the crewmates run and hide. The impostor needs to stay and wait for 15 seconds 4. the Impostor will be searching for crewmates to kill while the rest of the team avoids the impostor 
5. crewmates have to finish their tasks while avoiding the imposter

## Current implementation details
✔ Seekers and hiders are being showed on introcutscene (maybe also a name color) <br />
✔ Seekers are frozen (by the plugin) for configurable amount of time in their spawn location <br />
✔ Hiders have to finish their tasks while avoiding the seekers <br />
✔ No one can call emergency meetings and report bodies <br />
✖ Seekers will be searching for hiders to kill, they win if **all hiders** are killed. Seekers have no kill cooldown <br />
✖ Hiders are less visible (transparent) while standing still <br />
😔 Seekers are blinded while being frozen and vision of hiders is limited <br />
😔 Dead bodies despawn after a kill <br />
😔 Seekers can't use sabotages and close doors <br />
<br />
✔ - implemented <br />
✖ - to be implemented, possible with current API <br />
😔 - to be implemented, not possible with current API (changes required) <br />
