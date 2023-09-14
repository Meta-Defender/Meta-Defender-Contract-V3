import * as fs from 'fs-extra';
import { toBN, ZERO_ADDRESS } from './util/web3utils';
import { Contract, Signer } from 'ethers';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hre = require('hardhat');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { upgrades } = require('hardhat');

export type DeployedContracts = {
    network: string;
    globalsViewer: string;
    metaDefenderMarketsRegistry: string;
    testERC20: string;
    americanBinaryOptions: string;
    markets: Market[];
};

export type Market = {
    marketName: string;
    marketDescription: string;
    marketPaymentToken: string;
    marketProtectionType: string;
    network: string;
    metaDefender: string;
    liquidityCertificate: string;
    policy: string;
    epochManage: string;
};
async function main(
    marketName: string,
    marketDescription: string,
    marketPaymentToken: string,
    marketProtectionType: string,
    network: string,
) {
    let res: DeployedContracts;
    let signers: Signer[] = [];
    if (
        fs.existsSync(
            './deployments/.env.' + String(hre.network.name) + '.json',
        )
    ) {
        res = JSON.parse(
            fs.readFileSync(
                './deployments/.env.' + String(hre.network.name) + '.json',
                'utf8',
            ),
        );
    } else {
        const markets: Market[] = [];
        res = {} as DeployedContracts;
        res.markets = markets;
    }
    console.log('detected network ' + hre.network.name);
    signers = await hre.ethers.getSigners();

    const _MetaDefender = await hre.ethers.getContractFactory(
        'MetaDefender',
        signers[0],
    );
    const MetaDefender = await _MetaDefender.deploy();
    console.log(
        'successfully deployed MetaDefender: ' +
            MetaDefender.address +
            ' ' +
            MetaDefender.deployTransaction.hash,
    );
    const _LiquidityCertificate = await hre.ethers.getContractFactory(
        'LiquidityCertificate',
        signers[0],
    );

    // deploy liquidity certificate with low-risk/medium-risk/high-risk
    const LiquidityCertificate = await _LiquidityCertificate.deploy('L_231007_LC', 'L_231007_LC');
    console.log(
        'successfully deployed LiquidityCertificate: ' +
            LiquidityCertificate.address +
            ' ' +
            LiquidityCertificate.deployTransaction.hash,
    );

    // deploy policy with low-risk/medium-risk/high-risk
    const _Policy = await hre.ethers.getContractFactory('Policy', signers[0]);
    const Policy = await _Policy.deploy('L_231007_P', 'L_231007_P');
    console.log(
        'successfully deployed Policy: ' +
            Policy.address +
            ' ' +
            Policy.deployTransaction.hash,
    );

    const _EpochManage = await hre.ethers.getContractFactory(
        'EpochManage',
        signers[0],
    );
    const EpochManage = await _EpochManage.deploy();

    const _AmericanBinaryOptions = await hre.ethers.getContractFactory(
        'AmericanBinaryOptions',
        signers[0],
    );

    const _TestERC20 = await hre.ethers.getContractFactory(
        'TestERC20',
        signers[0],
    );

    // periphery contracts
    const _GlobalsViewer = await hre.ethers.getContractFactory(
        'GlobalsViewer',
        signers[0],
    );

    const _Prices = await hre.ethers.getContractFactory(
        'Prices',
        signers[0],
    );

    const _MetaDefenderMarketsRegistry = await hre.ethers.getContractFactory(
        'MetaDefenderMarketsRegistry',
        signers[0],
    );

    let MetaDefenderMarketsRegistry: Contract;
    let GlobalsViewer: Contract;
    let AmericanBinaryOptions: Contract;
    let TestERC20: Contract;
    let Prices: Contract;

    let metaDefenderMarketsRegistryAddress: string;
    let globalsViewerAddress: string;
    let americanBinaryOptionsAddress: string;
    let testERC20Address: string;

    if (!res.metaDefenderMarketsRegistry) {
        MetaDefenderMarketsRegistry =
            await _MetaDefenderMarketsRegistry.deploy();
        console.log(
            'successfully deployed MetaDefenderMarketsRegistry: ' +
                MetaDefenderMarketsRegistry.address,
        );

        Prices = await _Prices.deploy();
        console.log(
            'successfully deployed Prices: ' + Prices.address,
        );

        GlobalsViewer = await _GlobalsViewer.deploy();
        AmericanBinaryOptions = await _AmericanBinaryOptions.deploy();
        console.log(
            'successfully deployed AmericanBinaryOption: ' +
                AmericanBinaryOptions.address,
        );
        console.log(
            'successfully deployed GlobalsViewer: ' + GlobalsViewer.address,
        );
        await GlobalsViewer.init(
            MetaDefenderMarketsRegistry.address,
            AmericanBinaryOptions.address,
        );
        console.log('successfully init the GlobalsViewer contract');
        TestERC20 = await _TestERC20.deploy('TQA', 'TQA');
        console.log('successfully deployed TestERC20: ' + TestERC20.address);
        // mint 10M tokens for the owner
        await TestERC20.mint(
            await signers[0].getAddress(),
            '10000000000000000000000000',
        );
        metaDefenderMarketsRegistryAddress =
            MetaDefenderMarketsRegistry.address;
        globalsViewerAddress = GlobalsViewer.address;
        americanBinaryOptionsAddress = AmericanBinaryOptions.address;
        testERC20Address = TestERC20.address;
    } else {
        for (let i = 0; i < res.markets.length; i++) {
            if (res.markets[i].marketName === marketName) {
                console.log('market already exists');
                return;
            }
        }
        metaDefenderMarketsRegistryAddress = res.metaDefenderMarketsRegistry;
        globalsViewerAddress = res.globalsViewer;
        americanBinaryOptionsAddress = res.americanBinaryOptions;
        testERC20Address = res.testERC20;
        MetaDefenderMarketsRegistry = await _MetaDefenderMarketsRegistry.attach(
            metaDefenderMarketsRegistryAddress,
        );
        GlobalsViewer = await _GlobalsViewer.attach(globalsViewerAddress);
        AmericanBinaryOptions = await _AmericanBinaryOptions.attach(
            americanBinaryOptionsAddress,
        );
        TestERC20 = await _TestERC20.attach(testERC20Address);
    }
    res.markets.push({
        marketName: marketName,
        marketDescription: marketDescription,
        marketPaymentToken: marketPaymentToken,
        marketProtectionType: marketProtectionType,
        network: network,
        metaDefender: String(MetaDefender.address),
        liquidityCertificate: String(LiquidityCertificate.address),
        policy: String(Policy.address),
        epochManage: String(EpochManage.address),
    });
    res['network'] = hre.network.name;
    res['globalsViewer'] = globalsViewerAddress;
    res['metaDefenderMarketsRegistry'] = metaDefenderMarketsRegistryAddress;
    res['testERC20'] = testERC20Address;
    res['americanBinaryOptions'] = americanBinaryOptionsAddress;
    fs.writeFileSync(
        './deployments/.env.' + String(hre.network.name) + '.json',
        JSON.stringify(res, null, 2),
    );
    // begin init the contracts
    // init the metaDefender contract
    console.log("begin init the smart contracts");
    await MetaDefender.init(
        TestERC20.address,
        signers[0].getAddress(),
        LiquidityCertificate.address,
        Policy.address,
        AmericanBinaryOptions.address,
        EpochManage.address,
        toBN('0.10'),
        toBN('0.00'),
        toBN('200'),
        toBN('1.1'),
        3
    );
    console.log('successfully init the MetaDefender contract');
    await LiquidityCertificate.init(
        MetaDefender.address,
    );
    console.log('successfully init the LiquidityCertificate contract');
    await Policy.init(
        MetaDefender.address,
        EpochManage.address,
    );
    console.log('successfully init the Policy contract');
    await EpochManage.init(
        MetaDefender.address,
        LiquidityCertificate.address,
        Policy.address,
        signers[0].getAddress()
    );
    console.log('successfully init the EpochManage contract');

    console.log('registry in process...');
    await MetaDefenderMarketsRegistry.addMarket(
        MetaDefender.address,
        LiquidityCertificate.address,
        Policy.address,
        EpochManage.address,
        marketName,
        marketDescription,
        marketPaymentToken,
        marketProtectionType,
        network,
    );
    console.log('successfully registry the market');
}

main(
    'Test_StableCoin1_Pool',
    'Stable_Coin_Pool',
    'USDT',
    'DePeg Safety',
    'Arbitrum',
)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
