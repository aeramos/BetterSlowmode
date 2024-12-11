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

import Discord from "discord.js";
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";

import Command from "./Command.js";
// @ts-ignore
import ChannelData from "../ChannelData.js";
// @ts-ignore
import Database from "../Database.js";

/**
 * The Set command handles the creation of new slowmodes.
 *
 * By default, this bot's slowmodes follow the same permissions and rules as a default slowmode: users may send only one
 * message within a given interval. This bot allows the interval to be any length between 1 second and 1 year. Users who
 * attempt to send a message during this time will be prevented, or in the case of this bot (due to API limitations),
 * their message will be deleted immediately after it is sent. These slowmodes apply to users who lack the "Manage
 * Messages", "Manage Channels", or "Administrator" permissions in the affected channel.
 *
 * This bot also features additional configuration options that the default Discord slowmode lacks. The `include` option
 * allows the creation of slowmodes that apply to users or roles that would normally be immune because of the Discord
 * permission they have. The `exclude` option has the opposite effect. If a user is included at one level, and excluded
 * in another, their user-level exception will take precedence. If a user is both included and excluded at the role
 * level, the status of their higher-ranked role in the Discord UI will take precedence.
 *
 * @see SetText
 * @see SetImage
 */
class Set extends Command {
    /**
     * The type of slowmode this command creates. Null indicates a normal slowmode.
     *
     * @see SetText
     * @see SetImage
     * @see Database
     */
    protected static readonly SLOWMODE_TYPE: boolean | null = null;

