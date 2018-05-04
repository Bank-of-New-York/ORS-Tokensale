"use strict";

const ORSToken = artifacts.require("./ORSToken.sol");
const ORSTokenSale = artifacts.require("./ORSTokenSale.sol");
const ICOEngineInterface = artifacts.require("./ICOEngineInterface.sol");

const {expect} = require("chai").use(require("chai-bignumber")(web3.BigNumber));
const {rejectTx, rejectDeploy, logGas, currency, duration, now, sleep, randomAddr} = require("./helpers/common");

const {eidooWalletSigner, otherWalletSigner, buyTokens} = (() => {
        // Copied from Eidoo's "kycbase.js" test script.
        // --------------8<---------------
        const { ecsign } = require('ethereumjs-util');
        const abi = require('ethereumjs-abi');
        const BN = require('bn.js');

        const SIGNER_PK = Buffer.from('c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3', 'hex');
        const SIGNER_ADDR = '0x627306090abaB3A6e1400e9345bC60c78a8BEf57'.toLowerCase();
        const OTHER_PK = Buffer.from('0dbbe8e4ae425a6d2687f1a7e3ba17bc98c673636790f1b8ad91193c05875ef1', 'hex');
        const OTHER_ADDR = '0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef'.toLowerCase();
        const MAX_AMOUNT = '1000000000000000000';

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

        return {eidooWalletSigner: SIGNER_ADDR,
                otherWalletSigner: OTHER_ADDR,
                buyTokens};
    })();

const BN = x => new web3.BigNumber(x);
const VERBOSE = true;


