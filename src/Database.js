/*
 * This file is part of BetterSlowmode.
 * Copyright (C) 2021 Alejandro Ramos
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

const ChannelData = require("./ChannelData");
const { Sequelize, DataTypes, Op } = require("sequelize");

class Database {
    #sequelize;
    #ChannelData

    constructor(databaseURL) {
        this.#sequelize = new Sequelize(databaseURL, {
            dialectOptions: {
                ssl: {
                    rejectUnauthorized: false
                }
            }
        });
    }

    // used so that I can await this function and come back with a fully ready database that I can perform operations with
    static async build(databaseURL) {
        const database = new Database(databaseURL);
        await database.initialize();
        return database;
    }

    async initialize() {
        this.#ChannelData = await this.#sequelize.define("ChannelData", {
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
        await this.#ChannelData.sync();
    }

    // returns ChannelData object
    async getChannel(id) {
        const model = await this.getDBObject(id);
        if (model === null) {
            return null;
        }
        return new ChannelData(model.id, model.serverID, model.length, model.type, model.userExcludes, model.userIncludes, model.roleExcludes, model.roleIncludes, model.users, model.userTimes, model);
    }

    // returns an instance of a Sequelize model (row in db)
    async getDBObject(id) {
        return await this.#ChannelData.findByPk(id);
    }

    addChannel(channelData) {
        this.#ChannelData.create({
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

    // creates a new row if needed
    async setChannel(channelData) {
        const dbObject = await this.getDBObject(channelData.getID());

        // should never be the case. the caller of this function should always give a valid channel from the database
        if (dbObject === null) {
            this.addChannel(channelData);
            return;
        }

        dbObject.id = channelData.getID();
        dbObject.serverID = channelData.getServerID();
        dbObject.length = channelData.getLength();
        dbObject.type = channelData.getType();
        dbObject.userExcludes = channelData.getUserExcludes();
        dbObject.userIncludes = channelData.getUserIncludes();
        dbObject.roleExcludes = channelData.getRoleExcludes();
        dbObject.roleIncludes = channelData.getRoleIncludes();
        dbObject.users = channelData.getUsers();
        dbObject.userTimes = channelData.getUserTimes();
        await dbObject.save();
    }

    async removeChannel(id) {
        await this.#ChannelData.destroy({
            where: {
                id: id
            }
        });
    }

    async removeServer(serverID) {
        await this.#ChannelData.destroy({
            where: {
                serverID: serverID
            }
        });
    }

    async sanitizeDatabase(serverIDs, channelIDs) {
        // if there are no servers or our servers have no text channels, delete all rows and exit
        if (serverIDs.length === 0 || channelIDs.length === 0) {
            await this.#ChannelData.destroy({
                truncate: true
            });
            return;
        }

        // remove channels from servers we are no longer in and remove channels that were deleted
        await this.#ChannelData.destroy({
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
        // get all of the user arrays and userTime arrays and remove users whose times have now expired
        for (const model of await this.#ChannelData.findAll({attributes: ["id", "length", "users", "userTimes"]})) {
            const users = model.users.slice();
            const userTimes = model.userTimes.slice();
            let changed = false;
            for (let i = 0; i < users.length; i++) {
                if (Date.now() >= userTimes[i] + model.length) {
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
    }

    async shutDown() {
        await this.#sequelize.close();
    }
}
module.exports = Database;
