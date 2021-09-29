import { LobbyInstance } from "@nodepolus/framework/src/api/lobby/lobbyInstance";
import { PluginMetadata } from "@nodepolus/framework/src/api/plugin";
import { Player } from "@nodepolus/framework/src/player";
import { Palette } from "@nodepolus/framework/src/static";
import { Mutable } from "@nodepolus/framework/src/types";
import { GameState, Level } from "@nodepolus/framework/src/types/enums";
import { BaseMod } from "@polusgg/plugin-polusgg-api/src/baseMod/baseMod";
import { BaseRole, RoleAlignment } from "@polusgg/plugin-polusgg-api/src/baseRole/baseRole";
import { Impostor } from "@polusgg/plugin-polusgg-api/src/baseRole/impostor/impostor";
import { BooleanValue, EnumValue, NumberValue } from "@polusgg/plugin-polusgg-api/src/packets/root/setGameOption";
import { Services } from "@polusgg/plugin-polusgg-api/src/services";
import { LobbyDefaultOptions } from "@polusgg/plugin-polusgg-api/src/services/gameOptions/gameOptionsService";
import { GameOptionPriority } from "@polusgg/plugin-polusgg-api/src/services/gameOptions/gameOptionsSet";
import { RoleAssignmentData, RoleManagerService } from "@polusgg/plugin-polusgg-api/src/services/roleManager/roleManagerService";
import { Location, ServiceType } from "@polusgg/plugin-polusgg-api/src/types/enums";
import { HudItem } from "@polusgg/plugin-polusgg-api/src/types/enums/hudItem";
import { WinSoundType } from "@polusgg/plugin-polusgg-api/src/types/enums/winSound";
import { HiderRole } from "./src/roles/hiderRole";
import { SeekerRole } from "./src/roles/seekerRole";
import { HideAndSeekGameOptionCategories, HideAndSeekGameOptionNames } from "./src/types";