    /**
     * Slash command information to send through the REST API during initial registration on bot startup.
     *
     * @see https://v13.discordjs.guide/interactions/slash-commands.html Discord.js documentation
     * @see https://discord.com/developers/docs/interactions/application-commands Discord Application Commands documentation
     * @protected
     */
    protected static readonly SLASH_COMMAND_OPTIONS: object[] = [
        {
            type: ApplicationCommandOptionTypes.INTEGER,
            name: "days",
            description: "The number of days to add to the slowmode length.",
            required: false,
            min_value: 0,
            max_value: 364
        },
        {
            type: ApplicationCommandOptionTypes.INTEGER,
            name: "hours",
            description: "The number of hours to add to the slowmode length.",
            required: false,
            min_value: 0,
            max_value: 23
        },
        {
            type: ApplicationCommandOptionTypes.INTEGER,
            name: "minutes",
            description: "The number of minutes to add to the slowmode length.",
            required: false,
            min_value: 0,
            max_value: 59
        },
        {
            type: ApplicationCommandOptionTypes.INTEGER,
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

    public async tagCommand(channelData: ChannelData | null, parameters: string[], message: Discord.Message): Promise<Discord.MessageOptions> {
        if (parameters.length === 0) {
            return {
                content: `${message.author}, you need to add parameters to this command. For more info enter: <@${this.id}> \`help ${this.getName()}\``
            }
        }

        const guild: Discord.Guild = <Discord.Guild>message.guild
        const author: Discord.GuildMember = <Discord.GuildMember>message.member;

        // instantiate slowmode settings
        let length: number = 0;
        const userInclusions: globalThis.Set<Discord.Snowflake> = new globalThis.Set<Discord.Snowflake>();
        const userExclusions: globalThis.Set<Discord.Snowflake> = new globalThis.Set<Discord.Snowflake>();
        const roleInclusions: globalThis.Set<Discord.Snowflake> = new globalThis.Set<Discord.Snowflake>();
        const roleExclusions: globalThis.Set<Discord.Snowflake> = new globalThis.Set<Discord.Snowflake>();

        // used for final fetching of Discord objects before getting passed to next function
        let userInclusionObjects: globalThis.Set<Discord.GuildMember> = new globalThis.Set<Discord.GuildMember>();
        let userExclusionObjects: globalThis.Set<Discord.GuildMember> = new globalThis.Set<Discord.GuildMember>();
        let roleInclusionObjects: globalThis.Set<Discord.Role> = new globalThis.Set<Discord.Role>();
        let roleExclusionObjects: globalThis.Set<Discord.Role> = new globalThis.Set<Discord.Role>();

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
                    if (!Number.isInteger(addedTime)) {
                        return {
                           content: `${message.author}, length must not be specified with any decimals.`
                        }
                    }
                    // this shouldn't happen due to input validation above (all types of dashes are considered the start of an option, like -include)
                    // still checking in case another symbol to make a number negative is introduced
                    if (addedTime < 0) {
                        return {
                            content: `${message.author}, length must not be specified with any negative numbers.`
                        }
                    }
                } catch (e) { // example: 15min. must be 15m
                    return {
                        content: `${message.author}, length must be specified in the format "15m 30s" for example. For help enter: <@${this.id}> \`help ${this.getName()}\`.`
                    }
                }

                // break everything down to seconds and adds it to length
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
                            content: `${message.author}, length must be specified in the format "15m 30s" for example. For help enter: <@${this.id}> \`help ${this.getName()}\`.`
                        }
                }
                length += addedTime;
            } else { // this string must contain the parameter passed to an option: the tag of a user or role to exclude/include
                // if we were given a tag, but we are not excluding or including, something is wrong
                if (isExcluding === null) {
                    return {
                        content: `${message.author}, tags must be given after \`-include\` or \`-exclude\`.`
                    }
                }
                // test to see if it contains channel or user tags, any number of them (at least 1), and nothing more
                if (!new RegExp(/^(<(@|@!|@&)\d{1,20}>)+$/).test(parameter)) {
                    return {
                        content: `${message.author}, invalid tags. Example: <@${this.id}> \`set 1h -exclude\` ${message.author}.`
                    }
                }
                providedTags = true;

                // put each mention in the correct array that just contains the ids
                if (isExcluding) {
                    // get user tags as an array. trim the brackets and @ from each one. add the resulting userIDs to the userExclusions list
                    (parameter.match(/<@\d{1,20}>/g) || []).forEach(tag => {
                        userExclusions.add(tag.slice(2, -1));
                    });
                    (parameter.match(/<@!\d{1,20}>/g) || []).forEach(tag => {
                        userExclusions.add(tag.slice(3, -1));
                    });
                    (parameter.match(/<@&\d{1,20}>/g) || []).forEach(tag => {
                        roleExclusions.add(tag.slice(3, -1));
                    });
                } else {
                    (parameter.match(/<@\d{1,20}>/g) || []).forEach(tag => {
                        userInclusions.add(tag.slice(2, -1))
                    });
                    (parameter.match(/<@!\d{1,20}>/g) || []).forEach(tag => {
                        userInclusions.add(tag.slice(3, -1))
                    });
                    (parameter.match(/<@&\d{1,20}>/g) || []).forEach(tag => {
                        roleInclusions.add(tag.slice(3, -1))
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
        if (length < 1 || length > 31536000) {
            return {
                content: `${message.author}, length must be at least 1 second and no longer than 1 year.`
            }
        }

        // throw error if any of the specified users/roles do not exist
        // fetch userInclusionObjects
        let temp: any = await Command.getMembers(userInclusions, guild, author);
        if (typeof temp === "string") {
            return {
                content: temp
            };
        } else {
            userInclusionObjects = temp;
        }

        // fetch userExclusionObjects
        temp = await Command.getMembers(userExclusions, guild, author);
        if (typeof temp === "string") {
            return {
                content: temp
            };
        } else {
            userExclusionObjects = temp;
        }

        // fetch roleInclusionObjects
        temp = await Command.getRoles(roleInclusions, guild, author);
        if (typeof temp === "string") {
            return {
                content: temp
            };
        } else {
            roleInclusionObjects = temp;
        }

        // fetch roleExclusionObjects
        temp = await Command.getRoles(roleExclusions, guild, author);
        if (typeof temp === "string") {
            return {
                content: temp
            };
        } else {
            roleExclusionObjects = temp;
        }

        return {
            content: await this.command(author, <Discord.TextChannel>message.channel, guild, channelData, length, userInclusionObjects, userExclusionObjects, roleInclusionObjects, roleExclusionObjects)
        }
    }

    public async slashCommand(interaction: Discord.CommandInteraction): Promise<void> {
        const channel: Discord.TextChannel = <Discord.TextChannel>interaction.channel;
        if (!channel.viewable) {
            return interaction.reply({
                content: `The bot does not have permission to view ${channel}.`
            });
        }

        // sum days/hours/minutes/seconds to get length in seconds
        const length = ((((((interaction.options.getInteger("days", false) || 0) * 24) + (interaction.options.getInteger("hours", false) || 0)) * 60) +
            (interaction.options.getInteger("minutes", false) || 0)) * 60) + (interaction.options.getInteger("seconds", false) || 0);

        if (length === 0) {
            return interaction.reply({
                content: "Length must be at least 1 second and no longer than 1 year."
            });
        }

        let userIncludes: globalThis.Set<Discord.GuildMember> = new globalThis.Set<Discord.GuildMember>();
        let userExcludes: globalThis.Set<Discord.GuildMember> = new globalThis.Set<Discord.GuildMember>();
        let roleIncludes: globalThis.Set<Discord.Role> = new globalThis.Set<Discord.Role>();
        let roleExcludes: globalThis.Set<Discord.Role> = new globalThis.Set<Discord.Role>();

        let include = interaction.options.getMentionable("include", false);
        if (include !== null) {
            if (include instanceof Discord.GuildMember) {
                userIncludes.add(include);
            } else {
                roleIncludes.add(<Discord.Role>include);
            }
        }
        let exclude = interaction.options.getMentionable("exclude", false);
        if (exclude !== null) {
            if (exclude instanceof Discord.GuildMember) {
                userExcludes.add(exclude);
            } else {
                roleExcludes.add(<Discord.Role>exclude);
            }
        }

        return interaction.reply({
            content: await this.command(<Discord.GuildMember>interaction.member, channel, <Discord.Guild>interaction.guild, await this.database.getChannel(interaction.channelId), length, userIncludes, userExcludes, roleIncludes, roleExcludes)
        })
    }

    /**
     * Sets a new slowmode in the current channel, replacing the existing one if necessary and if the requester is not subject to it.
     *
     * @param author The requester. Must have Manage Messages permissions in the channel.
     * @param channel The channel the request was made in.
     * @param guild The server this is happening in.
     * @param channelData Current slowmode data for the channel, null if there is no slowmode present. This will be overwritten.
     * @param length The length of the new slowmode, in seconds.
     * @param userInclusions Set of members to include in the slowmode. The author must be more powerful than them.
     * @param userExclusions Set of members to exclude from the slowmode. They must not already be included.
     * @param roleInclusions Set of roles to include in the slowmode. The author's highest role must be higher than them.
     * @param roleExclusions Set of roles to exclude from the slowmode. They must not already be included.
     *
     * @returns A message to send to the user stating if the slowmode was successfully set or not.
     * @private
     */
    private async command(author: Discord.GuildMember, channel: Discord.TextChannel, guild: Discord.Guild, channelData: ChannelData | null, length: number,
                          userInclusions: globalThis.Set<Discord.GuildMember>, userExclusions: globalThis.Set<Discord.GuildMember>,
                          roleInclusions: globalThis.Set<Discord.Role>, roleExclusions: globalThis.Set<Discord.Role>): Promise<string> {
        // check that the member has the permissions to use this command
        const missingPermissions = Command.getMissingPermissions(author, channel, new Map([[Discord.Permissions.FLAGS.MANAGE_CHANNELS, "Manage Channel"]]), new Map([[Discord.Permissions.FLAGS.MANAGE_MESSAGES, "Manage Messages"]]));
        if (missingPermissions) {
            return missingPermissions;
        }

        // check that the member has the right to add the users/roles they mentioned
        const invalidExceptions = await Set.checkExceptions(author, Array.from(userInclusions.values()), Array.from(userExclusions.values()), Array.from(roleInclusions.values()), Array.from(roleExclusions.values()));
        if (invalidExceptions) {
            return invalidExceptions;
        }

        if (this.subjectToSlowmode(author, channel, channelData)) {
            return `${author}, you cannot replace the slowmode on <#${channel.id}> because you are subject to it.`;
        }

        // set the slowmode in the database and tell the Discord user it's done
        const SLOWMODE_TYPE: boolean | null = (<typeof Set>this.constructor).SLOWMODE_TYPE;
        await this.database.setChannel(new ChannelData(channel.id, guild.id, length, SLOWMODE_TYPE, Set.getIDs(Array.from(userExclusions.values())), Set.getIDs(Array.from(userInclusions.values())), Set.getIDs(Array.from(roleExclusions.values())), Set.getIDs(Array.from(roleInclusions.values())), [], []));
        return Command.getPrettyTime(length) + (SLOWMODE_TYPE === true ? "text" : SLOWMODE_TYPE === false ? "image" : "text and image") + " slowmode has been set!" + await Command.getSlowmodeSubjects(Array.from(userInclusions.values()), Array.from(userExclusions.values()), Array.from(roleInclusions.values()), Array.from(roleExclusions.values()));
    }

    /**
     * Checks that the given slowmode exceptions are allowed.
     *
     * @param author The user making the request.
     * @param userInclusions The users to include. None of them can be the owner or the author, and their highest roles
     * must be lower than the author's.
     * @param userExclusions The users to exclude. None of them can be included already.
     * @param roleInclusions The roles to include. They must be ordered lower than the author's highest role.
     * @param roleExclusions The roles to exclude. None of them can be included already.
     *
     * @returns An error message if the author is not powerful enough to include the users/roles or if they contradict
     * each other.
     * @private
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

    /**
     * @returns True if member1 is the owner or if their highest role is ordered above member2's. Returns false if
     * member1 and member2 are the same.
     * @private
     */
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

    /**
     * @returns True if the user's highest role is higher than the given role.
     * @private
     */
    private static isMorePowerfulThanRole(guild: Discord.Guild, member: Discord.GuildMember, role: Discord.Role): boolean {
        if (member.id === guild.ownerId) {
            return true;
        }
        return member.roles.highest.comparePositionTo(role) > 0;
    }

    /**
     * @returns An array of the IDs of the given member or role objects.
     */
    private static getIDs(objects: Discord.GuildMember[] | Discord.Role[]): Discord.Snowflake[] {
        let ids = [];
        for (const item of objects) {
            ids.push(item.id);
        }
        return ids;
    }
}
export default Set;
