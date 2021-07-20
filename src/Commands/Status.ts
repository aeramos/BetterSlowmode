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

import Discord = require("discord.js");
import Command = require("./Command");
// @ts-ignore
import ChannelData = require("../ChannelData");
// @ts-ignore
import Database = require("../Database");

class Status extends Command {
    private readonly database: Database;

    public constructor(prefix: string, database: Database) {
        super(prefix);
        this.database = database;
    }

    public async command(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<string> {
        let channelID: string = message.channel.id;
        if (parameters.length > 0) {
            if (parameters.length > 1) {
                return `${message.author}, you gave this command too many parameters. Use \`` + this.prefix + "help " + this.getName() +"` for more info.";
            }

            if (new RegExp(/^<#\d{1,20}>$/).test(parameters[0])) {
                channelID = parameters[0].slice(2, -1);
                channelData = await this.database.getChannel(channelID);
            } else {
                return `${message.author}, invalid tag. Example: ${this.prefix}${this.getName()} <#${channelID}>`;
            }
        }
        if (channelData === null) {
            return `There is no slowmode in <#${channelID}>.`;
        }

        let output;
        let length = Command.getPrettyTime(channelData.getLength() / BigInt(1000));

        // convert "12 seconds slowmode" to "12 second slowmode"
        if (length.endsWith("s ")) {
            length = length.slice(0, -2) + " ";
        }

        output = "There is a " + length + (channelData.getType() === null ? "" : channelData.getType() ? "text " : "image ") + "slowmode in <#" + channelID + ">.";
        let includes = channelData.getRoleIncludes().length === 0 ? "" : " It specially includes: " + (await Status.getDiscordRoleTags(<Discord.Guild>message.guild, channelData.getRoleIncludes())).join(", ");
        includes +=    channelData.getUserIncludes().length === 0 ? "" : (includes === "" ? " It specially includes: " : ", ") + (await Status.getDiscordUserTags(<Discord.Guild>message.guild, channelData.getUserIncludes())).join(", ");
        includes += includes === "" ? "" : ".";

        let excludes = channelData.getRoleExcludes().length === 0 ? "" : " It specially excludes: " + (await Status.getDiscordRoleTags(<Discord.Guild>message.guild, channelData.getRoleExcludes())).join(", ");
        excludes +=    channelData.getUserExcludes().length === 0 ? "" : (excludes === "" ? " It specially excludes: " : ", ") + (await Status.getDiscordUserTags(<Discord.Guild>message.guild, channelData.getUserExcludes())).join(", ");
        excludes += excludes === "" ? "" : ".";

        output += includes + excludes;
        return output;
    }

    public getHelp(): string {
        return "```" + this.prefix + "status [#channel]```" +
            "Prints the length and special inclusions/exclusions of the slowmode in the given channel, or the current channel if no channel is provided.";
    }

    public getName(): string {
        return "status";
    }

    public getUserPermissions(): Map<number, string> {
        return new Map();
    }

    public getBotPermissions(): Map<number, string> {
        return new Map();
    }

    private static async getDiscordUserTags(guild: Discord.Guild, userIDs: string[]): Promise<string[]> {
        const array = [];
        for (const member of await guild.members.fetch({user: userIDs, withPresences: false, force: true})) {
            array.push("@" + member[1].user.tag);
        }
        return array;
    }

    private static async getDiscordRoleTags(guild: Discord.Guild, roleIDs: string[]): Promise<string[]> {
        const array = [];
        for (const role of await guild.roles.cache) {
            if (roleIDs.includes(role[0])) {
                array.push("@" + role[1].name);
            }
        }
        return array;
    }
}
export = Status;
