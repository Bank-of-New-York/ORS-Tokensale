pragma solidity 0.4.23;


// This is for testing purposes.
contract CallableMock {

    address public lastMsgSender;
    uint public lastMsgValue;
    uint public lastArgument;

    function callback(uint argument) public payable {
        lastMsgSender = msg.sender;
        lastMsgValue = msg.value;
        lastArgument = argument;
    }

}
