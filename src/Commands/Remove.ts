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
import { ApplicationCommandOptionType, ChannelType } from "discord-api-types/v9";

// @ts-ignore
import ChannelData = require("../ChannelData");
// @ts-ignore
import Database = require("../Database");

class Remove extends Command {
    private readonly database: Database;
    private readonly subjectToSlowmode: CallableFunction;

    public constructor(id: Discord.Snowflake, database: Database, subjectToSlowmode: CallableFunction) {
        super(id);
        this.database = database;
        this.subjectToSlowmode = subjectToSlowmode;
    }

    public getName(): string {
        return "remove";
    }

    public getHelp(): string {
        return `Usage: <@${this.id}> \`remove [#channel]\`` +
            "\nRemoves a slowmode in the given channel or the current channel." +
            "\nCan not remove a slowmode that you are subject to. This can be due to permissions, your role being included, or you being specially included.";
    }

    public getSlashCommand(): object {
        return {
            description: "Removes the given slowmode. Can not remove a slowmode that you are subject to.",
            options: [
                {
                    type: ApplicationCommandOptionType.Channel,
                    name: "channel",
                    description: "The channel to remove the slowmode from.",
                    required: true,
                    channel_types: [ChannelType.GuildText]
                }
            ]
        };
    }

    public async tagCommand(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<Discord.MessageOptions> {
        let channelID: string = message.channel.id;
        if (parameters.length > 0) {
            if (parameters.length > 1) {
                return {
                    content: `${message.author}, you gave this command too many parameters. For more info enter: <@${this.id}> \`help ${this.getName()}\``
                };
            }

            if (!channelData || channelData.getID() !== channelID) {
                if (new RegExp(/^<#\d{1,20}>$/).test(parameters[0])) {
                    channelID = parameters[0].slice(2, -1);
                    channelData = undefined; // the database has not queried for the correct channel. let this.command do it.
                } else {
                    return {
                        content: `${message.author}, invalid tags. Example: <@${this.id}> \`${this.getName()}\` <#${channelID}>`
                    }
                }
            }
        }

        return {
            content: await this.command(channelID, channelData, <Discord.GuildMember>message.member)
        };
    }

    public async slashCommand(interaction: Discord.CommandInteraction): Promise<void> {
        return interaction.reply({
            content: await this.command(interaction.options.getChannel("channel", true).id, undefined, <Discord.GuildMember>interaction.member)
        });
    }

    /**
     * @param channelID     Channel to remove the slowmode from
     * @param channelData   Database reference to given channel. null if db queried and there is no ChannelData. undefined if db not queried yet.
     * @param author
     */
    private async command(channelID: Discord.Snowflake, channelData: ChannelData | null | undefined, author: Discord.GuildMember): Promise<string> {
        // check permissions
        const missingPermissions = Command.getMissingPermissions(author, channelID, new Map([[Discord.Permissions.FLAGS.MANAGE_CHANNELS, "Manage Channel"]]), new Map());
        if (missingPermissions) {
            return missingPermissions;
        }

        if (channelData === undefined) {
            channelData = await this.database.getChannel(channelID);
        }
        if (channelData === null) {
            return `There is no slowmode on <#${channelID}> to remove.`;
        }
        if (this.subjectToSlowmode(author, channelID, channelData)) {
            return `${author}, you cannot remove the slowmode on <#${channelID}> because you are subject to it.`;
        }

        await this.database.removeChannel(channelID);
        return `The slowmode has been removed from <#${channelID}>.`;
    }
}
export = Remove;