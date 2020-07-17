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
const db = new Keyv(config["db-url"]);
db.on('error', err => console.log('Connection Error', err));

const Slowmode = require("./Slowmode")

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // verifies that database is clean before proceeding
    client.guilds.cache.each(async (guild) => {
        if (await db.get(guild.id) === undefined) {
            await db.set(guild.id, config["default-prefix"]);
        }
    });
});

client.on("guildCreate", async (guild) => {
    await db.set(guild.id, config["default-prefix"]);
});

client.on("guildDelete", (guild) => {
    // don't need await because the guild won't be accessed when this method is called
    db.delete(guild.id);
});

client.on('message', async (message) => {
    if (message.author.bot) {
        return;
    }
    const channelID = message.channel.id;
    let data = await db.get(channelID);
    if (data !== undefined) { // if there is a slowmode in this channel
        data = JSON.parse(data);
        const authorID = message.author.id;

        // if author is not excluded from or author is included in the slowmode, check if the message violates the slowmode
        if (!Slowmode.getExcludes(data).includes(authorID) || Slowmode.getIncludes(data).includes(authorID)) {

            // if both, check slowmode. if just images + it has an image, check slowmode. if text + it has text, check slowmode.
            if (Slowmode.isBoth(data) || (Slowmode.isImage(data) && message.attachments.size > 0) || (Slowmode.isText(data) && message.content.length > 0)) {
                const messageTimestamp = message.createdTimestamp;
                const userTimestamp = Slowmode.getUser(data, authorID);

                if (userTimestamp === undefined || messageTimestamp >= userTimestamp + Slowmode.getLength(data)) {
                    Slowmode.addUser(data, authorID, messageTimestamp);
                    data = JSON.stringify(data);
                    await db.set(channelID, data);
                } else {
                    await message.delete({reason: "Violated slowmode."});
                    return;
                }
            }
        }
    }

    const prefix = await db.get(message.guild.id);
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
    await db.set(guildID, parameters[0]);
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
    await db.set(channel, JSON.stringify(Slowmode.createData(length, slowmodeType, exclusions, inclusions)))
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
