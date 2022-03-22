# BetterSlowmode
![Version: 0.1.0](https://img.shields.io/badge/version-0.1.0-blue.svg)
[![License: GNU AGPL-3.0+](https://img.shields.io/github/license/aeramos/BetterSlowmode)](./LICENSE.txt)
[![Twitter: aeramos_](https://img.shields.io/twitter/follow/aeramos_.svg)](https://twitter.com/aeramos_)

#### A Discord bot that adds more depth and customization to text channel slowmodes, including text or image only slowmodes.

### [Invite the bot to your server!](https://discord.com/api/oauth2/authorize?client_id=733458562101280788&permissions=10240&scope=bot%20applications.commands )
### [Join the Support Server!](https://discord.com/invite/JUE8keP)

## Overview
BetterSlowmode is a Discord bot designed to give users more power when defining slowmodes for text
channels. With the bot, users can specify which types of content will be blocked during the slowmode:
text or images or both.

BetterSlowmode is designed for as much customization as possible. Your slowmodes can be as short as
1 second, or as long as a year. You can even specially include or exclude certain members or roles to/from the slowmode!

## How to use
It's very simple! Try out the commands below to get started. Always remember that you can use `%help` for a list of all
the commands, and `%help [command]` to get help for a specific command.
```
%help
%help set
%set 1h 30m 10s -exclude @aeramos
%set-image 1d -include @aeramos
%set-text 1y
%status
%remove
%info
```

## Show your support
We are on [top.gg](https://top.gg/bot/733458562101280788). If you like this bot, feel free to leave a vote and a review!

Also, it would mean a lot to us if you starred our repository on [GitHub](https://github.com/aeramos/BetterSlowmode)!

## Slash command and tag prefixes
Due to [a change](https://support-dev.discord.com/hc/en-us/articles/4404772028055-Message-Content-Privileged-Intent-for-Verified-Bots)
from Discord, bots in 100+ servers will no longer be able to view the contents of a message if they don't gain approval
from Discord to view it, unless the bot is tagged (@) in the message. Just in case we don't get approval, BetterSlowmode
now supports slash commands and using a tag (@BetterSlowmode) as the prefix.

If slash commands are not enabled in your server, you may need to [re-invite BetterSlowmode](https://discord.com/api/oauth2/authorize?client_id=733458562101280788&permissions=10240&scope=bot%20applications.commands)
to your server. Don't worry, your slowmodes will not be removed because you don't need to kick the bot, just click on
the new invite link.

Once enabled, slash commands can be used by pressing `/` then selecting or typing any BetterSlowmode command. Tag
commands can be used by just using @BetterSlowmode in place of the prefix (`%`).

## Frequently Asked Questions
- I set a slowmode with the `%set` command, but nothing shows up on Discord. It doesn't say "Slowmode is enabled" near
  the Discord chat. Is the slowmode enabled?
    - Yes, the slowmode is enabled. It doesn't show the indicator because the bot doesn't use normal Discord Slowmodes,
      it manages the messages by itself. This is what allows it to create slowmodes just for images or exclude certain
      people from the slowmode for example.
- The slowmode doesn't do anything. I set a slowmode, but it doesn't delete any of my messages. Is it broken?
    - No, the bot's working fine. The reason you are immune from the slowmode is that you're a moderator with the
      permissions to create a slowmode (Manage Channel or Administrator). See what happens when someone without those
      permissions (who isn't also excluded) tries to violate the slowmode. The bot won't let them.
- How do I include a moderator to a slowmode? It doesn't let me.
    - You can only specially include people who are less powerful than you. This is determined by the order of the roles
      in Discord. This is to prevent abuse of the special inclusions. You can change the order temporarily or just ask
      the owner to set the slowmode. The owner of the server can include anyone.

## Host the bot yourself
Since BetterSlowmode is open source, you can host the bot yourself for your own servers if you want. 
This is not necessary since we have a public instance of the bot that you can invite [here](https://discord.com/api/oauth2/authorize?client_id=733458562101280788&permissions=10240&scope=bot).
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
Copyright © 2020, 2021, 2022 [Alejandro Ramos](https://github.com/aeramos).

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
