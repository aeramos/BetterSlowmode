/*
 * Copyright (C) 2020 Alejandro Ramos
 * This file is part of BetterSlowmode
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
const client = new Discord.Client();
const config = require("./config.json");

const ChannelData = require("./ChannelData")
const ServerData = require("./ServerData");

const Keyv = require("keyv");
const servers = new Keyv(config["db-url"], {namespace: "servers", serialize: JSON.stringify, deserialize: JSON.parse});
const channels = new Keyv(config["db-url"], {namespace: "channels", serialize: JSON.stringify, deserialize: JSON.parse});

servers.on('error', databaseError);
channels.on('error', databaseError);

function databaseError(error) {
    console.log(error);

    console.log("Bot shutting down now due to database error!");
    client.destroy();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
let doingAction = true;

function shutdown(signal) {
    console.log("Waiting for safe shutdown due to " + signal + "!");
    waitForShutdown(signal);
}

async function waitForShutdown(signal) {
    if (doingAction) {
        setImmediate(waitForShutdown, signal);
    } else {
        console.log("Bot shutting down now due to " + signal + "!");

        client.destroy();
        process.exit(0);
    }
}

client.on('ready', async () => {
    doingAction = true;
    console.log(`Logged in as ${client.user.tag}!`);

    let serverList = await servers.get("list");
    if (serverList === undefined) {
        await servers.set("list", []);
        serverList = [];
    }
    let serverListModified = false;

    let channelList = await channels.get("list");
    if (channelList === undefined) {
        await channels.set("list", []);
        channelList = [];
    }
    let channelListModified = false;

    // remove servers we're no longer in
    for (let i = serverList.length - 1; i >= 0; i--) {
        let serverID = serverList[i];
        if (!client.guilds.cache.has(serverID)) {
            serverListModified = true;

            // remove channel data
            let serverData = await servers.get(serverID);
            let serverChannels = ServerData.getChannels(serverData);
            for (let i = 0; i < serverChannels.length; i++) {
                channelListModified = true;

                await channels.delete(serverChannels[i]);
                channelList.splice(channelList.indexOf(serverChannels[i]), 1);
            }

            // remove server data
            serverList.splice(serverList.indexOf(serverID), 1);
            await servers.delete(serverID);
        }
    }

    let serversModified = new Map();
    // remove channels that were deleted
    for (let i = channelList.length - 1; i >= 0; i--) {
        let channelID = channelList[i];
        if (!client.channels.cache.has(channelID)) {
            channelListModified = true;

            let serverID = ChannelData.getServer(await channels.get(channelID));
            let serverData;
            let serverChannels;

            // only get the server data if we don't already have it
            if (serversModified.get(serverID) === undefined) {
                serverData = await servers.get(serverID);
                serversModified.set(serverID, serverData);
            }
            serverChannels = ServerData.getChannels(serverData);

            await removeChannel(serverChannels, channelID, channelList);
        }
    }
    // only update the server data if it was modified
    for (const [serverID, serverData] of serversModified.entries()) {
        await servers.set(serverID, serverData);
    }

    // add new servers
    let guildIDs = client.guilds.cache.keys();
    for (const guildID of guildIDs) {
        if (!serverList.includes(guildID)) {
            serverListModified = true;
            await addServer(guildID, serverList);
        }
    }

    if (serverListModified) {
        await servers.set("list", serverList);
    }
    if (channelListModified) {
        await channels.set("list", channelList);
    }

    console.log("Database clean. Bot ready!");
    doingAction = false;
});

client.on("guildCreate", async (guild) => {
    doingAction = true;
    await addServer(guild.id);
    doingAction = false;
});

client.on("guildDelete", async (guild) => {
    doingAction = true;

    // remove channel data
    let serverID = guild.id;
    let serverData = await servers.get(serverID);
    let serverChannels = ServerData.getChannels(serverData);
    if (serverChannels.length > 0) {
        // only get the channel list if we have to
        let channelList = await channels.get("list");

        for (let i = 0; i < serverChannels.length; i++) {
            await channels.delete(serverChannels[i]);
            channelList.splice(channelList.indexOf(serverChannels[i]), 1);
        }
        await channels.set("list", channelList);
    }

    // remove server data
    let serverList = await servers.get("list");
    serverList.splice(serverList.indexOf(serverID), 1);
    await servers.set("list", serverList);
    await servers.delete(serverID);

    doingAction = false;
});

client.on("channelDelete", async (channel) => {
    if (channel.type !== "text") {
        return; // we only manage guild text channels
    }
    doingAction = true;

    let serverData = await servers.get(channel.guild.id);
    let serverChannels = ServerData.getChannels(serverData);
    if (serverChannels.includes(channel.id)) {
        // remove channel from list
        let channelList = await channels.get("list");
        await removeChannel(serverChannels, channel.id, channelList);
        await channels.set("list", channelList);
        await servers.set(channel.guild.id, serverData);
    }
    doingAction = false;
});

async function addServer(serverID, serverList) {
    await servers.set(serverID, ServerData.createData(config["default-prefix"]));
    if (serverList === undefined ) {
        serverList = await servers.get("list");
        serverList.push(serverID);
        await servers.set("list", serverList);
    } else {
        serverList.push(serverID);
    }
}

async function removeChannel(serverChannels, channelID, channelList) {
    await channels.delete(channelID);
    serverChannels.splice(serverChannels.indexOf(channelID), 1);
    channelList.splice(channelList.indexOf(channelID), 1);
}

client.on('message', async (message) => {
    if (message.author.bot) {
        return;
    }
    if (message.guild === undefined) {
        return; // we don't handle dm messages yet
    }
    doingAction = true;

    const channelID = message.channel.id;
    let channelData = await channels.get(channelID);
    const authorID = message.author.id;

    // if there is a slowmode in this channel
    if (channelData !== undefined) {
        // inc || !(exc || perms).  equivalent to: inc || (!exc && !perms)
        if (ChannelData.getIncludes(channelData).includes(authorID) || !(ChannelData.getExcludes(channelData).includes(authorID) || (message.member.hasPermission("MANAGE_MESSAGES") || message.member.hasPermission("MANAGE_CHANNELS")))) {

            // if both text and images, check slowmode. if just images + it has an image, check slowmode. if text + it has text, check slowmode.
            if (ChannelData.isBoth(channelData) || (ChannelData.isImage(channelData) && message.attachments.size > 0) || (ChannelData.isText(channelData) && message.content.length > 0)) {
                const messageTimestamp = message.createdTimestamp;
                const userTimestamp = ChannelData.getUser(channelData, authorID);

                if (userTimestamp === undefined || messageTimestamp >= userTimestamp + ChannelData.getLength(channelData)) {
                    ChannelData.addUser(channelData, authorID, messageTimestamp);
                    await channels.set(channelID, channelData);
                } else {
                    await message.delete({reason: "Violated slowmode."});
                    doingAction = false;
                    return;
                }
            }
        }
    }

    const prefix = await ServerData.getPrefix(await servers.get(message.guild.id));
    if (message.content.startsWith(prefix)) {
        let parameters = message.content.substring(prefix.length);
        parameters = parameters.split(" ");
        let channel = message.channel;

        switch (parameters[0]) {
            case "help":
                parameters.shift();
                await helpCommand(prefix, channel, parameters);
                break;
            case "info":
                await infoCommand(channel);
                break;
            case "prefix":
                if (checkPermissions(message, ["MANAGE_GUILD"], [])) {
                    parameters.shift();
                    await prefixCommand(prefix, "prefix", channel, parameters, message.guild.id);
                }
                break;
            case "remove":
                if (checkPermissions(message, ["MANAGE_CHANNELS"], [])) {
                    parameters.shift();
                    await removeCommand(prefix, "remove", channel, parameters, authorID);
                }
                break;
            case "set":
                if (checkPermissions(message, ["MANAGE_CHANNELS"], ["MANAGE_MESSAGES"])) {
                    parameters.shift();
                    await setCommand(prefix, "set", channel, parameters, null);
                }
                break;
            case "set-image":
                if (checkPermissions(message, ["MANAGE_CHANNELS"], ["MANAGE_MESSAGES"])) {
                    parameters.shift();
                    await setCommand(prefix, "set-image", channel, parameters, false);
                }
                break;
            case "set-text":
                if (checkPermissions(message, ["MANAGE_CHANNELS"], ["MANAGE_MESSAGES"])) {
                    parameters.shift();
                    await setCommand(prefix, "set-text", channel, parameters, true);
                }
                break;
            default:
                await printUsage(prefix, undefined, channel);
                break;
        }
    }
    doingAction = false;
});

function checkPermissions(message, userPermissions, botPermissions) {
    const guildMember = message.member;
    const bot = message.guild.me;
    let permissionsGood = true;

    let missingPermissions = getMissingPermission(guildMember, userPermissions);
    if (missingPermissions !== "") {
        permissionsGood = false;
        message.reply("you don't have permission to use this command: " + missingPermissions);
    }

    missingPermissions = getMissingPermission(bot, botPermissions);
    if (missingPermissions !== "") {
        permissionsGood = false;
        message.reply("bot does not have permission to use this command: " + missingPermissions);
    }

    return permissionsGood;
}

function getMissingPermission(guildMember, requiredPermissions) {
    let missingPermissions = "";
    for (let i = 0; i < requiredPermissions.length; i++) {
        if (!guildMember.hasPermission(requiredPermissions[i])) {
            if (missingPermissions !== "") {
                missingPermissions += ", ";
            }
            // convert "MANAGE_CHANNELS" to "Manage Channels" for example
            missingPermissions += requiredPermissions[i].toLowerCase().split("_").map((s) => s.charAt(0).toUpperCase() + s.substring(1)).join(" ");
        }
    }
    return missingPermissions;
}

async function printOutput(channel, output) {
    if (channel === undefined) {
        console.log(output);
    } else {
        await channel.send("```\n" + output + "```");
    }
}

async function helpCommand(prefix, channel, parameters) {
    if (parameters.length > 1) {
        await printUsage(prefix, "help", channel);
        return;
    }

    if (channel === undefined) {
        // message was sent from console, display console help
        // coming soon
        return;
    }

    await printUsage(prefix, parameters[0], channel);
}

async function infoCommand(channel) {
    let output = "BetterSlowmode is A Discord bot that adds more depth and customization to text channel slowmodes.";
    output += "\nBetterSlowmode is developed by Alejandro Ramos (@aeramos#0979) and released on GitHub under the GNU AGPL3+ license.";
    output += "\nView the source code here: https://github.com/aeramos/BetterSlowmode";

    await printOutput(channel, output);
}

async function prefixCommand(prefix, command, channel, parameters, guildID) {
    if (parameters.length !== 1 || parameters[0].length !== 1) {
        await printUsage(prefix, command, channel);
        return;
    }
    let serverData = await servers.get(guildID);
    ServerData.setPrefix(serverData, parameters[0]);
    await servers.set(guildID, serverData);
}

async function removeCommand(prefix, command, channel, parameters, authorID) {
    if (parameters.length === 0) {
        await printUsage(prefix, command, channel);
        return;
    }

    let channelsToRemove = [];
    for (let i = 0; i < parameters.length; i++) {
        const parameter = parameters[i];

        // matches the test for tagging a channel
        if (parameter.search(/^<#\d+>$/) !== -1) {
            channelsToRemove.push(parameter.slice(2, -1))
        } else {
            await printUsage(prefix, command, channel);
            return;
        }
    }

    let serverData = await servers.get(channel.guild.id);
    let serverChannels = ServerData.getChannels(serverData);
    let channelList = undefined; // don't pull from the database if we don't have to
    for (let i = 0; i < channelsToRemove.length; i++) {
        const channelID = channelsToRemove[i];
        if (serverChannels.includes(channelID)) {
            let channelData = await channels.get(channelID);
            if (ChannelData.getIncludes(channelData).includes(authorID)) {
                channel.send("<@!" + authorID + ">, you can not remove slowmode on <#" + channelID + "> because it applies to you!");
            } else {
                if (channelList === undefined) {
                    channelList = await channels.get("list");
                }
                await removeChannel(serverChannels, channelID, channelList);
            }
        }
    }
    if (channelList !== undefined) {
        await servers.set(channel.guild.id, serverData);
        await channels.set("list", channelList);
    }
}

async function setCommand(prefix, command, channel, parameters, slowmodeType) {
    if (parameters.length === 0) {
        await printUsage(prefix, command, channel);
        return;
    }

    let length = 0;
    let exclusions = [];
    let inclusions = [];
    let excluding = null;

    for (let i = 0; i < parameters.length; i++) {
        let parameter = parameters[i];
        if (parameter.startsWith("--")) {
            switch (parameter.slice(2)) {
                case "exclude":
                    excluding = true;
                    break;
                case "include":
                    excluding = false;
                    break;
                default:
                    await printUsage(prefix, command, channel);
                    return;
            }
        } else {
            if (excluding === null) {
                let addedTime = 1;
                // noinspection FallThroughInSwitchStatementJS
                switch (parameter.slice(-1)) {
                    case "y":
                        addedTime *= 365;
                    case "d":
                        addedTime *= 24;
                    case "h":
                        addedTime *= 60;
                    case "m":
                        addedTime *= 60;
                    case "s":
                        let amount = parameter.slice(0, -1);
                        if (isNaN(amount)) {
                            await printUsage(prefix, command, channel);
                            return;
                        }
                        addedTime *= 1000 * amount;
                        break;
                    default:
                        await printUsage(prefix, command, channel);
                        return;
                }
                length += addedTime;
            } else {
                // matches the text for tagging a user
                if (parameter.search(/^<@!\d+>$/) !== -1) {
                    const userID = parameter.slice(3, -1);

                    if (excluding) {
                        if (inclusions.includes(userID)) {
                            await printUsage(prefix, command, channel);
                            return;
                        }
                        if (!exclusions.includes(userID)) {
                            exclusions.push(userID);
                        }
                    } else {
                        if (exclusions.includes(userID)) {
                            await printUsage(prefix, command, channel);
                            return;
                        }
                        if (!inclusions.includes(userID)) {
                            inclusions.push(userID);
                        }
                    }
                } else {
                    await printUsage(prefix, command, channel);
                    return;
                }
            }
        }
    }
    // add the channel to its server's list
    const serverID = channel.guild.id;
    const serverData = await servers.get(serverID);
    const serverChannels = ServerData.getChannels(serverData);
    if (!serverChannels.includes(channel.id)) {
        serverChannels.push(channel.id);
        await servers.set(serverID, serverData);

        let channelList = await channels.get("list");
        channelList.push(channel.id);
        await channels.set("list", channelList);
    }

    // store the channel slowmode data
    await channels.set(channel.id, ChannelData.createData(serverID, length, slowmodeType, exclusions, inclusions));
}

async function printUsage(prefix, command, channel) {
    let output;
    switch (command) {
        case "help":
            output = prefix + "help [command]";
            output += "\nLists commands. If given a command, describes usage of command."
            break;
        case "info":
            output = prefix + "info";
            output += "\nPrints info about the bot and a link to the code.";
            break;
        case "prefix":
            output = prefix + "prefix <new prefix>";
            output += "\nChanges the bot's prefix on this server to the given prefix. Prefix must be one character.";
            break;
        case "remove":
            output = prefix + "remove <#channel(s)>";
            output += "\nRemoves the slowmode in the given channel or channels. Can not remove a slowmode set on yourself.";
            break;
        case "set":
            output = prefix + "set <length> [--exclude <user(s)>] [--include <user(s)>]";
            output += "\nSets a slowmode using the given length (in the format: 1y 1d 1h 1m 1s), and optionally excludes or includes users. Can not exclude and include the same user."
            break;
        case "set-image":
            output = prefix + "set-image <length> [--exclude <user(s)>] [--include <user(s)>]";
            output += "\nSets a slowmode just for images using the given length (in the format: 1y 1d 1h 1m 1s), and optionally excludes or includes users. Can not exclude and include the same user."
            break;
        case "set-text":
            output = prefix + "set-text <length> [--exclude <user(s)>] [--include <user(s)>]";
            output += "\nSets a slowmode just for text using the given length (in the format: 1y 1d 1h 1m 1s), and optionally excludes or includes users. Can not exclude and include the same user."
            break;
        default:
            output = "Commands: help, info, prefix, remove, set, set-image, set-text. Prefix: " + prefix;
            break;
    }
    await printOutput(channel, output)
}

client.login(config.token);
