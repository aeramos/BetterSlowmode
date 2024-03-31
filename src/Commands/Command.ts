/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2021, 2022, 2024 Alejandro Ramos
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

// @ts-ignore
import ChannelData = require("../ChannelData")

abstract class Command {
    protected readonly id: Discord.Snowflake;

    protected constructor(id: Discord.Snowflake) {
        this.id = id;
    }

    public abstract getName(): string;

    public abstract getHelp(): string;

    public abstract getSlashCommand(): object;

    public abstract tagCommand(channelData: ChannelData | null, parameters: string[], message: Discord.Message): Promise<Discord.MessageOptions>;

    public abstract slashCommand(interaction: Discord.CommandInteraction): Promise<void>;

    /**
     * Converts a time given in seconds to years, days, hours, minutes, and seconds in a user-friendly format.
     *
     * @param totalSeconds
     * @returns a string in the form "1 hour, 23 minutes, 20 seconds"
     * @protected
     */
    protected static getPrettyTime(totalSeconds : number) : string {
        const years = Math.floor(totalSeconds / 31536000);
        const days = Math.floor(totalSeconds % 31536000 / 86400);
        const hours = Math.floor(totalSeconds % 86400 / 3600);
        const minutes = Math.floor(totalSeconds % 3600 / 60);
        const seconds = Math.floor(totalSeconds % 60);

        let string = seconds > 0 ? `${seconds} second` + (seconds > 1 ? "s " : " ") : "";
        string = (minutes > 0 ? `${minutes} minute` + (minutes > 1 ? "s" : "") + (string.length > 0 ? ", " : " ") : "") + string;
        string = (hours > 0 ? `${hours} hour` + (hours > 1 ? "s" : "") + (string.length > 0 ? ", " : " ") : "") + string;
        string = (days > 0 ? `${days} day` + (days > 1 ? "s" : "") + (string.length > 0 ? ", " : " ") : "") + string;
        string = (years > 0 ? `${years} year` + (years > 1 ? "s" : "") + (string.length > 0 ? ", " : " ") : "") + string;

        return string;
    }

    /**
     * Checks if permissions are met in
     * @param author The user whose permissions are being checked
     * @param channel The channel to check permissions in
     * @param userPermissions List of permissions the user must have in the channel
     * @param botPermissions List of permissions this bot must have in the channel
     * @protected
     *
     * @returns A user-friendly list of required user/bot permissions that are missing. Returns an empty string if no permissions are missing.
     */
    protected static getMissingPermissions(author: Discord.GuildMember, channel: Discord.GuildChannel, userPermissions: Map<bigint, string>, botPermissions: Map<bigint, string>): string {
        let output = "";
        const bot = <Discord.GuildMember>author.guild.me;

        let missingPermissions = this.getMissingMemberPermissions(author, channel, userPermissions);
        if (missingPermissions !== "") {
            output += `${author}, you don't have permission to use this command in <#${channel.valueOf()}>. You need: ${missingPermissions}.`;
        }

        missingPermissions = this.getMissingMemberPermissions(bot, channel, botPermissions);
        if (missingPermissions !== "") {
            if (output) {
                output += "\n";
            }
            output += `${author}, this bot does not have permission to use this command in <#${channel.valueOf()}>. The bot needs: ${missingPermissions}.`;
        }

        return output;
    }

    protected static async getSlowmodeSubjects(userIncludes: Discord.GuildMember[], userExcludes: Discord.GuildMember[], roleIncludes: Discord.Role[], roleExcludes: Discord.Role[]): Promise<string> {
        let includes = roleIncludes.length === 0 ? "" : " It specially includes: " + (await Command.getDiscordRoleTags(roleIncludes)).join(", ");
        includes +=    userIncludes.length === 0 ? "" : (includes === "" ? " It specially includes: " : ", ") + (await Command.getDiscordUserTags(userIncludes)).join(", ");
        includes +=    includes === "" ? "" : ".";

        let excludes = roleExcludes.length === 0 ? "" : " It specially excludes: " + (await Command.getDiscordRoleTags(roleExcludes)).join(", ");
        excludes +=    userExcludes.length === 0 ? "" : (excludes === "" ? " It specially excludes: " : ", ") + (await Command.getDiscordUserTags(userExcludes)).join(", ");
        excludes +=    excludes === "" ? "" : ".";

        return " It applies to users without the Administrator, Manage Channel, or Manage Messages permissions in the channel." + includes + excludes;
    }

    /*
        helper function for getMissingPermissions
        returns a string listing the given required permissions that the member lacks in the given channel
        returns an empty string if the member has the permissions
     */
    private static getMissingMemberPermissions(member: Discord.GuildMember, channel: Discord.GuildChannel, requiredPermissions: Map<bigint, string>): String {
        let missingPermissions = "";
        requiredPermissions.forEach((value, key) => {
            if (!channel.permissionsFor(member).has(key)) {
                if (missingPermissions !== "") {
                    missingPermissions += ", ";
                }
                missingPermissions += value;
            }
        });
        return missingPermissions;
    }

    private static async getDiscordUserTags(members: Discord.GuildMember[]): Promise<string[]> {
        const array = [];
        for (const member of members) {
            array.push("@" + member.user.tag);
        }
        return array;
    }

    private static async getDiscordRoleTags(roles: Discord.Role[]): Promise<string[]> {
        const array = [];
        for (const role of roles) {
            array.push("@" + role.name);
        }
        return array;
    }
}
export = Command;
