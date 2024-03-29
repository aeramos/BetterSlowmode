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

import Discord = require("discord.js");
import Command = require("./Command");
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";

// @ts-ignore
import ChannelData = require("../ChannelData");
// @ts-ignore
import Database = require("../Database");

class Set extends Command {
    protected static readonly SLOWMODE_TYPE: boolean | null = null;
    protected static readonly SLASH_COMMAND_OPTIONS: object[] = [
        {
            type: ApplicationCommandOptionTypes.NUMBER,
            name: "days",
            description: "The number of days to add to the slowmode length.",
            required: false,
            min_value: 0,
            max_value: 364
        },
        {
            type: ApplicationCommandOptionTypes.NUMBER,
            name: "hours",
            description: "The number of hours to add to the slowmode length.",
            required: false,
            min_value: 0,
            max_value: 23
        },
        {
            type: ApplicationCommandOptionTypes.NUMBER,
            name: "minutes",
            description: "The number of minutes to add to the slowmode length.",
            required: false,
            min_value: 0,
            max_value: 59
        },
        {
            type: ApplicationCommandOptionTypes.NUMBER,
            name: "seconds",
            description: "The number of seconds to add to the slowmode length.",
            required: false,
            min_value: 0,
            max_value: 60
        },
        {
            type: ApplicationCommandOptionTypes.MENTIONABLE,
            name: "include",
            description: "User or role to include to the slowmode.",
            required: false
        },
        {
            type: ApplicationCommandOptionTypes.MENTIONABLE,
            name: "exclude",
            description: "User or role to exclude from the slowmode.",
            required: false
        }
    ];

    private readonly database: Database;
    private readonly subjectToSlowmode: CallableFunction;

    public constructor(id: Discord.Snowflake, database: Database, subjectToSlowmode: CallableFunction) {
        super(id);
        this.database = database;
        this.subjectToSlowmode = subjectToSlowmode;
    }

    public getName(): string {
        return "set";
    }

    public getHelp(): string {
        return `Usage: <@${this.id}> \`set <length> [-exclude <users/roles>] [-include <users/roles>]\`` +
            "\nSets a slowmode of the given length (in the format: `1y 1d 1h 1m 1s`) and optionally includes/excludes users or roles." +
            "\nLength must be at least 1 second and no more than 1 year.";
    }

    public getSlashCommand(): object {
        return {
            type: ApplicationCommandOptionTypes.SUB_COMMAND,
            name: "set",
            description: "Sets a slowmode of the given length and optionally includes/excludes users or roles.",
            options: Set.SLASH_COMMAND_OPTIONS
        }
    }

