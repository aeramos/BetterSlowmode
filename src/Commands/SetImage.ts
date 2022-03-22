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

import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import Set = require("./Set");

class SetImage extends Set {
    protected static readonly SLOWMODE_TYPE: boolean | null = false;

    public getName(): string {
        return "set-image";
    }

    public getHelp(): string {
        return `Usage: <@${this.id}> \`set-image <length> [-exclude <users/roles>] [-include <users/roles>]\`` +
            "\nSets a slowmode just for images using the given length (in the format: `1y 1d 1h 1m 1s`), and optionally excludes or includes users or roles in this server." +
            "\nLength must be at least 1 second and no more than 1 year.";
    }

    public getSlashCommand(): object {
        return {
            type: ApplicationCommandOptionTypes.SUB_COMMAND,
            name: "set-image",
            description: "Sets an image-only slowmode of the given length and optionally includes/excludes users or roles.",
            options: Set.SLASH_COMMAND_OPTIONS
        }
    }
}
export = SetImage;
