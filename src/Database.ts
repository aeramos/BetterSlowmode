/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2021, 2024 Alejandro Ramos
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

import { Sequelize, DataTypes, Op, Model, ModelStatic } from "sequelize";
import Discord from "discord.js";

import ChannelData from "./ChannelData.js";

/**
 * The Database is used to store slowmode configurations and statuses.
 *
 * By default, this bot uses PostgreSQL as the database, but any backend can be used if is supported by the Sequelize
 * library and the required Node packages are installed.
 *
 * There is one table, ChannelData, with the following keys:
 *
 * |     Name     |   Type   | Description |
 * | ------------ | -------- | ----------- |
 * |      id      |  bigint  | Primary key. Discord channel ID |
 * |   serverID   |  bigint  | Discord server ID |
 * |    length    | integer  | Length of the slowmode in seconds |
 * |     type     | boolean  | Nullable. Slowmode type: true for text-only slowmodes, false for image-only, and null for normal/default |
 * |    users     | bigint[] | List of users currently on cooldown |
 * |  userTimes   | bigint[] | Timestamp of the last message sent before user entered cooldown, in milliseconds |
 * | userIncludes | bigint[] | List of users the slowmode specially includes |
 * | userExcludes | bigint[] | List of users the slowmode specially excludes |
 * | roleIncludes | bigint[] | List of roles the slowmode specially includes |
 * | roleExcludes | bigint[] | List of roles the slowmode specially excludes |
 *
 * @see ChannelData
 */
class Database {
    /**
     * The database connection.
     * @private
     */
    private readonly sequelize: Sequelize;

    /**
     * The Sequelize representation of the ChannelData table.
     * @private
     */
    private readonly ChannelData: ModelStatic<Model<any, any>>;

    /**
     * @param databaseURL A valid connection string to log into the database.
     */
    public constructor(databaseURL: string) {
        this.sequelize = new Sequelize(databaseURL, {
            dialectOptions: {
                ssl: {
                    rejectUnauthorized: false
                }
            },
            logging: false
        });
        this.ChannelData = this.sequelize.define("ChannelData", {
            id: {
                type: DataTypes.BIGINT,
                allowNull: false,
                primaryKey: true
            },
            serverID: {
                type: DataTypes.BIGINT,
                allowNull: false
            },
            length: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            type: {
                type: DataTypes.BOOLEAN,
                allowNull: true
            },
            users: {
                type: DataTypes.ARRAY(DataTypes.BIGINT),
                allowNull: false
            },
            userTimes: {
                type: DataTypes.ARRAY(DataTypes.BIGINT),
                allowNull: false
            },
            userIncludes: {
                type: DataTypes.ARRAY(DataTypes.BIGINT),
                allowNull: false
            },
            userExcludes: {
                type: DataTypes.ARRAY(DataTypes.BIGINT),
                allowNull: false
            },
            roleIncludes: {
                type: DataTypes.ARRAY(DataTypes.BIGINT),
                allowNull: false
            },
            roleExcludes: {
                type: DataTypes.ARRAY(DataTypes.BIGINT),
                allowNull: false
            }
        }, {
            freezeTableName: true
        });
    }

    /**
     * Logs into the database server and creates the table if it doesn't already exist.
     */
    public async initialize(): Promise<void> {
        await this.ChannelData.sync();
    }

    /**
     * @param channelID Discord channel ID.
     *
     * @returns The slowmode information for the given channel. Returns null if the channel does not have a slowmode.
     */
    public async getChannel(channelID: Discord.Snowflake): Promise<ChannelData | null> {
        // a Model is a row in sequelize. it has a property for each column, for example: id, serverID, length are all variables of the correct type
        const model: any | null = await this.getDBObject(channelID);
        if (model === null) {
            return null;
        }
        return new ChannelData(model.id, model.serverID, model.length, model.type, model.userExcludes, model.userIncludes, model.roleExcludes, model.roleIncludes, model.users, model.userTimes, model);
    }

    /**
     * @param id The primary key to search for.
     *
     * @returns The requested row of the database as a Sequelize Model, or null if it doesn't exist.
     */
    private async getDBObject(id: string): Promise<Model<any, any> | null> {
        return this.ChannelData.findByPk(id);
    }