    public async tagCommand(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<Discord.MessageOptions> {
        if (parameters.length === 0) {
            return {
                content: `${message.author}, you need to add parameters to this command. For more info enter: <@${this.id}> \`help ${this.getName()}\``
            }
        }

        const guild: Discord.Guild = <Discord.Guild>message.guild
        const author: Discord.GuildMember = <Discord.GuildMember>message.member;

        // instantiate slowmode settings
        let length: number = 0;
        const userInclusions: globalThis.Set<string> = new globalThis.Set<string>();
        const userExclusions: globalThis.Set<string> = new globalThis.Set<string>();
        const roleInclusions: globalThis.Set<string> = new globalThis.Set<string>();
        const roleExclusions: globalThis.Set<string> = new globalThis.Set<string>();

        // used for final fetching of Discord objects before getting passed to next function
        let userInclusionObjects: Discord.GuildMember[];
        let userExclusionObjects: Discord.GuildMember[];
        let roleInclusionObjects: Discord.Role[] = [];
        let roleExclusionObjects: Discord.Role[] = [];

        let isExcluding: boolean | null = null;
        let providedTags: boolean = false;

        // parse each parameter
        for (let parameter of parameters) {
            // matches a hyphen, en dash, or em dash
            if (parameter.startsWith("-") || parameter.startsWith("\u2013") || parameter.startsWith("\u2014")) {
                switch (parameter.slice(1)) {
                    case "exclude":
                        isExcluding = true;
                        providedTags = false;
                        break;
                    case "include":
                        isExcluding = false;
                        providedTags = false;
                        break;
                    default:
                        return {
                            content: `${message.author}, \`-\` must be followed by \`include\` or \`exclude\`.`
                        }
                }
            } else if (parameter.match(/^\d/)) { // if the parameter starts with a number it can only be the length
                // example: set -include 1h
                if (isExcluding !== null && !providedTags) {
                    return {
                        content: `${message.author}, \`-include\` or \`-exclude\` must be followed by the tags of users or roles.`
                    }
                }
                isExcluding = null;

                let addedTime: number;
                try {
                    // if properly formatted "15m", will remove the m and leave 15
                    addedTime = Number(parameter.slice(0, -1));
                } catch (e) { // example: 15min. must be 15m
                    return {
                        content: `${message.author}, length must be in format "15m 30s" for example. For more info enter: <@${this.id}> \`help ${this.getName()}\``
                    }
                }

                // switch statement breaks everything down to milliseconds and adds it to length
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
                        break;
                    default:
                        return {
                            content: `${message.author}, length must be in format "15m 30s" for example. For more info enter: <@${this.id}> \`help ${this.getName()}\``
                        }
                }
                length += addedTime;
            } else { // this string must contain the parameter passed to an option: the tag of a user or role to exclude/include
                // if we were given a tag but we are not excluding or including, something is wrong
                if (isExcluding === null) {
                    return {
                        content: `${message.author}, tags must be given after \`-include\` or \`-exclude\`.`
                    }
                }
                // test to see if it contains channel or user tags, any number of them (at least 1), and nothing more
                if (!new RegExp(/^(<(@|@!|@&)\d{1,20}>)+$/).test(parameter)) {
                    return {
                        content: `${message.author}, invalid tags. Example: <@${this.id}> \`set 1h -exclude\` ${message.author}`
                    }
                }
                providedTags = true;

                // put each mention in an array that just contains the ids
                if (isExcluding) {
                    (parameter.match(/<@\d{1,20}>/g) || []).forEach((e, i, a) => {
                        a[i] = e.slice(2, -1)
                        userExclusions.add(a[i])
                    });
                    (parameter.match(/<@!\d{1,20}>/g) || []).forEach((e, i, a) => {
                        a[i] = e.slice(3, -1)
                        userExclusions.add(a[i])
                    });
                    (parameter.match(/<@&\d{1,20}>/g) || []).forEach((e, i, a) => {
                        a[i] = e.slice(3, -1)
                        roleExclusions.add(a[i])
                    });
                } else {
                    (parameter.match(/<@\d{1,20}>/g) || []).forEach((e, i, a) => {
                        a[i] = e.slice(2, -1)
                        userInclusions.add(a[i])
                    });
                    (parameter.match(/<@!\d{1,20}>/g) || []).forEach((e, i, a) => {
                        a[i] = e.slice(3, -1)
                        userInclusions.add(a[i])
                    });
                    (parameter.match(/<@&\d{1,20}>/g) || []).forEach((e, i, a) => {
                        a[i] = e.slice(3, -1)
                        roleInclusions.add(a[i])
                    });
                }
            }
        }
        // example: set -include
        if (isExcluding !== null && !providedTags) {
            return {
                content: `${message.author}, \`-include\` or \`-exclude\` must be followed by the tags of users or roles.`
            }
        }

        // limit slowmode length to 1 year
        if (length === 0 || length > 31536000) {
            return {
                content: `${message.author}, length must be at least 1 second and no longer than 1 year.`
            }
        }

        // throw error if any of the specified users/roles do not exist
        // fetch userInclusionObjects
        let temp: any = await guild.members.fetch({
            user: Array.from(userInclusions.values()),
            withPresences: false,
            force: true,
            time: 10000
        });
        if (temp.size === userInclusions.size) {
            userInclusionObjects = Array.from(temp.values());
        } else {
            return {
                content: `${author}, I could not find the user you mentioned. Are you sure they're in this server?`
            }
        }

        // fetch userExclusionObjects
        temp = await guild.members.fetch({
            user: Array.from(userExclusions.values()),
            withPresences: false,
            force: true,
            time: 10000
        });
        if (temp.size === userExclusions.size) {
            userExclusionObjects = Array.from(temp.values());
        } else {
            return {
                content: `${author}, I could not find the user you mentioned. Are you sure they're in this server?`
            }
        }

        // fetch roleInclusionObjects
        for (const roleInclusion of roleInclusions) {
            temp = await guild.roles.fetch(roleInclusion, {
                cache: true,
                force: true
            });
            if (temp) {
                roleInclusionObjects.push(temp)
            } else {
                return {
                    content: `${author}, I could not find the role you mentioned. Are you sure it's in this server?`
                }
            }
        }

        // fetch roleExclusionObjects
        for (const roleExclusion of roleExclusions) {
            temp = await guild.roles.fetch(roleExclusion, {
                cache: true,
                force: true
            });
            if (temp) {
                roleExclusionObjects.push(temp)
            } else {
                return {
                    content: `${author}, I could not find the role you mentioned. Are you sure it's in this server?`
                }
            }
        }

        return {
            content: await this.command(author, <Discord.TextChannel>message.channel, guild, channelData, length, userInclusionObjects, userExclusionObjects, roleInclusionObjects, roleExclusionObjects)
        }
    }

