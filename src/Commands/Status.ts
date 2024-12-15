/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2021, 2022, 2024 Alejandro Ramos
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

import Discord from "discord.js";
import { ApplicationCommandOptionType, ChannelType } from "discord-api-types/v9";

import Command from "./Command.js";
import ChannelData from "../ChannelData.js";
import Database from "../Database.js";

class Status extends Command {
    private readonly database: Database;

    public constructor(id: Discord.Snowflake, database: Database) {
        super(id);
        this.database = database;
    }

    public getName(): string {
        return "status";
    }

    public getHelp(): string {
        return `Usage: <@${this.id}> \`status [#channel]\`` +
            "\nPrints the length and special inclusions/exclusions of the slowmode in the given channel, or the current channel if no channel is provided.";
    }

    public getSlashCommand(): object {
        return {
            description: "Prints information about the slowmode in the given channel or the current channel if none are given.",
            options: [
                {
                    type: ApplicationCommandOptionType.Channel,
                    name: "channel",
                    description: "The channel to print information about.",
                    required: false,
                    channel_types: [ChannelType.GuildText]
                }
            ]
        };
    }

    public async tagCommand(channelData: ChannelData | null, parameters: string[], message: Discord.Message): Promise<Discord.MessageOptions> {
        let channelID = message.channel.id;
        if (parameters.length > 0) {
            if (parameters.length > 1) {
                return {
                    content: `${message.author}, you gave this command too many parameters. For more info enter: <@${this.id}> help ${this.getName()}`
                }
            }

            const tempChannel = await this.getChannel(parameters[0], <Discord.Guild>message.guild, message.channelId, message.author.id, false);
            if (typeof tempChannel === "string") {
                return {
                    content: tempChannel
                };
            } else {
                channelID = tempChannel.id;
                channelData = await this.database.getChannel(channelID);
            }
        }
        return {
            content: await this.command(<Discord.Guild>message.guild, channelData, channelID)
        };
    }

    public async slashCommand(interaction: Discord.CommandInteraction): Promise<void> {
        // channel parameter is not required, so fall back to the current channel if no channel was provided
        const channel: Discord.TextChannel = <Discord.TextChannel>(interaction.options.getChannel("channel", false) || <Discord.TextChannel>interaction.channel);
        const channelData = await this.database.getChannel(channel.id);

        if (!channel.viewable) {
            return interaction.reply({
                content: `The bot does not have permission to view ${channel}.`
            });
        }

        return interaction.reply({
            content: await this.command(<Discord.Guild>interaction.guild, channelData, channel.id)
        });
    }

    private async command(guild: Discord.Guild, channelData: ChannelData | null, channelID: Discord.Snowflake): Promise<string> {
        if (channelData === null) {
            return `There is no slowmode in <#${channelID}>.`;
        }

        let length = Command.getPrettyTime(channelData.getLength());

        // convert "12 seconds slowmode" to "12 second slowmode"
        if (length.endsWith("s ")) {
            length = length.slice(0, -2) + " ";
        }

        // some members or roles may not be shown if they are not in the server anymore or if they couldn't be fetched before the request timed out
        return "There is a " + length + (channelData.getType() === null ? "" : channelData.getType() ? "text " : "image ") + `slowmode in <#${channelID}>.`
            + Command.getSlowmodeSubjects(await Status.getCurrentMembers(guild, channelData.getUserIncludes()), await Status.getCurrentMembers(guild, channelData.getUserExcludes()),
            await Status.getCurrentRoles(guild, channelData.getRoleIncludes()), await Status.getCurrentRoles(guild, channelData.getRoleExcludes()));
    }

    /**
     * Gets a list of members that still exist in the server.
     *
     * @param guild The server.
     * @param memberIDs The list of IDs to search for.
     * @private
     *
     * @returns A list of members. If any of the given members no longer exist, they will not be included in the list.
     */
    private static async getCurrentMembers(guild: Discord.Guild, memberIDs: Discord.Snowflake[]): Promise<Discord.GuildMember[]> {
        // fetch takes time even when the request is empty
        if (!memberIDs.length) {
            return [];
        }

        return guild.members.fetch({
            user: memberIDs,
            withPresences: false,
            force: true,
            time: 10000
        }).then((members) => {
            return Array.from(members.values());
        }).catch(() => {
            // if fetch times out
            return [];
        });
    }

    /**
     * Gets a list of roles that still exist in the server.
     *
     * @param guild The server.
     * @param roleIDs The list of IDs to search for.
     * @private
     *
     * @returns A list of roles. If any of the given roles no longer exist, they will not be included in the list.
     */
    private static async getCurrentRoles(guild: Discord.Guild, roleIDs: Discord.Snowflake[]): Promise<Discord.Role[]> {
        let roles: Discord.Role[] = [];
        for (const roleID of roleIDs) {
            const role = await guild.roles.fetch(roleID, {cache: true, force: true});
            if (role) {
                roles.push(role);
            }
        }
        return roles;
    }
}
export default Status;
