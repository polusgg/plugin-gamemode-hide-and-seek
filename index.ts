import { PluginMetadata } from "@nodepolus/framework/src/api/plugin";
import { BaseMod } from "@polusgg/plugin-polusgg-api/src/baseMod/baseMod";

const pluginMetadata: PluginMetadata = {
  name: "Hide and seek",
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
    }
  ],
  description: "Hide and seek plugin for polus.gg",
  website: "https://polus.gg",
};

export default class HideAndSeek extends BaseMod {
  constructor() {
    super(pluginMetadata);
  }

  getEnabled(): boolean {
    return true;
  }
}
