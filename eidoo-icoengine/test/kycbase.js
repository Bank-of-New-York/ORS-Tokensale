const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai
const _ = require('lodash')
const KYCBase = artifacts.require('KYCBaseTester')
const { ecsign } = require('ethereumjs-util')
const abi = require('ethereumjs-abi')
const BN = require('bn.js')

const SIGNER_PK = Buffer.from('c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3', 'hex')
const SIGNER_ADDR = '0x627306090abaB3A6e1400e9345bC60c78a8BEf57'.toLowerCase()
const OTHER_PK = Buffer.from('0dbbe8e4ae425a6d2687f1a7e3ba17bc98c673636790f1b8ad91193c05875ef1', 'hex')
const OTHER_ADDR = '0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef'.toLowerCase()
const MAX_AMOUNT = '1000000000000000000'

const getKycData = (userAddr, userid, icoAddr, pk) => {
  // sha256("Eidoo icoengine authorization", icoAddress, buyerAddress, buyerId, maxAmount);
  const hash = abi.soliditySHA256(
    [ 'string', 'address', 'address', 'uint64', 'uint' ],
    [ 'Eidoo icoengine authorization', icoAddr, userAddr, new BN(userid), new BN(MAX_AMOUNT) ]
  )
  const sig = ecsign(hash, pk)
  return {
    id: userid,
    max: MAX_AMOUNT,
    v: sig.v,
    r: '0x' + sig.r.toString('hex'),
    s: '0x' + sig.s.toString('hex')
  }
}

const expectEvent = (res, eventName) => {
  const ev = _.find(res.logs, {event: eventName})
  expect(ev).to.not.be.undefined
  return ev
}

contract('KYCBase', function (accounts) {
  describe('initialization', () => {
    it('should deploy KYCBaseTester', async () => {
      await KYCBase.new([SIGNER_ADDR])
    })
    it('should save signer', async () => {
      const kyc = await KYCBase.new([SIGNER_ADDR])
      expect(await kyc.isKycSigner(SIGNER_ADDR)).to.be.true
      expect(await kyc.isKycSigner(OTHER_ADDR)).to.be.false
    })
    it('should fail the default callback', async () => {
      const kyc = await KYCBase.new([SIGNER_ADDR])
      const payFallback = kyc.sendTransaction({from: accounts[0], to: kyc.address, value: 10000000})
      await expect(payFallback).to.be.rejected
    })
  })

  describe('buyTokens()', () => {
    const buyer = accounts[0]
    let kyc
    beforeEach(async () => {
      kyc = await KYCBase.new([SIGNER_ADDR])
    })

    it('should reject for invalid signer', async () => {
      const d = getKycData(buyer, 1, kyc.address, OTHER_PK)
      const buy = kyc.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: buyer, value: MAX_AMOUNT})
      await expect(buy).to.be.rejected
    })

    it('should fulfill', async () => {
      const d = getKycData(buyer, 1, kyc.address, SIGNER_PK)
      const buy = kyc.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: buyer, value: MAX_AMOUNT})
      await expect(buy).to.be.fulfilled
    })

    it('should call releaseTokens()', async () => {
      const d = getKycData(buyer, 1, kyc.address, SIGNER_PK)
      const res = await kyc.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: buyer, value: 100})
      const callEv = expectEvent(res, 'ReleaseTokensToCalled')
      expect(callEv.args.buyer).to.equal(accounts[0])
    })

    it('should emit KycVerified event', async () => {
      const d = getKycData(buyer, 1, kyc.address, SIGNER_PK)
      const res = await kyc.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: buyer, value: 100})
      const ev = expectEvent(res, 'KycVerified')
      expect(ev.args.signer).to.equal(SIGNER_ADDR, 'signer')
      expect(ev.args.buyerAddress).to.equal(accounts[0], 'buyerAddress')
      expect(ev.args.buyerId.toNumber()).to.equal(1, 'buyerId')
      expect(ev.args.maxAmount.toFixed()).to.equal(MAX_AMOUNT, 'maxAmount')
    })

    it('should increase alreadyPayed', async () => {
      const d = getKycData(buyer, 1, kyc.address, SIGNER_PK)
      await kyc.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: buyer, value: 100})
      await kyc.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: buyer, value: 50})
      const actual = await kyc.alreadyPayed(1)
      expect(actual.toFixed()).to.equal('150')
    })

    it('should reject for too big amount', async () => {
      const d = getKycData(buyer, 1, kyc.address, SIGNER_PK)
      const value = web3.toBigNumber(MAX_AMOUNT).add(1)
      const buy = kyc.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: buyer, value})
      await expect(buy).to.be.rejected
    })
  })

  describe('buyTokensFor', () => {
    it('should fulfill', async () => {
      const buyer = accounts[0]
      const kyc = await KYCBase.new([SIGNER_ADDR])
      const d = getKycData(buyer, 1, kyc.address, SIGNER_PK)
      const buy = kyc.buyTokensFor(buyer, d.id, d.max, d.v, d.r, d.s, {from: buyer, value: 100})
      await expect(buy).to.be.fulfilled
    })
    it('should reject', async () => {
      const buyer = accounts[0]
      const kyc = await KYCBase.new([SIGNER_ADDR])
      const d = getKycData(buyer, 1, kyc.address, SIGNER_PK)
      const buy = kyc.buyTokensFor(buyer, d.id, d.max, d.v, d.r, d.s, {from: accounts[1], value: 100})
      await expect(buy).to.be.rejected
    })
  })
})
