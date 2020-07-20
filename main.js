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

const Keyv = require("keyv");
const servers = new Keyv(config["db-url"], {namespace: "servers", serialize: JSON.stringify, deserialize: JSON.parse});
const channels = new Keyv(config["db-url"], {namespace: "channels", serialize: JSON.stringify, deserialize: JSON.parse});

servers.on('error', err => console.log('Connection Error', err));
channels.on('error', err => console.log('Connection Error', err));

const ChannelData = require("./ChannelData")
const ServerData = require("./ServerData");

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    let serverList = await servers.get("list");
    if (serverList === undefined) {
        await servers.set("list", []);
        serverList = [];
    }

    let channelList = await channels.get("list");
    if (channelList === undefined) {
        await channels.set("list", []);
        channelList = [];
    }

    // remove servers we're no longer in
    for (let i = serverList.length - 1; i >= 0; i--) {
        let serverID = serverList[i];
        if (!client.guilds.cache.has(serverID)) {
            // remove channel data
            let serverData = await servers.get(serverID);
            let serverChannels = ServerData.getChannels(serverData);
            for (let i = 0; i < serverChannels.length; i++) {
                await channels.delete(serverChannels[i]);
                channelList.splice(channelList.indexOf(serverChannels[i]), 1);
            }

            // remove server data
            serverList.splice(serverList.indexOf(serverID), 1);
            await servers.delete(serverID);
        }
    }

    // remove channels that were deleted
    for (let i = channelList.length - 1; i >= 0; i--) {
        let channelID = channelList[i];
        if (!client.channels.cache.has(channelID)) {
            // remove channel data
            let serverID = ChannelData.getServer(await channels.get(channelID));
            let serverData = await servers.get(serverID);
            let serverChannels = ServerData.getChannels(serverData);
            await channels.delete(channelID);
            channelList.splice(channelList.indexOf(channelID), 1);

            // remove server data
            serverChannels.splice(serverChannels.indexOf(channelID), 1);
            await servers.set(serverID, serverData);
        }
    }
    await channels.set("list", channelList);

    // add new servers
    let guildIDs = client.guilds.cache.keys();
    for (const guildID of guildIDs) {
        if (!serverList.includes(guildID)) {
            await addServer(guildID, serverList);
        }
    }
    await servers.set("list", serverList);

    console.log("Database clean. Bot ready!");
});

client.on("guildCreate", async (guild) => {
    await addServer(guild.id);
});

client.on("guildDelete", async (guild) => {
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

});

client.on("channelDelete", async (channel) => {
    if (channel.type !== "text") {
        return; // we only manage guild text channels
    }

    let serverData = await servers.get(channel.guild.id);
    let serverChannels = ServerData.getChannels(serverData);
    if (serverChannels.includes(channel.id)) {
        // remove channel data
        await channels.delete(channel.id);

        // remove channel from list
        let channelList = await channels.get("list");
        channelList.splice(channelList.indexOf(channel.id), 1);
        await channels.set("list", channelList);

        // update server data
        serverChannels.splice(serverChannels.indexOf(channel.id), 1);
        await servers.set(channel.guild.id, serverData);
    }
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

client.on('message', async (message) => {
    if (message.author.bot) {
        return;
    }
    const channelID = message.channel.id;
    let channelData = await channels.get(channelID);
    if (channelData !== undefined) { // if there is a slowmode in this channel
        const authorID = message.author.id;

        // if author is not excluded from or author is included in the slowmode, check if the message violates the slowmode
        if (!ChannelData.getExcludes(channelData).includes(authorID) || ChannelData.getIncludes(channelData).includes(authorID)) {

            // if both, check slowmode. if just images + it has an image, check slowmode. if text + it has text, check slowmode.
            if (ChannelData.isBoth(channelData) || (ChannelData.isImage(channelData) && message.attachments.size > 0) || (ChannelData.isText(channelData) && message.content.length > 0)) {
                const messageTimestamp = message.createdTimestamp;
                const userTimestamp = ChannelData.getUser(channelData, authorID);

                if (userTimestamp === undefined || messageTimestamp >= userTimestamp + ChannelData.getLength(channelData)) {
                    ChannelData.addUser(channelData, authorID, messageTimestamp);
                    await channels.set(channelID, channelData);
                } else {
                    await message.delete({reason: "Violated slowmode."});
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
                parameters.shift();
                await prefixCommand(prefix, "prefix", channel, parameters, message.guild.id)
                break;
            case "set":
                parameters.shift();
                await setCommand(prefix, "set", channel, parameters, null);
                break;
            case "set-image":
                parameters.shift();
                await setCommand(prefix, "set-image", channel, parameters, false);
                break;
            case "set-text":
                parameters.shift();
                await setCommand(prefix, "set-text", channel, parameters, true);
                break;
            default:
                await printUsage(prefix, undefined, channel);
                break;
        }
    }
});

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
                    if (excluding) {
                        exclusions.push(parameter.slice(3, -1));
                    } else {
                        inclusions.push(parameter.slice(3, -1));
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
        case "set":
            output = prefix + "set <length> [--exclude <user(s)>] [--include <user(s)>]";
            output += "\nSets a slowmode using the given length (in the format: 1y 1d 1h 1m 1s), and optionally excludes or includes users."
            break;
        case "set-image":
            output = prefix + "set-image <length> [--exclude <user(s)>] [--include <user(s)>]";
            output += "\nSets a slowmode just for images using the given length (in the format: 1y 1d 1h 1m 1s), and optionally excludes or includes users."
            break;
        case "set-text":
            output = prefix + "set-text <length> [--exclude <user(s)>] [--include <user(s)>]";
            output += "\nSets a slowmode just for text using the given length (in the format: 1y 1d 1h 1m 1s), and optionally excludes or includes users."
            break;
        default:
            output = "Commands: help, info, prefix, set, set-image, set-text. Prefix: " + prefix;
            break;
    }
    await printOutput(channel, output)
}

client.login(config.token);
