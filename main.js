/*
 * Copyright (C) 2020, 2021 Alejandro Ramos
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

const Database = require("./Database");
let database;

const ChannelData2 = require("./ChannelData");
const prefix = "%";

process.on("SIGINT", shutDownBot);
process.on("SIGTERM", shutDownBot);

client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity("%help for help!");

    initializeBot().then(() => {
        console.log("Database clean. Bot ready!");
    });
});

async function initializeBot() {
    let serverIDs = client.guilds.cache.keyArray();
    let channelIDs = client.channels.cache.filter(channel => channel.type === "text").keyArray();

    await Database.build(config["database-url"]).then(async (db) => {
        database = db;
        await database.sanitizeDatabase(serverIDs, channelIDs);
    });
}

function shutDownBot(signal) {
    console.log("Bot has received " + signal + ", shutting down.");
    database.shutDown().then(() => {
        console.log("Database shut down. Bot shutting down now!");

        client.destroy();
        process.exit(0);
    })
}

client.on("guildDelete", guild => {
    database.removeServer(guild.id);
});

client.on("channelDelete", channel => {
    if (channel.type !== "text") {
        return; // we only manage guild text channels
    }
    database.removeChannel(channel.id);
});

client.on("message", async (message) => {
    // don't respond to bots
    if (message.author.bot) {
        return;
    }
    // bot does not handle dm messages yet
    if (message.guild === undefined) {
        return;
    }

    const authorID = message.author.id;
    const channel = message.channel;
    const channelID = channel.id;
    let channelData = await database.getChannel(channelID);

    if (channelData !== null && channelData.getLength() !== 0) {
        if (subjectToSlowmode(message.member, channel, channelData)) {
            // if both text and images, check slowmode. if just images + it has an image, check slowmode. if text + it has text, check slowmode.
            if (channelData.isBoth() || (channelData.isImage() && message.attachments.size > 0) || (channelData.isText() && message.content.length > 0)) {
                const messageTimestamp = message.createdTimestamp;

                if (channelData.timeIsGood(authorID, messageTimestamp)) {
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

        switch (parameters[0]) {
            case "help":
                printUsage(channel, parameters[1]);
                break;
            case "info":
                infoCommand(channel);
                break;
            case "remove":
                if (checkUsagePermissions(message.member, channel, [[Discord.Permissions.FLAGS.MANAGE_CHANNELS, "Manage Channel"]], [[]])) {
                    parameters.shift();
                    removeCommand(channel, message.member);
                }
                break;
            case "set":
                if (checkUsagePermissions(message.member, channel, [[Discord.Permissions.FLAGS.MANAGE_CHANNELS, "Manage Channel"]], [[Discord.Permissions.FLAGS.MANAGE_MESSAGES, "Manage Messages"]])) {
                    parameters.shift();
                    await setCommand("set", channel, message.author, parameters, null);
                }
                break;
            case "set-image":
                if (checkUsagePermissions(message.member, channel, [[Discord.Permissions.FLAGS.MANAGE_CHANNELS, "Manage Channel"]], [[Discord.Permissions.FLAGS.MANAGE_MESSAGES, "Manage Messages"]])) {
                    parameters.shift();
                    await setCommand("set-image", channel, message.author, parameters, false);
                }
                break;
            case "set-text":
                if (checkUsagePermissions(message.member, channel, [[Discord.Permissions.FLAGS.MANAGE_CHANNELS, "Manage Channel"]], [[Discord.Permissions.FLAGS.MANAGE_MESSAGES, "Manage Messages"]])) {
                    parameters.shift();
                    await setCommand("set-text", channel, message.author, parameters, true);
                }
                break;
            default:
                printUsage(channel, undefined);
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

/*
    checks if perms are met in a given channel. if perms are not good it tells the discord user about the missing permissions
    returns true if permissions are good, false otherwise
 */
function checkUsagePermissions(guildMember, channel, userPermissions, botPermissions) {
    let permissionsGood = true;
    const bot = guildMember.guild.me;

    let missingPermissions = getMissingPermissions(guildMember, channel, userPermissions);
    if (missingPermissions !== "") {
        permissionsGood = false;
        channel.send(`${guildMember}, you don't have permission to use this command in this channel. You need: ${missingPermissions}.`);
    }

    missingPermissions = getMissingPermissions(bot, channel, botPermissions);
    if (missingPermissions !== "") {
        permissionsGood = false;
        channel.send(`${guildMember}, this bot does not have permission to use this command in this channel. The bot needs: ${missingPermissions}.`);
    }

    return permissionsGood;
}

