"use strict";

const ORSToken = artifacts.require("ORSToken.sol");
const ORSTokenSale = artifacts.require("ORSTokenSale.sol");
const ICOEngineInterface = artifacts.require("ICOEngineInterface.sol");

const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {rejectTx, rejectDeploy, log, logGas, currency, duration, now, sleep, increaseTime, randomAddr}
      = require("./helpers/common");

const {eidooSigner, otherSigner, buyTokens} = (() => {
        // Copied from Eidoo's "kycbase.js" test script.
        // --------------8<---------------
        const { ecsign } = require('ethereumjs-util');
        const abi = require('ethereumjs-abi');
        const BN = require('bn.js');

        const SIGNER_PK = Buffer.from('c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3', 'hex');
        const SIGNER_ADDR = '0x627306090abaB3A6e1400e9345bC60c78a8BEf57'.toLowerCase();
        const OTHER_PK = Buffer.from('0dbbe8e4ae425a6d2687f1a7e3ba17bc98c673636790f1b8ad91193c05875ef1', 'hex');
        const OTHER_ADDR = '0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef'.toLowerCase();
        const MAX_AMOUNT = '100000000000000000000';

        const getKycData = (userAddr, userid, icoAddr, pk) => {
          // sha256("Eidoo icoengine authorization", icoAddress, buyerAddress, buyerId, maxAmount);
          const hash = abi.soliditySHA256(
            [ 'string', 'address', 'address', 'uint64', 'uint' ],
            [ 'Eidoo icoengine authorization', icoAddr, userAddr, new BN(userid), new BN(MAX_AMOUNT) ]
          );
          const sig = ecsign(hash, pk);
          return {
            id: userid,
            max: MAX_AMOUNT,
            v: sig.v,
            r: '0x' + sig.r.toString('hex'),
            s: '0x' + sig.s.toString('hex')
          }
        };
        // -------------->8---------------

        const buyTokens = (sale, signer, msg) => {
            if (!("value" in msg)) {
                msg.value = 0;
            }
            let pk = signer === SIGNER_ADDR ? SIGNER_PK
                   : signer === OTHER_ADDR  ? OTHER_PK
                   : Buffer.alloc(64);
            let d = getKycData(msg.from, 1, sale.address, pk);
            return sale.buyTokens(d.id, d.max, d.v, d.r, d.s, msg);
        };

        return {eidooSigner: SIGNER_ADDR,
                otherSigner: OTHER_ADDR,
                buyTokens};
    })();


