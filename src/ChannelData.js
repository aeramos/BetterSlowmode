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

class ChannelData {
    #id;
    #serverID;
    #length;
    #type;
    #userExcludes;
    #userIncludes;
    #roleExcludes;
    #roleIncludes;
    #users;
    #userTimes;

    constructor(id, serverID, length, type, userExcludes, userIncludes, roleExcludes, roleIncludes, users, userTimes) {
        this.#id = id;
        this.#serverID = serverID;
        this.#length = length;
        this.#type = type;
        this.#userExcludes = userExcludes;
        this.#userIncludes = userIncludes;
        this.#roleExcludes = roleExcludes;
        this.#roleIncludes = roleIncludes;
        this.#users = users;
        this.#userTimes = userTimes;
    }

    getID() {
        return this.#id;
    }

    getServerID() {
        return this.#serverID;
    }

    getLength() {
        return Number(this.#length);
    }

    getType() {
        return this.#type;
    }

    getUserExcludes() {
        return this.#userExcludes;
    }

    getUserIncludes() {
        return this.#userIncludes;
    }

    getRoleExcludes() {
        return this.#roleExcludes;
    }

    getRoleIncludes() {
        return this.#roleIncludes;
    }

    getUsers() {
        return this.#users;
    }

    getUserTimes() {
        return this.#userTimes;
    }

    excludesUser(id) {
        return this.#userExcludes.includes(id);
    }

    includesUser(id) {
        return this.#userIncludes.includes(id);
    }

    excludesRole(id) {
        return this.#roleExcludes.includes(id);
    }

    includesRole(id) {
        return this.#roleIncludes.includes(id);
    }

    getUserTime(id) {
        const index = this.#users.indexOf(id);
        if (index !== -1) {
            return Number(this.#userTimes[index]);
        } else {
            return -1;
        }
    }

    addUser(id, time) {
        const index = this.#users.indexOf(id);
        if (index !== -1) {
            this.#userTimes[index] = time;
        } else {
            this.#users.push(id);
            this.#userTimes.push(time);
        }
    }

    isText() {
        return this.#type === true;
    }

    isImage() {
        return this.#type === false;
    }

    isBoth() {
        return this.#type === null;
    }
}
export default ChannelData;
