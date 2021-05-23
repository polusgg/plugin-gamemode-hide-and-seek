import { Palette } from "@nodepolus/framework/src/static";
import { PlayerInstance } from "@polusgg/plugin-polusgg-api/node_modules/@nodepolus/framework/src/api/player";
import { BaseManager } from "@polusgg/plugin-polusgg-api/src/baseManager/baseManager";
import { BaseRole } from "@polusgg/plugin-polusgg-api/src/baseRole";
import { RoleAlignment, RoleMetadata } from "@polusgg/plugin-polusgg-api/src/baseRole/baseRole";
import { StartGameScreenData } from "@polusgg/plugin-polusgg-api/src/services/roleManager/roleManagerService";

export class HiderRole extends BaseRole {
  protected readonly metadata: RoleMetadata = {
    name: "Hider",
    alignment: RoleAlignment.Crewmate,
  };

  constructor(owner: PlayerInstance) {
    super(owner);
  }

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
      subtitle: "Eskape da seekers!",
      color: Palette.crewmateBlue(),
    };
  }
}
