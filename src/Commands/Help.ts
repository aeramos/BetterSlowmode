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
import ChannelData from "../ChannelData.js";

class Help extends Command {
    private readonly commands: Command[]

    public constructor(id: Discord.Snowflake, commands: Command[]) {
        super(id);
        this.commands = commands;
    }

    public getName(): string {
        return "help";
    }

    public getHelp(): string {
        return `Usage: <@${this.id}> \`help [command]\`` +
            "\nLists commands. If given a command, describes usage of command.";
    }

    public getSlashCommand(): Discord.ChatInputApplicationCommandData {
        const commandChoices: Discord.ApplicationCommandOptionChoiceData<string>[] = []
        for (const command of this.commands) {
            commandChoices.push(
                {
                    name: command.getName(),
                    value: command.getName()
                });
        }
        return {
            name: this.getName(),
            description: "Lists commands. If given a command, describes usage of command.",
            options: [
                {
                    type: Discord.ApplicationCommandOptionType.String,
                    name: "command",
                    description: "The command to describe.",
                    required: false,
                    choices: commandChoices
                }
            ]
        };
    }

    public async tagCommand(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<Discord.MessageCreateOptions> {
        // if no command was given, print the generic help listing. if a *single* command was given, print the help for that command, otherwise print help for the help command
        if (parameters.length === 0) {
            return {
                content: this.command(null)
            };
        } else {
            if (parameters.length === 1) {
                return {
                    content: this.command(parameters[0])
                };
            } else {
                return {
                    content: this.getHelp()
                };
            }
        }
    }

    public async slashCommand(interaction: Discord.ChatInputCommandInteraction): Promise<Discord.InteractionResponse> {
        return interaction.reply({
            content: this.command(interaction.options.getString("command", false))
        });
    }

    /**
     * @param parameter The command the user is requesting information on.
     *
     * @returns A user-friendly string listing all the commands or providing usage information on a single command if
     * specified.
     */
    private command(parameter: string | null): string {
        // if a command is given, print help for that command
        if (parameter !== null) {
            for (const command of this.commands) {
                if (parameter === command.getName()) {
                    return command.getHelp();
                }
            }
        }

        // if no valid commands are given, print a list of commands
        let output = "Commands: `" + this.commands[0].getName() + "`";
        for (let i = 1; i < this.commands.length; i++){
            output += ", `" + this.commands[i].getName() + "`"
        }
        output += `\n\nFor help with a specific command, enter: <@${this.id}> \`help [command]\``;

        // give an example using a random command
        output += `\nExample: <@${this.id}> \`help ${this.commands[Math.floor(Math.random() * this.commands.length)].getName()}\``;

        output += `\n\nTo read the FAQ or join the support server, use: <@${this.id}> \`info\``
        return output;
    }
}
export default Help;
