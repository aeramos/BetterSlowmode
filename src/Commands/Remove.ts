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
    private readonly subjectToSlowmode: CallableFunction;
    private readonly database: Database;

    public constructor(subjectToSlowmode: CallableFunction, database: Database) {
        super();
        this.subjectToSlowmode = subjectToSlowmode;
        this.database = database;
    }

    public async command(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<string> {
        if (channelData === null) {
            return "There is no slowmode on this channel to remove.";
        }
        if (!this.subjectToSlowmode(message.member, message.channel, channelData)) {
            await this.database.removeChannel(message.channel.id);
            return "The slowmode has been removed from this channel.";
        } else {
            return `${message.author}, you cannot remove this slowmode because you are subject to it.`;
        }
    }

    public getHelp(prefix: string): string {
        return "```" + prefix + "remove```" +
            "Removes a slowmode in the current channel. Can not remove a slowmode that you are subject to. This can be due to permissions, your role being included, or you being specially included.";
    }

    public getName(): string {
        return "remove";
    }

    public getUserPermissions(): Map<number, string> {
        return new Map([[Discord.Permissions.FLAGS.MANAGE_CHANNELS, "Manage Channel"]]);
    }

    public getBotPermissions(): Map<number, string> {
        return new Map();
    }
}
export = Remove;
