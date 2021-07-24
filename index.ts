import { LobbyInstance } from "@nodepolus/framework/src/api/lobby/lobbyInstance";
import { PluginMetadata } from "@nodepolus/framework/src/api/plugin";
import { Palette } from "@nodepolus/framework/src/static";
import { Mutable } from "@nodepolus/framework/src/types";
import { GameState } from "@nodepolus/framework/src/types/enums";
import { BaseMod } from "@polusgg/plugin-polusgg-api/src/baseMod/baseMod";
import { BaseRole, RoleAlignment } from "@polusgg/plugin-polusgg-api/src/baseRole/baseRole";
import { EnumValue, NumberValue } from "@polusgg/plugin-polusgg-api/src/packets/root/setGameOption";
import { Services } from "@polusgg/plugin-polusgg-api/src/services";
import { RoleAssignmentData } from "@polusgg/plugin-polusgg-api/src/services/roleManager/roleManagerService";
import { Location, ServiceType } from "@polusgg/plugin-polusgg-api/src/types/enums";
import { WinSoundType } from "@polusgg/plugin-polusgg-api/src/types/enums/winSound";
import { HiderRole } from "./src/roles/hiderRole";
import { SeekerRole } from "./src/roles/seekerRole";
import { HideAndSeekGameOptionCategories, HideAndSeekGameOptionNames } from "./src/types";

export type HideAndSeekGameOptions = {
  [HideAndSeekGameOptionNames.SeekerFreezeTime]: NumberValue;
};

const pluginMetadata: PluginMetadata = {
  name: "Hide and Seek",
  version: [1, 0, 0],
  authors: [
    {
      name: "Polus.gg",
      email: "contact@polus.gg",
      website: "https://polus.gg",
    },
    {
      name: "Jan Przebor",
      email: "przebot@polus.gg",
      website: "https://polus.gg",
    },
  ],
  description: "Hide and seek plugin for polus.gg",
  website: "https://polus.gg",
};

export default class HideAndSeek extends BaseMod {
  private readonly hudService = Services.get(ServiceType.Hud);
  private readonly endGameService = Services.get(ServiceType.EndGame);
  private hidersLeft = 0;

