import Command from "../../classes/command.js";
import { commands, aliases, info, categories } from "../../utils/collections.js";

// all-in-one music command
class MusicAIOCommand extends Command {
  async run() {
    let cmd = this.type === "classic" ? this.args[0] : this.optionsArray[0].name;
    if (cmd === "music" || this.constructor.aliases.includes(cmd)) return "https://media.discordapp.net/attachments/322114245632327703/941958748874887178/robot_dance-trans.gif";
    if (this.type === "classic") {
      this.origOptions.args.shift();
    } else {
      this.origOptions.interaction.data.options = this.origOptions.interaction.data.options[0].options;
    }
    if (aliases.has(cmd)) cmd = aliases.get(cmd);
    if (commands.has(cmd) && info.get(cmd).category === "music") {
      const command = commands.get(cmd);
      return await (new command(this.client, this.cluster, this.worker, this.ipc, this.origOptions)).run();
    } else {
      return "That isn't a valid music command!";
    }
  }

  static postInit() {
    this.flags = [];
    for (const cmd of categories.get("music")) {
      if (cmd === "music") continue;
      const cmdInfo = info.get(cmd);
      this.flags.push({
        name: cmd,
        type: 1,
        description: cmdInfo.description,
        options: cmdInfo.flags
      });
    }
    return this;
  }

  static description = "Handles music playback";
  static requires = ["sound"];
  static aliases = ["m"];
  static directAllowed = false;
}

export default MusicAIOCommand;
