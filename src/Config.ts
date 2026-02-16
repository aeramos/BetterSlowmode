/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2026 Alejandro Ramos
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

import * as dotenv from "dotenv";

interface Config {
    botToken: string;
    databaseURL: string;
    prefix: string | undefined;
    supportCode: string;
}

function checkExists(varName: string) {
    if (!process.env[varName]) {
        console.error(`Error: Missing environment variable: ${varName}`);
        process.exit(1);
    }
}

// load and validate config
dotenv.config({path: "config/env.conf"});
checkExists("BOT_TOKEN");
checkExists("DATABASE_URL");
checkExists("SUPPORT_CODE");

const config: Config = {
    botToken: process.env.BOT_TOKEN!,
    databaseURL: process.env.DATABASE_URL!,
    prefix: process.env.PREFIX,
    supportCode: process.env.SUPPORT_CODE!
}

export default config;
