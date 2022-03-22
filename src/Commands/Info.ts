/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2020, 2021, 2022 Alejandro Ramos
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
    private readonly supportCode: string;

    public constructor(id: Discord.Snowflake, supportCode: string) {
        super(id);
        this.supportCode = supportCode;
    }

    public getName(): string {
        return "info";
    }

    public getHelp(): string {
        return `Usage: <@${this.id}> \`info\`` +
            "\nPrints info about the bot and a link to the code.";
    }

    public getSlashCommand(): object {
        return {
            name: "info",
            description: "Prints info about the bot and a link to the code."
        };
    }

    public async tagCommand(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<Discord.MessageOptions> {
        return {
            embeds: [
                this.command()
            ]
        };
    }

    public async slashCommand(interaction: Discord.CommandInteraction): Promise<void> {
        return interaction.reply({
            embeds: [
                await this.command()
            ]
        });
    }

    private command(): Discord.MessageEmbed {
        return new Discord.MessageEmbed({
            title: "About BetterSlowmode",
            url: "https://github.com/aeramos/BetterSlowmode",
            description: "A Discord bot that adds more depth and customization to text channel slowmodes." +
                "\n[Source Code](https://github.com/aeramos/BetterSlowmode)" +
                `\n[Support Server](https://discord.com/invite/${this.supportCode})` +
                `\n[Bot Invite](https://discord.com/api/oauth2/authorize?client_id=${this.id}&permissions=10240&scope=bot%20applications.commands)`
        });
    }
}
export = Info;