  constructor() {
    super(pluginMetadata);

    //#region cancels
    this.server.on("room.sabotaged", event => {
      if ((Services.get(ServiceType.GameOptions).getGameOptions(event.getGame().getLobby()).getOption("Gamemode")
        .getValue() as EnumValue).getSelected() === pluginMetadata.name) {
        event.cancel();
      }
    });

    this.server.on("meeting.started", event => {
      if ((Services.get(ServiceType.GameOptions).getGameOptions(event.getGame().getLobby()).getOption("Gamemode")
        .getValue() as EnumValue).getSelected() === pluginMetadata.name) {
        event.cancel();
      }
    });

    //#endregion cancels

    this.server.on("game.started", async event => {
      if ((Services.get(ServiceType.GameOptions).getGameOptions(event.getGame().getLobby()).getOption("Gamemode")
        .getValue() as EnumValue).getSelected() === pluginMetadata.name) {
        const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions>(event.getGame().getLobby());

        await this.syncHidersCount(event.getGame().getLobby());
        await this.endGameService.registerExclusion(event.getGame(), { intentName: "impostorKill" });
        await this.endGameService.registerExclusion(event.getGame(), { intentName: "impostorDisconnected" });
        await this.endGameService.registerExclusion(event.getGame(), { intentName: "crewmateDisconnected" });
        await this.endGameService.registerExclusion(event.getGame(), { intentName: "crewmateTasks" });

        // 5 seconds is an average IntroCutscene load time
        const freezeTime = 5 + gameOptions.getOption(HideAndSeekGameOptionNames.SeekerFreezeTime).getValue().value;
        let timeElapsed = 0;
        const timeout = setInterval(() => {
          if (timeElapsed >= freezeTime) {
            event.getGame().getLobby().getRealPlayers()
              .forEach(player => {
                if (player.isImpostor()) {
                  player.setSpeedModifier(1);
                  player.setVisionModifier(1);
                }
                this.hudService.setHudString(player, Location.RoomTracker, "__unset");
              });
            clearInterval(timeout);
          } else {
            event.getGame().getLobby().getRealPlayers()
              .forEach(player => {
                if (player.isImpostor()) {
                  this.hudService.setHudString(player, Location.RoomTracker, `You will be released in ${freezeTime - timeElapsed} second${(freezeTime - timeElapsed) === 1 ? "" : "s"}`);
                } else {
                  this.hudService.setHudString(player, Location.RoomTracker, `<color=#FF1919FF>Seeker${event.getGame().getLobby().getRealPlayers()
                    .filter(p => p.isImpostor()).length === 1
                    ? ""
                    : "s"}</color> will be released in ${freezeTime - timeElapsed} second${(freezeTime - timeElapsed) === 1 ? "" : "s"}`);
                }
              });
          }
          timeElapsed += 1;
        }, 1000);
      }
    });

    this.server.on("player.murdered", async event => {
      if ((Services.get(ServiceType.GameOptions).getGameOptions(event.getPlayer().getLobby()).getOption("Gamemode")
        .getValue() as EnumValue).getSelected() !== pluginMetadata.name || event.getPlayer().getLobby().getGameState() === GameState.NotStarted) { return }
      await this.syncHidersCount(event.getPlayer().getLobby());

      if (event.getKiller().getMeta<BaseRole | undefined>("pgg.api.role")?.getAlignment() === RoleAlignment.Impostor && HideAndSeek.shouldEndGameSeekers(event.getPlayer().getLobby())) {
        this.endGameService.registerEndGameIntent(event.getPlayer().getLobby().getGame()!, {
          endGameData: new Map(event.getPlayer().getLobby().getPlayers()
            .map(player => [player, {
              title: player.isImpostor() ? "Victory" : "Defeat",
              subtitle: "<color=#FF1919FF>Seekers</color> won by killing all hiders",
              color: Palette.impostorRed() as Mutable<[number, number, number, number]>,
              yourTeam: event.getPlayer()
                .getLobby()
                .getPlayers()
                .filter(sus => sus.isImpostor()),
              winSound: WinSoundType.ImpostorWin,
            }])),
          intentName: "seekersKill",
        });
      }
    });

    this.server.on("player.task.completed", event => {
      if ((Services.get(ServiceType.GameOptions).getGameOptions(event.getPlayer().getLobby()).getOption("Gamemode")
        .getValue() as EnumValue).getSelected() !== pluginMetadata.name || event.getPlayer().getLobby().getGameState() === GameState.NotStarted) { return }

      if (event.getPlayer().getLobby().getPlayers()
        .filter(player => player.getMeta<BaseRole | undefined>("pgg.api.role")?.getAlignment() === RoleAlignment.Crewmate)
        .filter(player => !player.getLobby().getGameData()?.getGameData()
          .getSafePlayer(player.getId())
          .isDoneWithTasks(),
        ).length == 0) {
        this.endGameService.registerEndGameIntent(event.getPlayer().getLobby().getGame()!, {
          endGameData: new Map(event.getPlayer().getLobby().getPlayers()
            .map(player => [player, {
              title: player.getMeta<BaseRole | undefined>("pgg.api.role")?.getAlignment() === RoleAlignment.Crewmate ? "Victory" : "Defeat",
              subtitle: "<color=#8CFFFFFF>Hiders</color> won by finishing all tasks",
              color: Palette.crewmateBlue() as Mutable<[number, number, number, number]>,
              yourTeam: event.getPlayer().getLobby().getPlayers()
                .filter(sus => sus.getMeta<BaseRole | undefined>("pgg.api.role")?.getAlignment() === RoleAlignment.Crewmate),
              winSound: WinSoundType.CrewmateWin,
            }])),
          intentName: "hidersTasks",
        });
      }
    });

    this.server.on("player.left", async event => {
      if ((Services.get(ServiceType.GameOptions).getGameOptions(event.getLobby()).getOption("Gamemode")
        .getValue() as EnumValue).getSelected() !== pluginMetadata.name || event.getPlayer().getLobby().getGameState() === GameState.NotStarted) { return }
      await this.syncHidersCount(event.getLobby());

      if (event.getLobby().getRealPlayers().filter(p => p.isImpostor() && !p.isDead() && !p.getGameDataEntry().isDisconnected()).length === 0) {
        this.endGameService.registerEndGameIntent(event.getPlayer().getLobby().getGame()!, {
          endGameData: new Map(event.getPlayer().getLobby().getPlayers()
            .map(player => [player, {
              title: player.isImpostor() ? "Defeat" : "Victory",
              subtitle: "<color=#FF1919FF>Seekers</color> disconnected",
              color: Palette.crewmateBlue() as Mutable<[number, number, number, number]>,
              yourTeam: event.getLobby().getPlayers()
                .filter(sus => sus.getMeta<BaseRole | undefined>("pgg.api.role")?.getAlignment() === RoleAlignment.Crewmate),
              winSound: WinSoundType.ImpostorWin,
            }])),
          intentName: "seekersDisconnected",
        });
      } else if (HideAndSeek.shouldEndGameSeekers(event.getLobby())) {
        this.endGameService.registerEndGameIntent(event.getPlayer().getLobby().getGame()!, {
          endGameData: new Map(event.getPlayer().getLobby().getPlayers()
            .map(player => [player, {
              title: player.isImpostor() ? "Victory" : "Defeat",
              subtitle: "<color=#8CFFFFFF>Hiders</color> disconnected",
              color: Palette.impostorRed() as Mutable<[number, number, number, number]>,
              yourTeam: event.getLobby().getPlayers()
                .filter(sus => sus.getMeta<BaseRole | undefined>("pgg.api.role")?.getAlignment() === RoleAlignment.Impostor),
              winSound: WinSoundType.CrewmateWin,
            }])),
          intentName: "hidersDisconnected",
        });
      }
    });
  }

