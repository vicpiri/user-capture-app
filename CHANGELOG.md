# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.2.1](https://github.com/vicpiri/user-capture-app/compare/v1.2.0...v1.2.1) (2025-10-27)

## [1.2.0](https://github.com/vicpiri/user-capture-app/compare/v1.1.4...v1.2.0) (2025-10-27)


### Features

* add automatic build to release scripts ([e94f9fa](https://github.com/vicpiri/user-capture-app/commit/e94f9fae8cdc85f35dff0eaa2689c5e484a7391b))
* add automatic repository folder watching with chokidar ([a7d3449](https://github.com/vicpiri/user-capture-app/commit/a7d3449e9fbc7509e1f1e9989709aa07cf63d99a))
* add empty state placeholder when no project is open ([dfe7a03](https://github.com/vicpiri/user-capture-app/commit/dfe7a03667827a3878d51002e383c4c1f120f6f4))
* add Enter key support for modal default buttons ([1dc840f](https://github.com/vicpiri/user-capture-app/commit/1dc840f8fe5463db15c361fc4cd9076e0ea1a40f))
* add inventory export with optional image compression in ZIP files ([cef7437](https://github.com/vicpiri/user-capture-app/commit/cef74378f67a78eb8d431473fd0e1a6f492dc1f5))
* add loading spinners for repository indicators ([4644a0e](https://github.com/vicpiri/user-capture-app/commit/4644a0eaca64d8b14806318cbfb6c96ea8435754))
* add local repository mirror to prevent UI blocking on network drives ([06c7c27](https://github.com/vicpiri/user-capture-app/commit/06c7c278b24d1770c72882d13e59ad629a0903fc))
* add repository change detection system with multiple strategies ([f9f60ac](https://github.com/vicpiri/user-capture-app/commit/f9f60ac249bb7f68a80e911d0a39f5232187981d))
* add repository image grid and synchronized group filters ([bb30e27](https://github.com/vicpiri/user-capture-app/commit/bb30e27781b9bae9e4c0b7f4a9908a389b481fd5))
* add spinner and loading styles for repository placeholders ([a1729f5](https://github.com/vicpiri/user-capture-app/commit/a1729f57e540a0e67cdf87bfd07ec26102937b4a))
* display application version in window title ([967e2e5](https://github.com/vicpiri/user-capture-app/commit/967e2e54acb53b126620463be51d64fde9e9485c))
* extract VirtualScrollManager component from renderer ([cf06ecd](https://github.com/vicpiri/user-capture-app/commit/cf06ecdca9e6ac993bee2e8c99661320c90d9178))
* implement phase 1 of renderer refactoring - architecture foundation ([7e7082c](https://github.com/vicpiri/user-capture-app/commit/7e7082cb64738fc5120123090e0719702fb43fea))
* implement phase 2 of renderer refactoring - modal components ([949d613](https://github.com/vicpiri/user-capture-app/commit/949d6136433e26daa96b1ed5b0e61b449f62b32c))
* implement phase 3 of renderer refactoring - modal integration ([e63a031](https://github.com/vicpiri/user-capture-app/commit/e63a0316ad37c87eb5db5e6c7e799bc633b7fb1c))
* persist display preferences across application restarts ([7cb9f69](https://github.com/vicpiri/user-capture-app/commit/7cb9f6920d1d0fab1c8620bebb7d2a7c3c37da1c))
* preserve scroll position when refreshing repository images ([f1665c6](https://github.com/vicpiri/user-capture-app/commit/f1665c605e2927396c0c48f68a6d1cf8da5e7c44))


### Bug Fixes

* add manual repository refresh due to unreliable automatic change detection ([15b3670](https://github.com/vicpiri/user-capture-app/commit/15b36709f17579482eb323b43f147e7ae9704292))
* apply saved group filter when loading project data ([ed35410](https://github.com/vicpiri/user-capture-app/commit/ed354107387b572b00c2a76d2387f23d6c1fb2be))
* change keyboard shortcut for refresh repository images to avoid conflict ([2ec69e5](https://github.com/vicpiri/user-capture-app/commit/2ec69e574a28ce5205730a11bc654d2be1f81df2))
* convert CommonJS modules to browser-compatible format ([706b66c](https://github.com/vicpiri/user-capture-app/commit/706b66cced6e78149457b602e133fce53991efbe))
* correct mock setup order in userService tests ([24a93ca](https://github.com/vicpiri/user-capture-app/commit/24a93cadfc8377f12f6582286600d79fda9e7bdc))
* defer camera detection to prevent UI blocking on startup ([365d064](https://github.com/vicpiri/user-capture-app/commit/365d064e9da0e927a42cc8706161ec12c176e47f))
* ensure progress bars reach 100% and remain visible ([6bac8ca](https://github.com/vicpiri/user-capture-app/commit/6bac8ca4102e8336613bb84593e3b8a0bd264596))
* ensure repository photo spinners are visible when toggling display ([ca51684](https://github.com/vicpiri/user-capture-app/commit/ca5168475dde9b25bf3d16d5616f916cfd2b599d))
* ensure repository photo spinners remain visible during sync ([53b9219](https://github.com/vicpiri/user-capture-app/commit/53b92193b38ef37d74743462f524a017d34b4369))
* initialize repository options when enabled on startup ([414061c](https://github.com/vicpiri/user-capture-app/commit/414061c5f6590e0325defd7738f2c404d305998d))
* load repository data correctly when options are enabled on startup ([c017a52](https://github.com/vicpiri/user-capture-app/commit/c017a5235b1613f2e543d0d90327529cecc20cea))
* prevent no-project-placeholder from blocking UI interactions ([002af7a](https://github.com/vicpiri/user-capture-app/commit/002af7aa6378ed221ceebc07e803f8cb83ee93a8)), closes [#1a1f2](https://github.com/vicpiri/user-capture-app/issues/1a1f2)
* reload user data when enabling thumbnail display ([baf5e34](https://github.com/vicpiri/user-capture-app/commit/baf5e343c4ebdf331b67e5c29200474c5fbda540))
* resolve mainWindow function call error in IPC handlers ([0797504](https://github.com/vicpiri/user-capture-app/commit/07975042bdbfb0b3bc1dabe24a4b0ac980737468))
* resolve process and modal reference errors in browser context ([bb4cfa3](https://github.com/vicpiri/user-capture-app/commit/bb4cfa320e17001291d5243d3e01e7e66ad2d599))
* resolve repository grid spinner issue when sync already completed ([5e9c553](https://github.com/vicpiri/user-capture-app/commit/5e9c5535b97d712da7106e98a2d3663edcdd706b))
* wrap modal files in IIFE to prevent global scope conflicts ([10c0a26](https://github.com/vicpiri/user-capture-app/commit/10c0a262d58597db30c3107db9fd267f05b60ba0))

### [1.1.4](https://github.com/vicpiri/user-capture-app/compare/v1.1.3...v1.1.4) (2025-10-22)


### Bug Fixes

* install Windows SDK via Visual Studio installer ([95c7a21](https://github.com/vicpiri/user-capture-app/commit/95c7a213b1382fb93a9fa0074e45c9555d83d4ac))

### [1.1.3](https://github.com/vicpiri/user-capture-app/compare/v1.1.2...v1.1.3) (2025-10-22)


### Bug Fixes

* install Windows SDK to fix node-gyp compilation ([11ea1bb](https://github.com/vicpiri/user-capture-app/commit/11ea1bb70e4e705fbc9e1d20e9a85856ca4629e0))

### [1.1.2](https://github.com/vicpiri/user-capture-app/compare/v1.1.1...v1.1.2) (2025-10-22)


### Bug Fixes

* configure native module rebuild with explicit Electron settings ([45882b8](https://github.com/vicpiri/user-capture-app/commit/45882b870e07a73d7270fcc804ef8fbdce41d2d3))

### [1.1.1](https://github.com/vicpiri/user-capture-app/compare/v1.1.0...v1.1.1) (2025-10-22)


### Bug Fixes

* improve GitHub Actions Windows build workflow ([c12237e](https://github.com/vicpiri/user-capture-app/commit/c12237e3986d96fa45a2c2139addb1fcac708cff))

## [1.1.0](https://github.com/vicpiri/user-capture-app/compare/v1.0.2...v1.1.0) (2025-10-21)


### Features

* add keyboard shortcut (Ctrl+E) for CSV export ([191078c](https://github.com/vicpiri/user-capture-app/commit/191078c22ebda6219f8f2b13fd4d7544ee978e7d))
* add loading spinner for user list operations ([7a043fa](https://github.com/vicpiri/user-capture-app/commit/7a043fae585bfb0f492aba3be778dea70240e84f))
* add multi-user selection with context menu and export integration ([1053346](https://github.com/vicpiri/user-capture-app/commit/1053346060811b3405145a5caa370727ecbd5698))
* add repository photo indicators menu option ([9000d27](https://github.com/vicpiri/user-capture-app/commit/9000d271938ede888f5b31dd8703673b80148c13))
* add toggle for Additional Actions section visibility ([2980429](https://github.com/vicpiri/user-capture-app/commit/298042919123ddc1bdef2cedd3d7a0e158f82415))
* implement lazy loading for image optimization ([a3935fb](https://github.com/vicpiri/user-capture-app/commit/a3935fbca80b5841de7ceb44b094fd37f592d542))
* implement repository file cache and automatic change detection ([3dfc697](https://github.com/vicpiri/user-capture-app/commit/3dfc69742a7ef81e17c413820e47b37356d73378))
* persist display preferences across application restarts ([67976c3](https://github.com/vicpiri/user-capture-app/commit/67976c32d06dafd88686ad10926f8b5a1b983a5e))


### Bug Fixes

* correct CSV export format to match specification ([df44d6f](https://github.com/vicpiri/user-capture-app/commit/df44d6f6cccd6d5b0a057758f755d2ff5bec5967))
* preserve spacers when clearing user table ([e3b014d](https://github.com/vicpiri/user-capture-app/commit/e3b014d05a17ef310f25888425144225d2fa55b2))
* resolve repository-changed event listener filter bug ([3f0cdd3](https://github.com/vicpiri/user-capture-app/commit/3f0cdd36f8353cbd88351caefbcae211f76d9c1a))
* resolve virtual scrolling not rendering after group filter change ([ea2ce61](https://github.com/vicpiri/user-capture-app/commit/ea2ce61292f9335a7ee8a59b787d36057fdb214f))

### [1.0.2](https://github.com/vicpiri/user-capture-app/compare/v1.0.1...v1.0.2) (2025-10-20)

### 1.0.1 (2025-10-20)
