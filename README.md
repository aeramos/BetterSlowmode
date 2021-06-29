# BetterSlowmode
![Version](https://img.shields.io/badge/version-0.1.0-blue.svg?cacheSeconds=2592000)
[![Documentation](https://img.shields.io/badge/documentation-yes-brightgreen.svg)](https://github.com/aeramos/BetterSlowmode#readme)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/aeramos/BetterSlowmode/graphs/commit-activity)
[![License: AGPL-3.0+](https://img.shields.io/github/license/aeramos/BetterSlowmode)](https://github.com/aeramos/BetterSlowmode/blob/master/LICENSE.txt)
[![Twitter: aeramos\_](https://img.shields.io/twitter/follow/aeramos\_.svg?style=social)](https://twitter.com/aeramos\_)

> A Discord bot that adds more depth and customization to text channel slowmodes.

## Overview
BetterSlowmode is a Discord bot designed to give users more power when defining slowmodes for text
channels. With the bot, users can specify which types of content will be blocked during the slowmode:
text or images or both. They can even specifically include or exclude certain members to/from the slowmode!

BetterSlowmode is designed for as much customization as possible. Your slowmodes can be as short as
1 second, or as long as a year!

## Invite the bot to your server!
Coming soon! Once the codebase becomes stable and after I add more tools for automatically cleaning
up the database, you'll be able to add BetterSlowmode to your server! Until then, you can self-host
with instructions below!

## Install
1. Install and configure Postgres server
2. Setup `config.json` (use `config.json.example` as a base)
3. `npm install`

## Usage
Run the bot with:
```
npm start
```

Try some commands with the bot, use `%help` for more information.
```
%help
%set 1h 30m 10s --exclude @aeramos
%set-image 1d --include @aeramos
%set-text 1y
%remove
```

## Developer
**Alejandro Ramos**

* GitHub: [@aeramos](https://github.com/aeramos)
* Twitter: [@aeramos\_](https://twitter.com/aeramos\_)
* Email: [aeramos.work@gmail.com](mailto:aeramos.work@gmail.com)

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!

Feel free to check the [issues page](https://github.com/aeramos/BetterSlowmode/issues). 

## Show your support
Please ⭐️ this repository if this bot can help you!

## 📝 License
Copyright © 2020, 2021 [Alejandro Ramos](https://github.com/aeramos).

This project is licensed under the [AGPL-3.0+](https://github.com/aeramos/BetterSlowmode/blob/master/LICENSE.txt).

***
_This README was generated with ❤️ by [readme-md-generator](https://github.com/kefranabg/readme-md-generator)
and further modified by Alejandro Ramos._
