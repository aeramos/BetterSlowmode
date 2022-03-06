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
    private readonly botID: string;
    private readonly supportCode: string;

    public constructor(prefix: string, botID: string, supportCode: string) {
        super(prefix);
        this.botID = botID;
        this.supportCode = supportCode;
    }

    public async command(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<Discord.MessageOptions> {
        return {
            embeds: [
                new Discord.MessageEmbed({
                    title: "About BetterSlowmode",
                    url: "https://github.com/aeramos/BetterSlowmode",
                    description: "A Discord bot that adds more depth and customization to text channel slowmodes." +
                        "\n[Source Code](https://github.com/aeramos/BetterSlowmode)" +
                        `\n[Support Server](https://discord.com/invite/${this.supportCode})` +
                        `\n[Bot Invite](https://discord.com/api/oauth2/authorize?client_id=${this.botID}&permissions=10240&scope=bot%20applications.commands )`
                })
            ]
        }
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
