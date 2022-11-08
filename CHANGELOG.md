achievibit changelog

# [2.10.0](https://github.com/Kibibit/configit/compare/v2.9.0...v2.10.0) (2022-09-23)


### Bug Fixes

* **security:** :ambulance: fix security vulnerabilities ([483fe6c](https://github.com/Kibibit/configit/commit/483fe6c54d000162b5dc6c22558314ca2003e698))


### Features

* **validation:** :sparkles: add validation flag ([95d18e6](https://github.com/Kibibit/configit/commit/95d18e61aaa8274e5bd938081bf2557e41531507))

# [2.9.0](https://github.com/Kibibit/configit/compare/v2.8.1...v2.9.0) (2022-07-19)


### Features

* adding support for any environment name ([273f312](https://github.com/Kibibit/configit/commit/273f312b23be9f2789a8b6914cd80ec2246b9889))

## [2.8.1](https://github.com/Kibibit/configit/compare/v2.8.0...v2.8.1) (2022-07-19)


### Reverts

* Revert "Release/2022 06 19 (#31)" (#32) ([fd89cd2](https://github.com/Kibibit/configit/commit/fd89cd219d1a1eee357724b5968dbf3ad1cd11c1)), closes [#31](https://github.com/Kibibit/configit/issues/31) [#32](https://github.com/Kibibit/configit/issues/32)

# [2.8.0](https://github.com/Kibibit/configit/compare/v2.7.0...v2.8.0) (2022-04-04)


### Bug Fixes

* **schema:** make sure schema is created before validation ([2751cf1](https://github.com/Kibibit/configit/commit/2751cf1b42b068053a32a3b3cc677b4b2a43687c))
* **security:** run security audit and fix problems ([ec13209](https://github.com/Kibibit/configit/commit/ec13209f9f2658069c4b3f1a466ffedf71498e2f))


### Features

* **env:** Support e2e as NODE_ENV value ([1e9b975](https://github.com/Kibibit/configit/commit/1e9b975375e897c095635d382a8f6bab9970c9fc))

# [2.7.0](https://github.com/Kibibit/configit/compare/v2.6.0...v2.7.0) (2022-03-31)


### Features

* **force:** force release ([de3fef0](https://github.com/Kibibit/configit/commit/de3fef0a742d012bca8a44c1fc1338e3d25a9473))

# [2.6.0](https://github.com/Kibibit/configit/compare/v2.5.1...v2.6.0) (2022-02-01)


### Features

* **formats:** add support for hjson ([3f7968a](https://github.com/Kibibit/configit/commit/3f7968a8701b6cfa5bb11b64e7754386d17a2a3f))
* **schema:** allow skipping schema writing ([ee040ab](https://github.com/Kibibit/configit/commit/ee040ab4e5a5279a85057bda282d1e6eb3649f35))

## [2.5.1](https://github.com/Kibibit/configit/compare/v2.5.0...v2.5.1) (2021-12-22)


### Bug Fixes

* **jsonc:** fix jsonc file saving ([6c4d669](https://github.com/Kibibit/configit/commit/6c4d669159c33dea0c8b8b8056fc9feeb20b1017))

# [2.5.0](https://github.com/Kibibit/configit/compare/v2.4.0...v2.5.0) (2021-12-22)


### Features

* **formats:** add support for jsonc format ([d1483bd](https://github.com/Kibibit/configit/commit/d1483bd2c452d0d6e6c1d32e07d3007b9228bfb5))

# [2.4.0](https://github.com/Kibibit/configit/compare/v2.3.0...v2.4.0) (2021-10-29)


### Features

* **release:** force a release ([456b2a8](https://github.com/Kibibit/configit/commit/456b2a83444b897f1b310a9e40de925902c619cb))
* **readme:** force another release? ([b3ba1fc](https://github.com/Kibibit/configit/commit/b3ba1fc8401177045d23d15eeaa643c46e1b8388))
* **tests:** improve coverage ([329f9cc](https://github.com/Kibibit/configit/commit/329f9cc09f34532954f7ccb6c4b6ba5146ebe6c2))
* **release:** try and force release ([4599bc7](https://github.com/Kibibit/configit/commit/4599bc7c67126a45c38405d5312ae1f824997342)), closes [/github.com/semantic-release/semantic-release/discussions/2213#discussioncomment-1555536](https://github.com//github.com/semantic-release/semantic-release/discussions/2213/issues/discussioncomment-1555536)

# [2.3.0](https://github.com/Kibibit/configit/compare/v2.2.1...v2.3.0) (2021-10-28)


### Bug Fixes

* **build:** fix build to not include configuration ([812386c](https://github.com/Kibibit/configit/commit/812386c32f2e81b3b2df1d761d615f39c1fdfc1f))


### Features

* **service:** allow overriding config folder when exporting ([62f9edc](https://github.com/Kibibit/configit/commit/62f9edc01ac77b062097456b99bc9e3a106827c1))
* **release:** force a release ([456b2a8](https://github.com/Kibibit/configit/commit/456b2a83444b897f1b310a9e40de925902c619cb))
* **readme:** force another release? ([b3ba1fc](https://github.com/Kibibit/configit/commit/b3ba1fc8401177045d23d15eeaa643c46e1b8388))
* **tests:** improve coverage ([329f9cc](https://github.com/Kibibit/configit/commit/329f9cc09f34532954f7ccb6c4b6ba5146ebe6c2))

## [2.2.1](https://github.com/Kibibit/configit/compare/v2.2.0...v2.2.1) (2021-10-28)


### Bug Fixes

* **build:** fix build to not include configuration ([#15](https://github.com/Kibibit/configit/issues/15)) ([0b5ff04](https://github.com/Kibibit/configit/commit/0b5ff04d2cf57148c6fb74f6216316b7f04e3080))

# [2.2.0](https://github.com/Kibibit/configit/compare/v2.1.0...v2.2.0) (2021-10-28)


### Features

* **yaml:** support convertion of config file on save ([4b8000c](https://github.com/Kibibit/configit/commit/4b8000c79520f936308febdc20117d3ab97aac54))

# [2.1.0](https://github.com/Kibibit/configit/compare/v2.0.0...v2.1.0) (2021-10-19)


### Bug Fixes

* **service:** small fixes to names and schemas ([b0a836c](https://github.com/Kibibit/configit/commit/b0a836c3853014685fa75602d9e8d7da2b9a2089))


### Features

* **examples:** add example for shared config ([c47956c](https://github.com/Kibibit/configit/commit/c47956cbb1e0bc9ed9f1ac9973181556dcaee9d4))
* **service:** add options to service and support shared configs ([589cd69](https://github.com/Kibibit/configit/commit/589cd697638a23e7bc34c706b470f73725e54d04))
* **config:** support yaml config files ([4e5d507](https://github.com/Kibibit/configit/commit/4e5d507c7a214855e3ef7a545cd1a155af97bf8f))

# [2.0.0](https://github.com/Kibibit/configit/compare/v1.2.0...v2.0.0) (2021-10-12)


### Features

* **decorators:** add configuration decorator ([1bfd918](https://github.com/Kibibit/configit/commit/1bfd918c51e2d69ba68a537a4c912960cd8dd463))
* **schema:** define a decorator that combines Expose and Validate ([7f4387b](https://github.com/Kibibit/configit/commit/7f4387bed1e7ad4cd97992dc3d6ee8704cfff19d))


### BREAKING CHANGES

* **decorators:** Since names have changed, this is a breaking change

# [1.2.0](https://github.com/Kibibit/configit/compare/v1.1.1...v1.2.0) (2021-10-11)


### Features

* **config:** force new version ([d3f437b](https://github.com/Kibibit/configit/commit/d3f437bfdb2b750d0dae3dd25b1bddd8059fbe49))

## [1.1.1](https://github.com/Kibibit/configit/compare/v1.1.0...v1.1.1) (2021-10-11)


### Bug Fixes

* **base:** fix classtoplain for base config class ([b6847ee](https://github.com/Kibibit/configit/commit/b6847eeb9ada58d32b4967a11bbc3c952517db0b))

# [1.1.0](https://github.com/Kibibit/configit/compare/v1.0.0...v1.1.0) (2021-10-11)


### Features

* **release:** force version bump ([f19ae19](https://github.com/Kibibit/configit/commit/f19ae19e28ab8fad14f7ad922f0893c4e80ebfe9))

# 1.0.0 (2021-10-11)


### Bug Fixes

* **examples:** fix port reference ([c3691b1](https://github.com/Kibibit/configit/commit/c3691b1a72ddd31d612897f1809e865cdc20ace3))


### Features

* **release:** force version major bump ([2b7dcbd](https://github.com/Kibibit/configit/commit/2b7dcbd2c73133efababd4ca3437b8d60053ce80))


### BREAKING CHANGES

* **release:** force version major bump

# [1.0.0-beta.5](https://github.com/Kibibit/configit/compare/v1.0.0-beta.4...v1.0.0-beta.5) (2021-10-11)


### Features

* **config:** force new version ([d3f437b](https://github.com/Kibibit/configit/commit/d3f437bfdb2b750d0dae3dd25b1bddd8059fbe49))

# [1.0.0-beta.4](https://github.com/Kibibit/configit/compare/v1.0.0-beta.3...v1.0.0-beta.4) (2021-10-11)


### Bug Fixes

* **base:** fix classtoplain for base config class ([b6847ee](https://github.com/Kibibit/configit/commit/b6847eeb9ada58d32b4967a11bbc3c952517db0b))

# [1.0.0-beta.3](https://github.com/Kibibit/configit/compare/v1.0.0-beta.2...v1.0.0-beta.3) (2021-10-11)


### Features

* **release:** force version bump ([f19ae19](https://github.com/Kibibit/configit/commit/f19ae19e28ab8fad14f7ad922f0893c4e80ebfe9))

# [1.0.0-beta.2](https://github.com/Kibibit/configit/compare/v1.0.0-beta.1...v1.0.0-beta.2) (2021-10-11)


### Features

* **release:** force version major bump ([2b7dcbd](https://github.com/Kibibit/configit/commit/2b7dcbd2c73133efababd4ca3437b8d60053ce80))


### BREAKING CHANGES

* **release:** force version major bump

# 1.0.0-beta.1 (2021-10-11)


### Bug Fixes

* **examples:** fix port reference ([c3691b1](https://github.com/Kibibit/configit/commit/c3691b1a72ddd31d612897f1809e865cdc20ace3))
