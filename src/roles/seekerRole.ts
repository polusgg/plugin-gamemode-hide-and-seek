import { Palette } from "@nodepolus/framework/src/static";
import { PlayerInstance } from "@polusgg/plugin-polusgg-api/node_modules/@nodepolus/framework/src/api/player";
import { BaseManager } from "@polusgg/plugin-polusgg-api/src/baseManager/baseManager";
import { RoleAlignment, RoleMetadata } from "@polusgg/plugin-polusgg-api/src/baseRole/baseRole";
import { Impostor } from "@polusgg/plugin-polusgg-api/src/baseRole/impostor/impostor";
import { StartGameScreenData } from "@polusgg/plugin-polusgg-api/src/services/roleManager/roleManagerService";

export class SeekerRole extends Impostor {
  protected readonly metadata: RoleMetadata = {
    name: "Seeker",
    alignment: RoleAlignment.Impostor,
  };

  constructor(owner: PlayerInstance) {
    super(owner);

    this.catch("room.sabotaged", e => e.getPlayer()).execute(e => {
      e.cancel();
    });

    });


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
      subtitle: "Hunt the hiders!",
      color: Palette.impostorRed(),
    };
  }
}
