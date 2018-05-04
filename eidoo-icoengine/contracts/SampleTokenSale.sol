pragma solidity ^0.4.19;

import "./ICOEngineInterface.sol";
import "./KYCBase.sol";
import "./SafeMath.sol";
import "./ERC20Interface.sol";

// This is a basic ico example, do not use it in production.
contract SampleTokenSale is ICOEngineInterface, KYCBase {
    using SafeMath for uint;

    ERC20Interface public token;
    address public wallet;

    // from ICOEngineInterface
    uint public price;

    // from ICOEngineInterface
    uint public startTime;

    // from ICOEngineInterface
    uint public endTime;

    // from ICOEngineInterface
    uint public totalTokens;

    // from ICOEngineInterface
    uint public remainingTokens;


    /**
     *  After you deployed the SampleICO contract, you have to call the ERC20
     *  approve() method from the _wallet account to the deployed contract address to assign
     *  the tokens to be sold by the ICO.
     */
    function SampleTokenSale(address [] kycSigner, address _token, address _wallet, uint _startTime, uint _endTime, uint _price, uint _totalTokens)
        public KYCBase(kycSigner)
    {
        token = ERC20Interface(_token);
        wallet = _wallet;
        startTime = _startTime;
        endTime = _endTime;
        price = _price;
        totalTokens = _totalTokens;
        remainingTokens = _totalTokens;
    }

    // from KYCBase
    function releaseTokensTo(address buyer) internal returns(bool) {
        require(now >= startTime && now < endTime);
        uint amount = msg.value.mul(price);
        remainingTokens = remainingTokens.sub(amount);
        wallet.transfer(msg.value);
        require(token.transferFrom(wallet, buyer, amount));
        return true;
    }

    // from ICOEngineInterface
    function started() public view returns(bool) {
        return now >= startTime;
    }

    // from ICOEngineInterface
    function ended() public view returns(bool) {
        return now >= endTime || remainingTokens == 0;
    }
}