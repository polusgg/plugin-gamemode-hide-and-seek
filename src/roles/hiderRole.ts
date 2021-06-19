import { Palette } from "@nodepolus/framework/src/static";
import { clamp } from "@nodepolus/framework/src/util/functions";
import { PlayerInstance } from "@polusgg/plugin-polusgg-api/node_modules/@nodepolus/framework/src/api/player";
import { BaseManager } from "@polusgg/plugin-polusgg-api/src/baseManager/baseManager";
import { RoleAlignment, RoleMetadata } from "@polusgg/plugin-polusgg-api/src/baseRole/baseRole";
import { Crewmate } from "@polusgg/plugin-polusgg-api/src/baseRole/crewmate/crewmate";
import { Services } from "@polusgg/plugin-polusgg-api/src/services";
import { StartGameScreenData } from "@polusgg/plugin-polusgg-api/src/services/roleManager/roleManagerService";
import { ServiceType } from "@polusgg/plugin-polusgg-api/src/types/enums";

export class HiderRole extends Crewmate {
  protected readonly metadata: RoleMetadata = {
    name: "Hider",
    alignment: RoleAlignment.Crewmate,
  };

  constructor(owner: PlayerInstance) {
    super(owner);

    const playerAnimationService = Services.get(ServiceType.Animation);

    this.catch("player.position.walked", e => e.getPlayer()).execute(event => {
      if (event.getPlayer().isDead()) {
        return;
      }

      const opacity = clamp(event.getNewVelocity().magnitude() / event.getPlayer().getLobby().getOptions()
        .getPlayerSpeedModifier(), 0.2, 0.7);

      if (opacity !== event.getPlayer().getMeta("hns.currentopacity")) {
        event.getPlayer().setMeta("hns.currentopacity", opacity);
        playerAnimationService.setOpacity(event.getPlayer(), opacity);
      }
    });
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
      subtitle: "Escape from the seekers!",
      color: Palette.crewmateBlue(),
    };
  }
}
