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

const Discord = require("discord.js");
const client = new Discord.Client({intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES]});

const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/rest/v9");

const config = require("../config/config.json");

const Database = require("./Database");
let database;
let ready = false;

const prefix = config["default-prefix"];

const Help = require("./Commands/Help");
const Info = require("./Commands/Info");
const Remove = require("./Commands/Remove");
const Reset = require("./Commands/Reset");
const Set = require("./Commands/Set");
const SetImage = require("./Commands/SetImage");
const SetText = require("./Commands/SetText");
const Status = require("./Commands/Status");
let commands;
let helpCommand;

process.on("SIGINT", shutDownBot);
process.on("SIGTERM", shutDownBot);

client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);

    await initializeBot();
    console.log("Database cleaned.");

    // set up slash commands
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

    client.user.setActivity(prefix + "help for help!")
    ready = true;
    console.log("Bot is ready!");
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

// set up the database and remove channels that are no longer valid
async function initializeBot() {
    const serverIDs = client.guilds.cache.keys();
    const channelIDs = client.channels.cache.filter(channel => channel.type === "GUILD_TEXT").keys();

    await Database.build(config["database-url"]).then(async (db) => {
        database = db;
        await database.sanitizeDatabase(serverIDs, channelIDs);
    });

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
                if (!message.guild.me.permissionsIn(message.channel).has(Discord.Permissions.FLAGS.MANAGE_MESSAGES)) {
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

// wrapper around sending messages that handles permissions and supports non-embed fallbacks for messages that use embeds
function sendMessage(channel, message) {
    if (channel.guild.me.permissionsIn(channel).has(Discord.Permissions.FLAGS.SEND_MESSAGES)) {
        if (message.embeds) {
            if (channel.guild.me.permissionsIn(channel).has(Discord.Permissions.FLAGS.EMBED_LINKS)) {
                message.content = undefined;
                return channel.send(message);
            } else {
                return channel.send(message.content +
                "\n\nThis output usually uses embeds (special formatting), but BetterSlowmode does not have the \"Embed Links\" permission in this channel. Sorry!");
            }
        } else {
            return channel.send(message);
        }
    }
}

/*
 *  Returns a boolean indicating if the given member is subject to a slowmode in the given channel or not.
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