/*
    returns a string listing the given required permissions that the member lacks in the given channel.
    returns an empty string if the member has the permissions
 */
function getMissingPermissions(guildMember, channel, requiredPermissions) {
    let missingPermissions = "";
    for (let i = 0; i < requiredPermissions.length; i++) {
        if (!guildMember.permissionsIn(channel).has(requiredPermissions[i][0])) {
            if (missingPermissions !== "") {
                missingPermissions += ", ";
            }
            missingPermissions += requiredPermissions[i][1];
        }
    }
    return missingPermissions;
}

async function printUsage(channel, command) {
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
        case "remove":
            output = prefix + "remove";
            output += "\nRemoves a slowmode in the current channel. Can not remove a slowmode that you are subject to. This can be due to permissions, your role being included, or you being specially included.";
            break;
        case "set":
            output = prefix + "set <length> [--exclude <user(s)>] [--include <user(s)>]";
            output += "\nSets a slowmode using the given length (in the format: 1y 1d 1h 1m 1s), and optionally excludes or includes users in this server.";
            output += "\nCan only --include people in a lower role than you and people who are not already --excluded (and vice versa).";
            break;
        case "set-image":
            output = prefix + "set-image <length> [--exclude <user(s)>] [--include <user(s)>]";
            output += "\nSets a slowmode just for images using the given length (in the format: 1y 1d 1h 1m 1s), and optionally excludes or includes users in this server."
            output += "\nCan only --include people in a lower role than you and people who are not already --excluded (and vice versa).";
            break;
        case "set-text":
            output = prefix + "set-text <length> [--exclude <user(s)>] [--include <user(s)>]";
            output += "\nSets a slowmode just for text using the given length (in the format: 1y 1d 1h 1m 1s), and optionally excludes or includes users in this server."
            output += "\nCan only --include people in a lower role than you and people who are not already --excluded (and vice versa).";
            break;
        default:
            output = "Commands: help, info, remove, set, set-image, set-text.";
            output += "\nPrefix: " + prefix;
            break;
    }
    printOutput(channel, output)
}

function printOutput(channel, output) {
    if (channel === undefined) {
        console.log(output);
    } else {
        channel.send("```\n" + output + "```");
    }
}

function infoCommand(channel) {
    let output = "BetterSlowmode is a Discord bot that adds more depth and customization to text channel slowmodes.";
    output += "\nBetterSlowmode is developed by Alejandro Ramos (Discord: @aeramos#0979) and released on GitHub under the GNU AGPL3+ license.";
    output += "\nView the source code here: https://github.com/aeramos/BetterSlowmode";

    printOutput(channel, output);
}

/*
    removes the slowmode in the channel in which it is called.
    only removes if the caller is not subject to the slowmode due to permissions or includes.
 */
function removeCommand(channel, author) {
    database.getChannel(channel.id).then(channelData => {
        if (channelData === null) {
            channel.send(`${author}, there is no slowmode on this channel to remove.`);
            return;
        }
        if (!subjectToSlowmode(author, channel, channelData)) {
            database.removeChannel(channel.id).then(() => {
                channel.send(`${author}, the slowmode has been removed from this channel.`);
            });
        } else {
            channel.send(`${author}, you cannot remove this slowmode because you are subject to it!`);
        }
    });
}

/*
    command: string "set"/"set-image"/"set-text"
    author: Discord.GuildMember
    parameters: parameters for the given command
    slowmodeType: True/False/Null (text/image/both)
 */
