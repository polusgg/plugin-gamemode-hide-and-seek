import { LobbyInstance } from "@nodepolus/framework/src/api/lobby/lobbyInstance";
import { PluginMetadata } from "@nodepolus/framework/src/api/plugin";
import { Palette } from "@nodepolus/framework/src/static";
import { Mutable } from "@nodepolus/framework/src/types";
import { GameState, Level } from "@nodepolus/framework/src/types/enums";
import { BaseMod } from "@polusgg/plugin-polusgg-api/src/baseMod/baseMod";
import { BaseRole, RoleAlignment } from "@polusgg/plugin-polusgg-api/src/baseRole/baseRole";
import { Impostor } from "@polusgg/plugin-polusgg-api/src/baseRole/impostor/impostor";
import { BooleanValue, EnumValue, NumberValue } from "@polusgg/plugin-polusgg-api/src/packets/root/setGameOption";
import { Services } from "@polusgg/plugin-polusgg-api/src/services";
import { RoleAssignmentData, RoleManagerService } from "@polusgg/plugin-polusgg-api/src/services/roleManager/roleManagerService";
import { Location, ServiceType } from "@polusgg/plugin-polusgg-api/src/types/enums";
import { HudItem } from "@polusgg/plugin-polusgg-api/src/types/enums/hudItem";
import { WinSoundType } from "@polusgg/plugin-polusgg-api/src/types/enums/winSound";
import { HiderRole } from "./src/roles/hiderRole";
import { SeekerRole } from "./src/roles/seekerRole";
import { HideAndSeekGameOptionCategories, HideAndSeekGameOptionNames } from "./src/types";

