import type { Client, Guild } from "oceanic.js";
import { info } from "../utils/logger.js";
import type { DatabasePlugin } from "../database.js";

// run when the bot is removed from a guild
export default async (_client: Client, _db: DatabasePlugin | undefined, guild: Guild) => {
  info(`[GUILD LEAVE] ${guild.name} (${guild.id}) removed the bot.`);
};
