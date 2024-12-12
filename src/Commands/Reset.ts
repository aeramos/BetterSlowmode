/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2024 Alejandro Ramos
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
import {ApplicationCommandOptionType, ChannelType} from "discord-api-types/v9";

import Command from "./Command.js";
import ChannelData from "../ChannelData.js";
import Database from "../Database.js";

class Reset extends Command {
    private readonly database: Database;

    public constructor(id: Discord.Snowflake, database: Database) {
        super(id);
        this.database = database;
    }

    public getName(): string {
        return "reset";
    }

    public getHelp(): string {
        return `Usage: <@${this.id}> \`reset [#channel] [@users]\`` +
            "\nResets users' slowmodes in the given channel. If no users are specified, everyone's slowmode will be reset in that channel. Uses the current channel if none specified." +
            "\nCan not reset a slowmode that you are subject to. This can be due to permissions, your role being included, or you being specially included.";
    }

    public getSlashCommand(): object {
        return {
            description: "Resets a slowmode. Can not reset a slowmode that you are subject to.",
            options: [
                {
                    type: ApplicationCommandOptionType.Channel,
                    name: "channel",
                    description: "The channel to reset slowmodes from.",
                    required: true,
                    channel_types: [ChannelType.GuildText]
                },
                {
                    type: ApplicationCommandOptionType.User,
                    name: "user",
                    description: "Reset the slowmode of a user.",
                    required: false
                }
            ]
        };
    }

