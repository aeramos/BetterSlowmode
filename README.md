# BetterSlowmode
![Version: 1.0](https://img.shields.io/badge/version-1.0-blue.svg)
[![License: GNU AGPL-3.0+](https://img.shields.io/github/license/aeramos/BetterSlowmode)](./LICENSE.txt)
[![Twitter: aeramos_](https://img.shields.io/twitter/follow/aeramos_.svg)](https://twitter.com/aeramos_)

#### A Discord bot that adds more depth and customization to text channel slowmodes, including text or image only slowmodes.

### [Invite the bot to your server!](https://discord.com/api/oauth2/authorize?client_id=733458562101280788&permissions=26624&scope=bot%20applications.commands)
### [Join the Support Server!](https://discord.com/invite/JUE8keP)

## Overview
BetterSlowmode is a verified Discord bot designed to give users more power when defining slowmodes for text channels.
With the bot, users can specify which types of content will be blocked during the slowmode: text or images or both.

BetterSlowmode is designed for as much customization as possible. Your slowmodes can be as short as 1 second, or as long
as a year. You can even specially include or exclude certain members or roles to/from the slowmode!

## How to use
It's very simple! Try out the commands below to get started. Always remember that you can use `@BetterSlowmode help` 
for a list of all the commands, and `@BetterSlowmode help [command]` to get help for a specific command.
```
@BetterSlowmode
@BetterSlowmode help
@BetterSlowmode help set
@BetterSlowmode set 1h 30m 10s -exclude @aeramos
@BetterSlowmode set-image 1d -include @aeramos
@BetterSlowmode set-text 1y
@BetterSlowmode status
@BetterSlowmode remove
@BetterSlowmode reset @aeramos
@BetterSlowmode info
```

BetterSlowmode also supports slash commands! If enabled, slash commands can be used by pressing `/` then selecting or
typing any BetterSlowmode command, like `/set` or `/status`. 

If slash commands are not enabled in your server, you may need to [re-invite BetterSlowmode](https://discord.com/api/oauth2/authorize?client_id=733458562101280788&permissions=26624&scope=bot%20applications.commands)
to your server. Don't worry, your slowmodes will not be removed because you don't need to kick the bot, just click on
the new invite link.

## Show your support
We are on [top.gg](https://top.gg/bot/733458562101280788). If you like this bot, feel free to leave a vote and a review!

Also, it would mean a lot to us if you starred our repository on [GitHub](https://github.com/aeramos/BetterSlowmode)!

## Frequently Asked Questions
- I set a slowmode with the `@BetterSlowmode set` command, but nothing shows up in Discord. It doesn't say "Slowmode 
  is enabled" at the bottom of the screen. Is the slowmode enabled?
    - Yes, the slowmode is enabled. It doesn't show the indicator because the bot doesn't use normal Discord Slowmodes,
      it manages the messages by itself. Through this, the bot is able to create slowmodes just for images or slowmodes
      that exclude certain members.
- The slowmode doesn't do anything. I set a slowmode, but it doesn't delete any of my messages. Is it broken?
    - No, this is correct behavior. You are immune from any slowmodes you create because you have either the Manage
      Channel of Administrator permissions in the channel. The slowmode will apply to members who don't have those
      permissions, according to the rules you set.
- How do I include a moderator to a slowmode?
    - Using the `-include` option with `@BetterSlowmode set`, `set-text`, or `set-image`, you can include individual
      members or roles. However, you can only specially include people who are less powerful than you. This is
      determined by the order of the roles in Discord. You can change the order in the server settings or ask the owner
      to set the slowmode. The owner of the server can include anyone.
- Can I include multiple users and roles to a slowmode? The slash command only lets me choose one.
  - Yes! If you use the `@BetterSlowmode set` command, you can add as many `-include` or `-exclude` options as you want.
    For example `@BetterSlowmode set -include @john @peter -exclude @james @matthew`. Note that if some of a user's
    roles are included and some of them are excluded, the status of the higher-ranked role takes precedence.

## Host the bot yourself
Since BetterSlowmode is open source, you can host the bot yourself for your own servers if you want. 
This is not necessary since we have a public instance of the bot that you can invite [here](https://discord.com/api/oauth2/authorize?client_id=733458562101280788&permissions=26624&scope=bot%20applications.commands).
If you have a question about our public hosting methods or security, please ask us on the [Support Server](https://discord.com/invite/JUE8keP).

If you host the bot yourself, we just require that you follow the terms of our software license, the [GNU AGPL3+](./LICENSE.txt).
We also ask that you don't host it as a public bot, unless you want to modify it and make your own fork, and advertise
that fact. We just don't want anyone to be confused about the bot if there are multiple different instances out there.
Please ask a question on the [Support Server](https://discord.com/invite/JUE8keP) if you're confused.

### Installation
1. Install and configure a PostgreSQL server for the database
2. Setup `config/config.json` (use `config/config.json.example` as a base)
3. `npm install` to install the dependencies
4. `npm run build` to compile the TypeScript

### Usage
Run the bot with:
```
npm start
```

## Developer
#### Alejandro Ramos

- GitHub: [@aeramos](https://github.com/aeramos)
- Discord: [@aeramos#0979](https://discord.com/users/733391783324680234)
- Twitter: [@aeramos_](https://twitter.com/aeramos_)
- Email: [aeramos.work@gmail.com](mailto:aeramos.work@gmail.com)

## License / Terms of Service
Copyright (C) 2020, 2021, 2022, 2024, 2025 [Alejandro Ramos](https://github.com/aeramos).

BetterSlowmode is free software: you can redistribute it and/or modify it under the terms of the
[GNU Affero General Public License](./LICENSE.txt) as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

BetterSlowmode is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
details.

You should have received a copy of the [GNU Affero General Public License](./LICENSE.txt) along with BetterSlowmode. 
If not, see <https://www.gnu.org/licenses/>.

## Privacy Policy
BetterSlowmode only stores information directly related to the slowmodes while they are active. **We do not sell or
distribute your data**. We also limit what information is required. We require some information so the bot knows what
channel the slowmodes are on, and which people the slowmodes apply to.

In detail, this means: the `channel ID` (if the channel has one of our slowmodes), the `server ID` for those channels,
the `user ID` of people who are subject to the slowmode after they send a message in the channel, and what time they
last sent a message (if the slowmode didn't delete it). Optionally, we also record `user IDs` or `role IDs` if a user or
role is specially included to or excluded from the slowmode.

All information relating to a channel is removed when its slowmode is removed. We also remove stored `userIDs` and
message times after the user's cooldown expires.
