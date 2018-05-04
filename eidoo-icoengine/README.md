# Eidoo ICO Engine

Base smart contracts for ICOs that use [ICO Engine](https://icoengine.net/) througt the [Eidoo app](https://eidoo.io/).

## Smart contracts

See _SampleTokenSale_ contract for an example of how to use the ICO Engine smart contracts.

### ICOEngineInterface

This is an abstract contract that defines the functions that must be implemented to provide required informations to the Eidoo wallets.

### KYCBase

This is the base contract for all smart contracts that use the ICO Engine KYC.

The KYCBase constructor requires an array of the signers addresses, these addresses are provided by Eidoo Sagl and for the Ethereum production network must be:

    [0xdd5ecefcaa0cb5d75f7b72dc9d2ce446d6d00520, 0x4e315e5de2abbf7b745d9628ee60e4355c0fab86] 

The descending contracts must implement the function _releaseTokensTo()_ to assign the tokens to a buyer, it is called when the kyc verification is passed:

    function releaseTokensTo(address buyer) internal returns(bool);

The KYC enabled contracts does not have the fallback payable function, users must buy tokens calling the _buyTokens()_ function implemented in the _KYCBase_ contract. The Eidoo wallet takes care of calling the _buyTokens()_ function with the appropriate parameters obtained from the ICO Engine KYC servers.

If you want to use a different wallet software you can use the following REST API call to generate a sort of "authorization token" that the user must place in the _data_ field of the transaction.

    GET https://eidoo-api-1.eidoo.io/api/ico/<ico_address>/authorization/<user_address>

It returns a json object:

    {
        "authorized": <boolean>,
        "authorizationToken": <string>
    }

The _authorizationToken_ field exists and _authorized_ is true only if the _user_address_ is registered by a user in the ICO Engine database. The authorizationToken value must be copied in the [data field of the transaction](https://github.com/ethereum/wiki/wiki/JavaScript-API#web3ethsendtransaction).

See _tests/kycbase.js_ for details about calling _buyTokens()_ function.

