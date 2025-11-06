import { ethers } from 'hardhat';
import hre, { upgrades } from 'hardhat';

const contractName = 'EtherPhunksMarketV2_WithRoyalties';

const _version = 2;
const _pointsAddress = '0x4119a7b9Ef6413EA7f9235AC64Ca1945609A3bF7';

export async function deployMarketWithRoyalties() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n\n=====================================================================');
  console.log(`Deploying ${contractName} contract with the account:`, signer.address);
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const args = [ _version, _pointsAddress ];

  // Deploy upgradeable contract
  const contract = await upgrades.deployProxy(
    ContractFactory,
    args,
    { initializer: 'initialize' }
  );

  await contract.waitForDeployment();
  const proxyAddress = await contract.getAddress();

  console.log('\n\n=====================================================================');
  console.log(`${contractName} Proxy deployed to:`, proxyAddress);
  console.log('=====================================================================');

  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log('\n\n=====================================================================');
  console.log(`${contractName} Implementation deployed to:`, implAddress);
  console.log('=====================================================================');

  const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
  console.log('\n\n=====================================================================');
  console.log(`${contractName} Admin deployed to:`, adminAddress);
  console.log('=====================================================================\n');

  return proxyAddress;
}

deployMarketWithRoyalties().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
