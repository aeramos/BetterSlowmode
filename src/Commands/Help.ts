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

class Help extends Command {
    private readonly commands: Command[]

    public constructor(prefix: string, commands: Command[]) {
        super(prefix);
        this.commands = commands;
    }

    public async command(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<string> {
        // if a command is given, print help for that command
        if (parameters.length !== 0) {
            for (const command of this.commands) {
                if (parameters[0] === command.getName()) {
                    return command.getHelp();
                }
            }
        }

        // if no valid commands are given, print a list of commands
        let output = "Commands: `" + this.commands[0].getName() + "`";
        for (let i = 1; i < this.commands.length; i++){
            output += ", `" + this.commands[i].getName() + "`"
        }
        output += ".\n\nYou can enter `" + this.prefix + "help [command]` to get help for a specific command.";
        output += "\nExample: `" + this.prefix + "help " + this.commands[Math.floor(Math.random() * this.commands.length)].getName() + "`.";
        return output;
    }

    public getHelp(): string {
        return "```" + this.prefix + "help [command]```" +
            "Lists commands. If given a command, describes usage of command.";
    }

    public getName(): string {
        return "help";
    }

    public getUserPermissions(): Map<number, string> {
        return new Map();
    }

    public getBotPermissions(): Map<number, string> {
        return new Map();
    }
}
export = Help;
