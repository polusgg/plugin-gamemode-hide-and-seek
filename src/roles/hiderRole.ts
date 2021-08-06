import { Palette } from "@nodepolus/framework/src/static";
import { clamp } from "@nodepolus/framework/src/util/functions";
import { PlayerInstance } from "@nodepolus/framework/src/api/player";
import { BaseManager } from "@polusgg/plugin-polusgg-api/src/baseManager/baseManager";
import { RoleAlignment, RoleMetadata } from "@polusgg/plugin-polusgg-api/src/baseRole/baseRole";
import { Crewmate } from "@polusgg/plugin-polusgg-api/src/baseRole/crewmate/crewmate";
import { Services } from "@polusgg/plugin-polusgg-api/src/services";
import { PlayerAnimationKeyframe } from "@polusgg/plugin-polusgg-api/src/services/animation/keyframes/player";
import { StartGameScreenData } from "@polusgg/plugin-polusgg-api/src/services/roleManager/roleManagerService";
import { ServiceType } from "@polusgg/plugin-polusgg-api/src/types/enums";
import { PlayerAnimationField } from "@polusgg/plugin-polusgg-api/src/types/playerAnimationFields";
import { HideAndSeekGameOptions } from "../..";
import { HideAndSeekGameOptionNames } from "../types";

export class HiderRole extends Crewmate {
  protected readonly metadata: RoleMetadata = {
    name: "Hider",
    alignment: RoleAlignment.Crewmate,
  };

  constructor(owner: PlayerInstance) {
    super(owner);

    const playerAnimationService = Services.get(ServiceType.Animation);
    const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions>(owner.getLobby());

    const initialOpacity = gameOptions.getOption(HideAndSeekGameOptionNames.HidersOpacity).getValue().value / 100;

    playerAnimationService.beginPlayerAnimation(this.owner, [PlayerAnimationField.Opacity, PlayerAnimationField.SkinOpacity, PlayerAnimationField.HatOpacity, PlayerAnimationField.PetOpacity], [
      new PlayerAnimationKeyframe({
        offset: 0,
        duration: 0,
        opacity: initialOpacity,
        petOpacity: initialOpacity,
      }),
    ], false);
    this.owner.setMeta("pgg.hns.currentopacity", initialOpacity);

    this.catch("player.position.walked", e => e.getPlayer()).execute(async event => {
      if (event.getPlayer().isDead()) {
        return;
      }

      const opacity = clamp(event.getNewVelocity().magnitude() / event.getPlayer().getLobby().getOptions()
        .getPlayerSpeedModifier(), gameOptions.getOption(HideAndSeekGameOptionNames.HidersOpacity).getValue().value / 100, 0.7);

      if (opacity !== event.getPlayer().getMeta("pgg.hns.currentopacity")) {
        await playerAnimationService.beginPlayerAnimation(event.getPlayer(), [PlayerAnimationField.Opacity, PlayerAnimationField.SkinOpacity, PlayerAnimationField.HatOpacity, PlayerAnimationField.PetOpacity], [
          new PlayerAnimationKeyframe({
            offset: 0,
            duration: 100,
            opacity: opacity,
            petOpacity: opacity,
          }),
        ], false);
        event.getPlayer().setMeta("pgg.hns.currentopacity", opacity);
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
      subtitle: "Finish your tasks and escape from the <color=#FF1919FF>Seekers!</color>",
      color: Palette.crewmateBlue(),
    };
  }

  getDescriptionText(): string {
    return `<color=#8cffff>Role: Hider
Finish your tasks and don't get caught!</color>`;
  }
}
