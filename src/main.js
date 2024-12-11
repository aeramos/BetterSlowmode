/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2020, 2021, 2022, 2024 Alejandro Ramos
 *
 * BetterSlowmode is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * BetterSlowmode is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with BetterSlowmode.  If not, see <https://www.gnu.org/licenses/>.
 */

import Discord from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/rest/v9";

import config from "../config/config.json" with { type: "json" };
import Database from "./Database.js";
import Help from "./Commands/Help.js";
import Info from "./Commands/Info.js";
import Remove from "./Commands/Remove.js";
import Reset from "./Commands/Reset.js";
import Set from "./Commands/Set.js";
import SetImage from "./Commands/SetImage.js";
import SetText from "./Commands/SetText.js";
import Status from "./Commands/Status.js";

const client = new Discord.Client({
    intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES],
    makeCache: Discord.Options.cacheWithLimits(Discord.Options.defaultMakeCacheSettings),
    sweepers: {
        ...Discord.Options.defaultSweeperSettings,
        messages: { // 30 second message cache
            lifetime: 30,
            interval: 60
        }
    }
});
let database;
let ready = false;

const prefix = config["default-prefix"];

let commands;
let helpCommand;

process.on("SIGINT", shutDownBot);
process.on("SIGTERM", shutDownBot);

client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);

    database = new Database(config["database-url"]);
    commands = [
        new Info(client.user.id, config["support-code"]),
        new Remove(client.user.id, database, subjectToSlowmode),
        new Reset(client.user.id, database, subjectToSlowmode),
        new Set(client.user.id, database, subjectToSlowmode),
        new SetImage(client.user.id, database, subjectToSlowmode),
        new SetText(client.user.id, database, subjectToSlowmode),
        new Status(client.user.id, database)
    ];
    helpCommand = new Help(client.user.id, commands);
    commands.splice(0, 0, helpCommand);

    return Promise.all([initializeDB(client, database), initializeSlashCommands(client, config, commands)]).then(() => {
        client.user.setActivity(prefix + "help for help!")
        ready = true;
        console.log("Bot is ready!");
    });
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild) {
        if (interaction.commandName !== "help" && interaction.commandName !== "info") {
            return interaction.reply({
                content: "This command can only be used in a server."
            });
        }
    }
    for (const command of commands) {
        if (command.getName() === interaction.commandName) {
            return command.slashCommand(interaction);
        }
    }
});

/**
 * Remove expired slowmodes and information about servers/channels we no longer have access to from the database.
 *
 * @param {Discord.Client} client
 * @param {Database} database
 * @returns {Promise<void>}
 */
async function initializeDB(client, database) {
    const serverIDs = Array.from(client.guilds.cache.keys());
    const channelIDs = Array.from(client.channels.cache.filter(channel => channel.type === "GUILD_TEXT").keys());

    await database.initialize();
    const [deleted, expired] = await database.sanitizeDatabase(serverIDs, channelIDs);
    console.log(`Init: Deleted channels: ${deleted}`);
    console.log(`Init: Expired slowmodes: ${expired}`);
}

/**
 * Register Discord slash commands using Command#getSlashCommand()
 *
 * @param {Discord.Client} client
 * @param {config} config
 * @param {[Command]} commands
 * @returns {Promise<void>}
 */
async function initializeSlashCommands(client, config, commands) {
    const slashCommands = [];
    for (const command of commands) {
        const slashCommand = command.getSlashCommand();
        slashCommand.name = command.getName();
        slashCommands.push(slashCommand);
    }
    const rest = new REST({ version: '9' }).setToken(config["bot-token"]);
    try {
        console.log("Reloading slash commands.");
        await rest.put(Routes.applicationCommands(client.user.id), { body : slashCommands });
        console.log("Successfully reloaded slash commands.");
    } catch (error) {
        console.log(error);
        shutDownBot("Slash command registration error.");
    }
}

function shutDownBot(signal) {
    console.log("Bot has received " + signal + ", shutting down.");
    database.shutDown().then(() => {
        console.log("Database shut down. Bot shutting down now!");

        client.destroy();
        process.exit(0);
    })
}

client.on("guildDelete", async (guild) => {
    if (!ready) {
        return;
    }

    await database.removeServer(guild.id);
});

client.on("channelDelete", async (channel) => {
    if (!ready) {
        return;
    }

    if (channel.type !== "GUILD_TEXT") {
        return; // we only manage guild text channels
    }
    await database.removeChannel(channel.id);
});