contract("ORSTokenSale", ([owner,
                           tokenOwner,
                           buyer,
                           investor,
                           wallet,
                           teamWallet,
                           companyWallet,
                           advisorsWallet,
                           anyone]) => {
    const defaults = {tokenCap    : BN("833333333e18"),
                      rate        : BN("12000"),
                      openingTime : now() + duration.days(1),
                      closingTime : now() + duration.days(2),
                      wallet,
                      teamWallet,
                      companyWallet,
                      advisorsWallet,
                      kycSigners  : [eidooWalletSigner, otherWalletSigner]};

    const deployToken = async cap => {
        if (cap === undefined) {
            cap = defaults.tokenCap;
        }
        if (VERBOSE) {
            console.log("deploy ORSToken"
                        + "\n       cap         = " + cap.toPrecision());
        }
        return ORSToken.new(cap, {from: tokenOwner});
    };

    const deployTokenSale = async args => {
        let params = {};
        if (args === undefined) {
            for (let param in defaults) {
                params[param] = defaults[param];
            }
            params.tokenAddress = (await deployToken()).address;
        }
        else {
            for (let param in defaults) {
                params[param] = param in args ? args[param] : defaults[param];
            }
            if ("token" in args) {
                params.tokenAddress = args.token.address;
            }
            else if(!("tokenAddress" in args)) {
                params.tokenAddress = (await deployToken(args.tokenCap)).address;
            }
        }
        if (VERBOSE) {
            console.log("deploy ORSTokenSale"
                        + "\n       token          = " + params.tokenAddress
                        + "\n       rate           = " + params.rate
                        + "\n       openingTime    = " + params.openingTime
                        + "\n       closingTime    = " + params.closingTime
                        + "\n       wallet         = " + params.wallet
                        + "\n       teamWallet     = " + params.teamWallet
                        + "\n       companyWallet  = " + params.companyWallet
                        + "\n       advisorsWallet = " + params.advisorsWallet
                        + "\n       kycSigners     = " + params.kycSigners);

        }

        return ORSTokenSale.new(params.tokenAddress,
                                params.rate,
                                params.openingTime,
                                params.closingTime,
                                params.wallet,
                                params.teamWallet,
                                params.companyWallet,
                                params.advisorsWallet,
                                params.kycSigners,
                                {from: owner});
    };

    it.skip("implements ICOEngineInterface", () => {
        for (let i = 0; i < ICOEngineInterface.abi.length; ++i) {
            expect(ORSTokenSale.abi).to.deep.include(ICOEngineInterface.abi[i]);
        }
    });

    describe.only("deployment", () => {

        describe.skip("with invalid parameters", () => {

            it("fails if token address is zero", async () => {
                await rejectDeploy(deployTokenSale({tokenAddress: 0x0}));
            });

            it("fails if total mainsale tokens is zero", async () => {
                await rejectDeploy(deployTokenSale({totalTokens: 0}));
            });

            it("fails if total mainsale tokens is more than cap minus team share", async () => {
                await rejectDeploy(deployTokenSale({totalTokens: defaults.tokenCap - defaults.teamShare + 1}));
            });

            it("fails if price is zero", async () => {
                await rejectDeploy(deployTokenSale({price: 0}));
            });

            it("fails if start time is in the past", async () => {
                await rejectDeploy(deployTokenSale({startTime: now() - duration.secs(1)}));
            });

            it("fails if end time is before start time", async () => {
                await rejectDeploy(deployTokenSale({endTime: defaults.startTime - duration.secs(1)}));
            });

            it("fails if wallet address is zero", async () => {
                await rejectDeploy(deployTokenSale({wallet: 0x0}));
            });

            it("fails if there are no KYC signers", async () => {
                await rejectDeploy(deployTokenSale({kycSigners: []}));
            });
        });

        describe("with valid parameters", () => {
            let sale;

            it.only("succeeds", async () => {
                sale = await deployTokenSale();
                console.log("CAP = " + (await sale.CAP()).toPrecision());
                expect(await web3.eth.getCode(sale.address)).to.be.not.oneOf(["0x", "0x0"]);
            });

            it("sets correct owner", async () => {
                expect(await sale.owner()).to.be.bignumber.equal(owner);
            });

            it("sets correct token address", async () => {
            });

            it("sets correct total tokens", async () => {
                expect(await sale.totalTokens()).to.be.bignumber.equal(defaults.totalTokens);
            });

            it("sets correct remaining tokens", async () => {
                expect(await sale.remainingTokens()).to.be.bignumber.equal(defaults.totalTokens);
            });

            it("sets correct team share", async () => {
                expect(await sale.teamShare()).to.be.bignumber.equal(defaults.teamShare);
            });

            it("sets correct price", async () => {
                expect(await sale.price()).to.be.bignumber.equal(defaults.price);
            });

            it("sets correct start time", async () => {
                expect(await sale.startTime()).to.be.bignumber.equal(defaults.startTime);
            });

            it("sets correct end time", async () => {
                expect(await sale.endTime()).to.be.bignumber.equal(defaults.endTime);
            });

            it("sets correct wallet", async () => {
                expect(await sale.wallet()).to.be.bignumber.equal(defaults.wallet);
            });

            it("sets correct eidoo wallet signer", async () => {
                expect(await sale.eidooWalletSigner()).to.be.bignumber.equal(eidooWalletSigner);
            });

            it("registers all signers", async () => {
                for (let i = 0; i < defaults.kycSigners.length; ++i) {
                    expect(await sale.isKycSigner(defaults.kycSigners[i])).to.be.true;
                }
            });
        });
    });

    describe("at any time", () => {
        let sale;

        before("deploy", async () => {
            sale = await deployTokenSale();
        });

        describe("set price", () => {

            it("by anyone is forbidden", async () => {
                let price = await sale.price();
                await rejectTx(sale.setPrice(price.times(2).plus(1), {from: anyone}));
                expect(await sale.price()).to.be.bignumber.equal(price);
            });

            it("by owner is permitted", async () => {
                let price = await sale.price();
                let newPrice = price.times(2).plus(1);
                let tx = await sale.setPrice(newPrice, {from: owner});
                let log = tx.logs.find(log => log.event === "PriceChanged");
                expect(log).to.exist;
                expect(log.args.newPrice).to.be.bignumber.equal(newPrice);
                expect(await sale.price()).to.be.bignumber.equal(newPrice);
            });

            it("to zero is forbidden", async () => {
                let price = await sale.price();
                await rejectTx(sale.setPrice(0, {from: owner}));
                expect(await sale.price()).to.be.bignumber.equal(price);
            });
        });

        describe("set team wallet", () => {

            it("by anyone is forbidden", async () => {
                let teamWallet = await sale.teamWallet();
                await rejectTx(sale.setTeamWallet(teamWallet, {from: anyone}));
                expect(await sale.teamWallet()).to.be.bignumber.equal(teamWallet);
            });

            it("by owner is permitted", async () => {
                await sale.setTeamWallet(teamWallet, {from: owner});
                expect(await sale.teamWallet()).to.be.bignumber.equal(teamWallet);
            });

            it("to zero is forbidden", async () => {
                let teamWallet = await sale.teamWallet();
                await rejectTx(sale.setTeamWallet(0x0, {from: owner}));
                expect(await sale.teamWallet()).to.be.bignumber.equal(teamWallet);
            });
        });
    });

    describe("until start time", () => {
        let sale;
        let token;

        before("deploy", async () => {
            sale = await deployTokenSale();
            token = ORSToken.at(await sale.token());
        });

        describe("main sale period", () => {

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

            it("is forbidden", async () => {
                await rejectTx(sale.distributePresale([], [], {from: owner}));
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await rejectTx(buyTokens(sale, eidooWalletSigner, {from: buyer, value: 1}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });
        });
    });

    describe("from start time till end time", () => {
        let sale;
        let token;

        before("deploy", async () => {
            sale = await deployTokenSale({startTime: now() + duration.secs(1)});
            token = ORSToken.at(await sale.token());
            await token.transferOwnership(sale.address, {from: tokenOwner});
            await sleep(2);
        });

        describe("main sale period", () => {

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

            it("is forbidden", async () => {
                await rejectTx(sale.distributePresale([], [], {from: owner}));
            });
        });

        describe("token purchase", () => {
            let value = BN(2000);
            let tokens;

            before("calculate expected amount of tokens", async () => {
                tokens = value.times(await sale.price());
            });

            it("is permitted and gets logged", async () => {
                let tx = await buyTokens(sale, otherWalletSigner, {from: buyer, value: value});
                let log = tx.logs.find(log => log.event === "TokenPurchased");
                expect(log).to.exist;
                expect(log.args.sender).to.be.bignumber.equal(buyer);
                expect(log.args.buyer).to.be.bignumber.equal(buyer);
                expect(log.args.value).to.be.bignumber.equal(value);
                expect(log.args.tokens).to.be.bignumber.equal(tokens);
            });

            it("increases raised funds by value", async () => {
                let weiRaised = await sale.weiRaised();
                await buyTokens(sale, otherWalletSigner, {from: buyer, value});
                expect(await sale.weiRaised()).to.be.bignumber.equal(weiRaised.plus(value));
            });

            it("decreases remaining tokens by correct amount", async () => {
                let remainingTokens = await sale.remainingTokens();
                await buyTokens(sale, otherWalletSigner, {from: buyer, value});
                expect(await sale.remainingTokens()).to.be.bignumber.equal(remainingTokens.minus(tokens));
            });

            it("increases buyer's balance by correct amount", async () => {
                let balance = await token.balanceOf(buyer);
                await buyTokens(sale, otherWalletSigner, {from: buyer, value});
                expect(await token.balanceOf(buyer)).to.be.bignumber.equal(balance.plus(tokens));
            });

            it("increases total token supply by correct amount", async () => {
                let totalSupply = await token.totalSupply();
                await buyTokens(sale, otherWalletSigner, {from: buyer, value});
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(tokens));
            });

            it("forwards invested funds to wallet account", async () => {
                let funds = await web3.eth.getBalance(wallet);
                await buyTokens(sale, otherWalletSigner, {from: buyer, value});
                expect(await web3.eth.getBalance(wallet)).to.be.bignumber.equal(funds.plus(value));
            });
        });

        describe.skip("token purchase signed by eidoo", () => {
            let value = BN(2000);
            let tokens;

            before("expected amount of tokens", async () => {
                tokens = value.times(await sale.price()).times(105).divToInt(100);
            });

            it("is permitted and gets logged", async () => {
                let tx = await buyTokens(sale, eidooWalletSigner, {from: buyer, value: value});
                let log = tx.logs.find(log => log.event === "TokenPurchased");
                expect(log).to.exist;
                expect(log.args.sender).to.be.bignumber.equal(buyer);
                expect(log.args.buyer).to.be.bignumber.equal(buyer);
                expect(log.args.value).to.be.bignumber.equal(value);
                expect(log.args.tokens).to.be.bignumber.equal(tokens);
            });

            it("increases raised funds by value", async () => {
                let weiRaised = await sale.weiRaised();
                await buyTokens(sale, eidooWalletSigner, {from: buyer, value: value});
                expect(await sale.weiRaised()).to.be.bignumber.equal(weiRaised.plus(value));
            });

            it("decreases remaining tokens by correct amount", async () => {
                let remainingTokens = await sale.remainingTokens();
                await buyTokens(sale, eidooWalletSigner, {from: buyer, value: value});
                expect(await sale.remainingTokens()).to.be.bignumber.equal(remainingTokens.minus(tokens));
            });

            it("increases buyer's balance by correct amount", async () => {
                let balance = await token.balanceOf(buyer);
                await buyTokens(sale, eidooWalletSigner, {from: buyer, value: value});
                expect(await token.balanceOf(buyer)).to.be.bignumber.equal(balance.plus(tokens));
            });

            it("increases total token supply by correct amount", async () => {
                let totalSupply = await token.totalSupply();
                await buyTokens(sale, eidooWalletSigner, {from: buyer, value: value});
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(tokens));
            });

            it("forwards invested funds to wallet account", async () => {
                let funds = await web3.eth.getBalance(wallet);
                await buyTokens(sale, eidooWalletSigner, {from: buyer, value: value});
                expect(await web3.eth.getBalance(wallet)).to.be.bignumber.equal(funds.plus(value));
            });
        });

        describe("token purchase beyond available amount", async () => {
            let tokens;
            let value;
            let sentValue;
            let weiRaised;
            let balance;
            let totalFunds;

            before("calculate maximum value and tokens", async () => {
                tokens = await sale.remainingTokens();
                value = tokens.divToInt(await sale.price());
                sentValue = value.plus(100);
            });

            before("save state variables", async () => {
                weiRaised = await sale.weiRaised();
                balance = await token.balanceOf(buyer);
                totalFunds = await web3.eth.getBalance(wallet);
            });

            it("is permitted and gets logged", async () => {
                let tx = await buyTokens(sale, otherWalletSigner, {from: buyer, value: sentValue});
                let refundLog = tx.logs.find(log => log.event === "BuyerRefunded");
                expect(refundLog).to.exist;
                expect(refundLog.args.sender).to.be.bignumber.equal(buyer);
                expect(refundLog.args.buyer).to.be.bignumber.equal(buyer);
                expect(refundLog.args.value).to.be.bignumber.equal(sentValue.minus(value));
                let purchaseLog = tx.logs.find(log => log.event === "TokenPurchased");
                expect(purchaseLog).to.exist;
                expect(purchaseLog.args.sender).to.be.bignumber.equal(buyer);
                expect(purchaseLog.args.buyer).to.be.bignumber.equal(buyer);
                expect(purchaseLog.args.value).to.be.bignumber.equal(value);
                expect(purchaseLog.args.tokens).to.be.bignumber.equal(tokens);
            });

            it("increases raised funds by maximum value", async () => {
                expect(await sale.weiRaised()).to.be.bignumber.equal(weiRaised.plus(value));
            });

            it("decreases remaining tokens to zero", async () => {
                expect(await sale.remainingTokens()).to.be.zero;
            });

            it("increases buyer's balance by remaining tokens", async () => {
                expect(await token.balanceOf(buyer)).to.be.bignumber.equal(balance.plus(tokens));
            });

            it("increases total token supply to total tokens", async () => {
                expect(await token.totalSupply()).to.be.bignumber.equal(await sale.totalTokens());
            });

            it("forwards invested funds to wallet account", async () => {
                expect(await web3.eth.getBalance(wallet)).to.be.bignumber.equal(totalFunds.plus(value));
            });

            it("ends main sale early", async () => {
                expect(await sale.ended()).to.be.true;
            });
        });

        describe.skip("token purchase beyond available amount signed by eidoo", async () => {
            let tokens;
            let value;
            let sentValue;
            let weiRaised;
            let balance;
            let totalFunds;

            before("redeploy", async () => {
                sale = await deployTokenSale({startTime: now() + duration.secs(1)});
                token = ORSToken.at(await sale.token());
                await token.transferOwnership(sale.address, {from: tokenOwner});
                await sleep(2);
                // calculate maximum investment at bonus price
                tokens = await sale.remainingTokens();
                value = tokens.mul(100).divToInt(105).divToInt(await sale.price());
                sentValue = value.plus(100);
                // save state variables
                weiRaised = await sale.weiRaised();
                balance = await token.balanceOf(buyer);
                totalFunds = await web3.eth.getBalance(wallet);
            });

            it("is permitted and gets logged", async () => {
                let tx = await buyTokens(sale, eidooWalletSigner, {from: buyer, value: sentValue});
                let refundLog = tx.logs.find(log => log.event === "BuyerRefunded");
                expect(refundLog).to.exist;
                expect(refundLog.args.sender).to.be.bignumber.equal(buyer);
                expect(refundLog.args.buyer).to.be.bignumber.equal(buyer);
                expect(refundLog.args.value).to.be.bignumber.equal(sentValue.minus(value));
                let purchaseLog = tx.logs.find(log => log.event === "TokenPurchased");
                expect(purchaseLog).to.exist;
                expect(purchaseLog.args.sender).to.be.bignumber.equal(buyer);
                expect(purchaseLog.args.buyer).to.be.bignumber.equal(buyer);
                expect(purchaseLog.args.value).to.be.bignumber.equal(value);
                expect(purchaseLog.args.tokens).to.be.bignumber.equal(tokens);
            });

            it("increases raised funds by maximum value", async () => {
                expect(await sale.weiRaised()).to.be.bignumber.equal(weiRaised.plus(value));
            });

            it("decreases remaining tokens to zero", async () => {
                expect(await sale.remainingTokens()).to.be.zero;
            });

            it("increases buyer's balance by remaining tokens", async () => {
                expect(await token.balanceOf(buyer)).to.be.bignumber.equal(balance.plus(tokens));
            });

            it("increases total token supply to total tokens", async () => {
                expect(await token.totalSupply()).to.be.bignumber.equal(await sale.totalTokens());
            });

            it("forwards invested funds to wallet account", async () => {
                expect(await web3.eth.getBalance(wallet)).to.be.bignumber.equal(totalFunds.plus(value));
            });

            it("ends main sale early", async () => {
                expect(await sale.ended()).to.be.true;
            });
        });
    });

    describe("after end time", () => {
        let sale;
        let token;

        before("deploy", async () => {
            sale = await deployTokenSale({startTime: now() + duration.secs(1),
                                          endTime: now() + duration.secs(2)});
            token = ORSToken.at(await sale.token());
            await token.transferOwnership(sale.address, {from: tokenOwner});
            await sleep(3);
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

            it("is forbidden if investors count doesn't amounts count", async () => {
                await rejectTx(sale.distributePresale([investor], [], {from: owner}));
                await rejectTx(sale.distributePresale([], [1], {from: owner}));
            });

            it("increases the investors' balances", async () => {
                let balance = await token.balanceOf(investor);
                await sale.distributePresale([investor, investor, investor], [10, 100, 1000], {from: owner});
                expect(await token.balanceOf(investor)).to.be.bignumber.equal(balance.plus(10 + 100 + 1000));
            });

            it("is possible for several (min 4) investors at once", async () => {
                await logGas(sale.distributePresale([], [], {from: owner}), "no investors");
                let nSucc = 0;
                let nFail = -1;
                let nTest = 1;
                while (nTest != nSucc) {
                    let investors = [];
                    let amounts = [];
                    for (let i = 0; i < nTest; ++i) {
                        investors.push(randomAddr());
                        amounts.push(i);
                    }
                    let success = true;
                    try {
                        await logGas(sale.distributePresale(investors, amounts, {from: owner}), nTest + " investors");
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
                expect(nSucc).to.be.at.least(4);
            });

            it("is impossible beyond cap minus team share", async () => {
                let cap = await token.cap();
                let supply = await token.totalSupply();
                let amount = (await token.cap())
                             .minus(await token.totalSupply())
                             .minus(await sale.teamShare())
                             .plus(1);
                await rejectTx(sale.distributePresale([investor], [amount], {from: owner}));
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await rejectTx(buyTokens(sale, eidooWalletSigner, {from: buyer, value: 1}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });
        });

        describe("finalizing", () => {
            let totalSupply;
            let teamBalance;
            let teamShare;

            before("save state variables", async () => {
                totalSupply = await token.totalSupply();
                teamBalance = await token.balanceOf(teamWallet);
                teamShare = await sale.teamShare();
            });

            it("is forbidden if no team wallet was set", async () => {
                await rejectTx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
            });

            it("by anyone is forbidden", async () => {
                await sale.setTeamWallet(teamWallet, {from: owner});
                await rejectTx(sale.finalize({from: anyone}));
                expect(await sale.isFinalized()).to.be.false;
            });

            it("by owner is permitted and gets logged", async () => {
                let tx = await sale.finalize({from: owner});
                let log = tx.logs.find(log => log.event === "Finalized");
                expect(log).to.exist;
                expect(await sale.isFinalized()).to.be.true;
            });

            it("increases token supply by team share", async () => {
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(teamShare));
            });

            it("mints team share for the benefit of team wallet", async () => {
                expect(await token.balanceOf(teamWallet)).to.be.bignumber.equal(teamBalance.plus(teamShare));
            });

            it("unpauses the token", async () => {
                expect(await token.paused()).to.be.false;
            });

            it("again is forbidden", async () => {
                await rejectTx(sale.finalize({from: owner}));
            });
        });
    });

});

