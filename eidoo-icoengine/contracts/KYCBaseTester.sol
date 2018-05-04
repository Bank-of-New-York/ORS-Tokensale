pragma solidity ^0.4.19;

import "./KYCBase.sol";

// this is for testing purpose, do not use it in production
contract KYCBaseTester is KYCBase {

    event ReleaseTokensToCalled(address buyer);
    event SenderAllowedForCalled(address buyer, bool returnValue);

    function KYCBaseTester(address [] signers) public
        KYCBase(signers)
    {}

    function releaseTokensTo(address buyer) internal returns(bool) {
        ReleaseTokensToCalled(buyer);
        return true;
    }

    function senderAllowedFor(address buyer)
        internal view returns(bool)
    {
        bool value = super.senderAllowedFor(buyer);
        SenderAllowedForCalled(buyer, value);
        return value;
    }
}