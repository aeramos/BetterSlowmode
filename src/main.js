/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2020, 2021 Alejandro Ramos
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
const config = require("../config/config.json");

const Database = require("./Database");
let database;

const prefix = config["default-prefix"];

const Help = require("./Commands/Help");
const Info = require("./Commands/Info");
const Remove = require("./Commands/Remove");
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

    await initializeBot().then(() => {
        console.log("Database clean. Bot ready!");
    }).then(() => {
        client.user.setActivity(prefix + "help for help!")
    })
});

// set up the database and remove channels that are no longer valid
async function initializeBot() {
    const serverIDs = client.guilds.cache.keyArray();
    const channelIDs = client.channels.cache.filter(channel => channel.type === "text").keyArray();

    await Database.build(config["database-url"]).then(async (db) => {
        database = db;
        await database.sanitizeDatabase(serverIDs, channelIDs);
    });

    commands = [
        new Info(prefix),
        new Remove(prefix, database, subjectToSlowmode),
        new Set(prefix, database),
        new SetImage(prefix, database),
        new SetText(prefix, database),
        new Status(prefix, database)
    ];
    helpCommand = new Help(prefix, commands);
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
    await database.removeServer(guild.id);
});

client.on("channelDelete", async (channel) => {
    if (channel.type !== "text") {
        return; // we only manage guild text channels
    }
    await database.removeChannel(channel.id);
});

client.on("message", async (message) => {
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

    if (channelData !== null) {
        if (subjectToSlowmode(message.member, channel, channelData)) {
            // if both text and images, check slowmode. if just images + it has an image, check slowmode. if text + it has text, check slowmode.
            if (channelData.isBoth() || (channelData.isImage() && message.attachments.size > 0) || (channelData.isText() && message.content.length > 0)) {
                const messageTimestamp = message.createdTimestamp;
                const userTimestamp = channelData.getUserTime(authorID);

                if (userTimestamp === undefined || messageTimestamp >= userTimestamp + BigInt(channelData.getLength())) {
                    channelData.addUser(authorID, messageTimestamp);
                    await database.setChannel(channelData);
                } else {
                    await message.delete({reason: "Violated slowmode."});
                    return;
                }
            }
        }
    }

    if (message.content.startsWith(prefix)) {
        let parameters = message.content.substring(prefix.length);
        parameters = parameters.split(" ").filter(e => e !== "");

        for (const command of commands) {
            if (command.getName() === parameters[0]) {
                parameters.shift();
                await channel.send(await command.command(channelData, parameters, message));
                return;
            }
        }
    }
});

/*
 *  Returns a boolean indicating if the given member is subject to a slowmode in the given channel or not.
 */
function subjectToSlowmode(member, channel, channelData) {
    if (member.guild.ownerID === member.id) return false;
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
