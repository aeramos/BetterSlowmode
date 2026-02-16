/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2020, 2021, 2022, 2024, 2026 Alejandro Ramos
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

import * as Discord from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/rest/v9";

import config from "./Config.js";

import Database from "./Database.js";
import Command from "./Commands/Command.js";
import Help from "./Commands/Help.js";
import Info from "./Commands/Info.js";
import Remove from "./Commands/Remove.js";
import Reset from "./Commands/Reset.js";
import Set from "./Commands/Set.js";
import SetImage from "./Commands/SetImage.js";
import SetText from "./Commands/SetText.js";
import Status from "./Commands/Status.js";

const client: Discord.Client = new Discord.Client({
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

const prefix: string | undefined = config.prefix;

/**
 * Indicates if the client is ready, the database is connected and cleaned, and the slash commands are registered.
 */
let ready: boolean = false;

let database: Database;
let commands: Command[];
let helpCommand: Help;

/**
 * Set up the Commands, connect to and clean the database, and register the slash commands.
 *
 * @param client
 */
async function onReady(client: Discord.Client<true>): Promise<void> {
    console.log(`Logged in as ${client.user.tag}`);

    database = new Database(config.databaseURL);
    commands = [
        new Info(client.user.id, config.supportCode),
        new Remove(client.user.id, database),
        new Reset(client.user.id, database),
        new Set(client.user.id, database),
        new SetImage(client.user.id, database),
        new SetText(client.user.id, database),
        new Status(client.user.id, database)
    ];
    helpCommand = new Help(client.user.id, commands);
    commands.splice(0, 0, helpCommand); // put help first so it appears first when the user lists the commands

    return Promise.all([initializeDB(client, database), initializeSlashCommands(client, config.botToken, commands)]).then(() => {
        if (prefix) {
            client.user.setActivity(prefix + "help for help!");
        } else {
            client.user.setActivity("/help for help!");
        }
        ready = true;
        client = client as Discord.Client<true>;
        console.log("Bot is ready!");
    });
}

/**
 * @param interaction
 */
async function onInteractionCreate(interaction: Discord.Interaction): Promise<void> {
    // we only register slash commands, so it should always be a Discord.CommandInteraction
    if (!interaction.isCommand()) {
        return;
    }

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
}

/**
 * Remove expired slowmodes and information about servers/channels we no longer have access to from the database.
 *
 * @param client
 * @param database
 */
async function initializeDB(client: Discord.Client, database: Database): Promise<void> {
    const serverIDs = Array.from(client.guilds.cache.keys());
    const channelIDs = Array.from(client.channels.cache.filter(channel => channel.isText()).keys());

    await database.initialize();
    const [deleted, expired] = await database.sanitizeDatabase(serverIDs, channelIDs);
    console.log(`Init: Deleted channels: ${deleted}`);
    console.log(`Init: Expired slowmodes: ${expired}`);
}

/**
 * Register Discord slash commands.
 *
 * @param client
 * @param botToken
 * @param commands
 *
 * @see Command#getSlashCommand
 */
async function initializeSlashCommands(client: Discord.Client<true>, botToken: string, commands: Command[]): Promise<void> {
    const slashCommands = [];
    for (const command of commands) {
        const slashCommand = command.getSlashCommand();
        slashCommands.push(slashCommand);
    }
    const rest = new REST({ version: '9' }).setToken(botToken);
    try {
        console.log("Reloading slash commands.");
        await rest.put(Routes.applicationCommands(client.user.id), { body : slashCommands });
        console.log("Successfully reloaded slash commands.");
    } catch (error) {
        console.error(error);
        shutDownBot("Slash command registration error.");
    }
}

/**
 * Disconnect from the database and Discord to gracefully shut down the bot.
 *
 * @param signal The signal recieved. Should be SIGINT or SIGTERM.
 */
function shutDownBot(signal: string): void {
    ready = false;
    console.log("Bot has received " + signal + ", shutting down.");
    database.shutDown().then(() => {
        console.log("Database shut down. Bot shutting down now!");

        client.destroy();
        process.exit(0);
    });
}

/**
 * Remove deleted servers from the database.
 *
 * @param guild
 */
async function onGuildDelete(guild: Discord.Guild): Promise<void> {
    if (!ready) {
        return;
    }

    await database.removeServer(guild.id);
}

/**
 * Remove deleted channels from the database.
 *
 * @param channel
 */
async function onChannelDelete(channel: Discord.DMChannel | Discord.GuildBasedChannel): Promise<void> {
    if (!ready) {
        return;
    }

    if (!channel.isText()) {
        return;
    }
    await database.removeChannel(channel.id);
}

/**
 * Check Slowmode for each user message in a server and delete if in violation,
 * then check if the message is a command for the bot and respond to it.
 *
 * @param message
 */
async function onMessageCreate(message: Discord.Message): Promise<void> {
    if (!ready) {
        return;
    }

    // don't respond to bots, dm messages, or webhooks
    if (message.author.bot || !message.inGuild() || !message.member) {
        return;
    }

    const authorID = message.author.id;
    const channel = message.channel;
    const channelID = channel.id;
    const channelData = await database.getChannel(channelID);

    if (channelData !== null && channelData.subjectToSlowmode(message.member, channel)) {
        // if both text and images, check slowmode. if just images + it has an image, check slowmode. if text + it has text, check slowmode.
        if (channelData.isBoth() || (channelData.isImage() && message.attachments.size > 0) || (channelData.isText() && message.content.length > 0)) {
            const messageTimestamp = message.createdTimestamp;
            const userTimestamp = channelData.getUserTime(authorID);

            if (userTimestamp === undefined || messageTimestamp >= userTimestamp + (channelData.getLength() * 1000)) {
                channelData.addUser(authorID, BigInt(messageTimestamp));
                await database.setChannel(channelData);
            } else {
                if (!message.guild.members.me!.permissionsIn(message.channel).has(Discord.Permissions.FLAGS.MANAGE_MESSAGES)) {
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
    let parameters: string | string[] = message.content;
    // trim the leading % or @BetterSlowmode from the message
    if (prefix && message.content.startsWith(prefix)) {
        parameters = parameters.substring(prefix.length)
        tagUsed = false;
    } else if (message.content.startsWith(`<@!${client.user!.id}>`)) {
        parameters = parameters.substring(`<@!${client.user!.id}>`.length);
    } else if (message.content.startsWith(`<@${client.user!.id}>`)) {
        parameters = parameters.substring(`<@${client.user!.id}>`.length);
    } else {
        return;
    }

    // get the commands sent to the bot, if any
    parameters = parameters.split(" ").filter(e => e !== "");
    if (parameters.length) {
        for (const command of commands) {
            if (command.getName() === parameters[0]) {
                parameters.shift();
                await sendMessage(message.channel, await command.tagCommand(channelData, parameters, message));
            }
        }
    } else {
        // if no command was sent, but the bot was tagged, print the help command
        if (tagUsed) {
            await sendMessage(message.channel, await commands[0].tagCommand(channelData, [], message));
        }
    }
}

/**
 * Wrapper around sending messages with the tag command that handles permissions and includes a fallback mode for when
 * the bot can't send embeds.
 *
 * @param channel The channel to send the message in.
 * @param message The message to send. If it contains embeds and the bot lacks permissions,
 * it will send the non-embed content (if it exists) and an information message that asks for the permission.
 *
 * @returns The sent message.
 */
async function sendMessage(channel: Discord.GuildTextBasedChannel, message: Discord.MessageOptions | string): Promise<Discord.Message | null> {
    if (channel.guild.members.me!.permissionsIn(channel).has(Discord.Permissions.FLAGS.SEND_MESSAGES)) {
        if (typeof message !== "string" && message.embeds) {
            if (channel.guild.members.me!.permissionsIn(channel).has(Discord.Permissions.FLAGS.EMBED_LINKS)) {
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
    } else {
        return null;
    }
}

process.on("SIGINT", shutDownBot);
process.on("SIGTERM", shutDownBot);

client.on("ready", onReady);
client.on("interactionCreate", onInteractionCreate);
client.on("guildDelete", onGuildDelete);
client.on("channelDelete", onChannelDelete);
client.on("threadDelete", onChannelDelete);
client.on("messageCreate", onMessageCreate);

client.login(config.botToken);