export type HideAndSeekGameOptions = {
  [HideAndSeekGameOptionNames.SeekerFreezeTime]: NumberValue;
  [HideAndSeekGameOptionNames.SeekerCloseDoors]: BooleanValue;
  [HideAndSeekGameOptionNames.HidersNamesVisibility]: EnumValue;
  //[HideAndSeekGameOptionNames.HidersColorLoss]: BooleanValue;
  [HideAndSeekGameOptionNames.HidersOpacity]: NumberValue;
  // [HideAndSeekGameOptionNames.GeneralStalemate]: NumberValue;
  [HideAndSeekGameOptionNames.GeneralChatAccess]: EnumValue;
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
  private readonly nameService = Services.get(ServiceType.Name);

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
        const level = event.getGame().getLobby().getLevel();

        event.getGame().getLobby().setMeta("pgg.hns.enableHidersLeftText", false);
        HideAndSeek.syncHidersCount(event.getGame().getLobby());
        await this.endGameService.registerExclusion(event.getGame(), { intentName: "impostorKill" });
        await this.endGameService.registerExclusion(event.getGame(), { intentName: "impostorDisconnected" });
        await this.endGameService.registerExclusion(event.getGame(), { intentName: "crewmateDisconnected" });
        await this.endGameService.registerExclusion(event.getGame(), { intentName: "crewmateTasks" });

        event.getGame().getLobby().getRealPlayers()
          .forEach(async player => {
            if (!player.isImpostor() && gameOptions.getOption(HideAndSeekGameOptionNames.HidersNamesVisibility).getValue().getSelected() === "Always") {
              await this.nameService.set(player, "");
            }
            await this.hudService.setHudVisibility(player, HudItem.ReportButton, false);
            await Services.get(ServiceType.Hud).setHudVisibility(player, HudItem.CallMeetingButton, false);
            await Services.get(ServiceType.Hud).setHudString(player, Location.MeetingButtonHudText, "If you see this text...\nSomething went horribly wrong.");
          });

        // 5 seconds is an average IntroCutscene load time
        let freezeTime = 5 + gameOptions.getOption(HideAndSeekGameOptionNames.SeekerFreezeTime).getValue().value;

        if (event.getGame().getLobby().getLevel() === Level.Airship) {
          freezeTime += 10;
        } else if (level === Level.Submerged) {
          return;
        }
        HideAndSeek.startSeekersFreeze(event.getGame().getLobby(), freezeTime);
      }
    });
    this.server.on("submerged.spawnIn", event => {
      if ((Services.get(ServiceType.GameOptions).getGameOptions(event.getGame().getLobby()).getOption("Gamemode")
        .getValue() as EnumValue).getSelected() === pluginMetadata.name) {
        const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions>(event.getGame().getLobby());
        const freezeTime = gameOptions.getOption(HideAndSeekGameOptionNames.SeekerFreezeTime).getValue().value;

        HideAndSeek.startSeekersFreeze(event.getGame().getLobby(), freezeTime);
      }
    });
    this.server.on("player.murdered", async event => {
      if ((Services.get(ServiceType.GameOptions).getGameOptions(event.getPlayer().getLobby()).getOption("Gamemode")
        .getValue() as EnumValue).getSelected() !== pluginMetadata.name || event.getPlayer().getLobby().getGameState() === GameState.NotStarted) { return }
      HideAndSeek.syncHidersCount(event.getPlayer().getLobby());

      if (event.getKiller().getMeta<BaseRole | undefined>("pgg.api.role")?.getAlignment() === RoleAlignment.Impostor && HideAndSeek.shouldEndGameSeekers(event.getPlayer().getLobby())) {
        await this.endGameService.registerEndGameIntent(event.getPlayer().getLobby().getGame()!, {
          endGameData: new Map(event.getPlayer().getLobby().getPlayers()
            .map(player => [player, {
              title: player.isImpostor() ? "Victory" : "<color=#FF1919FF>Defeat</color>",
              subtitle: "<color=#FF1919FF>Seekers</color> won by killing all hiders",
              color: Palette.impostorRed() as Mutable<[number, number, number, number]>,
              yourTeam: event.getPlayer()
                .getLobby()
                .getPlayers()
                .filter(sus => sus.isImpostor()),
              winSound: WinSoundType.ImpostorWin,
              hasWon: player.isImpostor(),
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
              title: !player.isImpostor() ? "Victory" : "<color=#FF1919FF>Defeat</color>",
              subtitle: "<color=#8CFFFFFF>Hiders</color> won by finishing all tasks",
              color: Palette.crewmateBlue() as Mutable<[number, number, number, number]>,
              yourTeam: event.getPlayer().getLobby().getPlayers()
                .filter(sus => sus.getMeta<BaseRole | undefined>("pgg.api.role")?.getAlignment() === RoleAlignment.Crewmate),
              winSound: WinSoundType.CrewmateWin,
              hasWon: !player.isImpostor(),
            }])),
          intentName: "hidersTasks",
        });
      }
    });

    this.server.on("player.left", event => {
      setTimeout(async () => {
        if ((Services.get(ServiceType.GameOptions).getGameOptions(event.getLobby()).getOption("Gamemode")
          .getValue() as EnumValue).getSelected() !== pluginMetadata.name || event.getPlayer().getLobby().getGameState() === GameState.NotStarted) { return }
        HideAndSeek.syncHidersCount(event.getLobby());

        if (event.getLobby().getRealPlayers().filter(p => p.isImpostor() && !p.isDead() && !p.getGameDataEntry().isDisconnected()).length === 0) {
          await this.endGameService.registerEndGameIntent(event.getPlayer().getLobby().getGame()!, {
            endGameData: new Map(event.getPlayer().getLobby().getPlayers()
              .map(player => [player, {
                title: "Victory",
                subtitle: "<color=#FF1919FF>Seekers</color> disconnected",
                color: Palette.crewmateBlue() as Mutable<[number, number, number, number]>,
                yourTeam: event.getLobby().getPlayers()
                  .filter(sus => sus.getMeta<BaseRole | undefined>("pgg.api.role")?.getAlignment() === RoleAlignment.Crewmate),
                winSound: WinSoundType.ImpostorWin,
                hasWon: !player.isImpostor(),
              }])),
            intentName: "seekersDisconnected",
          });
        } else if (HideAndSeek.shouldEndGameSeekers(event.getLobby())) {
          await this.endGameService.registerEndGameIntent(event.getPlayer().getLobby().getGame()!, {
            endGameData: new Map(event.getPlayer().getLobby().getPlayers()
              .map(player => [player, {
                title: player.isImpostor() ? "Victory" : "<color=#FF1919FF>Defeat</color>",
                subtitle: "<color=#8CFFFFFF>Hiders</color> disconnected",
                color: Palette.impostorRed() as Mutable<[number, number, number, number]>,
                yourTeam: event.getLobby().getPlayers()
                  .filter(sus => sus.isImpostor()),
                winSound: WinSoundType.CrewmateWin,
                hasWon: player.isImpostor(),
              }])),
            intentName: "hidersDisconnected",
          });
        }
      }, 500);
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

  static startSeekersFreeze(lobby: LobbyInstance, freezeTime: number): void {
    const hudService = Services.get(ServiceType.Hud);
    let timeElapsed = 0;
    const timeout = setInterval(() => {
      if (timeElapsed >= freezeTime) {
        lobby.getRealPlayers()
          .forEach(async player => {
            if (player.isImpostor()) {
              await (player.getMeta<BaseRole>("pgg.api.role") as Impostor).getImpostorButton()?.setCurrentTime(0);
              await player.setSpeedModifier(1);
              await player.setVisionModifier(1);
            }
            lobby.setMeta("pgg.hns.enableHidersLeftText", true);
            this.syncHidersCount(player.getLobby());
          });
        clearInterval(timeout);
      } else {
        lobby.getRealPlayers()
          .forEach(async player => {
            if (player.isImpostor()) {
              await hudService.setHudString(player, Location.RoomTracker, `You will be released in ${freezeTime - timeElapsed} second${(freezeTime - timeElapsed) === 1 ? "" : "s"}`);
            } else {
              await hudService.setHudString(player, Location.RoomTracker, `<color=#FF1919FF>Seeker${lobby.getRealPlayers()
                .filter(p => p.isImpostor()).length === 1
                ? ""
                : "s"}</color> will be released in ${freezeTime - timeElapsed} second${(freezeTime - timeElapsed) === 1 ? "" : "s"}`);
            }
          });
      }
      timeElapsed += 1;
    }, 1000);
  }

  static syncHidersCount(lobby: LobbyInstance): void {
    if (!lobby.getMeta<boolean>("pgg.hns.enableHidersLeftText")) {
      return;
    }

    const hidersLeft = lobby.getRealPlayers().filter(p => !p.isDead() && !p.getGameDataEntry().isDisconnected() && !p.isImpostor()).length;
    const hudService = Services.get(ServiceType.Hud);

    lobby.getRealPlayers().forEach(async player => {
      if (hidersLeft === 0) {
        await hudService.setHudString(player, Location.RoomTracker, "__unset");
      } else {
        await hudService.setHudString(player, Location.RoomTracker, `${hidersLeft} <color=#8cffff>Hider${hidersLeft === 1 ? "" : "s"}</color> left`);
      }
    });
  }

  getRoles(lobby: LobbyInstance): RoleAssignmentData[] {
    return [
      {
        role: HiderRole,
        playerCount: lobby.getRealPlayers().length - Math.min(lobby.getOptions().getImpostorCount(), RoleManagerService.adjustImpostorCount(lobby.getOptions().getImpostorCount())),
        assignWith: RoleAlignment.Crewmate,
      },
      {
        role: SeekerRole,
        playerCount: Math.min(lobby.getOptions().getImpostorCount(), RoleManagerService.adjustImpostorCount(lobby.getOptions().getImpostorCount())),
        assignWith: RoleAlignment.Impostor,
      },
    ];
  }

  async onEnable(lobby: LobbyInstance): Promise<void> {
    await super.onEnable(lobby);

    const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions>(lobby);

    await Promise.all([
      gameOptions.createOption(HideAndSeekGameOptionCategories.Seekers, HideAndSeekGameOptionNames.SeekerFreezeTime, new NumberValue(10, 2, 4, 20, false, "{0}s")),
      gameOptions.createOption(HideAndSeekGameOptionCategories.Seekers, HideAndSeekGameOptionNames.SeekerCloseDoors, new BooleanValue(true)),
      gameOptions.createOption(HideAndSeekGameOptionCategories.Hiders, HideAndSeekGameOptionNames.HidersNamesVisibility, new EnumValue(0, ["Never", "While Idle", "Always"])),
      //gameOptions.createOption(HideAndSeekGameOptionCategories.Hiders, HideAndSeekGameOptionNames.HidersColorLoss, new BooleanValue(false)),
      gameOptions.createOption(HideAndSeekGameOptionCategories.Hiders, HideAndSeekGameOptionNames.HidersOpacity, new NumberValue(15, 5, 10, 50, false, "{0}%")),
      // gameOptions.createOption(HideAndSeekGameOptionCategories.General, HideAndSeekGameOptionNames.GeneralStalemate, new NumberValue(0, 1, 0, 15, true, "{0} min")),
      gameOptions.createOption(HideAndSeekGameOptionCategories.General, HideAndSeekGameOptionNames.GeneralChatAccess, new EnumValue(0, ["No one", "Only Hiders", "Everyone"])),
    ]);
  }

  async onDisable(lobby: LobbyInstance): Promise<void> {
    super.onDisable(lobby);

    const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions>(lobby);

    await Promise.all(Object.values(HideAndSeekGameOptionNames).map(async option => await gameOptions.deleteOption(option)));
  }
}
