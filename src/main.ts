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
    intents: [Discord.IntentsBitField.Flags.MessageContent, Discord.IntentsBitField.Flags.DirectMessages, Discord.IntentsBitField.Flags.Guilds, Discord.IntentsBitField.Flags.GuildMessages],
    makeCache: Discord.Options.cacheWithLimits(Discord.Options.DefaultMakeCacheSettings),
    sweepers: {
        ...Discord.Options.DefaultSweeperSettings,
        messages: { // 30 second message cache
            lifetime: 30,
            interval: 60
        }
    }
});

const prefix: string | undefined = config.prefix;

/**
 * Indicates if the client is ready, the database is connected, and the slash commands are registered.
 */
let ready: boolean = false;

let database: Database;
let commands: Command[];
let helpCommand: Help;

/**
 * Set up the Commands, connect to the database, and register the slash commands.
 *
 * @param client
 */
async function onReady(client: Discord.Client<true>): Promise<void> {
    console.log(`Shard ${client.shard!.ids}: Logged in as ${client.user.tag}`);

    database = await Database.create(config.databaseURL);
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

    // if first shard, register slash commands so it's only done once
    if (client.shard!.ids.includes(0)) {
        await initializeSlashCommands(client, config.botToken, commands);
    }
    if (prefix) {
        client.user.setActivity(prefix + "help for help!");
    } else {
        client.user.setActivity("/help for help!");
    }
    ready = true;
    console.log(`Shard ${client.shard!.ids}: Ready!`);
}

/**
 * Handle slash commands or reply to the user with a rejection if not used in a server.
 *
 * @param interaction
 */
async function onInteractionCreate(interaction: Discord.Interaction): Promise<void> {
    // we only register slash commands, so it should always be a Discord.ChatInputCommand
    if (!interaction.isChatInputCommand()) {
        return;
    }

    if (!interaction.guild) {
        if (interaction.commandName !== "help" && interaction.commandName !== "info") {
            return void await interaction.reply({
                content: "This command can only be used in a server."
            });
        }
    }
    for (const command of commands) {
        if (command.getName() === interaction.commandName) {
            return void await command.slashCommand(interaction);
        }
    }
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
    const rest = new Discord.REST({ version: '10' }).setToken(botToken);
    try {
        await rest.put(Discord.Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log(`Shard ${client.shard!.ids}: Successfully registered slash commands.`);
    } catch (error) {
        console.error(`Shard ${client.shard!.ids}: Error: Failed to register slash commands.`);
        console.error(error);
        shutDownBot();
    }
}

/**
 * Handle message from the ShardManager.
 *
 * @param message The message. Object types are sent automatically by some functions, e.g. Shard#eval.
 */
async function onIPCMessage(message: string | object): Promise<void> {
    if (message === "shutdown") {
        await shutDownBot();
    }
}

/**
 * Disconnect from the database and Discord to gracefully shut down the shard.
 */
async function shutDownBot(): Promise<void> {
    ready = false;
    await client.destroy();
    await database.close();
    console.log(`Shard ${client.shard!.ids}: Disconnected from Discord and database. Safely shutting down now.`);
    process.exit(0);
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

    if (!channel.isTextBased()) {
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

            // if the message was sent after the user's slowmode expired, record the new timestamp
            if (userTimestamp === undefined || messageTimestamp >= userTimestamp + (channelData.getLength() * 1000)) {
                channelData.addUser(authorID, BigInt(messageTimestamp));
                await database.setChannel(channelData);
            } else {
                // if the bot doesn't have the permissions to delete the message, complain. if it does, delete the message
                if (!message.guild.members.me!.permissionsIn(message.channel).has(Discord.PermissionFlagsBits.ManageMessages)) {
                    await sendMessage(message.channel, "Error: Could not delete message because BetterSlowmode does not have the \"Manage Messages\" permission in this channel." +
                        "\nBetterSlowmode needs the \"Manage Messages\" and \"Send Messages\" permissions to function." +
                        "\nIf you want to remove the slowmode, use: `@BetterSlowmode remove`. Use `@BetterSlowmode help` for help.");
                } else {
                    await message.delete().catch(error => {
                        console.error(`Shard ${client.shard!.ids}: Error: Attempted to delete message that has already been deleted.`);
                        console.error(error);
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
                break;
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
async function sendMessage(channel: Discord.GuildTextBasedChannel, message: Discord.MessageCreateOptions | string): Promise<Discord.Message | null> {
    if (channel.guild.members.me!.permissionsIn(channel).has(Discord.PermissionFlagsBits.SendMessages)) {
        if (typeof message !== "string" && message.embeds) {
            if (channel.guild.members.me!.permissionsIn(channel).has(Discord.PermissionFlagsBits.EmbedLinks)) {
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

process.on("message", onIPCMessage);
process.on("SIGINT", () => {});
process.on("SIGTERM", () => {});

client.on(Discord.Events.ClientReady, onReady);
client.on(Discord.Events.InteractionCreate, onInteractionCreate);
client.on(Discord.Events.GuildDelete, onGuildDelete);
client.on(Discord.Events.ChannelDelete, onChannelDelete);
client.on(Discord.Events.ThreadDelete, onChannelDelete);
client.on(Discord.Events.MessageCreate, onMessageCreate);

client.login(config.botToken);
