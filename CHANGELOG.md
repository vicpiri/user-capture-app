# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.6.0](https://github.com/vicpiri/user-capture-app/compare/v1.5.0...v1.6.0) (2025-11-05)


### Features

* add 'coming soon' notification for documentation menu ([0fb1040](https://github.com/vicpiri/user-capture-app/commit/0fb104079600b0ed8e3ae0c8d29781ad81b9459b))
* add backup and restore system for captured image links ([44aabd2](https://github.com/vicpiri/user-capture-app/commit/44aabd21cb5ef81dfd6d6b53c030c48a0c86a498))
* add configurable thermal receipt printing system ([2698600](https://github.com/vicpiri/user-capture-app/commit/2698600e650991cc2ca3bef7f287dbb21b21b8d8))
* add global preferences modal with institution settings ([627ac34](https://github.com/vicpiri/user-capture-app/commit/627ac34bf18a8cfc6dcfa29e2071bab4d2478a35))
* add institution logo to PDF exports ([4eb1064](https://github.com/vicpiri/user-capture-app/commit/4eb10642268032a0b05787947f7b3f62519fbb07))
* add linked photos counter to status bar ([1e7319a](https://github.com/vicpiri/user-capture-app/commit/1e7319a09c1b3275670956ccd24c2129817f97b2))
* add test receipt printing button to printer configuration ([534f25d](https://github.com/vicpiri/user-capture-app/commit/534f25d65bd6d29785678144feeb95212aebaf9d))
* add visual active state to filter badges ([cc2a972](https://github.com/vicpiri/user-capture-app/commit/cc2a972e999426b4f6c6b19737fd86d7104a9a65))
* card print and publication filters now ignore group filter ([d3d196e](https://github.com/vicpiri/user-capture-app/commit/d3d196e58316b0031c4466b67944688990fa35ab))
* improve About modal with modern design and accurate information ([6fde2f6](https://github.com/vicpiri/user-capture-app/commit/6fde2f62e5a29b40b7af5ef56275333abf97fa6b))
* improve inventory export modal UI/UX design ([4666f43](https://github.com/vicpiri/user-capture-app/commit/4666f43dd97d37d80ec3c49dda6ecafe5ff4ac09))
* improve orla export modal UI/UX design ([c93303d](https://github.com/vicpiri/user-capture-app/commit/c93303dca225124fdbd5a1a38454590df4205503))
* improve orla PDF layout with consistent 6x6 grid and group selection ([28c0a8f](https://github.com/vicpiri/user-capture-app/commit/28c0a8f6916e6c09db372b13387a96d52b847dc8))
* improve printer and receipt configuration modal UI styles ([cc08c92](https://github.com/vicpiri/user-capture-app/commit/cc08c921b2a3165614e34e64d5ee375051a6d3b6))
* link orla paid and receipt printed indicators to additional actions visibility ([6eeb84a](https://github.com/vicpiri/user-capture-app/commit/6eeb84a3329bbbca70fff56f16e99fa811928b79))
* rename NIA column to ID and show DNI for teachers/staff ([83938e3](https://github.com/vicpiri/user-capture-app/commit/83938e36d3a1a72b22246ecdf8b2d0eb410ab4cc))
* simplify and clarify export menu labels ([8c2cba3](https://github.com/vicpiri/user-capture-app/commit/8c2cba385ad49dd5a610c6eb2560579b42469c76))


### Bug Fixes

* add !important to no-project-placeholder display property ([560b667](https://github.com/vicpiri/user-capture-app/commit/560b667c324e776f25bd0e27986385e0700f77bf))
* adjust receipt layout to prevent right-side displacement ([90f5979](https://github.com/vicpiri/user-capture-app/commit/90f59798a66ee8cf6541a20e2e9a871e6fbe2e36))
* apply showAdditionalActions preference on initial load ([390bb26](https://github.com/vicpiri/user-capture-app/commit/390bb26ddf333611778e045b6981e0541fb9c389))
* correctly display group name in receipt printing ([c3503ae](https://github.com/vicpiri/user-capture-app/commit/c3503ae18f44975f518d782e1a986a300ba6ec9d))
* group filter not refreshing on first 'All groups' selection after opening project ([0121f31](https://github.com/vicpiri/user-capture-app/commit/0121f314f07b727589c3c36cc116df464435c5fb))
* normalize jpeg extension to jpg when exporting to repository ([4ce9490](https://github.com/vicpiri/user-capture-app/commit/4ce9490c09ad362d291f7e2cab8e76e20a029032))
* resolve ExportManager test timeout failures ([e193590](https://github.com/vicpiri/user-capture-app/commit/e1935900f84725f1945c0ab4f0290b3f6f71183c))
* resolve LazyImageManager and BaseModal test failures ([bf063ef](https://github.com/vicpiri/user-capture-app/commit/bf063efdc0ba7847a0dfdda6bc21b1c428263bce))
* resolve new project creation dialog issues ([3b5dc80](https://github.com/vicpiri/user-capture-app/commit/3b5dc801e7d7be896d9a3f78fd2f2a33defad5f6))
* resolve test failures after recent changes ([de268f0](https://github.com/vicpiri/user-capture-app/commit/de268f031ad8d97ffd46e1c502253856b95f0cd0))
* update printed-cards.html to use modular CSS ([da3db45](https://github.com/vicpiri/user-capture-app/commit/da3db45a2e9bfcfd35decdaef0d615f6b9a1622e))

## [1.5.0](https://github.com/vicpiri/user-capture-app/compare/v1.4.0...v1.5.0) (2025-10-30)


### Features

* add automatic printed card marking on CSV export ([9aefe86](https://github.com/vicpiri/user-capture-app/commit/9aefe860a4120f54c41445b0c218f63b7661dad8))
* add context menu options to remove orla paid and receipt printed states ([0cc02a9](https://github.com/vicpiri/user-capture-app/commit/0cc02a926c16e56cc7485cfb7d9ff71753c813c3))
* add orla payment and receipt printing tracking ([9ba9f9c](https://github.com/vicpiri/user-capture-app/commit/9ba9f9cc3dc13e711eb02e4cfa5a815fee1bfb84))
* add paid students list PDF and CSV exports ([365e856](https://github.com/vicpiri/user-capture-app/commit/365e85602c17086d9306a396e4cb82accacf4aa8))
* add paid students list PDF export ([a0e5f19](https://github.com/vicpiri/user-capture-app/commit/a0e5f1962f922f6946880df7d098af0addd89d49))
* add printed cards history window with clear functionality ([155ab99](https://github.com/vicpiri/user-capture-app/commit/155ab99e1340dea721d0c4a60e898d477f7fb0d0))
* add visual alert badges for pending card prints and publications ([7f0f25f](https://github.com/vicpiri/user-capture-app/commit/7f0f25f08f6a5ac1c02049863b79496202afaf03))
* convert duplicates filter to clickable badge with exclusive behavior ([1842699](https://github.com/vicpiri/user-capture-app/commit/184269980caf73d7798c997ca7abf6dc5903c98e))
* hide photos column when all display options are disabled ([d8d6ba3](https://github.com/vicpiri/user-capture-app/commit/d8d6ba3e8ff2df3088ee5f337afee3ca6a48597f))
* implement exclusive filter behavior for view menu options ([39cef81](https://github.com/vicpiri/user-capture-app/commit/39cef818fa65b046ec7809c81b3b56d0f4482cde))

## [1.4.0](https://github.com/vicpiri/user-capture-app/compare/v1.3.1...v1.4.0) (2025-10-29)


### Features

* add View menu filter for pending card print requests ([866945e](https://github.com/vicpiri/user-capture-app/commit/866945ecaf358d93f09302101fdc6442c5b91878))
* implement card print request system with repository validation ([5a73ddc](https://github.com/vicpiri/user-capture-app/commit/5a73ddcebc158a9cf8490d74b292065101f5a559))
* implement official publication request system ([ee47e1f](https://github.com/vicpiri/user-capture-app/commit/ee47e1f7225abcfc6745abe50fd9a0cccb67d7c1)), closes [#8b5cf6](https://github.com/vicpiri/user-capture-app/issues/8b5cf6)


### Bug Fixes

* ensure repository mirror starts after project opens ([c0bc3a9](https://github.com/vicpiri/user-capture-app/commit/c0bc3a9c6ec27c05bc4c42b311f89e964d42305a))
* resolve race condition in repository images loading on app startup ([98d65fc](https://github.com/vicpiri/user-capture-app/commit/98d65fc25845b84b98afdaacbd21474b16455b59))

### [1.3.1](https://github.com/vicpiri/user-capture-app/compare/v1.3.0...v1.3.1) (2025-10-29)

## [1.3.0](https://github.com/vicpiri/user-capture-app/compare/v1.2.1...v1.3.0) (2025-10-29)


### Features

* add close project functionality ([c1e88b9](https://github.com/vicpiri/user-capture-app/commit/c1e88b9407290fd7aac95be9616a54bac1b4c581))
* add loading spinners to lazy-loaded images with minimum visibility duration ([3119552](https://github.com/vicpiri/user-capture-app/commit/3119552661d55d493012732669f6bd95d0ece222)), closes [#4a7cc7](https://github.com/vicpiri/user-capture-app/issues/4a7cc7) [#10b981](https://github.com/vicpiri/user-capture-app/issues/10b981)
* add orla PDF export with configurable image quality ([633d424](https://github.com/vicpiri/user-capture-app/commit/633d424eac7b6fc82e4fa05d3b79373631c22995))
* add status bar with project and repository information ([b2ecb11](https://github.com/vicpiri/user-capture-app/commit/b2ecb116db93fd75da60d31faa1d2762a6ce963b))
* add user count to status bar ([2bf0ce7](https://github.com/vicpiri/user-capture-app/commit/2bf0ce7c0decd1be95b8bcd99709563af1811c72))
* improve lazy image loading with row recycling and loading spinners ([256fa33](https://github.com/vicpiri/user-capture-app/commit/256fa334a04963bd18a85263cb1e095a85c741b0))


### Bug Fixes

* center modals on screen by using CSS flex layout ([a3d2e80](https://github.com/vicpiri/user-capture-app/commit/a3d2e8003339df2674fbd9d5622f25d6b31532bd))
* enable checkboxes in selection mode for virtualized lists ([de6d977](https://github.com/vicpiri/user-capture-app/commit/de6d97790a6e3c4118ca7ec4c2fa1325715b4bab))
* hide no-project placeholder when loading users ([f374ead](https://github.com/vicpiri/user-capture-app/commit/f374ead904336d99492215e708522d2c8dfd398f))
* regenerate import report after XML update ([1f4f553](https://github.com/vicpiri/user-capture-app/commit/1f4f55375180e3c4d7de8744a4ffbd30e183e41a))
* reinitialize repository mirror when changing repository path ([f3aa405](https://github.com/vicpiri/user-capture-app/commit/f3aa405d52849756190e30d27657d60562494c9d))
* resolve empty list when returning to all groups filter ([49e7ef3](https://github.com/vicpiri/user-capture-app/commit/49e7ef392e1ef458d2edee7c563c06cf561e9d15))

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
