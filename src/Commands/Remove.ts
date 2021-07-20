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

class Remove extends Command {
    private readonly database: Database;
    private readonly subjectToSlowmode: CallableFunction;

    public constructor(prefix: string, database: Database, subjectToSlowmode: CallableFunction) {
        super(prefix);
        this.database = database;
        this.subjectToSlowmode = subjectToSlowmode;
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
                return `${message.author}, invalid tags. Example: ${this.prefix}${this.getName()} <#${channelID}>`;
            }
        }
        const missingPermissions = Command.getMissingPermissions(<Discord.GuildMember>message.member, channelID, new Map([[Discord.Permissions.FLAGS.MANAGE_CHANNELS, "Manage Channel"]]), new Map());
        if (missingPermissions) {
            return missingPermissions;
        }

        if (channelData === null) {
            return `There is no slowmode on <#${channelID}> to remove.`;
        }
        if (this.subjectToSlowmode(message.member, channelID, channelData)) {
            return `${message.author}, you cannot remove the slowmode on <#${channelID}> because you are subject to it.`;
        }

        await this.database.removeChannel(channelID);
        return `The slowmode has been removed from <#${channelID}>.`;
    }

    public getHelp(): string {
        return "```" + this.prefix + "remove [#channel]```" +
            "Removes a slowmode in the given channel or the current channel." +
            "\nCan not remove a slowmode that you are subject to. This can be due to permissions, your role being included, or you being specially included.";
    }

    public getName(): string {
        return "remove";
    }
}
export = Remove;
