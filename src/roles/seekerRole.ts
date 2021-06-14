import { Palette } from "@nodepolus/framework/src/static";
import { DeathReason } from "@nodepolus/framework/src/types/enums";
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

    this.catch("room.sabotaged", e => e.getPlayer()).execute(e => {
      e.cancel();
    });

    this.catch("player.position.walked", e => e.getPlayer()).execute(e => {
      if (!canSeekerMove) { e.cancel() }
    });

    this.catch("player.murdered", e => e.getKiller()).execute(e => {
      if (e.getReason() === DeathReason.Murder) {
        this.getImpostorButton()?.setMaxTime(0);
      }
    });

    this.getImpostorButton()?.setMaxTime(0);
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
      subtitle: "Hunt the hiders!",
      color: Palette.impostorRed(),
    };
  }
}
