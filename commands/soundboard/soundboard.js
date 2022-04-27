import { play } from "../../utils/soundplayer.js";
import Command from "../../classes/command.js";
import { sounds, info } from "../../utils/collections.js";

// all-in-one soundboard command
class SoundboardAIOCommand extends Command {
  async run() {
    const soundName = this.type === "classic" ? this.args[0] : this.optionsArray[0].name;
    if (!sounds.has(soundName)) return "You need to provide a sound to play!";
    const name = sounds.get(soundName);
    return await play(this.client, name, { channel: this.channel, member: this.member, type: this.type, interaction: this.interaction });
  }
  
  static postInit() {
    this.flags = [];
    for (const sound of sounds.keys()) {
      this.flags.push({
        name: sound,
        type: 1,
        description: info.get(sound).description
      });
    }
    return this;
  }

  static description = "Plays a sound effect";
  static requires = ["sound"];
  static aliases = ["sound", "sb"];
}

export default SoundboardAIOCommand;