const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy();
  await voting.waitForDeployment();

  const address = await voting.getAddress();
  console.log("Voting deployed to:", address);

  await voting.addCandidate("Alice");
  await voting.addCandidate("Bob");
  await voting.addCandidate("Charlie");

  const count = await voting.candidatesCount();
  console.log("Total candidates:", count.toString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});