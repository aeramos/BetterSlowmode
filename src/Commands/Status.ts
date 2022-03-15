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

        let length = Command.getPrettyTime(channelData.getLength());

        // convert "12 seconds slowmode" to "12 second slowmode"
        if (length.endsWith("s ")) {
            length = length.slice(0, -2) + " ";
        }

        return "There is a " + length + (channelData.getType() === null ? "" : channelData.getType() ? "text " : "image ") + `slowmode in <#${channelID}>.` + await Command.getSlowmodeSubjects(channelData, <Discord.Guild>message.guild);
    }

    public getHelp(): string {
        return "```" + this.prefix + "status [#channel]```" +
            "Prints the length and special inclusions/exclusions of the slowmode in the given channel, or the current channel if no channel is provided.";
    }

    public getName(): string {
        return "status";
    }
}
export = Status;
