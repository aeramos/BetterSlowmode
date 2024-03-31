/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2020, 2021, 2022, 2024 Alejandro Ramos
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

    /**
     * Process the manual command inputs before sending to command() to perform the resets.
     * Verifies that there is an existing slowmode in the given channel and that it is in the current server. Aborts if this is not the case.
     *
     * @param channelData Slowmode data for the channel the message is sent in. Value is null if there is none.
     * @param parameters Each word sent as a parameter to this command
     * @param message The raw Discord message for this request
     *
     * @returns A message to send to the user stating if the removal was successful or not
     */
    public async tagCommand(channelData: ChannelData | null, parameters: string[], message: Discord.Message): Promise<Discord.MessageOptions> {
        let channel: Discord.GuildChannel = <Discord.GuildChannel>message.channel;

        // if parameters were provided, parse the input and find a new channel and channelData
        if (parameters.length > 0) {
            if (parameters.length > 1) {
                return {
                    content: `${message.author}, you gave this command too many parameters. For more info enter: <@${this.id}> \`help ${this.getName()}\``
                };
            }

            // parse the tag. abort if the tag is invalid or if the channel isn't in the server
            if (new RegExp(/^<#\d{1,20}>$/).test(parameters[0])) {
                const channelID = parameters[0].slice(2, -1);
                // regex is good. set the channel variable
                const tempChannel = await (<Discord.Guild>message.guild).channels.fetch(channelID, {
                    cache: true,
                    force: true
                }).catch(() => {
                    return null;
                });

                // check if the channel exists in this server
                if (tempChannel === null || tempChannel.guildId !== message.guildId) {
                    return {
                        content: `The channel <#${channelID}> does not exist in this server.`
                    };
                }
                channel = <Discord.GuildChannel>tempChannel;
                channelData = await this.database.getChannel(channel.id);
            } else {
                return {
                    content: `${message.author}, invalid tag. Example: <@${this.id}> \`${this.getName()}\` <#${message.channelId}>`
                };
            }
        }

        // we have a valid channel. remove the slowmode.
        return {
            content: await this.command(channel, channelData, <Discord.GuildMember>message.member)
        };
    }

    public async slashCommand(interaction: Discord.CommandInteraction): Promise<void> {
        // slash command guarantees that the channel exists in the server
        const channel = <Discord.GuildChannel>interaction.options.getChannel("channel", true);
        const channelData = await this.database.getChannel(channel.id);
        return interaction.reply({
            content: await this.command(channel, channelData, <Discord.GuildMember>interaction.member)
        });
    }

    /**
     * @param channel Valid channel to remove the slowmode from. Channel must exist in the server.
     * @param channelData Slowmode data for the given channel. Value is null if there is none.
     * @param author The user making the request
     *
     * @returns A message to send to the user stating if the removal was successful or not
     */
    private async command(channel: Discord.GuildChannel, channelData: ChannelData | null, author: Discord.GuildMember): Promise<string> {
        // check if there is a slowmode
        if (channelData === null) {
            return `There is no slowmode on ${channel} to remove.`;
        }

        // check if this user is allowed to remove the slowmode
        const missingPermissions = Command.getMissingPermissions(author, channel, new Map([[Discord.Permissions.FLAGS.MANAGE_CHANNELS, "Manage Channel"]]), new Map());
        if (missingPermissions) {
            return missingPermissions;
        }
        if (this.subjectToSlowmode(author, channel, channelData)) {
            return `${author}, you cannot remove the slowmode on ${channel} because you are subject to it.`;
        }

        // remove the slowmode
        await this.database.removeChannel(channel.id);
        return `The slowmode has been removed from ${channel}.`;
    }
}
export = Remove;
