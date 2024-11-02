import { queues } from "../../utils/soundplayer.js";
import MusicCommand from "../../classes/musicCommand.js";

class RemoveCommand extends MusicCommand {
  async run() {
    this.success = false;
    if (!this.guild) return this.getString("guildOnly");
    if (!this.member?.voiceState) return this.getString("sound.noVoiceState");
    if (!this.guild.voiceStates.get(this.client.user.id)?.channelID) return this.getString("sound.notInVoice");
    if (!this.connection) return this.getString("sound.noConnection");
    if (this.connection.host !== this.author.id && !process.env.OWNER.split(",").includes(this.connection.host)) return "Only the current voice session host can remove songs from the queue!";
    const pos = Number.parseInt(this.options.position ?? this.args[0]);
    if (Number.isNaN(pos) || pos > this.queue.length || pos < 1) return "That's not a valid position!";
    const removed = this.queue.splice(pos, 1);
    if (removed.length === 0) return "That's not a valid position!";
    const track = await this.connection.player.node.rest.decode(removed[0]);
    queues.set(this.guild.id, this.queue);
    this.success = true;
    return `🔊 The song \`${track?.info.title ? track.info.title : "(blank)"}\` has been removed from the queue.`;
  }

  static flags = [{
    name: "position",
    type: 4,
    description: "The queue position you want to remove",
    minValue: 1,
    required: true,
    classic: true
  }];
  static description = "Removes a song from the queue";
  static aliases = ["rm"];
}

export default RemoveCommand;
