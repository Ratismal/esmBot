import type { Client } from "oceanic.js";
import { type QueueEntry, type SoundPlayer, players, queues } from "#utils/soundplayer.js";
import Command, { type CommandOptions } from "./command.js";
import type { DatabasePlugin } from "../database.js";

class MusicCommand extends Command {
  connection?: SoundPlayer;
  queue: QueueEntry[];
  constructor(client: Client, database: DatabasePlugin, options: CommandOptions) {
    super(client, database, options);
    if (this.guild) {
      this.connection = players.get(this.guild.id);
      this.queue = queues.get(this.guild.id) ?? [];
    } else {
      this.queue = [];
    }
  }

  static slashAllowed = false;
  static directAllowed = false;
  static userAllowed = false;
}

export default MusicCommand;
