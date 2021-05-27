import { Palette } from "@nodepolus/framework/src/static";
import { PlayerInstance } from "@polusgg/plugin-polusgg-api/node_modules/@nodepolus/framework/src/api/player";
import { Player } from "@nodepolus/framework/src/player";
import { PlayerRole } from "@polusgg/plugin-polusgg-api/node_modules/@nodepolus/framework/src/types/enums/playerRole";
import { BaseManager } from "@polusgg/plugin-polusgg-api/src/baseManager/baseManager";
import { RoleAlignment, RoleMetadata } from "@polusgg/plugin-polusgg-api/src/baseRole/baseRole";
import { Impostor } from "@polusgg/plugin-polusgg-api/src/baseRole/impostor/impostor";
import { Services } from "@polusgg/plugin-polusgg-api/src/services";
import { StartGameScreenData } from "@polusgg/plugin-polusgg-api/src/services/roleManager/roleManagerService";
import { ServiceType } from "@polusgg/plugin-polusgg-api/src/types/enums";

export class SeekerRole extends Impostor {
  protected readonly metadata: RoleMetadata = {
    name: "Seeker",
    alignment: RoleAlignment.Impostor,
  };

  constructor(owner: PlayerInstance) {
    super(owner);
    Services.get(ServiceType.RoleManager).setBaseRole(this.owner as Player, PlayerRole.Impostor);
    this.onReady();
  }

  onReady(): void {
    //const bodyService = Services.get(ServiceType.DeadBody);
    /*this.catch("player.position.updated", e => e.getPlayer()).execute(event => {
      console.log(event.getPlayer().getLobby().getAge());

      if (event.getPlayer().getLobby().getAge() <= 5) {
        console.log("a");
        event.cancel();
      }
    });*/

    this.catch("room.sabotaged", e => e.getPlayer()).execute(e => {
      e.cancel();
    });

    this.catch("meeting.started", e => e.getCaller()).execute(e => {
      e.cancel();
    });

    /*this.catch("player.murdered", e => e.getPlayer()).execute(e => {
    });*/
  }

  getManagerType(): typeof BaseManager {
    return class extends BaseManager {
      getId(): string {
        return "SeekerManager";
      }

      getTypeName(): string {
        return "Seeker";
      }
    };
  }

  getAssignmentScreen(_player: PlayerInstance): StartGameScreenData {
    return {
      title: "Seeker",
      subtitle: "Hunt da hiders!",
      color: Palette.impostorRed(),
    };
  }
}
