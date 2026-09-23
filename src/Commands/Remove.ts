/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2020, 2021, 2022, 2024, 2026 Alejandro Ramos
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

import * as Discord from "discord.js";

import Command from "./Command.js";
import type ChannelData from "../ChannelData.js";
import type Database from "../Database.js";

class Remove extends Command {
    private readonly database: Database;

    public constructor(id: Discord.Snowflake, database: Database) {
        super(id);
        this.database = database;
    }

    public getName(): string {
        return "remove";
    }

    public getHelp(): string {
        return `Usage: <@${this.id}> \`remove [#channel]\`` +
            "\nRemoves a slowmode in the given channel or the current channel." +
            "\nCan not remove a slowmode that you are subject to. This can be due to permissions, your role being included, or you being specially included.";
    }

    public getSlashCommand(): Discord.ChatInputApplicationCommandData {
        return {
            name: this.getName(),
            description: "Removes the given slowmode. Can not remove a slowmode that you are subject to.",
            options: [
                {
                    type: Discord.ApplicationCommandOptionType.Channel,
                    name: "channel",
                    description: "The channel to remove the slowmode from.",
                    required: true,
                    channel_types: [Discord.ChannelType.GuildText]
                }
            ]
        };
    }

    public async tagCommand(channelData: ChannelData | null, parameters: string[], message: Discord.Message): Promise<Discord.MessageCreateOptions> {
        let channel: Discord.GuildChannel = <Discord.GuildChannel>message.channel;

        // if parameters were provided, parse the input and find a new channel and channelData
        if (parameters.length > 0) {
            if (parameters.length > 1) {
                return {
                    content: `${message.author}, you gave this command too many parameters. For more info enter: <@${this.id}> \`help ${this.getName()}\``
                };
            }

            // get the channel. return the error code if there is an error
            const tempChannel = await this.getChannel(parameters[0]!, <Discord.Guild>message.guild, message.channelId, message.author.id, false);
            if (typeof tempChannel === "string") {
                return {
                    content: tempChannel
                };
            } else {
                channel = tempChannel;
                channelData = await this.database.getChannel(channel.id);
            }
        }

        // we have a valid channel. remove the slowmode.
        return {
            content: await this.command(channel, channelData, <Discord.GuildMember>message.member)
        };
    }

    public async slashCommand(interaction: Discord.ChatInputCommandInteraction): Promise<Discord.InteractionResponse> {
        // slash command guarantees that the channel exists in the server
        const channel = <Discord.GuildChannel>interaction.options.getChannel("channel", true);
        const channelData = await this.database.getChannel(channel.id);

        if (!channel.viewable) {
            return interaction.reply({
                content: `The bot does not have permission to view ${channel}.`
            });
        }

        return interaction.reply({
            content: await this.command(channel, channelData, <Discord.GuildMember>interaction.member)
        });
    }

    /**
     * @param channel Valid channel to remove the slowmode from. Channel must exist in the server.
     * @param channelData Slowmode data for the given channel. Value is null if there is none.
     * @param author The user making the request.
     *
     * @returns A message to send to the user stating if the removal was successful or not.
     */
    private async command(channel: Discord.GuildChannel, channelData: ChannelData | null, author: Discord.GuildMember): Promise<string> {
        // check if there is a slowmode
        if (channelData === null) {
            return `There is no slowmode on ${channel} to remove.`;
        }

        // check if this user is allowed to remove the slowmode
        const missingPermissions = Command.getMissingPermissions(author, channel, new Map([[Discord.PermissionFlagsBits.ManageChannels, "Manage Channel"]]), new Map());
        if (missingPermissions) {
            return missingPermissions;
        }
        if (channelData.subjectToSlowmode(author, <Discord.TextChannel>channel)) {
            return `${author}, you cannot remove the slowmode on ${channel} because you are subject to it.`;
        }

        // remove the slowmode
        await this.database.removeChannel(channel.id);
        return `The slowmode has been removed from ${channel}.`;
    }
}
export default Remove;
