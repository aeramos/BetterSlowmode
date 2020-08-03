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

const PREFIX = 0;
const CHANNELS = 1;

class ServerData {
    #data;

    constructor(data) {
        this.#data = data;
    }

    static createData(prefix) {
        return [
            prefix,
            []
        ];
    }

    getData() {
        return this.#data;
    }

    getPrefix() {
        return this.#data[PREFIX];
    }

    setPrefix(prefix) {
        this.#data[PREFIX] = prefix;
    }

    getChannels() {
        return this.#data[CHANNELS];
    }
}
module.exports = ServerData;