    /**
     * Adds or updates a row in the database.
     *
     * @param channelData The row to add to the database. If the `_model` property is present, it will be used as a base
     * to UPDATE the row with. Otherwise, a new row will be INSERTed with this information.
     */
    public async setChannel(channelData: ChannelData) {
        // if the Model exists, the row exists, so UPDATE
        if (channelData._model) {
            // sql UPDATE the row
            await channelData._model.update({
                id: channelData.getID(),
                serverID: channelData.getServerID(),
                length: channelData.getLength(),
                type: channelData.getType(),
                userExcludes: channelData.getUserExcludes(),
                userIncludes: channelData.getUserIncludes(),
                roleExcludes: channelData.getRoleExcludes(),
                roleIncludes: channelData.getRoleIncludes(),
                users: channelData.getUsers(),
                userTimes: channelData.getUserTimes()
            });
        } else {
            // if the Model does not exist, the row does not exist (because the Commands would have preserved a valid Model otherwise), so INSERT.
            // this should only happen when the Set command is run on a channel that doesn't currently have a slowmode.
            // UPSERT is not used because if the above assumption is no longer true, there is a problem that should be fixed.

            // sql INSERT the new row
            await this.ChannelData.create({
                id: channelData.getID(),
                serverID: channelData.getServerID(),
                length: channelData.getLength(),
                type: channelData.getType(),
                userExcludes: channelData.getUserExcludes(),
                userIncludes: channelData.getUserIncludes(),
                roleExcludes: channelData.getRoleExcludes(),
                roleIncludes: channelData.getRoleIncludes(),
                users: channelData.getUsers(),
                userTimes: channelData.getUserTimes()
            });
        }
    }

    /**
     * Removes a channel from the database.
     *
     * @param channelID Discord channel ID.
     */
    public async removeChannel(channelID: Discord.Snowflake): Promise<void> {
        await this.ChannelData.destroy({
            where: {
                id: channelID
            }
        });
    }

    /**
     * Removes all of a server's channels from the database.
     *
     * @param serverID Discord server ID.
     */
    public async removeServer(serverID: Discord.Snowflake): Promise<void> {
        await this.ChannelData.destroy({
            where: {
                serverID: serverID
            }
        });
    }

    /**
     * Drops all rows in servers and channels that the bot lost access to. Also goes through each slowmode and removes
     * users whose timers have expired.
     *
     * @param serverIDs All servers the bot is in.
     * @param channelIDs All channels the bot has access to.
     *
     * @returns Tuple with number of deleted channels and number of expired users.
     */
    public async sanitizeDatabase(serverIDs: Discord.Snowflake[], channelIDs: Discord.Snowflake[]): Promise<number[]> {
        // if there are no servers or our servers have no text channels, delete all rows and exit
        if (serverIDs.length === 0 || channelIDs.length === 0) {
            return [
                await this.ChannelData.destroy({
                    truncate: true
                }),
                0
            ];
        }

        // remove channels from servers we are no longer in and remove channels that were deleted
        const deleted = await this.ChannelData.destroy({
            where: {
                [Op.or]: {
                    serverID: {
                        [Op.notIn]: serverIDs
                    },
                    id: {
                        [Op.notIn]: channelIDs
                    }
                }
            }
        });

        // remove users whose slowmodes have expired
        // get all the user arrays and userTime arrays and remove users whose times have now expired
        let expired = 0;
        for (const model of await this.ChannelData.findAll({attributes: ["id", "length", "users", "userTimes"]})) {
            const users: bigint[] = (<any>model).users.slice();
            const userTimes: bigint[] = (<any>model).userTimes.slice();
            let changed = false;
            for (let i = 0; i < users.length; i++) {
                // slowmode length is measured in seconds. Date.now() and user times are tracked in milliseconds
                if (Date.now() >= Number(userTimes[i]) + (<any>model).length * 1000) {
                    expired++;
                    users.splice(i, 1);
                    userTimes.splice(i, 1);
                    model.set("users", users);
                    model.set("userTimes", userTimes);
                    changed = true;
                    i--;
                }
            }
            if (changed) {
                await model.save();
            }
        }
        return [deleted, expired];
    }

    /**
     * Closes the database connection.
     */
    public async shutDown() {
        await this.sequelize.close();
    }
}
export default Database;
