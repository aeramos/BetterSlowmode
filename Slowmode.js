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

const LENGTH = 0;
const TYPE = 1;
const EXCLUDES = 2;
const INCLUDES = 3;
const USERS = 4;

class Slowmode {
    static createData(length, type, excludes, includes) {
        return [
            length,
            type,
            excludes,
            includes,
            {}
        ]
    }

    static getLength(data) {
        return data[LENGTH];
    }

    static isText(data) {
        return data[TYPE] === true;
    }

    static isImage(data) {
        return data[TYPE] === false;
    }

    static isBoth(data) {
        return data[TYPE] === null;
    }

    static getExcludes(data) {
        return data[EXCLUDES];
    }

    static getIncludes(data) {
        return data[INCLUDES];
    }

    static addUser(data, user, timestamp) {
        data[USERS] = {};
        data[USERS][user] = timestamp;
    }

    static getUser(data, user) {
        return data[USERS][user];
    }

    static removeUser(data, user) {
        delete data[USERS][user];
    }
}
module.exports = Slowmode;