contract("ORSTokenSale", ([owner,
                           tokenOwner,
                           buyer,
                           investor1,
                           investor2,
                           wallet,
                           companyWallet,
                           advisorsWallet,
                           bountyWallet,
                           anyone]) => {
    //                               M  k  1
    const TOKEN_CAP      = new BN("833333333e18");
    const PRESALE_CAP    = new BN("222247844e18");
    const MAINSALE_CAP   = new BN("281945791e18");
    const BONUS_CAP      = new BN( "60266365e18");
    const COMPANY_SHARE  = new BN("127206667e18");
    const TEAM_SHARE     = new BN( "83333333e18");
    const ADVISORS_SHARE = new BN( "58333333e18");

    // Helper function: default deployment parameters
    const defaultParams = () => {
        let blockTime = web3.eth.getBlock("latest").timestamp;
        return {tokenCap: TOKEN_CAP,
                rate: 12000,
                openingTime: blockTime + duration.days(1),
                closingTime: blockTime + duration.days(3),
                wallet,
                companyWallet,
                advisorsWallet,
                bountyWallet,
                kycSigners: [eidooSigner, otherSigner]};
    };

    // Helper function: deploy ORSToken contract (cap will be the default value if not given)
    const deployToken = async cap => {
        if (cap === undefined) {
            cap = defaultParams().tokenCap;
        }
        return ORSToken.new(cap, {from: tokenOwner});
    };

    // Helper function: deploy ORSTokenSale contract (and an ORSToken if not given)
    // Missing parameters will be set to default values
    const deployTokenSale = async args => {
        let params = defaultParams();
        if (args === undefined) {
            params.tokenAddress = (await deployToken()).address;
        }
        else {
            for (let param in args) {
                params[param] = args[param];
            }
            if ("token" in args) {
                params.tokenAddress = args.token.address;
            }
            else if(!("tokenAddress" in args)) {
                params.tokenAddress = (await deployToken(args.tokenCap)).address;
            }
        }
        return ORSTokenSale.new(params.tokenAddress,
                                params.rate,
                                params.openingTime,
                                params.closingTime,
                                params.wallet,
                                params.companyWallet,
                                params.advisorsWallet,
                                params.bountyWallet,
                                params.kycSigners,
                                {from: owner});
    };


    it("implements ICOEngineInterface", () => {
        for (let i = 0; i < ICOEngineInterface.abi.length; ++i) {
            expect(ORSTokenSale.abi).to.deep.include(ICOEngineInterface.abi[i]);
        }
    });

    describe("deployment:", () => {

        describe("with invalid parameters", () => {

            it("fails if token address is zero", async () => {
                await rejectDeploy(deployTokenSale({tokenAddress: 0x0}));
            });

            it("fails if token cap doesn't equal sum of total pool amounts", async () => {
                const tokenCap = PRESALE_CAP.plus(MAINSALE_CAP).plus(BONUS_CAP)
                                            .plus(COMPANY_SHARE).plus(TEAM_SHARE).plus(ADVISORS_SHARE)
                                            .plus(1);
                await rejectDeploy(deployTokenSale({tokenCap}));
            });

            it("fails if rate is zero", async () => {
                await rejectDeploy(deployTokenSale({rate: 0}));
            });

            it("fails if opening time is in the past", async () => {
                await rejectDeploy(deployTokenSale({openingTime: now() - duration.secs(1)}));
            });

            it("fails if closing time is before opening time", async () => {
                await rejectDeploy(deployTokenSale({closingTime: defaultParams.openingTime - duration.secs(1)}));
            });

            it("fails if wallet address is zero", async () => {
                await rejectDeploy(deployTokenSale({wallet: 0x0}));
            });

            it("fails if company wallet address is zero", async () => {
                await rejectDeploy(deployTokenSale({companyWallet: 0x0}));
            });

            it("fails if advisors wallet address is zero", async () => {
                await rejectDeploy(deployTokenSale({advisorsWallet: 0x0}));
            });

            it("fails if bounty wallet address is zero", async () => {
                await rejectDeploy(deployTokenSale({bountyWallet: 0x0}));
            });

            it("fails if there are no KYC signers", async () => {
                await rejectDeploy(deployTokenSale({kycSigners: []}));
            });
        });

        describe("with valid parameters", () => {
            let params = defaultParams();
            let token;
            let sale;

            it("succeeds", async () => {
                token = await deployToken();
                params.token = token;
                sale = await deployTokenSale(params);
                expect(await web3.eth.getCode(sale.address)).to.be.not.oneOf(["0x", "0x0"]);
            });

            it("sets correct owner", async () => {
                expect(await sale.owner()).to.be.bignumber.equal(owner);
            });

            it("sets correct token address", async () => {
                expect(await sale.token()).to.be.bignumber.equal(token.address)
            });

            it("sets correct rate", async () => {
                expect(await sale.rate()).to.be.bignumber.equal(params.rate);
            });

            it("sets correct opening time", async () => {
                expect(await sale.openingTime()).to.be.bignumber.equal(params.openingTime);
            });

            it("sets correct closing time", async () => {
                expect(await sale.closingTime()).to.be.bignumber.equal(params.closingTime);
            });

            it("sets correct wallet address", async () => {
                expect(await sale.wallet()).to.be.bignumber.equal(params.wallet);
            });

            it("sets correct company wallet address", async () => {
                expect(await sale.companyWallet()).to.be.bignumber.equal(params.companyWallet);
            });

            it("sets correct advisors wallet address", async () => {
                expect(await sale.advisorsWallet()).to.be.bignumber.equal(params.advisorsWallet);
            });

            it("sets correct bounty wallet address", async () => {
                expect(await sale.bountyWallet()).to.be.bignumber.equal(params.bountyWallet);
            });

            it("sets correct eidoo signer address", async () => {
                expect(await sale.eidooSigner()).to.be.bignumber.equal(eidooSigner);
            });

            it("registers all signers", async () => {
                for (let i = 0; i < params.kycSigners.length; ++i) {
                    expect(await sale.isKycSigner(params.kycSigners[i])).to.be.true;
                }
            });

            it("delivers correct start time", async () => {
                expect(await sale.startTime()).to.be.bignumber.equal(await sale.openingTime());
            });

            it("delivers correct end time", async () => {
                expect(await sale.endTime()).to.be.bignumber.equal(await sale.closingTime());
            });

            it("delivers correct amount of total tokens (for mainsale)", async () => {
                expect(await sale.totalTokens()).to.be.bignumber.equal(MAINSALE_CAP);
            });

            it("delivers correct initial amount of remaining tokens (for mainsale)", async () => {
                expect(await sale.remainingTokens()).to.be.bignumber.equal(MAINSALE_CAP);
            });

            it("delivers correct rate", async () => {
                expect(await sale.rate()).to.be.bignumber.equal(await sale.rate());
            });
        });
    });

    describe("at any time:", () => {
        let sale;

        before("deploy", async () => {
            sale = await deployTokenSale();
        });

        describe("changing rate", () => {

            it("by anyone is forbidden", async () => {
                let rate = await sale.rate();
                await rejectTx(sale.setRate(rate.times(2).plus(1), {from: anyone}));
                expect(await sale.rate()).to.be.bignumber.equal(rate);
            });

            it("by owner is permitted", async () => {
                let rate = await sale.rate();
                let newRate = rate.times(2).plus(1);
                let tx = await sale.setRate(newRate, {from: owner});
                let log = tx.logs.find(log => log.event === "RateChanged");
                expect(log).to.exist;
                expect(log.args.newRate).to.be.bignumber.equal(newRate);
                expect(await sale.rate()).to.be.bignumber.equal(newRate);
            });

            it("to zero is forbidden", async () => {
                let rate = await sale.rate();
                await rejectTx(sale.setRate(0, {from: owner}));
                expect(await sale.rate()).to.be.bignumber.equal(rate);
            });
        });
    });

    describe("until opening time:", () => {
        let token;
        let sale;

        before("deploy", async () => {
            sale = await deployTokenSale();
            token = ORSToken.at(await sale.token());
        });

        describe("mainsale period", () => {

            it("has not started", async () => {
                expect(await sale.started()).to.be.false;
            });

            it("has not ended", async () => {
                expect(await sale.ended()).to.be.false;
            });
        });

        describe("finalizing", () => {

            it("is forbidden", async () => {
                await rejectTx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("distribute presold tokens", () => {

            it("is permitted", async () => {
                await sale.distributePresale([], [], {from: owner});
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await rejectTx(buyTokens(sale, eidooSigner, {from: buyer, value: 1}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });
        });
    });

    describe("from opening till closing time:", () => {
        let token;
        let sale;

        before("deploy", async () => {
            sale = await deployTokenSale();
            token = ORSToken.at(await sale.token());
            await token.transferOwnership(sale.address, {from: tokenOwner});
            await increaseTime(duration.days(2));
        });

        describe("mainsale period", () => {

            it("has started", async () => {
                expect(await sale.started()).to.be.true;
            });

            it("has not ended", async () => {
                expect(await sale.ended()).to.be.false;
            });
        });

        describe("finalizing", () => {

            it("is forbidden", async () => {
                await rejectTx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("distribute presold tokens", () => {

            it("is permitted", async () => {
                await sale.distributePresale([], [], {from: owner});
            });
        });

        describe("token purchase", () => {
            let value = currency.ether(2);
            let tokens;

            before("calculate expected amount of tokens", async () => {
                tokens = value.times(await sale.rate());
            });

            afterEach("invariant: totalTokens doesn't change", async () => {
                expect(await sale.totalTokens()).is.bignumber.equal(MAINSALE_CAP);
            });

            afterEach("invariant: remainingTokens is mainsaleRemaining", async () => {
                expect(await sale.remainingTokens()).is.bignumber.equal(await sale.mainsaleRemaining());
            });

            it("is permitted and gets logged", async () => {
                let tx = await buyTokens(sale, otherSigner, {from: buyer, value: value});
                let log = tx.logs.find(log => log.event === "TokenPurchased");
                expect(log).to.exist;
                expect(log.args.buyer).to.be.bignumber.equal(buyer);
                expect(log.args.value).to.be.bignumber.equal(value);
                expect(log.args.tokens).to.be.bignumber.equal(tokens);
            });

            it("decreases remaining mainsale tokens by correct amount", async () => {
                let remainingTokens = await sale.remainingTokens();
                await buyTokens(sale, otherSigner, {from: buyer, value});
                expect(await sale.remainingTokens()).to.be.bignumber.equal(remainingTokens.minus(tokens));
            });

            it("increases buyer's balance by correct amount", async () => {
                let balance = await token.balanceOf(buyer);
                await buyTokens(sale, otherSigner, {from: buyer, value});
                expect(await token.balanceOf(buyer)).to.be.bignumber.equal(balance.plus(tokens));
            });

            it("increases total token supply by correct amount", async () => {
                let totalSupply = await token.totalSupply();
                await buyTokens(sale, otherSigner, {from: buyer, value});
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(tokens));
            });

            it("forwards invested funds to wallet account", async () => {
                let funds = await web3.eth.getBalance(wallet);
                await buyTokens(sale, otherSigner, {from: buyer, value});
                expect(await web3.eth.getBalance(wallet)).to.be.bignumber.equal(funds.plus(value));
            });
        });

        describe("token purchase signed by eidoo", () => {
            let value = currency.ether(2);
            let tokens;
            let bonus;

            before("calculate expected amount of tokens", async () => {
                tokens = value.times(await sale.rate());
                bonus = tokens.div(20);
            });

            afterEach("invariant: totalTokens doesn't change", async () => {
                expect(await sale.totalTokens()).is.bignumber.equal(MAINSALE_CAP);
            });

            afterEach("invariant: remainingTokens is mainsaleRemaining", async () => {
                expect(await sale.remainingTokens()).is.bignumber.equal(await sale.mainsaleRemaining());
            });

            it("is permitted and gets logged", async () => {
                let tx = await buyTokens(sale, eidooSigner, {from: buyer, value: value});
                let log = tx.logs.find(log => log.event === "TokenPurchased");
                expect(log).to.exist;
                expect(log.args.buyer).to.be.bignumber.equal(buyer);
                expect(log.args.value).to.be.bignumber.equal(value);
                expect(log.args.tokens).to.be.bignumber.equal(tokens.plus(bonus));
            });

            it("decreases remaining mainsale tokens by correct amount", async () => {
                let remainingTokens = await sale.remainingTokens();
                await buyTokens(sale, eidooSigner, {from: buyer, value});
                expect(await sale.remainingTokens()).to.be.bignumber.equal(remainingTokens.minus(tokens));
            });

            it("decreases remaining bonus tokens by correct amount", async () => {
                let bonusRemaining = await sale.bonusRemaining();
                await buyTokens(sale, eidooSigner, {from: buyer, value});
                expect(await sale.bonusRemaining()).to.be.bignumber.equal(bonusRemaining.minus(bonus));
            });

            it("increases buyer's balance by correct amount", async () => {
                let balance = await token.balanceOf(buyer);
                await buyTokens(sale, eidooSigner, {from: buyer, value});
                expect(await token.balanceOf(buyer)).to.be.bignumber.equal(balance.plus(tokens).plus(bonus));
            });

            it("increases total token supply by correct amount", async () => {
                let totalSupply = await token.totalSupply();
                await buyTokens(sale, eidooSigner, {from: buyer, value});
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(tokens).plus(bonus));
            });

            it("forwards invested funds to wallet account", async () => {
                let funds = await web3.eth.getBalance(wallet);
                await buyTokens(sale, eidooSigner, {from: buyer, value});
                expect(await web3.eth.getBalance(wallet)).to.be.bignumber.equal(funds.plus(value));
            });
        });

        describe("token purchase beyond available amount", async () => {
            let sentValue;
            let value;
            let tokens;
            let balance;
            let totalSupply;
            let totalFunds;

            before("adjust rate s.t. all remaining tokens are sold for ~1 ether", async () => {
                tokens = await sale.remainingTokens();
                await sale.setRate(tokens.divToInt(currency.ether(1)));
                value = tokens.divToInt(await sale.rate());
                sentValue = value.times(3);
            });

            before("save state variables", async () => {
                balance = await token.balanceOf(buyer);
                totalSupply = await token.totalSupply();
                totalFunds = await web3.eth.getBalance(wallet);
            });

            it("is permitted and gets logged", async () => {
                let tx = await buyTokens(sale, otherSigner, {from: buyer, value: sentValue});
                let refundLog = tx.logs.find(log => log.event === "BuyerRefunded");
                expect(refundLog).to.exist;
                expect(refundLog.args.buyer).to.be.bignumber.equal(buyer);
                expect(refundLog.args.value).to.be.bignumber.equal(sentValue.minus(value));
                let purchaseLog = tx.logs.find(log => log.event === "TokenPurchased");
                expect(purchaseLog).to.exist;
                expect(purchaseLog.args.buyer).to.be.bignumber.equal(buyer);
                expect(purchaseLog.args.value).to.be.bignumber.equal(value);
                expect(purchaseLog.args.tokens).to.be.bignumber.equal(tokens);
            });

            it("decreases remaining tokens to zero", async () => {
                expect(await sale.remainingTokens()).to.be.zero;
            });

            it("increases buyer's balance by remaining tokens", async () => {
                expect(await token.balanceOf(buyer)).to.be.bignumber.equal(balance.plus(tokens));
            });

            it("increases total token supply to total tokens", async () => {
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(tokens));
            });

            it("forwards invested funds to wallet account", async () => {
                expect(await web3.eth.getBalance(wallet)).to.be.bignumber.equal(totalFunds.plus(value));
            });

            it("ends mainsale early", async () => {
                expect(await sale.ended()).to.be.true;
            });
        });
    });

    describe("past closing time:", () => {
        let token;
        let sale;

        before("deploy", async () => {
            sale = await deployTokenSale();
            token = ORSToken.at(await sale.token());
            await token.transferOwnership(sale.address, {from: tokenOwner});
            await increaseTime(duration.days(4));
        });

        describe("main sale period", () => {

            it("has started", async () => {
                expect(await sale.started()).to.be.true;
            });

            it("has ended", async () => {
                expect(await sale.ended()).to.be.true;
            });
        });

        describe("distribute presold tokens", () => {

            it("by anyone is forbidden", async () => {
                await rejectTx(sale.distributePresale([], [], {from: anyone}));
            });

            it("is forbidden if number of investors and amounts aren't equal", async () => {
                await rejectTx(sale.distributePresale([investor1], [], {from: owner}));
                await rejectTx(sale.distributePresale([], [1], {from: owner}));
            });

            it("decreases remaining presale tokens by correct amount", async () => {
                let investors = [investor1, investor2];
                let tokens = [new BN("1e18"), new BN("2e18")];
                let presaleRemaining = tokens.reduce((remaining, amount) => remaining.minus(amount),
                                                     await sale.presaleRemaining());
                await sale.distributePresale(investors, tokens, {from: owner});
                expect(await sale.presaleRemaining()).to.be.bignumber.equal(presaleRemaining);
            });

            it("increases the investors' balances", async () => {
                let investors = [investor1, investor2];
                let tokens = [new BN("1e18"), new BN("2e18")];
                let balances = [];
                for (let i = 0; i < investors.length; ++i) {
                    balances.push(await token.balanceOf(investors[i]));
                }
                await sale.distributePresale(investors, tokens, {from: owner});
                for (let i = 0; i < investors.length; ++i) {
                    expect(await token.balanceOf(investors[i])).to.be.bignumber.equal(
                        balances[i].plus(tokens[i]));
                }
            });

            it("is possible for many investors at once", async () => {
                await logGas(sale.distributePresale([], [], {from: owner}), "no investors");
                let nSucc = 0;
                let nFail = -1;
                let nTest = 1;
                while (nTest != nSucc) {
                    let investors = [];
                    let tokens = [];
                    for (let i = 0; i < nTest; ++i) {
                        investors.push(randomAddr());
                        tokens.push(i);
                    }
                    let success = true;
                    try {
                        await logGas(sale.distributePresale(investors, tokens, {from: owner}),
                                     nTest + " investors");
                    }
                    catch (error) {
                        success = false;
                    }
                    if (success) {
                        nSucc = nTest;
                        nTest = nFail < 0 ? 2 * nTest : Math.trunc((nTest + nFail) / 2);
                    }
                    else {
                        nFail = nTest;
                        nTest = Math.trunc((nSucc + nTest) / 2);
                    }
                }
                expect(nSucc).to.be.at.least(2);
            });

            it("doesn't exceed presale cap", async () => {
                let presaleRemaining = await sale.presaleRemaining();
                await rejectTx(sale.distributePresale([investor1], [presaleRemaining.plus(1)], {from: owner}));
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await rejectTx(buyTokens(sale, eidooSigner, {from: buyer, value: 1}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });
        });

        describe("finalizing", () => {
            let totalSupply;
            let companyBalance;
            let advisorsBalance;
            let bonusBalance;
            let bonusRemaining;

            before("save company, advisors, bounty wallet balances", async () => {
                companyBalance = await token.balanceOf(companyWallet);
                advisorsBalance = await token.balanceOf(advisorsWallet);
                bonusBalance = await token.balanceOf(bountyWallet);
            });

            it("is forbidden if there are remaining presale tokens", async () => {
                await rejectTx(sale.finalize({from: owner}));
                sale.distributePresale([investor1], [await sale.presaleRemaining()], {from: owner});
            });

            it("by anyone is forbidden", async () => {
                await rejectTx(sale.finalize({from: anyone}));
                expect(await sale.isFinalized()).to.be.false;
            });

            it("by owner is permitted and gets logged", async () => {
                totalSupply = await token.totalSupply();
                bonusRemaining = await sale.bonusRemaining();
                let tx = await sale.finalize({from: owner});
                let log = tx.logs.find(log => log.event === "Finalized");
                expect(log).to.exist;
                expect(await sale.isFinalized()).to.be.true;
            });

            it("increases token supply by company, team, advisors share and remaining bonus tokens", async () => {
                expect(await token.totalSupply()).to.be.bignumber.equal(
                    totalSupply.plus(COMPANY_SHARE).plus(TEAM_SHARE).plus(ADVISORS_SHARE).plus(bonusRemaining));
            });

            it("mints company and team share for the benefit of company wallet", async () => {
                expect(await token.balanceOf(companyWallet)).to.be.bignumber.equal(
                    companyBalance.plus(COMPANY_SHARE).plus(TEAM_SHARE));
            });

            it("mints advisors share for the benefit of advisors wallet", async () => {
                expect(await token.balanceOf(advisorsWallet)).to.be.bignumber.equal(
                    advisorsBalance.plus(ADVISORS_SHARE));
            });

            it("mints remaining bonus tokens for the benefit of bounty wallet", async () => {
                expect(await token.balanceOf(bountyWallet)).to.be.bignumber.equal(
                    bonusBalance.plus(bonusRemaining));
            });
            it("decreases remaining bonus tokens to zero", async () => {
                expect(await sale.bonusRemaining()).to.be.zero;
            });

            it("finishes minting", async () => {
                expect(await token.mintingFinished()).to.be.true;
            });

            it("unpauses the token", async () => {
                expect(await token.paused()).to.be.false;
            });

            it("again is forbidden", async () => {
                await rejectTx(sale.finalize({from: owner}));
            });
        });
    });

    describe("maximum token allocation", () => {
        let token;
        let sale;

        before("deploy and allocate and output", async () => {
            sale = await deployTokenSale();
            token = ORSToken.at(await sale.token());
            await token.transferOwnership(sale.address, {from: tokenOwner});
            await increaseTime(duration.days(2));
            await sale.setRate((await sale.mainsaleRemaining()).divToInt(currency.ether(1)), {from: owner});
            await buyTokens(sale, eidooSigner, {from: buyer, value: currency.ether(2)});
            await sale.distributePresale([investor1], [await sale.presaleRemaining()], {from: owner});
            await sale.finalize();
            const format = number => (" ".repeat(27) + number.toPrecision()).slice(-27);
            log("cap                  = " + format(await token.cap()));
            log("unminted             = " + format((await token.cap()).minus(await token.totalSupply())));
            log("total supply         = " + format(await token.totalSupply()));
            log("balance of buyers    = " + format(await token.balanceOf(buyer)));
            log("balance of investors = " + format(await token.balanceOf(investor1)));
            log("balance of company   = " + format(await token.balanceOf(companyWallet)));
            log("balance of advisors  = " + format(await token.balanceOf(advisorsWallet)));
            log("balance of bounty    = " + format(await token.balanceOf(bountyWallet)));
            log("remaining presale    = " + format(await sale.presaleRemaining()));
            log("remaining mainsale   = " + format(await sale.mainsaleRemaining()));
            log("remaining bonus      = " + format(await sale.bonusRemaining()));
        });

        it("should make total supply equal to cap", async () => {
            expect(await token.totalSupply()).to.be.bignumber.equal(await token.cap());
        });

        it("should leave no remaining presale tokens", async () => {
            expect(await sale.presaleRemaining()).to.be.bignumber.zero;
        });

        it("should leave no remaining mainsale tokens", async () => {
            expect(await sale.mainsaleRemaining()).to.be.bignumber.zero;
        });

        it("should leave no remaining bonus tokens", async () => {
            expect(await sale.bonusRemaining()).to.be.bignumber.zero;
        });
    });

});

