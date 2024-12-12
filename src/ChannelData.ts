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

    public excludesUser(id: Discord.Snowflake): boolean {
        return this.userExcludes.includes(id);
    }

    public includesUser(id: Discord.Snowflake): boolean {
        return this.userIncludes.includes(id);
    }

    public excludesRole(id: Discord.Snowflake): boolean {
        return this.roleExcludes.includes(id);
    }

    public includesRole(id: Discord.Snowflake): boolean {
        return this.roleIncludes.includes(id);
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
}
export default ChannelData;
