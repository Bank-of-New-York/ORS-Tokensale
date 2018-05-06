pragma solidity 0.4.23;

import "ICOEngineInterface.sol";
import "KYCBase.sol";
import "./ORSToken.sol";


/// @title ORSTokenSale
/// @author Autogenerated from a Dia UML diagram
contract ORSTokenSale is ICOEngineInterface, KYCBase {

    uint public PRESALE_CAP = 250000000e18;
    uint public MAILSALE_CAP = 500000000e18 - PRESALE_CAP;
    uint public BONUS_CAP = 64460000e18;
    uint public TEAM_SHARE = 83333333e18;
    uint public ADVISORS_SHARE = 58333333e18;
    uint public COMPANY_SHARE = 127206667e18;
    uint public mainsaleRemaining = MAINSALE_CAP;
    uint public presaleRemaining = PRESALE_CAP;
    uint public bonusRemaining = BONUS_CAP;
    address public teamWallet;
    address public companyWallet;
    address public advisorsWallet;
    ORSToken public token;
    uint public rate;
    uint public openingTime;
    uint public closingTime;
    address public wallet;
    address public eidooSigner;
    bool public isFinalized = false;

    /// @dev Log entry on rate changed
    /// @param newRate A positive number
    event RateChanged(uint newRate);

    /// @dev Log entry on token purchased
    /// @param buyer An Ethereum address
    /// @param value A positive number
    /// @param tokens A positive number
    event TokenPurchased(address buyer, uint value, uint tokens);

    /// @dev Log entry on buyer refunded
    /// @param buyer An Ethereum address
    /// @param value A positive number
    event BuyerRefunded(address buyer, uint value);

    /// @dev Log entry on finalized
    event Finalized();

    /// @dev Constructor
    /// @param _token An ORSToken
    /// @param _rate A positive number
    /// @param _openingTime A positive number
    /// @param _closingTime A positive number
    /// @param _wallet A positive number
    /// @param _teamWallet An Ethereum address
    /// @param _advisorsWallet An Ethereum address
    /// @param _companyWallet An Ethereum address
    /// @param _kycSigners A list where each entry is an Ethereum address
    constructor(ORSToken _token, uint _rate, uint _openingTime, uint _closingTime, uint _wallet, address _teamWallet, address _advisorsWallet, address _companyWallet, address[] _kycSigners) public KYCBase(_kycSigners) {
        require(IMPLEMENTATION);
    }

    /// @dev Set rate
    /// @param _price A positive number
    function setRate(uint _price) public onlyOwner {
        require(IMPLEMENTATION);
    }

    /// @dev Distribute presale
    /// @param _investors A list where each entry is an Ethereum address
    /// @param _tokens A list where each entry is a positive number
    function distributePresale(address[] _investors, uint[] _tokens) public onlyOwner {
        require(IMPLEMENTATION);
    }

    /// @dev Finalize
    function finalize() public onlyOwner {
        require(IMPLEMENTATION);
    }

    /// @dev Started
    /// @return True or false
    function started() public view returns (bool) {
        require(IMPLEMENTATION);
    }

    /// @dev Ended
    /// @return True or false
    function ended() public view returns (bool) {
        require(IMPLEMENTATION);
    }

    /// @dev Start time
    /// @return A positive number
    function startTime() public view returns (uint) {
        require(IMPLEMENTATION);
    }

    /// @dev End time
    /// @return A positive number
    function endTime() public view returns (uint) {
        require(IMPLEMENTATION);
    }

    /// @dev Total tokens
    /// @return A positive number
    function totalTokens() public view returns (uint) {
        require(IMPLEMENTATION);
    }

    /// @dev Remaining tokens
    /// @return A positive number
    function remainingTokens() public view returns (uint) {
        require(IMPLEMENTATION);
    }

    /// @dev Price
    /// @return A positive number
    function price() public view returns (uint) {
        require(IMPLEMENTATION);
    }

    /// @dev Release tokens to
    /// @param buyer An Ethereum address
    /// @param signer An Ethereum address
    /// @return True or false
    function releaseTokensTo(address buyer, address signer) internal returns (bool) {
        require(IMPLEMENTATION);
    }

}

