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

class Info extends Command {
    public async command(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<string> {
        return "BetterSlowmode is a Discord bot that adds more depth and customization to text channel slowmodes." +
            "\nView the source code here: https://github.com/aeramos/BetterSlowmode";
    }

    public getHelp(): string {
        return "```" + this.prefix + "info```" +
            "Prints info about the bot and a link to the code.";
    }

    public getName(): string {
        return "info";
    }
}
export = Info;
