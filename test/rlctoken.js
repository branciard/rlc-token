var Crowdsale = artifacts.require("./Crowdsale.sol");
var RLC = artifacts.require("./RLC.sol");

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
                        web3.toWei(web3.toBigNumber(10), "ether").lessThan(balance),
                        "sheriff should have at least 3 ether, not " + web3.fromWei(balance, "ether"))
              )
              .then(() => Extensions.refillAccount(owner,backer1,5))
              .then(() => Extensions.refillAccount(owner,backer2,5));
    });



    describe("Test Crowndsale just open state", function() {

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
            [sheriffInitialBalance,wasteOwnerInitialBalance,aRLCInstance]=results;
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
           return Promise.all([ aRLCInstance.balanceOf.call(backer1), aRLCInstance.balanceOf.call(backer1+10)])
              .then( rlcbalances  => {
                assert.strictEqual(rlcbalances[0].toString(10), '0', "backer1 should have 0 balance at start");
                assert.strictEqual(rlcbalances[0].toString(10), '0', "backer2 should have 0 balance at start");
               return aCrowdsaleInstance.receiveETH(backer1+10,{ from : backer1,value: web3.toWei(1, "ether"), gaz:4712389 });
              })
           .then( txMined => {
              assert.isBelow(txMined.receipt.gasUsed, 4712389, "should not use all gas");
              return Promise.all([
                        web3.eth.getBalancePromise(aCrowdsaleInstance.address),
                        aRLCInstance.balanceOf.call(backer1),
                        aRLCInstance.balanceOf.call(backer1+10)
                      ]);
           })
           .then( balances  => {
             assert.strictEqual(balances[0].toString(10), web3.toWei(1, "ether").toString(10), "contract should have 1 ether balance ");
             assert.strictEqual(balances[1].toString(10), "0" , "backer1 should have no RLC");
             assert.strictEqual(balances[2].toString(10), "240000000000" , "backer1+10 have some RLC now");
            }
           );
      });



    });

});
