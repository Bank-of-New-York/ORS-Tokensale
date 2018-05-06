# ORS-TokenSale

Initial checkout:

	git clone --recursive https://github.com/ORSGroup/ORS-Tokensale.git

or as separate steps:

	git clone https://github.com/ORSGroup/ORS-Tokensale.git
	git submodule update --init --recursive

Install dependencies:

	cd ORS-Tokensale
	npm install

Add toolchain to PATH environment variable:

	source ./set_path.sh

Run linter:

	solium -d contracts

Compile contracts:

	truffle compile --all

Run unit tests:

	truffle test
