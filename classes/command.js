import { Constants, Permission } from "oceanic.js";
import { getString } from "../utils/i18n.js";

class Command {
  /**
   * @param {import("oceanic.js").Client} client
   * @param {{ type: string; args: []; message: import("oceanic.js").Message; content: string; specialArgs: {}; interaction: import("oceanic.js").CommandInteraction }} options
   */
  constructor(client, options) {
    this.client = client;
    this.origOptions = options;
    this.type = options.type;
    this.args = options.args;
    this.success = true;
    this.edit = false;
    if (options.type === "classic") {
      this.message = options.message;
      this.locale = process.env.LOCALE ?? "en-US";
      this.cmdName = options.cmdName;
      this.channel = options.message.channel;
      this.guild = options.message.guild;
      this.author = options.message.author;
      this.member = options.message.member;
      this.permissions = this.channel?.permissionsOf?.(client.user.id) ?? new Permission(Constants.AllPermissions);
      this.memberPermissions = this.member?.permissions ?? new Permission(Constants.AllPermissions);
      this.content = options.content;
      this.options = options.specialArgs;
      this.reference = {
        messageReference: {
          channelID: this.message.channelID,
          messageID: this.message.id,
          guildID: this.message.guildID ?? undefined,
          failIfNotExists: false
        },
        allowedMentions: {
          repliedUser: false
        }
      };
    } else {
      this.interaction = options.interaction;
      this.locale = options.interaction.locale;
      this.cmdName = options.interaction.data.name;
      this.args = [];
      this.channel = options.interaction.channel ?? { id: options.interaction.channelID, guildID: options.interaction.guildID };
      if (!options.interaction.authorizingIntegrationOwners || options.interaction.authorizingIntegrationOwners[0] !== undefined) {
        this.guild = options.interaction.guild;
      } else {
        this.guild = null;
      }
      this.author = options.interaction.user;
      this.member = options.interaction.member;
      this.permissions = options.interaction.appPermissions;
      this.memberPermissions = options.interaction.memberPermissions ?? new Permission(Constants.AllPermissions);
      this.options = options.interaction.data.options.raw.reduce((obj, item) => {
        obj[item.name] = item.value;
        return obj;
      }, {});
    }
  }

  /**
   * The main command function.
   * @returns {Promise<string | import("oceanic.js").InteractionContent | import("oceanic.js").CreateMessageOptions | undefined>}
   */
  async run() {
    return "It works!";
  }

  async acknowledge() {
    if (this.type === "classic" && this.message) {
      const channel = this.channel ?? await this.client.rest.channels.get(this.message.channelID);
      await channel.sendTyping();
    }
  }

  /**
   * @param {string} key
   */
  getString(key, returnNull = false) {
    return getString(key, this.locale, returnNull);
  }

  static init() {
    return this;
  }

  static description = "No description found";
  static aliases = [];
  static flags = [];
  static ephemeral = false;
  static slashAllowed = true;
  static directAllowed = true;
  static userAllowed = true;
  static adminOnly = false;
}

export default Command;
