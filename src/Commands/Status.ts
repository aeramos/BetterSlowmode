/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2021, 2022 Alejandro Ramos
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

    public async tagCommand(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<Discord.MessageOptions> {
        let channelID = message.channel.id;
        if (parameters.length > 0) {
            if (parameters.length > 1) {
                return {
                    content: `${message.author}, you gave this command too many parameters. For more info enter: <@${this.id}> help ${this.getName()}`
                }
            }

            if (new RegExp(/^<#\d{1,20}>$/).test(parameters[0])) {
                channelID = parameters[0].slice(2, -1);
                channelData = undefined;
            } else {
                return {
                    content: `${message.author}, invalid tag. Example: <@${this.id}> ${this.getName()} <#${channelID}>`
                }
            }
        }
        return {
            content: await this.command(<Discord.Guild>message.guild, channelData, channelID)
        };
    }

    public async slashCommand(interaction: Discord.CommandInteraction): Promise<void> {
        return interaction.reply({
            content: await this.command(<Discord.Guild>interaction.guild, undefined, (interaction.options.getChannel("channel", false) || <Discord.TextChannel>interaction.channel).id)
        });
    }

    private async command(guild: Discord.Guild, channelData: ChannelData | null | undefined, channelID: Discord.Snowflake): Promise<string> {
        if (channelData === null) {
            return `There is no slowmode in <#${channelID}>.`;
        }

        channelData = await this.database.getChannel(channelID);
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
            + await Command.getSlowmodeSubjects(await Status.getMembers(guild, channelData.getUserIncludes()), await Status.getMembers(guild, channelData.getUserExcludes()),
            await Status.getRoles(guild, channelData.getRoleIncludes()), await Status.getRoles(guild, channelData.getRoleExcludes()));
    }

    private static async getMembers(guild: Discord.Guild, memberIDs: Discord.Snowflake[]): Promise<Discord.GuildMember[]> {
        return await guild.members.fetch({
            user: memberIDs,
            withPresences: false,
            force: true,
            time: 10000
        }).then((members) => {
            return Array.from(members.values());
        }).catch(() => []);
    }

    private static async getRoles(guild: Discord.Guild, roleIDs: Discord.Snowflake[]): Promise<Discord.Role[]> {
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
export = Status;
