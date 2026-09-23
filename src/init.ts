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

import * as Discord from "discord.js";

import * as Config from "./Config.js";
import Database from "./Database.js";

Config.loadEnvFile();
const config: Config.Config = Config.getConfig();

const manager = new Discord.ShardingManager("dist/main.js", {
    token: config.botToken,
    execArgv: ["--enable-source-maps"],
});

/**
 * Remove expired slowmodes and information about servers/channels we no longer have access to from the database.
 */
async function sanitizeDatabase(): Promise<void> {
    // get the ids of servers and channels each shard is handling so they can be spared from the database cleanup
    const serverIDs = (await manager.broadcastEval(client => {
        return Array.from(client.guilds.cache.keys());
    })).flat();
    const textBasedChannelIDs = (await manager.broadcastEval(client => {
        return Array.from(client.channels.cache.filter(channel => channel.isTextBased()).keys());
    })).flat();

    const database = await Database.create(config.databaseURL);
    const [deleted, expired] = await database.sanitizeDatabase(serverIDs, textBasedChannelIDs);
    await database.close();

    console.log(`Manager: Deleted channels: ${deleted}`);
    console.log(`Manager: Expired slowmodes: ${expired}`);
}

/**
 * Disconnect from the database and Discord to gracefully shut down the bot.
 *
 * @param signal The signal recieved. Should be SIGINT or SIGTERM.
 */
async function shutDownBot(signal: string): Promise<void> {
    manager.respawn = false;
    console.log(`Manager: Bot has received ${signal}, shutting down shards.`);

    // add handlers to catch each shard's onDeath event
    // i think this has a race condition: if one of the shards dies randomly and then the SIGINT is received before it respawns
    // if that happens the timeout will handle it.
    const allShardsDead = new Promise<void>(resolve => {
        const remainingShards = new Set(manager.shards.keys());
        for (const [id, shard] of manager.shards) {
            remainingShards.add(id);
            shard.on(Discord.ShardEvents.Death, () => {
                remainingShards.delete(shard.id);
                if (remainingShards.size === 0) {
                    resolve();
                }
            });
        }
    });
    const timeout = new Promise<void>(resolve => {
        setTimeout(() => {
            console.log("Manager: 2 second shard timeout exceeded. Continuing with shutdown.");
            resolve();
        }, 2000);
    });

    manager.broadcast("shutdown");
    await Promise.race([allShardsDead, timeout]);

    console.log("Manager: Ending manager process.")
    process.exit(0);
}

await manager.spawn();
await sanitizeDatabase();

process.on("SIGINT", shutDownBot);
process.on("SIGTERM", shutDownBot);