async function setCommand(command, channel, author, parameters, slowmodeType) {
    if (parameters.length === 0) {
        printUsage(channel, command);
        return;
    }

    // instantiate slowmode settings
    let length = 0;
    let userExclusions = [];
    let userInclusions = [];
    let roleExclusions = [];
    let roleInclusions = [];

    let isExcluding = null;
    let timeHasBeenAdded = false;

    // parse each parameter
    for (let i = 0; i < parameters.length; i++) {
        let parameter = parameters[i];

        if (parameter.startsWith("--")) {
            switch (parameter.slice(2)) {
                case "exclude":
                    isExcluding = true;
                    break;
                case "include":
                    isExcluding = false;
                    break;
                default:
                    printUsage(channel, command);
                    return;
            }
        // if the parameter starts with a number it can only be the length
        } else if (parameter.match(/^\d/)) {
            // enforce that time is only added once
            if (!timeHasBeenAdded) {
                timeHasBeenAdded = true;
            } else {
                printUsage(channel, command);
                return;
            }

            // if properly formatted "15m", will remove the m and leave 15
            let addedTime = parameter.slice(0, -1);
            // should only be the case if improperly formatted
            if (isNaN(addedTime)) {
                printUsage(channel, command);
                return;
            }
            // switch statement breaks everything down to milliseconds and adds it to `length`
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
                    addedTime *= 1000;
                    break;
                default:
                    printUsage(channel, command);
                    return;
            }
            length += addedTime;
        // this string must contain the parameter passed to an option: the tag of a user or role to exclude/include
        } else {
            // test to see if it contains channel or user tags, any number of them (at least 1), and nothing more
            if (!new RegExp(/^(<(@|@!|@&)(\d{1,20}?)>)+$/).test(parameter)) {
                printUsage(channel, command);
                return;
            }

            // put each mention in an array that just contains the id
            let userMentions = [];
            let temp = parameter.match(/(<@(\d{1,20}?)>)/g);
            if (temp !== null) {
                temp.forEach((e, i, a) => a[i] = e.slice(2, -1))
                Array.push.apply(userMentions, temp);
            }

            temp = parameter.match(/(<@!(\d{1,20}?)>)/g);
            if (temp !== null) {
                temp.forEach((e, i, a) => a[i] = e.slice(3, -1))
                Array.push.apply(userMentions, temp);
            }

            let roleMentions = [];
            temp = parameter.match(/(<@&(\d{1,20}?)>)/g);
            if (temp !== null) {
                temp.forEach((e, i, a) => a[i] = e.slice(3, -1))
                roleMentions = temp;
            }

            if (await Promise.all([handleExclusions(channel.guild, author, userMentions, userExclusions, userInclusions, isExcluding, true),
            handleExclusions(channel.guild, author, roleMentions, roleExclusions, roleInclusions, isExcluding, false)]).then(results =>
            {
                return results.includes(false);
            })) {
                printUsage(channel, command);
                return;
            }
        }
    }
    if (!timeHasBeenAdded) {
        printUsage(channel, command);
        return;
    }

    database.setChannel(new ChannelData2(channel.id, channel.guild.id, length, slowmodeType, userExclusions, userInclusions, roleExclusions, roleInclusions, [], [])).then(() => {
        channel.send(`${author}, ${length / 1000} second ${slowmodeType === true ? "text" : slowmodeType === false ? "image" : "text and image"} slowmode has been set!`);
    });
}

/*
    just called by setCommand as a helper function
    modifies the given arrays so that they include the given mentions
    returns true if no error, false otherwise
 */
async function handleExclusions(guild, author, mentions, exclusions, inclusions, isExcluding, isMember) {
    for (let i = 0; i < mentions.length; i++) {
        const mentionID = mentions[i];

        let mentionObject = await guild.members.fetch({user: [mentionID], force: false});
        if (isExcluding) {
            if (inclusions.includes(mentionID)) {
                return false;
            }
            if (!exclusions.includes(mentionID)) {
                exclusions.push(mentionID);
            }
        } else {
            if (isMember) {
                if (!isMorePowerfulThanMember(guild, author, mentionObject)) {
                    return false;
                }
            } else {
                if (!isMorePowerfulThanRole(guild, author, mentionObject)) {
                    return false;
                }
            }
            if (exclusions.includes(mentionID)) {
                return false;
            }
            if (!inclusions.includes(mentionID)) {
                inclusions.push(mentionID);
            }
        }
    }

    return true;
}

function isMorePowerfulThanMember(guild, guildMember1, guildMember2) {
    // a member is not more powerful than himself
    if (guildMember1.id === guildMember2.id) {
        return false;
    }

    // if one of the members is the owner
    if (guildMember1.id === guild.owner.id) {
        return true;
    }
    if (guildMember2.id === guild.owner.id) {
        return false;
    }

    return guildMember1.roles.highest.comparePositionTo(guildMember2.roles.highest) > 0;
}

function isMorePowerfulThanRole(guild, guildMember, role) {
    if (guildMember.id === guild.owner.id) {
        return true;
    }
    return guildMember.roles.highest.comparePositionTo(role) > 0;
}

client.login(config["bot-token"]);
