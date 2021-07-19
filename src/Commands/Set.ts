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

import Discord = require("discord.js");
import Command = require("./Command");
// @ts-ignore
import ChannelData = require("../ChannelData");
// @ts-ignore
import Database = require("../Database");

class Set extends Command {
    protected static readonly SLOWMODE_TYPE: boolean | null = null;
    private readonly database: Database;

    public constructor(prefix: string, database: Database) {
        super(prefix);
        this.database = database;
    }

    public async command(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<string> {
        const SLOWMODE_TYPE: boolean | null = (<typeof Set>this.constructor).SLOWMODE_TYPE;

        if (parameters.length === 0) {
            return `${message.author}, you need to add parameters to this command. Use \`` + this.prefix + "help " + this.getName() + "` for more info.";
        }

        // instantiate slowmode settings
        let length: bigint = BigInt(0);
        const userExclusions: string[] = [];
        const userInclusions: string[] = [];
        const roleExclusions: string[] = [];
        const roleInclusions: string[] = [];

        let isExcluding: boolean | null = null;
        let providedTags: boolean = false;

        // parse each parameter
        for (let parameter of parameters) {
            if (parameter.startsWith("--")) {
                switch (parameter.slice(2)) {
                    case "exclude":
                        isExcluding = true;
                        providedTags = false;
                        break;
                    case "include":
                        isExcluding = false;
                        providedTags = false;
                        break;
                    default:
                        return `${message.author}, \`--\` must be followed by \`include\` or \`exclude\`.`;
                }
            } else if (parameter.match(/^\d/)) { // if the parameter starts with a number it can only be the length
                // example: set --include 1h
                if (isExcluding !== null && !providedTags) {
                    return `${message.author}, \`--include\` or \`--exclude\` must be followed by the tags of users or roles.`;
                }
                isExcluding = null;

                let addedTime;
                try {
                    // if properly formatted "15m", will remove the m and leave 15
                    addedTime = BigInt(parameter.slice(0, -1));
                } catch (e) { // example: 15min. must be 15m
                    return `${message.author}. length must be in format "15m 30s" for example. Use \`` + this.prefix + "help " + this.getName() + "` for more info.";
                }

                // switch statement breaks everything down to milliseconds and adds it to length
                // noinspection FallThroughInSwitchStatementJS
                switch (parameter.slice(-1)) {
                    case "y":
                        addedTime *= BigInt(365);
                    case "d":
                        addedTime *= BigInt(24);
                    case "h":
                        addedTime *= BigInt(60);
                    case "m":
                        addedTime *= BigInt(60);
                    case "s":
                        addedTime *= BigInt(1000);
                        break;
                    default:
                        return `${message.author}. length must be in format "15m 30s" for example. Use \`` + this.prefix + "help " + this.getName() + "` for more info.";
                }
                length += addedTime;
            } else { // this string must contain the parameter passed to an option: the tag of a user or role to exclude/include
                // if we were given a tag but we are not excluding or including, something is wrong
                if (isExcluding === null) {
                    return `${message.author}, tags must be given after \`--include\` or \`--exclude\`.`;
                }
                // test to see if it contains channel or user tags, any number of them (at least 1), and nothing more
                if (!new RegExp(/^(<(@|@!|@&)\d{1,20}>)+$/).test(parameter)) {
                    return `${message.author}. invalid tags. Example: ${this.prefix}set 1h --exclude ${message.author}`;
                }
                providedTags = true;

                // put each mention in an array that just contains the id
                const userMentions: string[] = [];
                let temp = parameter.match(/<@\d{1,20}>/g);
                if (temp !== null) {
                    temp.forEach((e, i, a) => a[i] = e.slice(2, -1))
                    Array.prototype.push.apply(userMentions, temp);
                }

                temp = parameter.match(/<@!\d{1,20}>/g);
                if (temp !== null) {
                    temp.forEach((e, i, a) => a[i] = e.slice(3, -1))
                    Array.prototype.push.apply(userMentions, temp);
                }

                let roleMentions: string[] = [];
                temp = parameter.match(/<@&\d{1,20}>/g);
                if (temp !== null) {
                    temp.forEach((e, i, a) => a[i] = e.slice(3, -1))
                    roleMentions = temp;
                }

                // place the exclusions/inclusions into their respective arrays. cancel the set operation if there is an error
                const exceptionErrors = await Promise.all([
                    Set.handleExclusions(<Discord.GuildMember>message.member, userMentions, userExclusions, userInclusions, isExcluding, true),
                    Set.handleExclusions(<Discord.GuildMember>message.member, roleMentions, roleExclusions, roleInclusions, isExcluding, false)])
                        .then(results => {
                            if (results[0]) {
                                if (results[1]) {
                                    return results[0] + "\n" + results[1];
                                }
                                return results[0];
                            }
                            return results[1];
                        });
                if (exceptionErrors) {
                    return exceptionErrors;
                }
            }
        }
        // example: set --include
        if (isExcluding !== null && !providedTags) {
            return `${message.author}, \`--include\` or \`--exclude\` must be followed by the tags of users or roles.`;
        }

        // limit slowmode length to 1 year
        if (length === BigInt(0) || length > BigInt(31536000000)) {
            return `${message.author}, length must be at least 1 second and no longer than 1 year.`;
        }

        // set the slowmode in the database and tell the Discord user it's done
        await this.database.setChannel(new ChannelData(message.channel.id, (<Discord.Guild>message.guild).id, length, SLOWMODE_TYPE, userExclusions, userInclusions, roleExclusions, roleInclusions, [], []));
        return Command.getPrettyTime(length / BigInt(1000)) + `${SLOWMODE_TYPE === true ? "text" : SLOWMODE_TYPE === false ? "image" : "text and image"} slowmode has been set!`;
    }

    public getHelp(): string {
        return "```" + this.prefix + "set <length> [--exclude <users/roles>] [--include <users/roles>]```" +
            "Sets a slowmode using the given length (in the format: `1y 1d 1h 1m 1s`), and optionally excludes or includes users or roles in this server." +
            "\nYou can only `--include` users or roles that are less powerful than you." +
            "\nYou can not `--include` users/roles that have already been `--excluded`, and vice versa." +
            "\nLength must be at least 1 second and no more than 1 year.";
    }

    public getName(): string {
        return "set";
    }

    public getUserPermissions(): Map<number, string> {
        return new Map([[Discord.Permissions.FLAGS.MANAGE_CHANNELS, "Manage Channel"]]);
    }

    public getBotPermissions(): Map<number, string> {
        return new Map([[Discord.Permissions.FLAGS.MANAGE_MESSAGES, "Manage Messages"]]);
    }

    /*
        modifies the given exception arrays so they contain the given mentions properly
        returns true if there was no problem with the exceptions. returns false if there was
     */
    private static async handleExclusions(author: Discord.GuildMember, mentions: string[], exclusions: string[], inclusions: string[], isExcluding: boolean, isMember: boolean): Promise<string> {
        const guild = author.guild;
        for (const mentionID of mentions) {
            if (isExcluding) {
                if (inclusions.includes(mentionID)) {
                    return `${author}, you can not exclude a user or role that is already included.`;
                }
                if (!exclusions.includes(mentionID)) {
                    exclusions.push(mentionID);
                }
            } else {
                if (isMember) {
                    const member: Discord.GuildMember | null = await guild.members.fetch({user: mentionID, cache: true, force: true}).catch(() => {
                        return null;
                    });
                    if (member === null) {
                        return `${author}, could not find the user you mentioned. Are you sure they're in this server?`;
                    }
                    if (!Set.isMorePowerfulThanMember(guild, author, member)) {
                        return `${author}, you can only include users whose highest role is ordered lower than your highest role. You can never include the owner or yourself.`;
                    }
                } else {
                    const role: Discord.Role | null = await guild.roles.fetch(mentionID, true, true);
                    if (role === null) {
                        return `${author}, could not find the role you mentioned. Are you sure it's in this server?`;
                    }

                    if (!Set.isMorePowerfulThanRole(guild, author, role)) {
                        return `${author}, you can only include roles that are ordered lower than your highest role.`;
                    }
                }
                if (exclusions.includes(mentionID)) {
                    return `${author}, you can not include a user or role that is already excluded.`;
                }
                if (!inclusions.includes(mentionID)) {
                    inclusions.push(mentionID);
                }
            }
        }
        return "";
    }

    private static isMorePowerfulThanMember(guild: Discord.Guild, member1: Discord.GuildMember, member2: Discord.GuildMember): boolean {
        // a member is not more powerful than himself
        if (member1.id === member2.id) {
            return false;
        }

        // if one of the members is the owner
        if (member1.id === guild.ownerID) {
            return true;
        }
        if (member2.id === guild.ownerID) {
            return false;
        }

        return member1.roles.highest.comparePositionTo(member2.roles.highest) > 0;
    }

    private static isMorePowerfulThanRole(guild: Discord.Guild, member: Discord.GuildMember, role: Discord.Role): boolean {
        if (member.id === guild.ownerID) {
            return true;
        }
        return member.roles.highest.comparePositionTo(role) > 0;
    }
}
export = Set;
