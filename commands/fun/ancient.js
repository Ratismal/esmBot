import { request } from "undici";
import Command from "../../classes/command.js";

class AncientCommand extends Command {
  async run() {
    await this.acknowledge();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);
    try {
      const data = await request("https://projectlounge.pw/meme/", { method: "HEAD", signal: controller.signal });
      clearTimeout(timeout);
      return data.headers.location;
    } catch (e) {
      if (e.name === "AbortError") {
        this.success = false;
        return "I couldn't get a meme in time. Maybe try again?";
      }
    } 
  }

  static description = "Gets a random ancient meme";
  static aliases = ["old", "oldmeme", "badmeme"];
}

export default AncientCommand;