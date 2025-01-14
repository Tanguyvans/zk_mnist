// Charger d'abord le circuit avec fetch
let circuit;
const loadCircuit = async () => {
  const response = await fetch('./circuit.json');
  circuit = await response.json();
};
await loadCircuit();

import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { Noir } from '@noir-lang/noir_js';
import { ethers } from 'ethers';

// Configuration
const contractAddress = "0x711310B306A21544Dd0cc3A09cA56139FAa8CA59";
const contractABI = [
  {
    "inputs": [{"internalType": "contract UltraVerifier", "name": "_verifier", "type": "address"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "verifier",
    "outputs": [{"internalType": "contract UltraVerifier", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes", "name": "proof", "type": "bytes"},
      {"internalType": "bytes32[]", "name": "y", "type": "bytes32[]"}
    ],
    "name": "verifyEqual",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// État global
let state = {
  currentProof: null,
  currentPublicInputs: null,
  currentFile: null,
  currentWallet: null,
  isConnected: false
};

// Utilitaires
function display(container, msg) {
  const c = document.getElementById(container);
  const p = document.createElement('p');
  p.textContent = msg;
  c.appendChild(p);
}

async function imageToPixelArray(file) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 28;
      canvas.height = 28;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 28, 28);
      ctx.drawImage(img, 0, 0, 28, 28);
      
      const preview = document.getElementById("preview");
      const previewCtx = preview.getContext("2d");
      previewCtx.drawImage(canvas, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, 28, 28);
      const pixels = [];
      
      for(let i = 0; i < imageData.data.length; i += 4) {
        const gray = Math.floor((imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3);
        pixels.push(gray.toString());
      }
      
      resolve(pixels);
    };
    
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Gestionnaires d'événements
async function handleImageSelect(event) {
  state.currentFile = event.target.files[0];
  if (state.currentFile) {
    display("logs", "Image selected: " + state.currentFile.name);
  }
}

async function handleSubmit() {
  try {
    const backend = new BarretenbergBackend(circuit);
    const noir = new Noir(circuit);

    const pixels = await imageToPixelArray(state.currentFile);
    const input = { input: pixels };
    
    display('logs', 'Generating proof... ⌛');
    const { witness } = await noir.execute(input);
    const proof = await backend.generateProof(witness);

    const formattedPublicInputs = proof.publicInputs.map(input => 
      ethers.zeroPadValue(input, 32)
    );
    
    const formattedProof = '0x' + Array.from(proof.proof)
      .map(x => x.toString(16).padStart(2, '0'))
      .join('');
    
    display('logs', 'Generating proof... ✅');
    
    // Afficher les résultats
    display('results', 'Public Inputs:');
    display('results', JSON.stringify(formattedPublicInputs, null, 2));
    display('results', 'Input:');
    display('results', parseInt(proof.publicInputs[0], 16));
    display('results', 'Proof:');
    display('results', formattedProof);
    
    // Sauvegarder l'état
    state.currentProof = formattedProof;
    state.currentPublicInputs = formattedPublicInputs;
    
  } catch (err) {
    console.error(err);
    display('logs', 'Error: ' + err.message);
  }
}

async function toggleWallet() {
  if (state.isConnected) {
    // Déconnexion
    state.currentWallet = null;
    state.isConnected = false;
    document.getElementById('walletAddress').textContent = '';
    document.getElementById('connectWallet').textContent = 'Connect Wallet';
    document.getElementById('connectWallet').classList.remove('bg-red-600', 'hover:bg-red-700');
    document.getElementById('connectWallet').classList.add('bg-purple-600', 'hover:bg-purple-700');
    display('logs', 'Wallet disconnected ✅');
  } else {
    // Connexion
    try {
      if (!window.ethereum) {
        throw new Error('Please install MetaMask');
      }

      display('logs', 'Connecting to wallet...');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      state.currentWallet = address;
      state.isConnected = true;
      
      document.getElementById('walletAddress').textContent = 
        `${address.slice(0, 6)}...${address.slice(-4)}`;
      document.getElementById('connectWallet').textContent = 'Disconnect';
      document.getElementById('connectWallet').classList.remove('bg-purple-600', 'hover:bg-purple-700');
      document.getElementById('connectWallet').classList.add('bg-red-600', 'hover:bg-red-700');
      
      display('logs', 'Wallet connected successfully! ✅');
    } catch (err) {
      console.error(err);
      display('logs', 'Error connecting wallet: ' + err.message);
    }
  }
}

async function verifyProof() {
  try {
    if (!state.currentWallet) {
      display('logs', 'Please connect your wallet first');
      return;
    }
    
    if (!state.currentProof || !state.currentPublicInputs) {
      display('logs', 'Please generate a proof first');
      return;
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress, contractABI, signer);
    
    display('logs', 'Verifying proof on chain...');
    const isValid = await contract.verifyEqual(state.currentProof, state.currentPublicInputs);
    display('logs', isValid ? 'Proof verified successfully! ✅' : 'Proof verification failed ❌');
    
  } catch (err) {
    console.error(err);
    display('logs', 'Error during verification: ' + err.message);
  }
}

// Event Listeners
document.getElementById("imageInput").addEventListener("change", handleImageSelect);
document.getElementById('submit').addEventListener('click', handleSubmit);
document.getElementById('connectWallet').addEventListener('click', toggleWallet);
document.getElementById('verifyProof').addEventListener('click', verifyProof);