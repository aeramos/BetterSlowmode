/*
 * Copyright (C) 2020 Alejandro Ramos
 * This file is part of BetterSlowmode
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

const SERVER = 0;
const LENGTH = 1;
const TYPE = 2;
const EXCLUDES = 3;
const INCLUDES = 4;
const USERS = 5;

class ChannelData {
    #data;

    constructor(data) {
        this.#data = data;
    }

    static createData(server, length, type, excludes, includes) {
        return [
            server,
            length,
            type,
            excludes,
            includes,
            {}
        ]
    }

    getData() {
        return this.#data;
    }

    getServer() {
        return this.#data[SERVER];
    }

    getLength() {
        return this.#data[LENGTH];
    }

    isText() {
        return this.#data[TYPE] === true;
    }

    isImage() {
        return this.#data[TYPE] === false;
    }

    isBoth() {
        return this.#data[TYPE] === null;
    }

    excludes(userID) {
        return this.#data[EXCLUDES].includes(userID);
    }

    includes(userID) {
        return this.#data[INCLUDES].includes(userID);
    }

    addUser(user, timestamp) {
        this.#data[USERS][user] = timestamp;
    }

    getUser(user) {
        return this.#data[USERS][user];
    }

    removeUser(user) {
        delete this.#data[USERS][user];
    }
}
module.exports = ChannelData;
