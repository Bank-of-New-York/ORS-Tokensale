pragma solidity 0.4.23;

import "./ORSToken.sol";
import "./KYCBase.sol";
import "../eidoo-icoengine/contracts/ICOEngineInterface.sol";
import "../zeppelin-solidity/contracts/math/SafeMath.sol";
import "../zeppelin-solidity/contracts/ownership/Ownable.sol";


/// @title ORSTokenSale
/// @author Autogenerated from a Dia UML diagram
contract ORSTokenSale is KYCBase, ICOEngineInterface, Ownable {

    using SafeMath for uint;

    // Maximum token amounts of each pool
    uint constant public PRESALE_CAP = 250000000e18;                 // 250,000,000 e18
    uint constant public MAINSALE_CAP = 500000000e18 - PRESALE_CAP;  // 250,000,000 e18
    uint constant public BONUS_CAP = 64460000e18;                    //  64,460,000 e18

    // Granted token shares that will be minted upon finalization
    uint constant public TEAM_SHARE = 83333333e18;                   //  83,333,333 e18
    uint constant public ADVISORS_SHARE = 58333333e18;               //  58,333,333 e18
    uint constant public COMPANY_SHARE = 127206667e18;               // 127,206,667 e18

    // Remaining token amounts of each pool
    uint public presaleRemaining = PRESALE_CAP;
    uint public mainsaleRemaining = MAINSALE_CAP;
    uint public bonusRemaining = BONUS_CAP;

    // Beneficiaries of granted token shares
    address public teamWallet;
    address public advisorsWallet;
    address public companyWallet;

    ORSToken public token;

    // Integral token units (10^-18 tokens) per wei
    uint public rate;

    // Mainsale period
    uint public openingTime;
    uint public closingTime;

    // Ethereum address where invested funds will be transferred to
    address public wallet;

    // Purchases signed via Eidoo's platform will receive bonus tokens
    address public eidooSigner;

    bool public isFinalized = false;

    /// @dev Log entry on rate changed
    /// @param newRate A positive number
    event RateChanged(uint newRate);

    /// @dev Log entry on token purchased
    /// @param buyer An Ethereum address
    /// @param value A positive number
    /// @param tokens A positive number
    event TokenPurchased(address indexed buyer, uint value, uint tokens);

    /// @dev Log entry on buyer refunded
    /// @param buyer An Ethereum address
    /// @param value A positive number
    event BuyerRefunded(address indexed buyer, uint value);

    /// @dev Log entry on finalized
    event Finalized();

    /// @dev Constructor
    /// @param _token An ORSToken
    /// @param _rate A positive number
    /// @param _openingTime A positive number
    /// @param _closingTime A positive number
    /// @param _wallet An Ethereum address
    /// @param _teamWallet An Ethereum address
    /// @param _companyWallet An Ethereum address
    /// @param _advisorsWallet An Ethereum address
    /// @param _kycSigners A list where each entry is an Ethereum address
    constructor(
        ORSToken _token,
        uint _rate,
        uint _openingTime,
        uint _closingTime,
        address _wallet,
        address _teamWallet,
        address _advisorsWallet,
        address _companyWallet,
        address[] _kycSigners
    )
        public
        KYCBase(_kycSigners)
    {
        require(_token != address(0x0));
        require(_token.cap() == PRESALE_CAP + MAINSALE_CAP + BONUS_CAP + TEAM_SHARE + ADVISORS_SHARE + COMPANY_SHARE);
        require(_rate > 0);
        require(_openingTime > now && _closingTime > _openingTime);
        require(_wallet != address(0x0));
        require(_teamWallet != address(0x0) && _companyWallet != address(0x0) && _advisorsWallet != address(0x0));
        require(_kycSigners.length >= 2);

        token = _token;
        rate = _rate;
        openingTime = _openingTime;
        closingTime = _closingTime;
        wallet = _wallet;
        teamWallet = _teamWallet;
        advisorsWallet = _advisorsWallet;
        companyWallet = _companyWallet;

        eidooSigner = _kycSigners[0];
    }

    /// @dev Set rate
    /// @param newRate A positive number
    function setRate(uint newRate) public onlyOwner {
        require(newRate > 0);

        if (newRate != rate) {
            rate = newRate;

            emit RateChanged(newRate);
        }
    }

    /// @dev Distribute presale
    /// @param investors A list where each entry is an Ethereum address
    /// @param tokens A list where each entry is a positive number
    /// @param bonuses A list where each entry is a positive number
    function distributePresale(address[] investors, uint[] tokens, uint[] bonuses) public onlyOwner {
        require(ended() && !isFinalized);
        require(tokens.length == investors.length && bonuses.length == investors.length);

        for (uint i = 0; i < investors.length; ++i) {
            presaleRemaining = presaleRemaining.sub(tokens[i]);
            bonusRemaining = bonusRemaining.sub(bonuses[i]);

            token.mint(investors[i], tokens[i].add(bonuses[i]));
        }
    }

    /// @dev Finalize
    function finalize() public onlyOwner {
        require(ended() && !isFinalized);
        require(presaleRemaining == 0);

        // Distribute granted token shares
        token.mint(teamWallet, TEAM_SHARE);
        token.mint(advisorsWallet, ADVISORS_SHARE);
        token.mint(companyWallet, COMPANY_SHARE);

        // There shouldn't be any remaining presale tokens
        // Remaining mainsale tokens will be lost (i.e. not minted)
        // Remaining bonus tokens will be minted for the benefit of company
        if (bonusRemaining > 0) {
            token.mint(companyWallet, bonusRemaining);
            bonusRemaining = 0;
        }

        // Enable token trade
        token.finishMinting();
        token.unpause();

        isFinalized = true;

        emit Finalized();
    }

    // false if the ico is not started, true if the ico is started and running, true if the ico is completed
    /// @dev Started
    /// @return True or false
    function started() public view returns (bool) {
        return now > openingTime;
    }

    // false if the ico is not started, false if the ico is started and running, true if the ico is completed
    /// @dev Ended
    /// @return True or false
    function ended() public view returns (bool) {
        return now > closingTime || mainsaleRemaining < rate;
    }

    // time stamp of the starting time of the ico, must return 0 if it depends on the block number
    /// @dev Start time
    /// @return A positive number
    function startTime() public view returns (uint) {
        return openingTime;
    }

    // time stamp of the ending time of the ico, must retrun 0 if it depends on the block number
    /// @dev End time
    /// @return A positive number
    function endTime() public view returns (uint) {
        return closingTime;
    }

    // returns the total number of the tokens available for the sale, must not change when the ico is started
    /// @dev Total tokens
    /// @return A positive number
    function totalTokens() public view returns (uint) {
        return MAINSALE_CAP;
    }

    // returns the number of the tokens available for the ico. At the moment that the ico starts it must be
    // equal to totalTokens(), then it will decrease. It is used to calculate the percentage of sold tokens as
    // remainingTokens() / totalTokens()
    /// @dev Remaining tokens
    /// @return A positive number
    function remainingTokens() public view returns (uint) {
        return mainsaleRemaining;
    }

    // return the price as number of tokens released for each ether
    /// @dev Price
    /// @return A positive number
    function price() public view returns (uint) {
        return rate;
    }

    /// @dev Release tokens to
    /// @param buyer An Ethereum address
    /// @param signer An Ethereum address
    /// @return True or false
    function releaseTokensTo(address buyer, address signer) internal returns (bool) {
        require(started() && !ended());

        uint value = msg.value;
        uint refund = 0;

        uint tokens = value.mul(rate);
        uint bonus = 0;

        // (Last) buyer whose purchase would exceed available mainsale tokens will be partially refunded
        if (tokens > mainsaleRemaining) {
            uint valueOfRemaining = mainsaleRemaining.div(rate);

            refund = value.sub(valueOfRemaining);
            value = valueOfRemaining;
            tokens = mainsaleRemaining;
            // Note:
            // To be 100% accurate the buyer should receive only a token amount that corresponds to valueOfRemaining,
            // i.e. tokens = valueOfRemaining.mul(rate), because of mainsaleRemaining may not be a multiple of rate
            // (due to regular adaption to the ether/fiat exchange rate).
            // Nevertheless, we deliver all mainsaleRemaining tokens as the worth of these additional n tokens at time
            // of purchase is less than a wei and the gas costs of a correct solution, i.e. calculate value * rate
            // again, would exceed this by several orders of magnitude.
        }

        // Purchases via Eidoo's platform will receive additional 20% bonus tokens
        if (signer == eidooSigner) {
            bonus = tokens.div(20);
        }

        mainsaleRemaining = mainsaleRemaining.sub(tokens);
        bonusRemaining = bonusRemaining.sub(bonus);

        token.mint(buyer, tokens.add(bonus));
        wallet.transfer(value);
        if (refund > 0) {
            buyer.transfer(refund);

            emit BuyerRefunded(buyer, refund);
        }

        emit TokenPurchased(buyer, value, tokens.add(bonus));

        return true;
    }

}
