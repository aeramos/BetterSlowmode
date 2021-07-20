/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2021 Alejandro Ramos
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

// @ts-ignore
import ChannelData = require("../ChannelData")
import Discord = require("discord.js");

abstract class Command {
    protected readonly prefix: string;

    public constructor(prefix: string) {
        this.prefix = prefix;
    }

    public abstract command(channelData: ChannelData, parameters: string[], message: Discord.Message): Promise<string>;

    public abstract getHelp() : string;

    public abstract getName() : string;

    public abstract getUserPermissions(): Map<number, string>;

    public abstract getBotPermissions(): Map<number, string>;

    protected static getPrettyTime(totalSeconds : bigint) : string {
        const years = totalSeconds / BigInt(31536000);
        const days = totalSeconds % BigInt(31536000) / BigInt(86400);
        const hours = totalSeconds % BigInt(86400) / BigInt(3600);
        const minutes = totalSeconds % BigInt(3600) / BigInt(60);
        const seconds = totalSeconds % BigInt(60);

        let string = seconds > 0 ? `${seconds} second` + (seconds > 1 ? "s " : " ") : "";
        string = (minutes > 0 ? `${minutes} minute` + (minutes > 1 ? "s" : "") + (string.length > 0 ? ", " : " ") : "") + string;
        string = (hours > 0 ? `${hours} hour` + (hours > 1 ? "s" : "") + (string.length > 0 ? ", " : " ") : "") + string;
        string = (days > 0 ? `${days} day` + (days > 1 ? "s" : "") + (string.length > 0 ? ", " : " ") : "") + string;
        string = (years > 0 ? `${years} year` + (years > 1 ? "s" : "") + (string.length > 0 ? ", " : " ") : "") + string;

        return string;
    }
}
export = Command;
