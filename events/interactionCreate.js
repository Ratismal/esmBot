import database from "../utils/database.js";
import * as logger from "../utils/logger.js";
import { commands, messageCommands } from "../utils/collections.js";
import { clean } from "../utils/misc.js";
import { upload } from "../utils/tempimages.js";

// run when a slash command is executed
export default async (client, cluster, worker, ipc, interaction) => {
  if (interaction?.type !== 2) return;

  // check if command exists and if it's enabled
  const command = interaction.data.name;
  let cmd = commands.get(command);
  if (!cmd) {
    cmd = messageCommands.get(command);
    if (!cmd) return;
  }

  const invoker = interaction.member ?? interaction.user;

  // actually run the command
  logger.log("log", `${invoker.username} (${invoker.id}) ran application command ${command}`);
  try {
    await database.addCount(command);
    // eslint-disable-next-line no-unused-vars
    const commandClass = new cmd(client, cluster, worker, ipc, { type: "application", interaction });
    const result = await commandClass.run();
    const replyMethod = interaction.acknowledged ? "editOriginalMessage" : "createMessage";
    if (typeof result === "string") {
      await interaction[replyMethod]({
        content: result,
        flags: commandClass.success ? 0 : 64
      });
    } else if (typeof result === "object" && result.embeds) {
      await interaction[replyMethod](Object.assign(result, {
        flags: result.flags ?? (commandClass.success ? 0 : 64)
      }));
    } else if (typeof result === "object" && result.file) {
      const fileSize = 8388119;
      if (result.file.length > fileSize) {
        if (process.env.TEMPDIR && process.env.TEMPDIR !== "") {
          await upload(client, ipc, result, interaction, true);
        } else {
          await interaction[replyMethod]({
            content: "The resulting image was more than 8MB in size, so I can't upload it.",
            flags: 64
          });
        }
      } else {
        await interaction[replyMethod](result.text ? result.text : {}, result);
      }
    }
  } catch (error) {
    const replyMethod = interaction.acknowledged ? "editOriginalMessage" : "createMessage";
    if (error.toString().includes("Request entity too large")) {
      await interaction[replyMethod]({ content: "The resulting file was too large to upload. Try again with a smaller image if possible.", flags: 64 });
    } else if (error.toString().includes("Job ended prematurely")) {
      await interaction[replyMethod]({ content: "Something happened to the image servers before I could receive the image. Try running your command again.", flags: 64 });
    } else if (error.toString().includes("Timed out")) {
      await interaction[replyMethod]({ content: "The request timed out before I could download that image. Try uploading your image somewhere else or reducing its size.", flags: 64 });
    } else {
      logger.error(`Error occurred with application command ${command} with arguments ${JSON.stringify(interaction.data.options)}: ${error.stack || error}`);
      try {
        let err = error;
        if (error?.constructor?.name == "Promise") err = await error;
        await interaction[replyMethod]("Uh oh! I ran into an error while running this command. Please report the content of the attached file at the following link or on the esmBot Support server: <https://github.com/esmBot/esmBot/issues>", {
          file: `Message: ${clean(err)}\n\nStack Trace: ${clean(err.stack)}`,
          name: "error.txt"
        });
      } catch { /* silently ignore */ }
    }
  }
};
