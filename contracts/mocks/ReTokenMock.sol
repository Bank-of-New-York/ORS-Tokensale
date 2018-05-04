pragma solidity 0.4.23;

import "../../zeppelin-solidity/contracts/token/ERC20/BasicToken.sol";
import "../../zeppelin-solidity/contracts/token/ERC827/ERC827.sol";

contract ReTokenMock is BasicToken {

    bytes public data;

    function transferBack(ERC827 token) public payable {
        token.transfer(token, token.balanceOf(this));
    }

    function setData(bytes _data) public {
        data = _data;
    }

    function transferRecursive(ERC827 token) public payable {
        token.transfer(token, 1);
        token.transferAndCall(this, 1, data);
    }

}
