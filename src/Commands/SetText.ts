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

import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import Set from "./Set.js";

/**
 * The Set-Text command handles the creation of text-only slowmodes.
 *
 * A text-only slowmode only applies to messages that contain text. Messages that only contain attachments will not be
 * deleted. Messages without text that are later edited to include text will not be deleted, as edits are not tracked by
 * the bot.
 *
 * @see SetImage
 */
class SetText extends Set {
    /**
     * The type of slowmode this command creates. True indicates a text-only slowmode.
     *
     * @see SetImage
     * @see Database
     */
    protected static readonly SLOWMODE_TYPE: boolean | null = true;

    public getName(): string {
        return "set-text";
    }

    public getHelp(): string {
        return `Usage: <@${this.id}> \`set-text <length> [-exclude <users/roles>] [-include <users/roles>]\`` +
            "\nSets a slowmode just for text using the given length (in the format: `1y 1d 1h 1m 1s`), and optionally excludes or includes users or roles in this server." +
            "\nLength must be at least 1 second and no more than 1 year.";
    }

    public getSlashCommand(): object {
        return {
            type: ApplicationCommandOptionTypes.SUB_COMMAND,
            name: "set-text",
            description: "Sets a text-only slowmode of the given length and optionally includes/excludes users or roles.",
            options: Set.SLASH_COMMAND_OPTIONS
        }
    }
}
export default SetText;
