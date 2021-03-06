/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2021 Alejandro Ramos
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

// @ts-ignore
import ChannelData = require("../ChannelData")
import Discord = require("discord.js");

abstract class Command {
    protected readonly prefix: string;

    public constructor(prefix: string) {
        this.prefix = prefix;
    }

    public abstract command(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<string>;

    public abstract getHelp() : string;

    public abstract getName() : string;

    protected static getPrettyTime(totalSeconds : bigint) : string {
        const years = totalSeconds / BigInt(31536000);
        const days = totalSeconds % BigInt(31536000) / BigInt(86400);
        const hours = totalSeconds % BigInt(86400) / BigInt(3600);
        const minutes = totalSeconds % BigInt(3600) / BigInt(60);
        const seconds = totalSeconds % BigInt(60);

        let string = seconds > 0 ? `${seconds} second` + (seconds > 1 ? "s " : " ") : "";
        string = (minutes > 0 ? `${minutes} minute` + (minutes > 1 ? "s" : "") + (string.length > 0 ? ", " : " ") : "") + string;
        string = (hours > 0 ? `${hours} hour` + (hours > 1 ? "s" : "") + (string.length > 0 ? ", " : " ") : "") + string;
        string = (days > 0 ? `${days} day` + (days > 1 ? "s" : "") + (string.length > 0 ? ", " : " ") : "") + string;
        string = (years > 0 ? `${years} year` + (years > 1 ? "s" : "") + (string.length > 0 ? ", " : " ") : "") + string;

        return string;
    }

    /*
        checks if perms are met in a given channel
        returns a list of user and bot permissions that are required, but the user or bot lacks, if applicable
     */
    protected static getMissingPermissions(author: Discord.GuildMember, channel: Discord.GuildChannelResolvable, userPermissions: Map<number, string>, botPermissions: Map<number, string>): string {
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
            output += `${author}, this bot does not have permission to use this command un <#${channel.valueOf()}>. The bot needs: ${missingPermissions}.`;
        }

        return output;
    }

    /*
        helper function for getMissingPermissions
        returns a string listing the given required permissions that the member lacks in the given channel
        returns an empty string if the member has the permissions
     */
    private static getMissingMemberPermissions(member: Discord.GuildMember, channel: Discord.GuildChannelResolvable, requiredPermissions: Map<number, string>) {
        let missingPermissions = "";
        requiredPermissions.forEach((value, key) => {
            if (!member.permissionsIn(channel).has(key)) {
                if (missingPermissions !== "") {
                    missingPermissions += ", ";
                }
                missingPermissions += value;
            }
        });
        return missingPermissions;
    }
}
export = Command;
