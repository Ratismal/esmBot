import InteractionCollector from "./awaitinteractions.js";
import { ComponentInteraction } from "eris";

export default async (client, info, pages, timeout = 120000) => {
  const options = info.type === "classic" ? {
    messageReference: {
      channelID: info.channel.id,
      messageID: info.message.id,
      guildID: info.channel.guild ? info.channel.guild.id : undefined,
      failIfNotExists: false
    },
    allowedMentions: {
      repliedUser: false
    }
  } : {};
  let page = 0;
  const components = {
    components: [{
      type: 1,
      components: [
        {
          type: 2,
          label: "Back",
          emoji: {
            id: null,
            name: "◀"
          },
          style: 1,
          custom_id: "back"
        },
        {
          type: 2,
          label: "Forward",
          emoji: {
            id: null,
            name: "▶"
          },
          style: 1,
          custom_id: "forward"
        },
        {
          type: 2,
          label: "Jump",
          emoji: {
            id: null,
            name: "🔢"
          },
          style: 1,
          custom_id: "jump"
        },
        {
          type: 2,
          label: "Delete",
          emoji: {
            id: null,
            name: "🗑"
          },
          style: 4,
          custom_id: "delete"
        }
      ]
    }]
  };
  let currentPage;
  if (info.type === "classic") {
    currentPage = await client.createMessage(info.message.channel.id, Object.assign(pages[page], options, pages.length > 1 ? components : {}));
  } else {
    await info.interaction[info.interaction.acknowledged ? "editOriginalMessage" : "createMessage"](Object.assign(pages[page], pages.length > 1 ? components : {}));
    currentPage = await info.interaction.getOriginalMessage();
  }
  
  if (pages.length > 1) {
    const interactionCollector = new InteractionCollector(client, currentPage, ComponentInteraction, timeout);
    interactionCollector.on("interaction", async (interaction) => {
      if ((interaction.member ?? interaction.user).id === info.author.id) {
        switch (interaction.data.custom_id) {
          case "back":
            await interaction.deferUpdate();
            page = page > 0 ? --page : pages.length - 1;
            currentPage = await currentPage.edit(Object.assign(pages[page], options));
            interactionCollector.extend();
            break;
          case "forward":
            await interaction.deferUpdate();
            page = page + 1 < pages.length ? ++page : 0;
            currentPage = await currentPage.edit(Object.assign(pages[page], options));
            interactionCollector.extend();
            break;
          case "jump":
            await interaction.deferUpdate();
            var newComponents = JSON.parse(JSON.stringify(components));
            for (const index of newComponents.components[0].components.keys()) {
              newComponents.components[0].components[index].disabled = true;
            }
            currentPage = await currentPage.edit(newComponents);
            interactionCollector.extend();
            var jumpComponents = {
              components: [{
                type: 1,
                components: [{
                  type: 3,
                  custom_id: "seekDropdown",
                  placeholder: "Page Number",
                  options: []
                }]
              }]
            };
            for (let i = 0; i < pages.length && i < 25; i++) {
              const payload = {
                label: i + 1,
                value: i
              };
              jumpComponents.components[0].components[0].options[i] = payload;
            }
            var promise;
            if (info.type === "classic") {
              promise = client.createMessage(info.message.channel.id, Object.assign({ content: "What page do you want to jump to?" }, {
                messageReference: {
                  channelID: currentPage.channel.id,
                  messageID: currentPage.id,
                  guildID: currentPage.channel.guild ? currentPage.channel.guild.id : undefined,
                  failIfNotExists: false
                },
                allowedMentions: {
                  repliedUser: false
                }
              }, jumpComponents));
            } else {
              promise = info.interaction.createFollowup(Object.assign({ content: "What page do you want to jump to?" }, jumpComponents));
            }
            promise.then(askMessage => {
              const dropdownCollector = new InteractionCollector(client, askMessage, ComponentInteraction, timeout);
              let ended = false;
              dropdownCollector.on("interaction", async (response) => {
                if (response.data.custom_id !== "seekDropdown") return;
                try {
                  if (askMessage.channel.messages ? askMessage.channel.messages.has(askMessage.id) : await client.getMessage(askMessage.channel.id, askMessage.id).catch(() => undefined)) await askMessage.delete();
                } catch {
                  // no-op
                }
                page = Number(response.data.values[0]);
                currentPage = await currentPage.edit(Object.assign(pages[page], options, components));
                ended = true;
                dropdownCollector.stop();
              });
              dropdownCollector.once("end", async () => {
                if (ended) return;
                try {
                  if (askMessage.channel.messages ? askMessage.channel.messages.has(askMessage.id) : await client.getMessage(askMessage.channel.id, askMessage.id).catch(() => undefined)) await askMessage.delete();
                } catch {
                  // no-op
                }
                currentPage = await currentPage.edit(Object.assign(pages[page], options, components));
              });
            }).catch(error => {
              throw error;
            });
            break;
          case "delete":
            await interaction.deferUpdate();
            interactionCollector.emit("end", true);
            if (currentPage.channel.messages ? currentPage.channel.messages.has(currentPage.id) : await client.getMessage(currentPage.channel.id, currentPage.id).catch(() => undefined)) await currentPage.delete();
            return;
          default:
            break;
        }
      }
    });
    interactionCollector.once("end", async (deleted = false) => {
      interactionCollector.removeAllListeners("interaction");
      if (!deleted) {
        for (const index of components.components[0].components.keys()) {
          components.components[0].components[index].disabled = true;
        }
        if (currentPage.channel.messages ? currentPage.channel.messages.has(currentPage.id) : await client.getMessage(currentPage.channel.id, currentPage.id).catch(() => undefined)) {
          await currentPage.edit(components);
        }
      }
    });
  }
};