    public async slashCommand(interaction: Discord.CommandInteraction): Promise<void> {
        // sum days/hours/minutes/seconds to get length in seconds
        const length = ((((((interaction.options.getNumber("days", false) || 0) * 24) + (interaction.options.getNumber("hours", false) || 0)) * 60) +
            (interaction.options.getNumber("minutes", false) || 0)) * 60) + (interaction.options.getNumber("seconds", false) || 0);

        if (length === 0) {
            return interaction.reply({
                content: "Length must be at least 1 second and no longer than 1 year."
            });
        }

        let userIncludes: Discord.GuildMember[] = [];
        let userExcludes: Discord.GuildMember[] = [];
        let roleIncludes: Discord.Role[] = [];
        let roleExcludes: Discord.Role[] = [];

        let include = interaction.options.getMentionable("include", false);
        if (include !== null) {
            if (include instanceof Discord.GuildMember) {
                userIncludes.push(include);
            } else {
                roleIncludes.push(<Discord.Role>include);
            }
        }
        let exclude = interaction.options.getMentionable("exclude", false);
        if (exclude !== null) {
            if (exclude instanceof Discord.GuildMember) {
                userExcludes.push(exclude);
            } else {
                roleExcludes.push(<Discord.Role>exclude);
            }
        }

        return interaction.reply({
            content: await this.command(<Discord.GuildMember>interaction.member, <Discord.TextChannel>interaction.channel, <Discord.Guild>interaction.guild, undefined, length, userIncludes, userExcludes, roleIncludes, roleExcludes)
        })
    }

    /**
     * Sets a slowmode with the given options and returns a confirmation message to the user or an error message if the user lacks permissions.
     *
     * Length of the slowmode must be given in seconds.
     */
    private async command(author: Discord.GuildMember, channel: Discord.TextChannel, guild: Discord.Guild, channelData: ChannelData, length: number,
                          userInclusions: Discord.GuildMember[], userExclusions: Discord.GuildMember[],
                          roleInclusions: Discord.Role[], roleExclusions: Discord.Role[]): Promise<string> {
        // check that the member has the permissions to use this command
        const missingPermissions = Command.getMissingPermissions(author, channel, new Map([[Discord.Permissions.FLAGS.MANAGE_CHANNELS, "Manage Channel"]]), new Map([[Discord.Permissions.FLAGS.MANAGE_MESSAGES, "Manage Messages"]]));
        if (missingPermissions) {
            return missingPermissions;
        }

        // check that the member has the right to add the users/roles they mentioned
        const invalidExceptions = await Set.checkExceptions(author, userInclusions, userExclusions, roleInclusions, roleExclusions);
        if (invalidExceptions) {
            return invalidExceptions;
        }

        if (this.subjectToSlowmode(author, channel, channelData || await this.database.getChannel(channel.id))) {
            return `${author}, you cannot remove the slowmode on <#${channel.id}> because you are subject to it.`;
        }

        // set the slowmode in the database and tell the Discord user it's done
        const SLOWMODE_TYPE: boolean | null = (<typeof Set>this.constructor).SLOWMODE_TYPE;
        await this.database.setChannel(new ChannelData(channel.id, guild.id, length, SLOWMODE_TYPE, Set.getIDs(userExclusions), Set.getIDs(userInclusions), Set.getIDs(roleExclusions), Set.getIDs(roleInclusions), [], []));
        return Command.getPrettyTime(length) + (SLOWMODE_TYPE === true ? "text" : SLOWMODE_TYPE === false ? "image" : "text and image") + " slowmode has been set!" + await Command.getSlowmodeSubjects(userInclusions, userExclusions, roleInclusions, roleExclusions);
    }

    /**
     *  @returns an error message if the given member does not have the right to add the given users or roles or if they don't exist.
     */
    private static async checkExceptions(author: Discord.GuildMember, userInclusions: Discord.GuildMember[], userExclusions: Discord.GuildMember[], roleInclusions: Discord.Role[], roleExclusions: Discord.Role[]): Promise<string> {
        const guild = author.guild;
        for (const includedUser of userInclusions) {
            if (!Set.isMorePowerfulThanMember(guild, author, includedUser)) {
                return `${author}, you can only include users whose highest role is ordered lower than your highest role. You can never include the owner or yourself.`;
            }
        }
        for (const excludedUser of userExclusions) {
            if (userInclusions.some(user => user.id === excludedUser.id)) {
                return `${author}, you can not exclude a user or role that is already included.`;
            }
        }
        for (const includedRole of roleInclusions) {
            if (!Set.isMorePowerfulThanRole(guild, author, includedRole)) {
                return `${author}, you can only include roles that are ordered lower than your highest role.`;
            }
        }
        for (const excludedRole of roleExclusions) {
            if (roleInclusions.some(role => role.id === excludedRole.id)) {
                return `${author}, you can not exclude a user or role that is already included.`;
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
        if (member1.id === guild.ownerId) {
            return true;
        }
        if (member2.id === guild.ownerId) {
            return false;
        }

        return member1.roles.highest.comparePositionTo(member2.roles.highest) > 0;
    }

    private static isMorePowerfulThanRole(guild: Discord.Guild, member: Discord.GuildMember, role: Discord.Role): boolean {
        if (member.id === guild.ownerId) {
            return true;
        }
        return member.roles.highest.comparePositionTo(role) > 0;
    }

    /**
     * @returns array of the IDs of the given members or roles
     */
    private static getIDs(objects: Discord.GuildMember[] | Discord.Role[]): Discord.Snowflake[] {
        let ids = [];
        for (const item of objects) {
            ids.push(item.id);
        }
        return ids;
    }
}
export = Set;
