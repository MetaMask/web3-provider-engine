# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [16.0.0] - 2020-09-22

### Changed

- **Breaking:** Use Infura V3 API ([#352](https://github.com/MetaMask/web3-provider-engine/pull/352))
  - The previously used Infura API is deprecated and will be (or is already) removed.
  - Using the Infura Provider now requires an API key.
  See [`eth-json-rpc-infura`](https://npmjs.com/package/eth-json-rpc-infura) and [infura.io](https://infura.io) for details.
- Update various dependencies
  - eth-json-rpc-middleware@6.0.0 ([#350](https://github.com/MetaMask/web3-provider-engine/pull/350))
  - eth-json-rpc-filters@4.2.1 ([#351](https://github.com/MetaMask/web3-provider-engine/pull/351))
  - eth-json-rpc-infura@5.1.0 ([#352](https://github.com/MetaMask/web3-provider-engine/pull/352))
  - eth-rpc-errors@3.0.0 ([#353](https://github.com/MetaMask/web3-provider-engine/pull/353))
- Specify publish files

[Unreleased]:https://github.com/MetaMask/web3-provider-engine/compare/v16.0.0...HEAD
