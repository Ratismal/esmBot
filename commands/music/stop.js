import { leaveChannel, players, queues, skipVotes } from "../../utils/soundplayer.js";
import MusicCommand from "../../classes/musicCommand.js";

class StopCommand extends MusicCommand {
  async run() {
    this.success = false;
    if (!this.guild) return this.getString("guildOnly");
    if (!this.member?.voiceState) return this.getString("sound.noVoiceState");
    if (!this.guild.voiceStates.get(this.client.user.id)?.channelID) return this.getString("sound.notInVoice");
    if (this.connection?.host !== this.author.id && !this.memberPermissions.has("MANAGE_CHANNELS")) return "Only the current voice session host can stop the music!";
    players.delete(this.guild.id);
    queues.delete(this.guild.id);
    skipVotes.delete(this.guild.id);
    await leaveChannel(this.guild.id);
    this.success = true;
    return this.connection ? `🔊 The voice channel session in \`${this.connection.voiceChannel.name}\` has ended.` : "🔊 The current voice channel session has ended.";
  }

  static description = "Stops the music";
  static aliases = ["disconnect"];
}

export default StopCommand;
