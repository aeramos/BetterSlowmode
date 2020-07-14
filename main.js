/*
 * Copyright (C) 2020 Alejandro Ramos
 * This file is part of BetterSlowmode
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
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
    if (!message.author.bot) {
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
            let text = message.content.substring(prefix.length);
            text = text.split(" ");

            switch (text[0]) {
                case "prefix":
                    await db.set(message.guild.id, text[1]);
                    break;
                case "set":
                    text.shift();
                    await setCommand("set", text, null, message, prefix);
                    break;
                case "set-image":
                    text.shift();
                    await setCommand("set-image", false, message, prefix);
                    break;
                case "set-text":
                    text.shift();
                    await setCommand("set-text", true, message, prefix);
                    break;
                default:
                    printUsage(message, prefix);
                    break;
            }
        }
    }
});

async function setCommand(command, parameters, type, channel, message, prefix) {
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
                    printUsage(message, prefix, command);
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
                            printUsage(message, prefix, command);
                            return;
                        }
                        addedTime *= 1000 * amount;
                        break;
                    default:
                        printUsage(message, prefix, command);
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
                    printUsage(message, prefix, command);
                    return;
                }
            }
        }
    }
    await db.set(channel, JSON.stringify(Slowmode.createData(length, type, exclusions, inclusions)))
}

function printUsage(message, prefix, command) {
    message.reply("Example to set slowmode: " + prefix + "set 1y 1d 1h 1m 1s --exclude @User1 --include @User2");
    message.reply("Example to change prefix: " + prefix + "prefix !");
}

client.login(config.token);