    public async tagCommand(channelData: ChannelData | null, parameters: string[], message: Discord.Message): Promise<Discord.MessageOptions> {
        let channel: Discord.GuildChannel = <Discord.GuildChannel>message.channel;
        let users: Set<Discord.User> = new Set<Discord.User>();
        let userTags: Set<Discord.Snowflake> = new Set<Discord.Snowflake>();

        if (parameters.length > 0) {
            // first parameter must match: optional channel tag with optional user tags, in that order (reset [channel] [user])
            if (!new RegExp(/^(<#\d{1,20}>)?(<(@|@!)\d{1,20}>)*$/).test(parameters[0])) {
                return {
                    content: `${message.author}, your tags are invalid. Example: <@${this.id}> \`${this.getName()}\` ${message.channel} ${message.member}`
                }
            }

            // get the tagged channel if it exists
            // will match zero or one time. inefficient to search the full string, but cleaner than a search for the regex then a search for the closing bracket ">"
            for (const channelTag of (parameters[0].match(/<#\d{1,20}>/g) || [])) {
                const tempChannel = await this.getChannel(channelTag, <Discord.Guild>message.guild, message.channelId, message.author.id, true);
                if (typeof tempChannel === "string") {
                    return {
                        content: tempChannel
                    };
                } else {
                    channel = tempChannel;
                    channelData = await this.database.getChannel(channel.id);
                }
            }

            // finish parsing the first parameter for user tags
            // get the user tags as an array, trim the brackets and @ stuff from each one, then add the ID to the list
            (parameters[0].match(/<@\d{1,20}>/g) || []).forEach(tag => {
                userTags.add(tag.slice(2, -1));
            });
            (parameters[0].match(/<@!\d{1,20}>/g) || []).forEach(tag => {
                userTags.add(tag.slice(3, -1));
            });

            // the first parameter has been parsed. shift to the next one.
            parameters.shift();

            // the remaining parameters should be user tags, not channels. get the users from these in the same way as before
            for (const parameter of parameters) {
                (parameter.match(/<@\d{1,20}>/g) || []).forEach(tag => {
                    userTags.add(tag.slice(2, -1));
                });
                (parameter.match(/<@!\d{1,20}>/g) || []).forEach(tag => {
                    userTags.add(tag.slice(3, -1));
                });
            }
            let tempMembers = await Command.getMembers(userTags, <Discord.Guild>message.guild, <Discord.GuildMember>message.member);
            if (typeof tempMembers === "string") {
                return {
                    content: tempMembers
                };
            }
            // only way to get users from members unfortunately
            for (const member of tempMembers) {
                users.add(member.user);
            }
        }

        // input has been parsed successfully. reset the slowmode
        return {
            content: await this.command(channel, channelData, <Discord.GuildMember>message.member, users)
        };
    }

    public async slashCommand(interaction: Discord.CommandInteraction): Promise<void> {
        const mention = interaction.options.getUser("user");
        const channel = <Discord.GuildChannel>interaction.options.getChannel("channel", true);
        const channelData = await this.database.getChannel(channel.id);

        if (!channel.viewable) {
            return interaction.reply({
                content: `The bot does not have permission to view ${channel}.`
            });
        }

        if (mention === null) {
            return interaction.reply({
                content: await this.command(channel, channelData, <Discord.GuildMember>interaction.member, new Set())
            });
        } else {
            return interaction.reply({
                content: await this.command(channel, channelData, <Discord.GuildMember>interaction.member, new Set([mention]))
            });
        }
    }

    /**
     *  Resets a given slowmode if the requester has the Manage Channel permission and is not subject to the slowmode.
     *  This matches the permissions required for the "remove" command.
     *
     *  @param channel The channel to reset the slowmodes in
     *  @param channelData Reset every slowmode in the channel. If users are specified, only reset those users' slowmodes.
     *  @param author The requester. This user must have "Manage Channel" permissions in the specified channel and most not be subject to the slowmode.
     *  @param users Reset the slowmodes of each user listed
     *
     *  @returns A message to send to the user stating if the reset was successful or not.
     *  @private
     */
    private async command(channel: Discord.GuildChannel, channelData: ChannelData | null, author: Discord.GuildMember, users: Set<Discord.User>): Promise<string> {
        // check if there is a slowmode
        if (channelData === null) {
            return `There is no slowmode on ${channel} to reset.`;
        }

        // check if this user is allowed to reset the slowmode
        const missingPermissions = Command.getMissingPermissions(author, channel, new Map([[Discord.Permissions.FLAGS.MANAGE_CHANNELS, "Manage Channel"]]), new Map());
        if (missingPermissions) {
            return missingPermissions;
        }
        if (channelData.subjectToSlowmode(author, <Discord.TextChannel>channel)) {
            return `${author}, you cannot reset the slowmode on ${channel} because you are subject to it.`;
        }

        // reset the slowmodes for the selected users, or all of them if none are specified
        let resettingChannel: boolean = true;
        let originalUsers: Discord.Snowflake[] = channelData.getUsers();

        // newUsers will replace the originalUsers list in the slowmode database
        let newUsers: Discord.Snowflake[] = [...originalUsers];
        let newUserTimes: bigint[] = channelData.getUserTimes();
        if (users.size) {
            resettingChannel = false;
            newUsers = newUsers.filter((newUserTag, index) => {
                for (const user of users) {
                    if (user.id === newUserTag) {
                        newUserTimes.splice(index, 1);
                        return false;
                    }
                }
                return true;
            });
        }

        // push the new user lists to the server. don't waste the query if there's nothing to change
        if (resettingChannel) {
            if (originalUsers.length > 0) {
                await this.database.setChannel(new ChannelData(channelData.getID(), channelData.getServerID(), channelData.getLength(), channelData.getType(), channelData.getUserExcludes(), channelData.getUserIncludes(), channelData.getRoleExcludes(), channelData.getRoleIncludes(), [], [], channelData._model));
            }
            return `The slowmode in ${channel} has been reset!`;
        } else {
            if (newUsers.length !== originalUsers.length) {
                await this.database.setChannel(new ChannelData(channelData.getID(), channelData.getServerID(), channelData.getLength(), channelData.getType(), channelData.getUserExcludes(), channelData.getUserIncludes(), channelData.getRoleExcludes(), channelData.getRoleIncludes(), newUsers, newUserTimes, channelData._model));
            }
            return `The slowmode in ${channel} has been reset for the specified users.`;
        }
    }
}
export default Reset;
