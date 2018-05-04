"use strict";

const ORSToken = artifacts.require("./ORSToken.sol");
const Callable = artifacts.require("./CallableMock.sol");
const ReToken = artifacts.require("./ReTokenMock.sol");

const {expect} = require("chai").use(require("chai-bignumber")(web3.BigNumber));
const {rejectTx, rejectDeploy} = require("./helpers/common");


contract("ORSToken", ([owner, holder, trustee, recipient, anyone]) => {

    const deployToken = cap => {
        return ORSToken.new(cap, {from: owner});
    };

    describe("deployment", () => {
        const name = "ORS Token";
        const symbol = "ORS";
        const decimals = 18;
        const cap = 2525;
        let token;

        describe("with invalid parameters", () => {

            it("should fail if cap is zero", async () => {
                await rejectDeploy(deployToken(0));
            });
        });

        describe("with valid parameters", () => {
            const cap = 2525;
            let token;

            it("succeeds", async () => {
                token = await ORSToken.new(cap, {from: owner});
                expect(await web3.eth.getCode(token.address)).to.be.not.oneOf(["0x", "0x0"]);
            });

            it("sets correct owner", async () => {
                expect(await token.owner()).to.be.bignumber.equal(owner);
            });

            it("sets correct cap", async () => {
                expect(await token.cap()).to.be.bignumber.equal(cap);
            });

            it("has correct name", async () => {
                expect(await token.name()).to.be.equal("ORS Token");
            });

            it("has correct symbol", async () => {
                expect(await token.symbol()).to.be.equal("ORS");
            });

            it("has correct decimals", async () => {
                expect(await token.decimals()).to.be.bignumber.equal(18);
            });

            it("is initially paused", async () => {
                expect(await token.paused()).to.be.true;
            });
        });
    });

    describe("Pausable", () => {
        let token;

        before("deploy", async () => {
            token = await deployToken(2525);
        });

        describe("unpause", () => {

            it("by anyone is forbidden", async () => {
                await rejectTx(token.unpause({from: anyone}));
            });

            it("by owner is permitted", async () => {
                await token.unpause({from: owner});
                expect(await token.paused()).to.be.false;
            });
        });

        describe("pause", () => {

            it("by anyone is forbidden", async () => {
                await rejectTx(token.pause({from: anyone}));
            });

            it("by owner is permitted", async () => {
                await token.pause({from: owner});
                expect(await token.paused()).to.be.true;
            });
        });
    });

    describe("Mintable", () => {
        let token;

        before("deploy", async () => {
            token = await deployToken(2525);
        });

        describe("minting", () => {

            it("by anyone is forbidden", async () => {
                await rejectTx(token.mint(recipient, 100, {from: anyone}));
            });

            it("by owner is permitted", async () => {
                let totalSupply = await token.totalSupply();
                let balance = await token.balanceOf(recipient);
                await token.mint(recipient, 100, {from: owner});
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(100));
                expect(await token.balanceOf(recipient)).to.be.bignumber.equal(balance.plus(100));
            });

            it("beyond cap is forbidden", async () => {
                let cap = await token.cap();
                let totalSupply = await token.totalSupply();
                await rejectTx(token.mint(recipient, cap.minus(totalSupply).plus(1), {from: owner}));
            });
        });

        describe("finish minting", () => {

            it("by anyone is forbidden", async () => {
                await rejectTx(token.finishMinting({from: anyone}));
            });

            it("by owner is permitted", async () => {
                await token.finishMinting({from: owner});
                expect(await token.mintingFinished()).to.be.true;
            });

            it("again is forbidden", async () => {
                await rejectTx(token.finishMinting({from: owner}));
            });

            it("forbids to mint", async () => {
                await rejectTx(token.mint(recipient, 100, {from: owner}));
            });
        });
    });

    describe("while unpaused", () => {
        let token;
        let callable;

        before("deploy and mint", async () => {
            token = await ORSToken.new(2525, {from: owner});
            await token.unpause({from: owner});
            await token.mint(holder, 1000, {from: owner});
            callable = await Callable.new();
        });

        describe("approve/transfer", () => {
            let totalSupply;

            before("read token supply", async () => {
                totalSupply = await token.totalSupply();
            });

            afterEach("total supply didn't change", async () => {
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });

            it("permits to approve", async () => {
                await token.approve(trustee, 800, {from: holder});
                expect(await token.allowance(holder, trustee)).to.be.bignumber.equal(800);
            });

            it("permits to increase approval", async () => {
                let allowance = await token.allowance(holder, trustee);
                await token.increaseApproval(trustee, 100, {from: holder});
                expect(await token.allowance(holder, trustee)).to.be.bignumber.equal(allowance.plus(100));
            });

            it("permits to decrease approval", async () => {
                let allowance = await token.allowance(holder, trustee);
                await token.decreaseApproval(trustee, 100, {from: holder});
                expect(await token.allowance(holder, trustee)).to.be.bignumber.equal(allowance.minus(100));
            });

            it("permits to transfer", async () => {
                let holdersBalance = await token.balanceOf(holder);
                let recipientsBalance = await token.balanceOf(recipient);
                await token.transfer(recipient, 10, {from: holder});
                expect(await token.balanceOf(holder)).to.be.bignumber.equal(holdersBalance.minus(10));
                expect(await token.balanceOf(recipient)).to.be.bignumber.equal(recipientsBalance.plus(10));
            });

            it("permits to transfer from", async () => {
                let holdersBalance = await token.balanceOf(holder);
                let recipientsBalance = await token.balanceOf(recipient);
                let allowance = await token.allowance(holder, trustee);
                await token.transferFrom(holder, recipient, 10, {from: trustee});
                expect(await token.balanceOf(holder)).to.be.bignumber.equal(holdersBalance.minus(10));
                expect(await token.balanceOf(recipient)).to.be.bignumber.equal(recipientsBalance.plus(10));
                expect(await token.allowance(holder, trustee)).to.be.bignumber.equal(allowance.minus(10));
            });

            it("permits to approve and call", async () => {
                let data = callable.contract.callback.getData(1111);
                await token.approveAndCall(callable.address, 500, data, {from: holder, value: 11});
                expect(await token.allowance(holder, callable.address)).to.be.bignumber.equal(500);
                expect(await callable.lastMsgSender()).to.be.bignumber.equal(token.address);
                expect(await callable.lastMsgValue()).to.be.bignumber.equal(11);
                expect(await callable.lastArgument()).to.be.bignumber.equal(1111);
            });

            it("permits to increase approval and call", async () => {
                let allowance = await token.allowance(holder, callable.address);
                let data = callable.contract.callback.getData(2222);
                await token.increaseApprovalAndCall(callable.address, 100, data, {from: holder, value: 22});
                expect(await token.allowance(holder, callable.address)).to.be.bignumber.equal(allowance.plus(100));
                expect(await callable.lastMsgSender()).to.be.bignumber.equal(token.address);
                expect(await callable.lastMsgValue()).to.be.bignumber.equal(22);
                expect(await callable.lastArgument()).to.be.bignumber.equal(2222);
            });

            it("permits to decrease approval and call", async () => {
                let allowance = await token.allowance(holder, callable.address);
                let data = callable.contract.callback.getData(3333);
                await token.decreaseApprovalAndCall(callable.address, 100, data, {from: holder, value: 33});
                expect(await token.allowance(holder, callable.address)).to.be.bignumber.equal(allowance.minus(100));
                expect(await callable.lastMsgSender()).to.be.bignumber.equal(token.address);
                expect(await callable.lastMsgValue()).to.be.bignumber.equal(33);
                expect(await callable.lastArgument()).to.be.bignumber.equal(3333);
            });

            it("permits to transfer and call", async () => {
                let holdersBalance = await token.balanceOf(holder);
                let callablesBalance = await token.balanceOf(callable.address);
                let data = callable.contract.callback.getData(4444);
                await token.transferAndCall(callable.address, 10, data, {from: holder, value: 44});
                expect(await token.balanceOf(holder)).to.be.bignumber.equal(holdersBalance.minus(10));
                expect(await token.balanceOf(callable.address)).to.be.bignumber.equal(callablesBalance.plus(10));
                expect(await callable.lastMsgSender()).to.be.bignumber.equal(token.address);
                expect(await callable.lastMsgValue()).to.be.bignumber.equal(44);
                expect(await callable.lastArgument()).to.be.bignumber.equal(4444);
            });

            it("permits to transfer from and call", async () => {
                let holdersBalance = await token.balanceOf(holder);
                let callablesBalance = await token.balanceOf(callable.address);
                let allowance = await token.allowance(holder, trustee);
                let data = callable.contract.callback.getData(5555);
                await token.transferFromAndCall(holder, callable.address, 10, data, {from: trustee, value: 55});
                expect(await token.balanceOf(holder)).to.be.bignumber.equal(holdersBalance.minus(10));
                expect(await token.balanceOf(callable.address)).to.be.bignumber.equal(callablesBalance.plus(10));
                expect(await token.allowance(holder, trustee)).to.be.bignumber.equal(allowance.minus(10));
                expect(await callable.lastMsgSender()).to.be.bignumber.equal(token.address);
                expect(await callable.lastMsgValue()).to.be.bignumber.equal(55);
                expect(await callable.lastArgument()).to.be.bignumber.equal(5555);
            });
        });

        describe("burning", () => {

            it("permits to burn", async () => {
                let totalSupply = await token.totalSupply();
                let balance = await token.balanceOf(holder);
                await token.burn(10, {from: holder});
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.minus(10));
                expect(await token.balanceOf(holder)).to.be.bignumber.equal(balance.minus(10));
            });

            it("permits to burn from", async () => {
                let totalSupply = await token.totalSupply();
                let balance = await token.balanceOf(holder);
                let allowance = await token.allowance(holder, trustee);
                await token.burnFrom(holder, 10, {from: trustee});
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.minus(10));
                expect(await token.balanceOf(holder)).to.be.bignumber.equal(balance.minus(10));
                expect(await token.allowance(holder, trustee)).to.be.bignumber.equal(allowance.minus(10));
            });
        });
    });

    describe("while paused", () => {
        let token;
        let callable;

        before("deploy and mint and approve", async () => {
            const cap = 2525;
            token = await ORSToken.new(cap, {from: owner});
            await token.unpause({from: owner});
            await token.mint(holder, 1000, {from: owner});
            await token.approve(trustee, 400, {from: holder});
            await token.pause({from: owner});
            callable = await Callable.new();
        });

        describe("approve/transfer", () => {

            it("forbids to approve", async () => {
                await rejectTx(token.approve(trustee, 800, {from: holder}));
            });

            it("forbids to increase approval", async () => {
                await rejectTx(token.increaseApproval(trustee, 100, {from: holder}));
            });

            it("forbids to decrease approval", async () => {
                await rejectTx(token.decreaseApproval(trustee, 100, {from: holder}));
            });

            it("forbids to transfer", async () => {
                await rejectTx(token.transfer(recipient, 10, {from: holder}));
            });

            it("forbids to transfer from", async () => {
                await rejectTx(token.transferFrom(holder, recipient, 10, {from: trustee}));
            });

            it("forbids to approve and call", async () => {
                let data = callable.contract.callback.getData(1111);
                await rejectTx(token.approveAndCall(callable.address, 500, data, {from: holder, value: 11}));
            });

            it("forbids to increase approval and call", async () => {
                let data = callable.contract.callback.getData(2222);
                await rejectTx(token.increaseApprovalAndCall(callable.address, 100, data, {from: holder, value: 22}));
            });

            it("forbids to decrease approval and call", async () => {
                let data = callable.contract.callback.getData(3333);
                await rejectTx(token.decreaseApprovalAndCall(callable.address, 100, data, {from: holder, value: 33}));
            });

            it("forbids to transfer and call", async () => {
                let data = callable.contract.callback.getData(4444);
                await rejectTx(token.transferAndCall(callable.address, 10, data, {from: holder, value: 44}));
            });

            it("forbids to transfer from and call", async () => {
                let data = callable.contract.callback.getData(5555);
                await rejectTx(token.transferFromAndCall(holder, callable.address, 10, data, {from: trustee, value: 55}));
            });
        });

        describe("burning", () => {

            it("forbids to burn", async () => {
                await rejectTx(token.burn(10, {from: holder}));
            });

            it("forbids to burn from", async () => {
                await rejectTx(token.burnFrom(holder, 10, {from: trustee}));
            });
        });
    });

    describe("calling another contract", () => {
        let token;
        let reToken;

        before("deploy and mint", async () => {
            const cap = 2525;
            token = await ORSToken.new(cap, {from: owner});
            await token.unpause({from: owner});
            await token.mint(holder, 1000, {from: owner});
            reToken = await ReToken.new();
        });

        it("may transfer tokens back", async () => {
            let data = reToken.contract.transferBack.getData(token.address);
            await token.transferAndCall(reToken.address, 500, data, {from: holder});
            expect(await token.balanceOf(token.address)).to.be.bignumber.equal(500);
        });

        it("may not transfer tokens recursive", async () => {
            let data = reToken.contract.transferRecursive.getData(token.address);
            await reToken.setData(data);
            await rejectTx(token.transferAndCall(reToken.address, 1, data, {from: holder}));
        });
    });

});

