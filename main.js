const axios = require('axios');
const fs = require('fs');
const { ethers } = require('ethers');
const { HttpsProxyAgent } = require('https-proxy-agent');

const API_URL = 'https://capy-db.onrender.com/api/v1/user';
const SOCIALS_API_URL = 'https://capy-db.onrender.com/api/v1/user/socials/x/';
const TELE_API_URL = 'https://capy-db.onrender.com/api/v1/user/socials/tg/';
const WALLET_FILE = 'wallets.json';
const REFERRER_FILE = 'user.txt';
const PROXY_FILE = 'proxy.txt';

async function getProxy() {
    try {
        if (fs.existsSync(PROXY_FILE)) {
            const proxies = fs.readFileSync(PROXY_FILE, 'utf8').split('\n').filter(p => p.trim());
            const proxy = proxies[Math.floor(Math.random() * proxies.length)].trim();
            if (!proxy.startsWith('http://')) {
                return `http://${proxy}`;
            }
            return proxy;
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic?.phrase || null
    };
}

async function getReferrerAddress() {
    try {
        const data = fs.readFileSync(REFERRER_FILE, 'utf8');
        return data.trim();
    } catch (err) {
        return null;
    }
}

async function saveWalletToFile(walletData) {
    try {
        let wallets = [];
        if (fs.existsSync(WALLET_FILE)) {
            const data = fs.readFileSync(WALLET_FILE, 'utf8');
            wallets = JSON.parse(data);
        }
        wallets.push(walletData);
        fs.writeFileSync(WALLET_FILE, JSON.stringify(wallets, null, 2));
        console.log(`Wallet ${walletData.address} saved successfully`);
    } catch (err) {
        console.error('Error saving wallet:', err);
    }
}

async function createAxiosInstance() {
    const proxy = await getProxy();
    const headers = {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'origin': 'https://www.capyhl.fun',
        'referer': 'https://www.capyhl.fun/',
        'priority': 'u=1, i',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
    };

    const config = { headers };

    if (proxy) {
        console.log(`Using proxy: ${proxy}`);
        config.httpsAgent = new HttpsProxyAgent(proxy);
        config.timeout = 10000;
    }

    return axios.create(config);
}

async function postUserData(instance, walletAddress, refAddress) {
    try {
        const payload = {
            wallet: walletAddress,
            point: 0,
            refAddress: refAddress
        };
        const response = await instance.post(API_URL, payload);
        console.log('User POST response:', response.data);
        return true;
    } catch (error) {
        console.error('User POST failed:', error.response?.data || error.message);
        return false;
    }
}

async function postSocialsData(instance, walletAddress, endpoint) {
    try {
        const url = endpoint === 'x' ? `${SOCIALS_API_URL}${walletAddress}` : `${TELE_API_URL}${walletAddress}`;
        const response = await instance.post(url, {});
        console.log(`${endpoint.toUpperCase()} POST response:`, response.data);
        return true;
    } catch (error) {
        console.error(`${endpoint.toUpperCase()} POST failed:`, error.response?.data || error.message);
        return false;
    }
}

async function runProcess() {
    try {
        console.log('\n--- Starting new process ---');
        const newWallet = await generateWallet();
        console.log('Generated wallet:', newWallet.address);
        
        const refAddress = await getReferrerAddress();
        if (!refAddress) {
            throw new Error('No referrer address found');
        }
        console.log('Using referrer:', refAddress);
        
        const instance = await createAxiosInstance();
        
        const userSuccess = await postUserData(instance, newWallet.address, refAddress);
        const xSuccess = await postSocialsData(instance, newWallet.address, 'x');
        const tgSuccess = await postSocialsData(instance, newWallet.address, 'tg');
        const user = await postUserData(instance, newWallet.address, refAddress);
        
        if (userSuccess && xSuccess && tgSuccess && user) {
            await saveWalletToFile(newWallet);
            console.log('All operations completed successfully!');
        } else {
            console.log('Some operations failed, wallet not saved');
        }
    } catch (error) {
        console.error('Process error:', error.message);
    }
}

async function main() {
    while (true) {
        await runProcess();
        
        // Generate random delay between 5-10 seconds
        const delay = Math.floor(Math.random() * 5000) + 5000;
        console.log(`Waiting for ${delay/1000} seconds before next process...\n`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

main().catch(console.error);
