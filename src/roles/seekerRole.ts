import { Palette } from "@nodepolus/framework/src/static";
import { PlayerInstance } from "@polusgg/plugin-polusgg-api/node_modules/@nodepolus/framework/src/api/player";
import { BaseManager } from "@polusgg/plugin-polusgg-api/src/baseManager/baseManager";
import { RoleAlignment, RoleMetadata } from "@polusgg/plugin-polusgg-api/src/baseRole/baseRole";
import { Impostor } from "@polusgg/plugin-polusgg-api/src/baseRole/impostor/impostor";
import { Services } from "@polusgg/plugin-polusgg-api/src/services";
import { StartGameScreenData } from "@polusgg/plugin-polusgg-api/src/services/roleManager/roleManagerService";
import { ServiceType } from "@polusgg/plugin-polusgg-api/src/types/enums";
import { HideAndSeekGameOptions } from "../..";
import { HideAndSeekGameOptionNames } from "../types";

export class SeekerRole extends Impostor {
  protected readonly metadata: RoleMetadata = {
    name: "Seeker",
    alignment: RoleAlignment.Impostor,
  };

  constructor(owner: PlayerInstance) {
    super(owner);

    const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions>(this.owner.getLobby());
    let canSeekerMove = false;

    setTimeout(() => {
      canSeekerMove = true;
    }, 5000 + (gameOptions.getOption(HideAndSeekGameOptionNames.SeekerFreezeTime).getValue().value * 1000));

    this.catch("player.position.walked", e => e.getPlayer()).execute(event => {
      if (!canSeekerMove) { event.cancel() }
    });

    this.catch("player.murdered", e => e.getKiller()).execute(event => {
      if (!canSeekerMove) { event.cancel() }
      this.getImpostorButton()?.setCurrentTime(0);
    });

    this.getImpostorButton()?.setCurrentTime(0);
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
