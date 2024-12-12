/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2020, 2021, 2024 Alejandro Ramos
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

import Discord from "discord.js"
import Sequelize from "sequelize"

/**
 * ChannelData is the interface for working with a row in the database that contains slowmode information. The Sequelize
 * API should not be worked with directly by Commands. ChannelData and Database work together as an abstraction over
 * Sequelize with helper functions for other classes to use.
 *
 * @see Database
 */
class ChannelData {
    private readonly id: Discord.Snowflake;
    private readonly serverID: Discord.Snowflake;
    private readonly length: number;
    private readonly type: boolean | null;
    private readonly userExcludes: Discord.Snowflake[];
    private readonly userIncludes: Discord.Snowflake[];
    private readonly roleExcludes: Discord.Snowflake[];
    private readonly roleIncludes: Discord.Snowflake[];
    private users: Discord.Snowflake[];
    private userTimes: bigint[];

    /**
     * The Sequelize representation of this row. If this row's information is used to make a new ChannelData object,
     * `_model` must be transferred with it. This reduces the number of unnecessary SELECT and UPDATE statements made by
     * the database.
     *
     * Only the Database class should be working with `_model` directly.
     *
     * @see Database
     */
    public readonly _model: Sequelize.Model | undefined;

    constructor(id: Discord.Snowflake, serverID: Discord.Snowflake, length: number, type: boolean | null, userExcludes: Discord.Snowflake[], userIncludes: Discord.Snowflake[], roleExcludes: Discord.Snowflake[], roleIncludes: Discord.Snowflake[], users: Discord.Snowflake[], userTimes: bigint[], model: Sequelize.Model | undefined = undefined) {
        this.id = id;
        this.serverID = serverID;
        this.length = length;
        this.type = type;
        this.userExcludes = userExcludes;
        this.userIncludes = userIncludes;
        this.roleExcludes = roleExcludes;
        this.roleIncludes = roleIncludes;
        this.users = users;
        this.userTimes = userTimes;
        this._model = model;
    }

    public getID(): Discord.Snowflake {
        return this.id;
    }

    public getServerID(): Discord.Snowflake {
        return this.serverID;
    }

    public getLength(): number {
        return this.length;
    }

    public getType(): boolean | null {
        return this.type;
    }

    public getUserExcludes(): Discord.Snowflake[] {
        return this.userExcludes;
    }

    public getUserIncludes(): Discord.Snowflake[] {
        return this.userIncludes;
    }

    public getRoleExcludes(): Discord.Snowflake[] {
        return this.roleExcludes;
    }

    public getRoleIncludes(): Discord.Snowflake[] {
        return this.roleIncludes;
    }

    public getUsers(): Discord.Snowflake[] {
        return this.users;
    }

    public getUserTimes(): bigint[] {
        return this.userTimes;
    }

    /**
     * @returns The user's last message timestamp, or -1 if there is none.
     */
    public getUserTime(id: Discord.Snowflake): number {
        const index = this.users.indexOf(id);
        if (index !== -1) {
            return Number(this.userTimes[index]);
        } else {
            return -1;
        }
    }

    /**
     * @param id The user's Discord ID.
     * @param time The message timestamp to use as the start of their slowmode cooldown.
     */
    public addUser(id: Discord.Snowflake, time: bigint): void {
        // create a new reference for the array so that in Database, Sequelize knows to UPDATE the row
        if (this._model && this.userTimes === (<any>this._model).userTimes) {
            this.userTimes = [...this.userTimes];
        }

        const index = this.users.indexOf(id);
        if (index !== -1) {
            this.userTimes[index] = time;
        } else {
            if (this._model && this.users === (<any>this._model).users) {
                this.users = [...this.users]
            }
            this.users.push(id);
            this.userTimes.push(time);
        }
    }

    /**
     * @returns True if this instance represents a text-only slowmode.
     */
    public isText(): boolean {
        return this.type === true;
    }

    /**
     * @returns True if this instance represents an image-only slowmode.
     */
    public isImage(): boolean {
        return this.type === false;
    }

    /**
     * @returns True if this instance represents a normal slowmode.
     */
    public isBoth(): boolean {
        return this.type === null;
    }

    /**
     * Determines if a slowmode applies to a user.
     *
     * This is done though the following tests, in order:
     *
     * 1. The owner of the server is never subject to a slowmode.
     * 2. If the user is specifically included, they are subject to the slowmode.
     * 3. If the user is specifically excluded, they are not subject to the slowmode.
     * 4. If one of a user's roles are included, and none of theirs are excluded, they are subject to the slowmode.
     * 5. If one of a user's roles are excluded, and none of theirs are included, they are not subject to the slowmode.
     * 6. If a user is a member of both an included role and an excluded role, the roles' positions in the Discord UI
     * are compared. The status of their highest-ranked role that is included or excluded will determine if they are
     * subject to the slowmode or not.
     * 7. If none of the previous tests apply to the user, the default Discord slowmode settings apply: if the user has
     * the Manage Messages permission, the Manage Channels permission, or the Administrator permission in the channel,
     * they are not subject to the slowmode.
     *
     * @returns True if the slowmode applies to the given member.
     */
    public subjectToSlowmode(member: Discord.GuildMember, channel: Discord.TextChannel): boolean {
        // note that the Set command prevents the owner from being included, but the server owner can change
        if (member.guild.ownerId === member.id) return false;

        if (this.userIncludes.includes(member.id)) return true;
        if (this.userExcludes.includes(member.id)) return false;

        // of the member's roles, get the highest ranked ones that are either included or excluded
        let highestIncludedRole;
        let highestExcludedRole;
        for (const roleMap of member.roles.cache) {
            const role: Discord.Role = roleMap[1];
            if (this.roleIncludes.includes(role.id)) {
                if (highestIncludedRole === undefined || highestIncludedRole.comparePositionTo(role) < 0) {
                    highestIncludedRole = role;
                }
            }
            if (this.roleExcludes.includes(role.id)) {
                if (highestExcludedRole === undefined || highestExcludedRole.comparePositionTo(role) < 0) {
                    highestExcludedRole = role;
                }
            }
        }

        // process the role exceptions
        // note that the Set command prevents a role from being both included and excluded
        if (highestIncludedRole === undefined) {
            if (highestExcludedRole === undefined) {
                // if the member has no roles included or excluded, just check Discord channel permissions
                const permissions = member.permissionsIn(channel);
                return !(permissions.has(Discord.Permissions.FLAGS.MANAGE_MESSAGES) || permissions.has(Discord.Permissions.FLAGS.MANAGE_CHANNELS) || permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR));
            } else {
                // if the member is excluded and not included
                return false;
            }
        } else {
            if (highestExcludedRole === undefined) {
                // if the member is included and not excluded
                return true;
            } else {
                // if the member is included and excluded, follow the status of the higher ranked role
                return highestIncludedRole.comparePositionTo(highestExcludedRole) > 0;
            }
        }
    }
}
export default ChannelData;