client.on("messageCreate", async (message) => {
    if (!ready) {
        return;
    }

    // don't respond to bots
    if (message.author.bot) {
        return;
    }
    // bot does not handle dm messages yet
    if (message.guild === null) {
        return;
    }

    const authorID = message.author.id;
    const channel = message.channel;
    const channelID = channel.id;
    const channelData = await database.getChannel(channelID);

    if (subjectToSlowmode(message.member, channel, channelData)) {
        // if both text and images, check slowmode. if just images + it has an image, check slowmode. if text + it has text, check slowmode.
        if (channelData.isBoth() || (channelData.isImage() && message.attachments.size > 0) || (channelData.isText() && message.content.length > 0)) {
            const messageTimestamp = message.createdTimestamp;
            const userTimestamp = channelData.getUserTime(authorID);

            if (userTimestamp === undefined || messageTimestamp >= userTimestamp + (channelData.getLength() * 1000)) {
                channelData.addUser(authorID, messageTimestamp);
                await database.setChannel(channelData);
            } else {
                if (!message.guild.members.me.permissionsIn(message.channel).has(Discord.Permissions.FLAGS.MANAGE_MESSAGES)) {
                    await sendMessage(message.channel, "Error: Could not delete message because BetterSlowmode does not have the \"Manage Messages\" permission in this channel." +
                        "\nBetterSlowmode needs the \"Manage Messages\" and \"Send Messages\" permissions to function." +
                        "\nIf you want to remove the slowmode, use: `@BetterSlowmode remove`. Use `@BetterSlowmode help` for help.");
                } else {
                    await message.delete().catch((e) => {
                        console.error("Error: Attempted to delete message that has already been deleted.");
                        console.error(e);
                    });
                }
                return;
            }
        }
    }

    // check if the message is directed at the bot using the prefix or the tag
    let tagUsed = true;
    let parameters = message.content;
    if (message.content.startsWith(prefix)) {
        parameters = parameters.substring(prefix.length)
        tagUsed = false;
    } else if (message.content.startsWith(`<@!${client.user.id}>`)) {
        parameters = parameters.substring(`<@!${client.user.id}>`.length);
    } else if (message.content.startsWith(`<@${client.user.id}>`)) {
        parameters = parameters.substring(`<@${client.user.id}>`.length);
    } else {
        return;
    }
    parameters = parameters.split(" ").filter(e => e !== "");
    for (const command of commands) {
        if (command.getName() === parameters[0]) {
            parameters.shift();
            await sendMessage(message.channel, await command.tagCommand(channelData, parameters, message))
            return;
        }
    }
    // don't want to just reply to anyone who uses the prefix. only reply to people who tag the bot specifically
    if (tagUsed) {
        await sendMessage(message.channel, await commands[0].tagCommand(channelData, [], message));
    }
});


/**
 * Wrapper around sending messages with the tag command that handles permissions and includes a fallback mode for when the bot can't send embeds.
 *
 * @param {Discord.TextChannel} channel The channel to send the message in.
 * @param {Discord.MessageOptions | string} message The message to send. If it contains embeds and the bot lacks permissions,
 * it will send the non-embed content (if it exists) and an information message that asks for the permission.
 * @returns {Promise<Discord.Message>} The sent message.
 */
async function sendMessage(channel, message) {
    if (channel.guild.members.me.permissionsIn(channel).has(Discord.Permissions.FLAGS.SEND_MESSAGES)) {
        if (message.embeds) {
            if (channel.guild.members.me.permissionsIn(channel).has(Discord.Permissions.FLAGS.EMBED_LINKS)) {
                message.content = undefined;
                return channel.send(message);
            } else {
                return channel.send(message.content +
                    "\n\nThis output usually uses embeds (special formatting), but BetterSlowmode does not have the \"Embed Links\" permission in this channel." +
                    " Please ask a moderator to grant the \"Embed Links\" permission to enable full functionality.!"
                );
            }
        } else {
            return channel.send(message);
        }
    }
}

/**
 * @param {Discord.GuildMember} member
 * @param {Discord.TextChannel} channel
 * @param {ChannelData} channelData
 * @returns {boolean} true if there is a slowmode in the channel and it applies to the given member
 */
function subjectToSlowmode(member, channel, channelData) {
    if (!channelData) return false;
    if (member.guild.ownerId === member.id) return false;
    if (channelData.includesUser(member.id)) return true;
    if (channelData.excludesUser(member.id)) return false;

    let highestIncludedRole;
    let highestExcludedRole;
    for (let role of member.roles.cache) {
        role = role[1];
        if (channelData.includesRole(role.id)) {
            if (highestIncludedRole === undefined || highestIncludedRole.comparePositionTo(role) < 0) {
                highestIncludedRole = role;
            }
        }
        if (channelData.excludesRole(role.id)) {
            if (highestExcludedRole === undefined || highestExcludedRole.comparePositionTo(role) < 0) {
                highestExcludedRole = role;
            }
        }
    }
    if (highestIncludedRole === undefined) {
        if (highestExcludedRole === undefined) {
            // only need to check the permissions in the slowed channel
            const permissions = member.permissionsIn(channel);
            return !(permissions.has(Discord.Permissions.FLAGS.MANAGE_MESSAGES) || permissions.has(Discord.Permissions.FLAGS.MANAGE_CHANNELS) || permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR));
        } else {
            return false;
        }
    } else {
        if (highestExcludedRole === undefined) {
            return true;
        } else {
            return highestIncludedRole.comparePositionTo(highestExcludedRole) > 0;
        }
    }
}

client.login(config["bot-token"]);
