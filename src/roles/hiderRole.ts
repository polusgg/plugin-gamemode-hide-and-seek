// import { LobbyInstance } from "@nodepolus/framework/src/api/lobby";
// import { Player } from "@nodepolus/framework/src/player";
import { Palette } from "@nodepolus/framework/src/static";
// import { PlayerRole } from "@nodepolus/framework/src/types/enums";
import { PlayerInstance } from "@polusgg/plugin-polusgg-api/node_modules/@nodepolus/framework/src/api/player";
import { BaseManager } from "@polusgg/plugin-polusgg-api/src/baseManager/baseManager";
import { RoleAlignment, RoleMetadata } from "@polusgg/plugin-polusgg-api/src/baseRole/baseRole";
import { Crewmate } from "@polusgg/plugin-polusgg-api/src/baseRole/crewmate/crewmate";
// import { Services } from "@polusgg/plugin-polusgg-api/src/services";
import { StartGameScreenData } from "@polusgg/plugin-polusgg-api/src/services/roleManager/roleManagerService";
// import { ServiceType } from "@polusgg/plugin-polusgg-api/src/types/enums";

export class HiderRole extends Crewmate {
  protected readonly metadata: RoleMetadata = {
    name: "Hider",
    alignment: RoleAlignment.Crewmate,
  };

  // constructor(owner: PlayerInstance) {
  //   super(owner);
  //   Services.get(ServiceType.RoleManager).setBaseRole(this.owner as Player, PlayerRole.Crewmate);
  //   this.onReady();
  // }

  // onReady(): void {
  //   const roleManager = Services.get(ServiceType.EndGame);
  //
  //   this.catch("player.task.completed", e => e.getPlayer()).execute(e => {
  //     const player = e.getPlayer();
  //     const lobby = player.getLobby();
  //
  //     if (this.checkAllTasks(lobby)) {
  //       roleManager.setEndGameData(player.getSafeConnection(), {
  //         title: player.getRole() === PlayerRole.Crewmate ? "Victory" : "Defeat",
  //         subtitle: "tazkz finished ez",
  //         color: [255, 140, 238, 255],
  //         yourTeam: lobby.getPlayers(),
  //       });
  //     }
  //   });
  // }
  //
  // checkAllTasks(lobby: LobbyInstance): boolean {
  //   lobby.getPlayers()
  //     .forEach(player => {
  //       if (player.getTasks().filter(x => !x[1]).length > 0) {
  //         return false;
  //       }
  //     });
  //
  //   return true;
  // }

  getManagerType(): typeof BaseManager {
    return class extends BaseManager {
      getId(): string {
        return "HiderManager";
      }

      getTypeName(): string {
        return "Hider";
      }
    };
  }

  getAssignmentScreen(_player: PlayerInstance): StartGameScreenData {
    return {
      title: "Hider",
      subtitle: "Escape from the seekers!",
      color: Palette.crewmateBlue(),
    };
  }
}
