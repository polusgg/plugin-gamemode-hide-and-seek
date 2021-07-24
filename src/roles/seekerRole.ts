import { PlayerInstance } from "@nodepolus/framework/src/api/player";
import { Palette } from "@nodepolus/framework/src/static";
import { BaseManager } from "@polusgg/plugin-polusgg-api/src/baseManager/baseManager";
import { RoleAlignment, RoleMetadata } from "@polusgg/plugin-polusgg-api/src/baseRole/baseRole";
import { Impostor } from "@polusgg/plugin-polusgg-api/src/baseRole/impostor/impostor";
import { Services } from "@polusgg/plugin-polusgg-api/src/services";
import { StartGameScreenData } from "@polusgg/plugin-polusgg-api/src/services/roleManager/roleManagerService";
import { ServiceType } from "@polusgg/plugin-polusgg-api/src/types/enums";
import { HudItem } from "@polusgg/plugin-polusgg-api/src/types/enums/hudItem";

export class SeekerRole extends Impostor {
  protected readonly metadata: RoleMetadata = {
    name: "Seeker",
    alignment: RoleAlignment.Impostor,
  };

  constructor(owner: PlayerInstance) {
    super(owner);

    const hudService = Services.get(ServiceType.Hud);

    hudService.setHudVisibility(owner, HudItem.MapSabotageButtons, false);

    this.catch("player.murdered", e => e.getKiller()).execute(_event => {
      this.getImpostorButton()?.setCurrentTime(0);
    });

    this.getImpostorButton()?.setCurrentTime(0);

    this.owner.setSpeedModifier(0);
    this.owner.setVisionModifier(0.1);
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
      subtitle: "Hunt the hiders down!",
      color: Palette.impostorRed(),
    };
  }

  getDescriptionText(): string {
    return `<color=#ff1919>Role: Seeker
Kill all hiders to win!</color>`;
  }
}