export type HideAndSeekGameOptions = {
  [HideAndSeekGameOptionNames.SeekerVision]: NumberValue;
  [HideAndSeekGameOptionNames.SeekerPlayerSpeed]: NumberValue;
  [HideAndSeekGameOptionNames.SeekerFreezeTime]: NumberValue;
  [HideAndSeekGameOptionNames.SeekerCloseDoors]: BooleanValue;
  [HideAndSeekGameOptionNames.SeekerKillDistance]: EnumValue;
  [HideAndSeekGameOptionNames.HidersVision]: NumberValue;
  [HideAndSeekGameOptionNames.HidersPlayerSpeed]: NumberValue;
  [HideAndSeekGameOptionNames.HidersNamesHidden]: EnumValue;
  //[HideAndSeekGameOptionNames.HidersColorLoss]: BooleanValue;
  [HideAndSeekGameOptionNames.HidersOpacity]: NumberValue;
  // [HideAndSeekGameOptionNames.GeneralStalemate]: NumberValue;
  [HideAndSeekGameOptionNames.GeneralChatAccess]: EnumValue;
  [HideAndSeekGameOptionNames.AllowAdminTable]: BooleanValue;
  [HideAndSeekGameOptionNames.GameDuration]: NumberValue;
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

  private gameDurationInterval!: NodeJS.Timeout;

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

    this.server.on("game.ended", () => {
      clearInterval(this.gameDurationInterval);
    });

    //#endregion cancels

    this.server.on("game.started", async event => {
      if ((Services.get(ServiceType.GameOptions).getGameOptions(event.getGame().getLobby()).getOption("Gamemode")
        .getValue() as EnumValue).getSelected() === pluginMetadata.name) {
        const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions>(event.getGame().getLobby());
        const level = event.getGame().getLobby().getLevel();

        event.getGame().getLobby().setMeta("pgg.hns.enableHidersLeftText", false);
        event.getGame().getLobby().getOptions().setKillDistance(gameOptions.getOption(HideAndSeekGameOptionNames.SeekerKillDistance).getValue().index);
        (event.getGame().getLobby().getPlayers()[0] as Player).getEntity().getPlayerControl().syncSettings(
          event.getGame().getLobby().getOptions()
        );
        this.syncHidersCount(event.getGame().getLobby());
        await this.endGameService.registerExclusion(event.getGame(), { intentName: "impostorKill" });
        await this.endGameService.registerExclusion(event.getGame(), { intentName: "impostorDisconnected" });
        await this.endGameService.registerExclusion(event.getGame(), { intentName: "crewmateDisconnected" });
        await this.endGameService.registerExclusion(event.getGame(), { intentName: "crewmateTasks" });

        event.getGame().getLobby().getRealPlayers()
          .forEach(async player => {
            if (!player.isImpostor()) {
              await player.setSpeedModifier(gameOptions.getOption(HideAndSeekGameOptionNames.HidersPlayerSpeed).getValue().value);
              await player.setVisionModifier(gameOptions.getOption(HideAndSeekGameOptionNames.HidersVision).getValue().value);

              if (gameOptions.getOption(HideAndSeekGameOptionNames.HidersNamesHidden).getValue().getSelected() === "Always") {
                await this.nameService.set(player, "");
              }
            }
            await this.hudService.setHudVisibility(player, HudItem.ReportButton, false);
            await Services.get(ServiceType.Hud).setHudVisibility(player, HudItem.CallMeetingButton, false);
            await Services.get(ServiceType.Hud).setHudString(player, Location.MeetingButtonHudText, "If you see this text...\nSomething went horribly wrong.");
            if (!gameOptions.getOption(HideAndSeekGameOptionNames.AllowAdminTable).getValue().value) {
              await Services.get(ServiceType.Hud).setHudVisibility(player, HudItem.AdminTable, false);
            }
          });

        // 5 seconds is an average IntroCutscene load time
        let freezeTime = 5 + gameOptions.getOption(HideAndSeekGameOptionNames.SeekerFreezeTime).getValue().value;

        if (event.getGame().getLobby().getLevel() === Level.Airship) {
          freezeTime += 10;
        } else if (level === Level.Submerged) {
          return;
        }
        this.startSeekersFreeze(event.getGame().getLobby(), freezeTime);
      }
    });
    this.server.on("submerged.spawnIn", event => {
      if ((Services.get(ServiceType.GameOptions).getGameOptions(event.getGame().getLobby()).getOption("Gamemode")
        .getValue() as EnumValue).getSelected() === pluginMetadata.name) {
        const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions>(event.getGame().getLobby());
        const freezeTime = gameOptions.getOption(HideAndSeekGameOptionNames.SeekerFreezeTime).getValue().value;

        this.startSeekersFreeze(event.getGame().getLobby(), freezeTime);
      }
    });
    this.server.on("player.murdered", async event => {
      if ((Services.get(ServiceType.GameOptions).getGameOptions(event.getPlayer().getLobby()).getOption("Gamemode")
        .getValue() as EnumValue).getSelected() !== pluginMetadata.name || event.getPlayer().getLobby().getGameState() === GameState.NotStarted) { return }
      this.syncHidersCount(event.getPlayer().getLobby());

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
        this.syncHidersCount(event.getLobby());

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

  startSeekersFreeze(lobby: LobbyInstance, freezeTime: number): void {
    const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions>(lobby);

    const hudService = Services.get(ServiceType.Hud);
    let timeElapsed = 0;
    const timeout = setInterval(() => {
      if (timeElapsed >= freezeTime) {
        lobby.getRealPlayers()
          .forEach(async player => {
            if (player.isImpostor()) {
              await (player.getMeta<BaseRole>("pgg.api.role") as Impostor).getImpostorButton()?.setCurrentTime(0);
              await player.setSpeedModifier(gameOptions.getOption(HideAndSeekGameOptionNames.SeekerPlayerSpeed).getValue().value);
              await player.setVisionModifier(gameOptions.getOption(HideAndSeekGameOptionNames.SeekerVision).getValue().value);
            }
            lobby.setMeta("pgg.hns.enableHidersLeftText", true);
            this.syncHidersCount(player.getLobby());
          });
        const gameDuration = gameOptions.getOption(HideAndSeekGameOptionNames.GameDuration).getValue().value;
        if (gameDuration > 0) {
          const dateStarted = Date.now();
          this.gameDurationInterval = setInterval(() => {
            const msPassed = Date.now() - dateStarted;
            if (msPassed >= (gameDuration * 60000)) {
              this.endGameService.registerEndGameIntent(
                lobby.getGame()!,
                {
                  endGameData: new Map(
                    lobby.getPlayers()
                    .map(player => [player, {
                      title: "<color=#969696>Stalemate</color>",
                      subtitle: "No one completed their objective in time",
                      color: Palette.halfWhite() as Mutable<[ number, number, number, number ]>,
                      yourTeam: lobby
                        .getPlayers()
                        .filter(sus => player.isImpostor() === sus.isImpostor()),
                      winSound: WinSoundType.ImpostorWin,
                      hasWon: false
                    }])
                  ),
                  intentName: "stalemate"
                }
              )
            } else {
              const msLeft = (gameDuration * 60000) - msPassed;
              const minutesLeft = Math.ceil(msLeft / 60000);
              const secondsLeft = Math.floor(msLeft / 1000);

              if (minutesLeft > 1) {
                for (const player of lobby.getPlayers()) {
                  Services.get(ServiceType.Hud).setHudString(player, Location.TaskText, player.getMeta<BaseRole>("pgg.api.role").getDescriptionText() + "\n" + minutesLeft + " minutes remaining");
                }
              } else {
                for (const player of lobby.getPlayers()) {
                  Services.get(ServiceType.Hud).setHudString(player, Location.TaskText, player.getMeta<BaseRole>("pgg.api.role").getDescriptionText() + "\n" + secondsLeft + " second" + (secondsLeft === 1 ? "" : "s") + " remaining");
                }
              }
            }
          }, 1000);
        }
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

  syncHidersCount(lobby: LobbyInstance): void {
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
    const adjustedImpostors = RoleManagerService.adjustImpostorCount(lobby.getPlayers().length);
    const minimumImpostors = Math.min(adjustedImpostors, lobby.getOptions().getImpostorCount());

    return [
      {
        role: HiderRole,
        playerCount: lobby.getPlayers().length - minimumImpostors,
        assignWith: RoleAlignment.Crewmate,
      },
      {
        role: SeekerRole,
        playerCount: minimumImpostors,
        assignWith: RoleAlignment.Impostor,
      },
    ];
  }

  async onEnable(lobby: LobbyInstance): Promise<void> {
    await super.onEnable(lobby);

    const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions & LobbyDefaultOptions>(lobby);

    setTimeout(async () => {
      await Promise.all<any>([
        gameOptions.createOption(HideAndSeekGameOptionCategories.Seekers, HideAndSeekGameOptionNames.SeekerPlayerSpeed, new NumberValue(1, 0.25, 0.25, 3, false, "{0}x")),
        gameOptions.createOption(HideAndSeekGameOptionCategories.Seekers, HideAndSeekGameOptionNames.SeekerVision, new NumberValue(1, 0.25, 0.25, 3, false, "{0}x")),
        gameOptions.createOption(HideAndSeekGameOptionCategories.Seekers, HideAndSeekGameOptionNames.SeekerFreezeTime, new NumberValue(10, 2, 4, 20, false, "{0}s")),
        gameOptions.createOption(HideAndSeekGameOptionCategories.Seekers, HideAndSeekGameOptionNames.SeekerCloseDoors, new BooleanValue(true)),
        gameOptions.createOption(HideAndSeekGameOptionCategories.Seekers, HideAndSeekGameOptionNames.SeekerKillDistance, new EnumValue(0, ["Short", "Normal", "Long"])),
        gameOptions.createOption(HideAndSeekGameOptionCategories.Hiders, HideAndSeekGameOptionNames.HidersPlayerSpeed, new NumberValue(1, 0.25, 0.25, 3, false, "{0}x")),
        gameOptions.createOption(HideAndSeekGameOptionCategories.Hiders, HideAndSeekGameOptionNames.HidersVision, new NumberValue(1, 0.25, 0.25, 3, false, "{0}x")),
        gameOptions.createOption(HideAndSeekGameOptionCategories.Hiders, HideAndSeekGameOptionNames.HidersNamesHidden, new EnumValue(0, ["Never", "While Idle", "Always"])),
        //gameOptions.createOption(HideAndSeekGameOptionCategories.Hiders, HideAndSeekGameOptionNames.HidersColorLoss, new BooleanValue(false)),
        gameOptions.createOption(HideAndSeekGameOptionCategories.Hiders, HideAndSeekGameOptionNames.HidersOpacity, new NumberValue(15, 5, 10, 50, false, "{0}%")),
        gameOptions.createOption(HideAndSeekGameOptionCategories.General, HideAndSeekGameOptionNames.GeneralChatAccess, new EnumValue(0, ["Off", "Only Hiders", "Everyone"])),
        gameOptions.createOption(HideAndSeekGameOptionCategories.General, HideAndSeekGameOptionNames.AllowAdminTable, new BooleanValue(false)),
        gameOptions.createOption(HideAndSeekGameOptionCategories.General, HideAndSeekGameOptionNames.GameDuration, new NumberValue(0, 1, 0, 15, true, "{0}m")),
        gameOptions.deleteOption("<color=#ff1919>Impostor</color> Vision"),
        gameOptions.deleteOption("<color=#8cffff>Crewmate</color> Vision"),
        gameOptions.deleteOption("<color=#ff1919>Impostor</color> Kill Distance"),
        gameOptions.deleteOption("Player Speed"),
        gameOptions.deleteOption("Anonymous Votes"),
        gameOptions.deleteOption("Confirm Ejects"),
        gameOptions.deleteOption("Emergency Cooldown"),
        gameOptions.deleteOption("Emergency Meetings"),
        gameOptions.deleteOption("Discussion Time"),
        gameOptions.deleteOption("Voting Time"),
        gameOptions.deleteOption("<color=#ff1919>Impostor</color> Kill Cooldown")
      ]);
    }, 100);
  }

  async onDisable(lobby: LobbyInstance): Promise<void> {
    super.onDisable(lobby);

    const gameOptions = Services.get(ServiceType.GameOptions).getGameOptions<HideAndSeekGameOptions & LobbyDefaultOptions>(lobby);

    gameOptions.createOption("", "Player Speed", new NumberValue(1, 0.25, 0.25, 3, false, "{0}x"), GameOptionPriority.Highest + 4);
    gameOptions.createOption("Meeting Settings", "Anonymous Votes", new BooleanValue(false), GameOptionPriority.Higher - 10);
    gameOptions.createOption("Meeting Settings", "Confirm Ejects", new BooleanValue(false), GameOptionPriority.Higher - 9);
    gameOptions.createOption("Meeting Settings", "Emergency Cooldown", new NumberValue(15, 5, 0, 60, false, "{0}s"), GameOptionPriority.Higher - 8);
    gameOptions.createOption("Meeting Settings", "Emergency Meetings", new NumberValue(1, 1, 0, 9, false, "{0} Buttons"), GameOptionPriority.Higher - 8)
    gameOptions.createOption("Meeting Settings", "Discussion Time", new NumberValue(30, 15, 0, 300, false, "{0}s"), GameOptionPriority.Higher - 7);
    gameOptions.createOption("Meeting Settings", "Voting Time", new NumberValue(30, 30, 0, 300, true, "{0}s"), GameOptionPriority.Higher - 7);;
    gameOptions.createOption("Role Settings", "<color=#8cffff>Crewmate</color> Vision", new NumberValue(1, 0.25, 0.25, 3, false, "{0}x"), GameOptionPriority.Normal - 5);
    gameOptions.createOption("Role Settings", "<color=#ff1919>Impostor</color> Vision", new NumberValue(1, 0.25, 0.25, 3, false, "{0}x"), GameOptionPriority.Normal - 5);
    gameOptions.createOption("Role Settings", "<color=#ff1919>Impostor</color> Kill Distance", new EnumValue(0, ["Short", "Normal", "Long"]), GameOptionPriority.Normal - 4);
    gameOptions.createOption("Role Settings", "<color=#ff1919>Impostor</color> Kill Cooldown", new NumberValue(10, 2.5, 5, 60, false, "{0}s"), GameOptionPriority.Normal - 4);

    await Promise.all(Object.values(HideAndSeekGameOptionNames).map(async option => await gameOptions.deleteOption(option)));
  }
}
