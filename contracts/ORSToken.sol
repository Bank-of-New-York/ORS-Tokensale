pragma solidity 0.4.23;

import "../zeppelin-solidity/contracts/token/ERC20/CappedToken.sol";
import "../zeppelin-solidity/contracts/token/ERC20/PausableToken.sol";
import "../zeppelin-solidity/contracts/token/ERC20/StandardBurnableToken.sol";


/// @title ORSToken
/// @author Sicos et al.
contract ORSToken is CappedToken, StandardBurnableToken, PausableToken {

    string public name = "ORS Token";
    string public symbol = "ORS";
    uint8 public decimals = 18;

    /// @dev Constructor
    /// @param _cap Maximum number of integral token units; total supply must never exceed this limit
    constructor(uint _cap) public CappedToken(_cap) {
        pause();  // Disable token trade
    }

}
