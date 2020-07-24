# BetterSlowmode
![Version](https://img.shields.io/badge/version-0.1.0-blue.svg?cacheSeconds=2592000)
[![Documentation](https://img.shields.io/badge/documentation-yes-brightgreen.svg)](https://github.com/aeramos/BetterSlowmode#readme)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/aeramos/BetterSlowmode/graphs/commit-activity)
[![License: AGPL-3.0+](https://img.shields.io/github/license/aeramos/BetterSlowmode)](https://github.com/aeramos/BetterSlowmode/blob/master/LICENSE.txt)
[![Twitter: aeramos\_](https://img.shields.io/twitter/follow/aeramos\_.svg?style=social)](https://twitter.com/aeramos\_)

> A Discord bot that adds more depth and customization to text channel slowmodes.

## Overview
BetterSlowmode is a Discord bot designed to give users more power when defining slowmodes for text
channels. With the bot, users can specifically exclude or include certain members to the slowmode,
and they can specify which types of content will be blocked during the slowmode: text or images.

BetterSlowmode is designed for as much customization as possible. Your slowmodes can be as short as
1 second, or as long as 1 year! You can even change the bot's prefix in your server so it doesn't
interfere with other bots!

## Invite the bot to your server!
Coming soon! Once the codebase becomes stable and after I add more tools for automatically cleaning
up the database, you'll be able to add BetterSlowmode to your server! Until then, you can self-host
with instructions below!

## Install
```sh
npm install
```

## Usage
Run the bot with:
```sh
node main.js
```

In Discord (default prefix is %):
```sh
%help
%prefix !
%set 1h 30m 10s --exclude @aeramos#0979
%set-image 1d --include @aeramos#0979
%set-text 1y
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
Copyright © 2020 [Alejandro Ramos](https://github.com/aeramos).

This project is licensed under the [AGPL-3.0+](https://github.com/aeramos/BetterSlowmode/blob/master/LICENSE.txt).

***
_This README was generated with ❤️ by [readme-md-generator](https://github.com/kefranabg/readme-md-generator)
and further modified by Alejandro Ramos._
