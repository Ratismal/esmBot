import { manager, players, queues } from "../../utils/soundplayer.js";
import MusicCommand from "../../classes/musicCommand.js";

class StopCommand extends MusicCommand {
  async run() {
    if (!this.channel.guild) return "This command only works in servers!";
    if (!this.member.voiceState.channelID) return "You need to be in a voice channel first!";
    if (!this.channel.guild.members.get(this.client.user.id).voiceState.channelID) return "I'm not in a voice channel!";
    if (!this.connection) {
      await manager.leave(this.channel.guild.id);
      return "🔊 The current voice channel session has ended.";
    }
    if (this.connection.host !== this.author.id && !this.member.permissions.has("manageChannels")) return "Only the current voice session host can stop the music!";
    await manager.leave(this.channel.guild.id);
    const connection = this.connection.player;
    await connection.destroy();
    players.delete(this.channel.guild.id);
    queues.delete(this.channel.guild.id);
    return "🔊 The current voice channel session has ended.";
  }

  static description = "Stops the music";
  static aliases = ["disconnect"];
}

export default StopCommand;
