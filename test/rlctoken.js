var Crowdsale = artifacts.require("./Crowdsale.sol");
var RLC = artifacts.require("./RLC.sol");
var RLCRobust = artifacts.require("./RLCRobust.sol");

//extensions.js : credit to : https://github.com/coldice/dbh-b9lab-hackathon/blob/development/truffle/utils/extensions.js
const Extensions = require("../utils/extensions.js");

Extensions.init(web3, assert);

contract('Crowdsale', function(accounts) {

  var owner,btcproxy,backer1,backer2;

    before("should prepare accounts", function() {
      assert.isAtLeast(accounts.length, 4, "should have at least 4 accounts");
      owner = accounts[0];
      btcproxy = accounts[1];
      backer1 = accounts[2];
      backer2 = accounts[3];
      return Extensions.makeSureAreUnlocked(
              [ owner, backer1, backer2])
              .then(() => web3.eth.getBalancePromise(owner))
              //check owner has at least 2 ether
              .then(balance => assert.isTrue(
                        web3.toWei(web3.toBigNumber(30), "ether").lessThan(balance),
                        "sheriff should have at least 3 ether, not " + web3.fromWei(balance, "ether"))
              )
              .then(() => Extensions.refillAccount(owner,backer1,10))
              .then(() => Extensions.refillAccount(owner,backer2,10));
    });



    describe("Test Crowndsale with RLC.sol", function() {

      var aRLCInstance;
      var aCrowdsaleInstance;
      var ownerInitialBalance;
      var backer1InitialBalance;

      beforeEach("create a new contract instance and get inital balance", function() {
          return Promise.all([
            web3.eth.getBalancePromise(owner),
            web3.eth.getBalancePromise(backer1),
            RLC.new()
          ])
          .then(results => {
            [ownerInitialBalance,backer1InitialBalance,aRLCInstance]=results;
            return aRLCInstance.unlock({from: owner, gaz:300000})
          })
          .then( txMined => {
            assert.isBelow(txMined.receipt.gasUsed, 3000000, "should not use all gas");
            return Crowdsale.new(aRLCInstance.address,btcproxy);
          })
          .then(crowdsaleInstance => {
              aCrowdsaleInstance=crowdsaleInstance
              return aRLCInstance.transfer(aCrowdsaleInstance.address,87000000000000000,{from: owner, gaz:3000000});
            }
          )
          //transfert owner ship
          .then(() => aRLCInstance.transferOwnership(aCrowdsaleInstance.address,{from: owner, gaz:3000000}))
          .then(() => {
            return aCrowdsaleInstance.start({from: owner, gaz:300000});
          })
          .then( txMined => assert.isBelow(txMined.receipt.gasUsed, 3000000, "should not use all gas"));
      });

      it("contract should have 0 balance at start", function() {
           return web3.eth.getBalancePromise(aCrowdsaleInstance.address)
           .then( balance  => assert.strictEqual(balance.toString(10), '0', "contract should have 0 balance at start"));
      });

      it("TEST 0 : normal use case with receiveETH call ", function() {
           return aRLCInstance.balanceOf.call(backer1)
              .then( rlcbalance  => {
                assert.strictEqual(rlcbalance.toString(10), '0', "backer1 should have 0 balance at start");
                return aCrowdsaleInstance.receiveETH(backer1,{ from : backer1, value: web3.toWei(1, "ether"), gaz:4712389 });
              })
           .then( txMined => {
              assert.isBelow(txMined.receipt.gasUsed, 4712389, "should not use all gas");
              return Promise.all([
                        web3.eth.getBalancePromise(aCrowdsaleInstance.address),
                        aRLCInstance.balanceOf.call(backer1)
                      ]);
           })
           .then( balances  => {
             assert.strictEqual(balances[0].toString(10), web3.toWei(1, "ether").toString(10), "crowdsaleInstance should have 1 ether balance ");
             //RLCPerETH = 200 000 000 000;
             // 20% de 200000000000 = 40 000 000 000
             // 200 000 000 000 +40 000 000 000  = 240 000 000 000
             assert.strictEqual(balances[1].toString(10), "240000000000", "backer1 should have some RLC now")
           }
           );
      });

      it("TEST A : Is sending ether for another account a wanted feature ?. backer 1 is a nice guy ... backer 1 pay and backer 2 have RLC token", function() {
           return Promise.all([ aRLCInstance.balanceOf.call(backer1), aRLCInstance.balanceOf.call(backer2)])
              .then( rlcbalances  => {
                assert.strictEqual(rlcbalances[0].toString(10), '0', "backer1 should have 0 balance at start");
                assert.strictEqual(rlcbalances[0].toString(10), '0', "backer2 should have 0 balance at start");
               return aCrowdsaleInstance.receiveETH(backer2,{ from : backer1,value: web3.toWei(1, "ether"), gaz:4712389 });
              })
           .then( txMined => {
              assert.isBelow(txMined.receipt.gasUsed, 4712389, "should not use all gas");
              return Promise.all([
                        web3.eth.getBalancePromise(aCrowdsaleInstance.address),
                        aRLCInstance.balanceOf.call(backer1),
                        aRLCInstance.balanceOf.call(backer2)
                      ]);
           })
           .then( balances  => {
             assert.strictEqual(balances[0].toString(10), web3.toWei(1, "ether").toString(10), "contract should have 1 ether balance ");
             assert.strictEqual(balances[1].toString(10), "0" , "backer1 should have no RLC");
             assert.strictEqual(balances[2].toString(10), "240000000000" , "backer2 should have some RLC now");
            }
           );
      });

      it("TEST B : backer 1 is a idiot guy ...backer 1 pay  and sent RLC token to adresse 0", function() {
           return Promise.all([ aRLCInstance.balanceOf.call(backer1), aRLCInstance.balanceOf.call(backer2)])
              .then( rlcbalances  => {
                assert.strictEqual(rlcbalances[0].toString(10), '0', "backer1 should have 0 balance at start");
                assert.strictEqual(rlcbalances[0].toString(10), '0', "backer2 should have 0 balance at start");
               return aCrowdsaleInstance.receiveETH(0,{ from : backer1,value: web3.toWei(1, "ether"), gaz:4712389 });
              })
           .then( txMined => {
              assert.isBelow(txMined.receipt.gasUsed, 4712389, "should not use all gas");
              return Promise.all([
                        web3.eth.getBalancePromise(aCrowdsaleInstance.address),
                        aRLCInstance.balanceOf.call(backer1),
                        aRLCInstance.balanceOf.call(0)
                      ]);
           })
           .then( balances  => {
             assert.strictEqual(balances[0].toString(10), web3.toWei(1, "ether").toString(10), "contract should have 1 ether balance ");
             assert.strictEqual(balances[1].toString(10), "0" , "backer1 should have no RLC");
             assert.strictEqual(balances[2].toString(10), "240000000000" , "adresse 0  have some RLC now");
            }
           );
      });

      it("TEST C : backer 1 is a bad guy ...backer 1 try to trick the address", function() {
        var trickIt=111111111111111111111;
           return Promise.all([ aRLCInstance.balanceOf.call(backer1), aRLCInstance.balanceOf.call(backer1+trickIt)])
              .then( rlcbalances  => {
                assert.strictEqual(rlcbalances[0].toString(10), '0', "backer1 should have 0 balance at start");
                assert.strictEqual(rlcbalances[0].toString(10), '0', "backer2 should have 0 balance at start");
               return aCrowdsaleInstance.receiveETH(backer1+trickIt,{ from : backer1,value: web3.toWei(1, "ether"), gaz:4712389 });
              })
           .then( txMined => {
             //console.log(txMined);
              assert.isBelow(txMined.receipt.gasUsed, 4712389, "should not use all gas");
              return Promise.all([
                        web3.eth.getBalancePromise(aCrowdsaleInstance.address),
                        aRLCInstance.balanceOf.call(backer1),
                        aRLCInstance.balanceOf.call(backer1+trickIt)
                      ]);
           })
           .then( balances  => {
             assert.strictEqual(balances[0].toString(10), web3.toWei(1, "ether").toString(10), "contract should have 1 ether balance ");
             assert.strictEqual(balances[1].toString(10), "0" , "backer1 should have no RLC");
             assert.strictEqual(balances[2].toString(10), "240000000000" , "backer1+trickIt have some RLC now");
            }
           );
      });


            it("TEST D : whitening ether and RLC totalSupply not change by sending to beneficiary : aCrowdsaleInstance.address", function() {
                 return Promise.all([ aRLCInstance.balanceOf.call(backer1), aRLCInstance.balanceOf.call(aCrowdsaleInstance.address),aCrowdsaleInstance.rlc_team.call()])
                    .then( rlcbalances  => {
                      assert.strictEqual(rlcbalances[0].toString(10), '0', "backer1 should have 0 RLC balance at start");
                      assert.strictEqual(rlcbalances[1].toString(10), '87000000000000000', "aCrowdsaleInstance.address should have 87000000000000000 RLC balance at start");
                      assert.strictEqual(rlcbalances[2].toString(10), "12000000000000000" , "rlc_team amount");
                     return aCrowdsaleInstance.receiveETH(aCrowdsaleInstance.address,{ from : backer1,value: web3.toWei(1, "ether"), gaz:4712389 });
                    })
                 .then( txMined => {
                    assert.isBelow(txMined.receipt.gasUsed, 4712389, "should not use all gas");
                    return Promise.all([
                              web3.eth.getBalancePromise(aCrowdsaleInstance.address),
                              aRLCInstance.balanceOf.call(backer1),
                              aRLCInstance.balanceOf.call(aCrowdsaleInstance.address),
                              aCrowdsaleInstance.rlc_team.call(),
                              aCrowdsaleInstance.RLCSentToETH.call()
                            ]);
                 })
                 .then( balances  => {
                   assert.strictEqual(balances[0].toString(10), web3.toWei(1, "ether").toString(10), "contract should have 6 ether balance ");
                   assert.strictEqual(balances[1].toString(10), "0" , "backer1  RLC");
                   assert.strictEqual(balances[2].toString(10), "87000000000000000" , "aCrowdsaleInstance.address same as start");
                   assert.strictEqual(balances[4].toString(10), "240000000000" , "RLCSentToETH amount will be burn ...");
                  }
                 );
            });


          // i generate this adresse with 00 at the end with a small loop create acount script : 3b63fff0ea4e103296426d1a5c0b8111858b5100
            it("TEST E : ERC20 Short Address Attack test : web3 client is safe as said in many posts. No shift in inputs data or whatever. It sent nice tx data input of 68 bytes : 4 bytes function signature + 32 * 2. If you pass wrong content it is your responsibility, 3b63fff0ea4e103296426d1a5c0b8111858b5100 with a missing 0 is passed :3b63fff0ea4e103296426d1a5c0b8111858b510", function() {
                var previousBalance;

                 return aRLCInstance.balanceOf.call(backer1)
                    .then( rlcbalance  => {
                      assert.strictEqual(rlcbalance.toString(10), '0', "backer1 should have 0 balance at start");
                      return aCrowdsaleInstance.receiveETH(backer1,{ from : backer1, value: web3.toWei(1, "ether"), gaz:4712389 });
                    })
                 .then( txMined => {
                    assert.isBelow(txMined.receipt.gasUsed, 4712389, "should not use all gas");
                    return Promise.all([
                              web3.eth.getBalancePromise(aCrowdsaleInstance.address),
                              aRLCInstance.balanceOf.call(backer1)
                            ]);
                 })
                 .then( balances  => {
                   assert.strictEqual(balances[0].toString(10), web3.toWei(1, "ether").toString(10), "crowdsaleInstance should have 1 ether balance ");
            //        //RLCPerETH = 200 000 000 000;
                   // 20% de 200000000000 = 40 000 000 000
                   // 200 000 000 000 +40 000 000 000  = 240 000 000 000
                   assert.strictEqual(balances[1].toString(10), "240000000000", "backer1 should have some RLC now");
                  return aRLCInstance.balanceOf.call("0x3b63fff0ea4e103296426d1a5c0b8111858b510");
                }).then(balanceBackerMagic => {
                  previousBalance=balanceBackerMagic;
                  return aRLCInstance.transfer("0x3b63fff0ea4e103296426d1a5c0b8111858b510",1,{from : backer1, gaz:4712389  });
                })
                .then(txMagicMined => {
                   console.log("aRLCInstance.transfer tx through web3 looks : ");
                   console.log(txMagicMined);
                  /*
                  { tx: '0xc5658493c3a9a012e770b2ca0bfbebaf04f4cf794cd9dc66fd8508535478b3d8',
                receipt:
                 { blockHash: '0x97b1429e7a011cfc062efd47189b9e82e50821442a9ed79b824e972f70d8f4d6',
                   blockNumber: 1424,
                   contractAddress: null,
                   cumulativeGasUsed: 51289,
                   from: '0xcf3cfe42a8cd2ca52377c3e9fc9b08ce8273ab6c',
                   gasUsed: 51289,
                   logs: [ [Object] ],
                  logsBloom: '0x00000000000008000000000000000000000000000000000000000010000000200000000000000000000000000000000000000000000000000000000000000000000000010000
             000000000008000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000400000000000000000000000000000
             000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000002000000000000000010000000000000000000000000000000000000000000000000
             000000000000000000000000000010000000000000000000000000',
                  root: '0x6bfa2eded1e52c93ffd5a4bbd83b7590e627cad400d0b8eafa521cff570a65f5',
                  to: '0x112e7fdc9101b12d28b9e5da84569b0988ed035f',
                  transactionHash: '0xc5658493c3a9a012e770b2ca0bfbebaf04f4cf794cd9dc66fd8508535478b3d8',
                  transactionIndex: 0 },
               logs:
                [ { address: '0x112e7fdc9101b12d28b9e5da84569b0988ed035f',
                    blockNumber: 1424,
                    transactionIndex: 0,
                    transactionHash: '0xc5658493c3a9a012e770b2ca0bfbebaf04f4cf794cd9dc66fd8508535478b3d8',
                    blockHash: '0x97b1429e7a011cfc062efd47189b9e82e50821442a9ed79b824e972f70d8f4d6',
                    logIndex: 0,
                    removed: false,
                    event: 'Transfer',
                    args: [Object] } ] }
                  */
                  console.log("args : ");
                  /*
                  args :
                  { from: '0xcf3cfe42a8cd2ca52377c3e9fc9b08ce8273ab6c',
                    to: '0x03b63fff0ea4e103296426d1a5c0b8111858b510',
                    value: { [String: '1'] s: 1, e: 0, c: [ 1 ] } }
                  */
                  console.log(txMagicMined.logs[0].args);
                  assert.isBelow(txMagicMined.receipt.gasUsed, 4712389, "should not use all gas");
                  return web3.eth.getTransactionPromise(txMagicMined.tx);
                })
                .then(txSent => {
                  console.log("txSent : ");
                  console.log(txSent);
                   /*
                  txSent :
                  { blockHash: '0x97b1429e7a011cfc062efd47189b9e82e50821442a9ed79b824e972f70d8f4d6',
                    blockNumber: 1424,
                    from: '0xcf3cfe42a8cd2ca52377c3e9fc9b08ce8273ab6c',
                    gas: 4712388,
                    gasPrice: { [String: '100000000000'] s: 1, e: 11, c: [ 100000000000 ] },
                    hash: '0xc5658493c3a9a012e770b2ca0bfbebaf04f4cf794cd9dc66fd8508535478b3d8',
                    input: '0xa9059cbb00000000000000000000000003b63fff0ea4e103296426d1a5c0b8111858b5100000000000000000000000000000000000000000000000000000000000000001',
                    nonce: 31,
                    to: '0x112e7fdc9101b12d28b9e5da84569b0988ed035f',
                    transactionIndex: 0,
                    value: { [String: '0'] s: 1, e: 0, c: [ 0 ] },
                    v: '0x1c',
                    r: '0x5c7d722a6b731e268ef44fa22c689d4e96c1b8a5f82d452fe2cacd4f887e3908',
                    s: '0x1c0e7fb4b83dd32db1212479350016b7e1a1e2f7002a8388a235e9ac9cb98c02' }
                  */

                  return aRLCInstance.balanceOf.call("0x3b63fff0ea4e103296426d1a5c0b8111858b510");
                })
                .then(balanceBackerMagic => {
                  magicBalance=web3.toBigNumber(balanceBackerMagic.minus(previousBalance));
                  assert.strictEqual(magicBalance.toString(10), '1', "magicAdress received 1 RLC");
                }
                );

            });


            //
            it("TEST F : ERC20 Short Address Attack test : just log tx for use of a good call and with address :0x3b63fff0ea4e103296426d1a5c0b8111858b5100. log usefull to play with sendTransaction and trick input data in TEST G", function() {
                var previousBalance;

                 return aRLCInstance.balanceOf.call(backer1)
                    .then( rlcbalance  => {
                      assert.strictEqual(rlcbalance.toString(10), '0', "backer1 should have 0 balance at start");
                      return aCrowdsaleInstance.receiveETH(backer1,{ from : backer1, value: web3.toWei(1, "ether"), gaz:4712389 });
                    })
                 .then( txMined => {
                    assert.isBelow(txMined.receipt.gasUsed, 4712389, "should not use all gas");
                    return Promise.all([
                              web3.eth.getBalancePromise(aCrowdsaleInstance.address),
                              aRLCInstance.balanceOf.call(backer1)
                            ]);
                 })
                 .then( balances  => {
                   assert.strictEqual(balances[0].toString(10), web3.toWei(1, "ether").toString(10), "crowdsaleInstance should have 1 ether balance ");
                    //RLCPerETH = 200 000 000 000;
                   // 20% de 200000000000 = 40 000 000 000
                   // 200 000 000 000 +40 000 000 000  = 240 000 000 000
                   assert.strictEqual(balances[1].toString(10), "240000000000", "backer1 should have some RLC now");
                  return aRLCInstance.balanceOf.call("0x3b63fff0ea4e103296426d1a5c0b8111858b5100");
                }).then(balanceBackerMagic => {
                  previousBalance=balanceBackerMagic;
                  return aRLCInstance.transfer("0x3b63fff0ea4e103296426d1a5c0b8111858b5100",1,{from : backer1, gaz:4712389  });
                })
                .then(txMagicMined => {
                  console.log("aRLCInstance.transfer tx through web3 looks : ");
                  console.log(txMagicMined);
                  /*
                  { tx: '0x92772c72115ff2798f566da39155a5e02cb990b69d41bd47c46cc9029a9c351d',
                    receipt:
                     { blockHash: '0x35d53236e96dcfeef7a0652597249d1f5969d97a706089c00ace644940db6e09',
                       blockNumber: 1501,
                       contractAddress: null,
                       cumulativeGasUsed: 51225,
                       from: '0xcf3cfe42a8cd2ca52377c3e9fc9b08ce8273ab6c',
                       gasUsed: 51225,
                       logs: [ [Object] ],
                  logsBloom: '0x000000000000000000000000000000000000020000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000[24/444]
000000000008000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000400000000000000000000000000000
00000000000000000000000000000000000000000000000000000001000000000004000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000$
000000000000000040000000000000000000000000000000000000',
root: '0x759f857946a094c41defb83dee354d9840d7ddb54c8ca72a2ab8ec8a6803ce10',
to: '0x3da76a2a088f1da9a30f04e3415db34ba5742e23',
transactionHash: '0x92772c72115ff2798f566da39155a5e02cb990b69d41bd47c46cc9029a9c351d',
transactionIndex: 0 },
logs:
[ { address: '0x3da76a2a088f1da9a30f04e3415db34ba5742e23',
  blockNumber: 1501,
  transactionIndex: 0,
  transactionHash: '0x92772c72115ff2798f566da39155a5e02cb990b69d41bd47c46cc9029a9c351d',
  blockHash: '0x35d53236e96dcfeef7a0652597249d1f5969d97a706089c00ace644940db6e09',
  logIndex: 0,
  removed: false,
  event: 'Transfer',
  args: [Object] } ] }

                  */
                console.log("args : ");
                  /*

                  args :
{ from: '0xcf3cfe42a8cd2ca52377c3e9fc9b08ce8273ab6c',
  to: '0x3b63fff0ea4e103296426d1a5c0b8111858b5100',
  value: { [String: '1'] s: 1, e: 0, c: [ 1 ] } }

                  */
                  console.log(txMagicMined.logs[0].args);
                  assert.isBelow(txMagicMined.receipt.gasUsed, 4712389, "should not use all gas");
                  return web3.eth.getTransactionPromise(txMagicMined.tx);
                })
                .then(txSent => {
                  console.log("txSent : ");
                  console.log(txSent);
                  /*

                  txSent :
{ blockHash: '0x35d53236e96dcfeef7a0652597249d1f5969d97a706089c00ace644940db6e09',
  blockNumber: 1501,
  from: '0xcf3cfe42a8cd2ca52377c3e9fc9b08ce8273ab6c',
  gas: 4712388,
  gasPrice: { [String: '100000000000'] s: 1, e: 11, c: [ 100000000000 ] },
  hash: '0x92772c72115ff2798f566da39155a5e02cb990b69d41bd47c46cc9029a9c351d',
  input: '0xa9059cbb0000000000000000000000003b63fff0ea4e103296426d1a5c0b8111858b51000000000000000000000000000000000000000000000000000000000000000001',
  nonce: 37,
  to: '0x3da76a2a088f1da9a30f04e3415db34ba5742e23',
  transactionIndex: 0,
  value: { [String: '0'] s: 1, e: 0, c: [ 0 ] },
  v: '0x1c',
  r: '0xc45cc5034be3284899d1b749e1849a063f9c194c2bdad70e347f2dbcc869b26c',
  s: '0x4c874c0979a2586f29ea4130f95e4a23a042610ef545c4910e07676200cb88b3' }

                  */
                  return aRLCInstance.balanceOf.call("0x3b63fff0ea4e103296426d1a5c0b8111858b5100");
                })
                .then(balanceBackerMagic => {
                  magicBalance=web3.toBigNumber(balanceBackerMagic.minus(previousBalance));
                  assert.strictEqual(magicBalance.toString(10), '1', "magicAdress received 1 RLC");
                }
                );

              });

              it("TEST G : ERC20 Short Address Attack : use of sendTransactionPromise to simulate aRLCInstance.transfer call  ", function() {
                  var previousBalance;

                   return aRLCInstance.balanceOf.call(backer1)
                      .then( rlcbalance  => {
                        assert.strictEqual(rlcbalance.toString(10), '0', "backer1 should have 0 balance at start");
                        return aCrowdsaleInstance.receiveETH(backer1,{ from : backer1, value: web3.toWei(1, "ether"), gaz:4712389 });
                      })
                   .then( txMined => {
                      assert.isBelow(txMined.receipt.gasUsed, 4712389, "should not use all gas");
                      return Promise.all([
                                web3.eth.getBalancePromise(aCrowdsaleInstance.address),
                                aRLCInstance.balanceOf.call(backer1)
                              ]);
                   })
                   .then( balances  => {
                     assert.strictEqual(balances[0].toString(10), web3.toWei(1, "ether").toString(10), "crowdsaleInstance should have 1 ether balance ");
                     //RLCPerETH = 200 000 000 000;
                     // 20% de 200000000000 = 40 000 000 000
                     // 200 000 000 000 +40 000 000 000  = 240 000 000 000
                     assert.strictEqual(balances[1].toString(10), "240000000000", "backer1 should have some RLC now");
                    return aRLCInstance.balanceOf.call("0x3b63fff0ea4e103296426d1a5c0b8111858b5100");
                  }).then(balanceBackerMagic => {
                    previousBalance=balanceBackerMagic;
                  // web 3 control : Error: invalid argument 0: hex string has odd length
                  return web3.eth.sendTransactionPromise({from : backer1 ,to : aRLCInstance.address , data : "0xa9059cbb0000000000000000000000003b63fff0ea4e103296426d1a5c0b8111858b51000000000000000000000000000000000000000000000000000000000000000001" , gas: 300000, gasPrice: 10000000000});
                  })
                  .then(txSent => {
                   return   web3.eth.getTransactionReceiptMined(txSent);
                 }
                   )
                  .then(txMagicMined => {
                    assert.isBelow(txMagicMined.gasUsed, 300000, "should not use all gas");
                    return aRLCInstance.balanceOf.call("0x3b63fff0ea4e103296426d1a5c0b8111858b5100");
                  })
                  .then(balanceBackerMagic => {
                    magicBalance=web3.toBigNumber(balanceBackerMagic.minus(previousBalance));
                    assert.strictEqual(magicBalance.toString(10), '1', "magicAdress received 1 RLC");
                  }
                  );
                });

                it("TEST H : ERC20 Short Address Attack : use of sendTransactionPromise to simulate aRLCInstance.transfer call with 00 shift", function() {
                    var previousBalance;

                     return aRLCInstance.balanceOf.call(backer1)
                        .then( rlcbalance  => {
                          assert.strictEqual(rlcbalance.toString(10), '0', "backer1 should have 0 balance at start");
                          return aCrowdsaleInstance.receiveETH(backer1,{ from : backer1, value: web3.toWei(1, "ether"), gaz:4712389 });
                        })
                     .then( txMined => {
                        assert.isBelow(txMined.receipt.gasUsed, 4712389, "should not use all gas");
                        return Promise.all([
                                  web3.eth.getBalancePromise(aCrowdsaleInstance.address),
                                  aRLCInstance.balanceOf.call(backer1)
                                ]);
                     })
                     .then( balances  => {
                       assert.strictEqual(balances[0].toString(10), web3.toWei(1, "ether").toString(10), "crowdsaleInstance should have 1 ether balance ");
                       //RLCPerETH = 200 000 000 000;
                       // 20% de 200000000000 = 40 000 000 000
                       // 200 000 000 000 +40 000 000 000  = 240 000 000 000
                       assert.strictEqual(balances[1].toString(10), "240000000000", "backer1 should have some RLC now");
                      return aRLCInstance.balanceOf.call("0x3b63fff0ea4e103296426d1a5c0b8111858b5100");
                    }).then(balanceBackerMagic => {
                      previousBalance=balanceBackerMagic;
                    // origin data :
                    //0xa9059cbb0000000000000000000000003b63fff0ea4e103296426d1a5c0b8111858b51000000000000000000000000000000000000000000000000000000000000000001
                    //shifted data :
                    //0xa9059cbb0000000000000000000000003b63fff0ea4e103296426d1a5c0b8111858b510000000000000000000000000000000000000000000000000000000000000001

                    return web3.eth.sendTransactionPromise({from : backer1 ,to : aRLCInstance.address , data : "0xa9059cbb0000000000000000000000003b63fff0ea4e103296426d1a5c0b8111858b510000000000000000000000000000000000000000000000000000000000000001" , gas: 300000, gasPrice: 10000000000});
                    })
                    .then(txSent => web3.eth.getTransactionReceiptMined(txSent))
                    .then(txMagicMined => {
                      assert.isBelow(txMagicMined.gasUsed, 300000, "should not use all gas");
                      return aRLCInstance.balanceOf.call("0x3b63fff0ea4e103296426d1a5c0b8111858b5100");
                    })
                    .then(balanceBackerMagic => {
                      console.log(balanceBackerMagic);
                      magicBalance=web3.toBigNumber(balanceBackerMagic.minus(previousBalance));
                      assert.strictEqual(magicBalance.toString(10), '256', "magicAdress expected 1 RLC have 256 RLC !!!!");
                    }
                    );
                  });
                });


                describe("Test Crowndsale with RLCRobust.sol", function() {

                  var aRLCRobustInstance;
                  var aCrowdsaleInstance;
                  var ownerInitialBalance;
                  var backer1InitialBalance;

                  beforeEach("create a new contract instance and get inital balance", function() {
                      return Promise.all([
                        web3.eth.getBalancePromise(owner),
                        web3.eth.getBalancePromise(backer1),
                        RLCRobust.new()
                      ])
                      .then(results => {
                        [ownerInitialBalance,backer1InitialBalance,aRLCRobustInstance]=results;
                        return aRLCRobustInstance.unlock({from: owner, gaz:300000})
                      })
                      .then( txMined => {
                        assert.isBelow(txMined.receipt.gasUsed, 3000000, "should not use all gas");
                        return Crowdsale.new(aRLCRobustInstance.address,btcproxy);
                      })
                      .then(crowdsaleInstance => {
                          aCrowdsaleInstance=crowdsaleInstance
                          return aRLCRobustInstance.transfer(aCrowdsaleInstance.address,87000000000000000,{from: owner, gaz:3000000});
                        }
                      )
                      //transfert owner ship
                      .then(() => aRLCRobustInstance.transferOwnership(aCrowdsaleInstance.address,{from: owner, gaz:3000000}))
                      .then(() => {
                        return aCrowdsaleInstance.start({from: owner, gaz:300000});
                      })
                      .then( txMined => assert.isBelow(txMined.receipt.gasUsed, 3000000, "should not use all gas"));
                  });

                  it("contract should have 0 balance at start", function() {
                       return web3.eth.getBalancePromise(aCrowdsaleInstance.address)
                       .then( balance  => assert.strictEqual(balance.toString(10), '0', "contract should have 0 balance at start"));
                  });


                  it("TEST I : ERC20 Short Address Attack with RLCRobust => throw : use of sendTransactionPromise to simulate aRLCInstance.transfer call with 00 shift", function() {
                      var previousBalance;

                       return aRLCRobustInstance.balanceOf.call(backer1)
                          .then( rlcbalance  => {
                            assert.strictEqual(rlcbalance.toString(10), '0', "backer1 should have 0 balance at start");
                            return aCrowdsaleInstance.receiveETH(backer1,{ from : backer1, value: web3.toWei(1, "ether"), gaz:4712389 });
                          })
                       .then( txMined => {
                          assert.isBelow(txMined.receipt.gasUsed, 4712389, "should not use all gas");
                          return Promise.all([
                                    web3.eth.getBalancePromise(aCrowdsaleInstance.address),
                                    aRLCRobustInstance.balanceOf.call(backer1)
                                  ]);
                       })
                       .then( balances  => {
                         assert.strictEqual(balances[0].toString(10), web3.toWei(1, "ether").toString(10), "crowdsaleInstance should have 1 ether balance ");
                         //RLCPerETH = 200 000 000 000;
                         // 20% de 200000000000 = 40 000 000 000
                         // 200 000 000 000 +40 000 000 000  = 240 000 000 000
                         assert.strictEqual(balances[1].toString(10), "240000000000", "backer1 should have some RLC now");
                        return aRLCRobustInstance.balanceOf.call("0x3b63fff0ea4e103296426d1a5c0b8111858b5100");
                      }).then(balanceBackerMagic => {
                        previousBalance=balanceBackerMagic;
                      // origin data :
                      //0xa9059cbb0000000000000000000000003b63fff0ea4e103296426d1a5c0b8111858b51000000000000000000000000000000000000000000000000000000000000000001
                      //shifted data :
                      //0xa9059cbb0000000000000000000000003b63fff0ea4e103296426d1a5c0b8111858b510000000000000000000000000000000000000000000000000000000000000001

                      return web3.eth.sendTransactionPromise({from : backer1 ,to : aRLCRobustInstance.address , data : "0xa9059cbb0000000000000000000000003b63fff0ea4e103296426d1a5c0b8111858b510000000000000000000000000000000000000000000000000000000000000001" , gas: 300000, gasPrice: 10000000000});
                      })
                      .then(txSent => web3.eth.getTransactionReceiptMined(txSent))
                      .then(txMagicMined => {
                        assert.strictEqual(txMagicMined.gasUsed, 300000, "should use all gas !!! => expected throw on a RLCRobust with onlyPayloadSize check of the tranfert function");
                        return aRLCRobustInstance.balanceOf.call("0x3b63fff0ea4e103296426d1a5c0b8111858b5100");
                      })
                      .then(balanceBackerMagic => {
                        console.log(balanceBackerMagic);
                        magicBalance=web3.toBigNumber(balanceBackerMagic.minus(previousBalance));
                        assert.strictEqual(magicBalance.toString(10), '0', "magicAdress expected 0  because exception in throw in transfert  thanks to onlyPayloadSize check of the tranfert function ");
                      }
                      );
                    });

                    it("TEST J : backer1 (every holder RLC token) can call burn function and burn some RLC but also decrease the totalSupply of the RLC token. need onlyOwner on burn function ?", function() {
                      return aRLCRobustInstance.balanceOf.call(backer1)
                         .then( rlcbalance  => {
                           assert.strictEqual(rlcbalance.toString(10), '0', "backer1 should have 0 balance at start");
                           return aCrowdsaleInstance.receiveETH(backer1,{ from : backer1, value: web3.toWei(1, "ether"), gaz:4712389 });
                         })
                      .then( txMined => {
                         assert.isBelow(txMined.receipt.gasUsed, 4712389, "should not use all gas");
                         return Promise.all([
                                   aRLCRobustInstance.totalSupply.call(),
                                   aRLCRobustInstance.balanceOf.call(backer1)
                                 ]);
                      })
                      .then( balances  => {
                        assert.strictEqual(balances[0].toString(10), "87000000000000000", "aRLCRobustInstance totalSupply is 87000000000000000 ");
                        assert.strictEqual(balances[1].toString(10), "240000000000", "backer1 should have some RLC now");
                        //burn RLC with transfer call
                        return aRLCRobustInstance.transfer(0x00,1,{from: backer1, gaz:3000000});
                      })
                      .then( txMined => {
                         assert.isBelow(txMined.receipt.gasUsed, 3000000, "should not use all gas");
                         return Promise.all([
                                   aRLCRobustInstance.totalSupply.call(),
                                   aRLCRobustInstance.balanceOf.call(backer1)
                                 ]);
                      })
                      .then( balances  => {
                        assert.strictEqual(balances[0].toString(10), "87000000000000000", "aRLCRobustInstance totalSupply is still 87000000000000000 ");
                        assert.strictEqual(balances[1].toString(10), "239999999999", "backer1 should have some RLC now");
                        return aRLCRobustInstance.burn(1,{from: backer1, gaz:3000000});
                      })
                      .then( txMined => {
                         assert.isBelow(txMined.receipt.gasUsed, 3000000, "should not use all gas");
                         return Promise.all([
                                   aRLCRobustInstance.totalSupply.call(),
                                   aRLCRobustInstance.balanceOf.call(backer1)
                                 ]);
                       })
                       .then( balances  => {
                         assert.strictEqual(balances[0].toString(10), "86999999999999999", "aRLCRobustInstance totalSupply is now  86999999999999999 !! ");
                         assert.strictEqual(balances[1].toString(10), "239999999998", "backer1 should have some RLC now");
                       });
                    });

                  });

});