  static shouldEndGameSeekers(lobby: LobbyInstance): boolean {
    if (lobby.getGameState() == GameState.NotStarted) {
      return false;
    }

    const players = lobby.getPlayers();

    const aliveHiders = players.filter(p => p.getMeta<BaseRole | undefined>("pgg.api.role")?.getAlignment() === RoleAlignment.Crewmate && !p.isDead() && !p.getGameDataEntry().isDisconnected());

    return aliveHiders.length === 0;
  }

  getRoles(lobby: LobbyInstance): RoleAssignmentData[] {
    return [
      {
        role: HiderRole,
        playerCount: lobby.getRealPlayers().length - lobby.getOptions().getImpostorCount(),
        assignWith: RoleAlignment.Crewmate,
      },
      {
        role: SeekerRole,
        playerCount: lobby.getOptions().getImpostorCount(),
        assignWith: RoleAlignment.Impostor,
      },
    ];
  }

  async syncHidersCount(lobby: LobbyInstance): Promise<void> {
    this.hidersLeft = lobby.getRealPlayers().filter(p => !p.isDead() && !p.getGameDataEntry().isDisconnected() && p.getMeta<BaseRole | undefined>("pgg.api.role")?.getAlignment() === RoleAlignment.Crewmate).length;
    await lobby.getRealPlayers().forEach(async player => {
      if (this.hidersLeft === 0) {
        await this.hudService.setHudString(player, Location.PingTracker, "__unset");
      } else {
        await this.hudService.setHudString(player, Location.PingTracker, `Ping: %s ms\nThere ${this.hidersLeft === 1 ? "is" : "are"} ${this.hidersLeft} hider${this.hidersLeft === 1 ? "" : "s"} left`);
      }
    });
  }

  async onEnable(lobby: LobbyInstance): Promise<void> {
    await super.onEnable(lobby);

    const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions>(lobby);

    await Promise.all([
      gameOptions.createOption(HideAndSeekGameOptionCategories.Config, HideAndSeekGameOptionNames.SeekerFreezeTime, new NumberValue(10, 2, 4, 20, false, "{0}s")),
    ]);
  }

  async onDisable(lobby: LobbyInstance): Promise<void> {
    super.onDisable(lobby);

    const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions>(lobby);

    await Promise.all(Object.values(HideAndSeekGameOptionNames).map(async option => await gameOptions.deleteOption(option)));
  }
}
