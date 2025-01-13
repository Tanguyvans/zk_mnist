import circuit from '../circuit/target/circuit.json';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { Noir } from '@noir-lang/noir_js';
import { ethers } from 'ethers';

// Ajout de l'ABI complet du contrat
const contractABI = [
  {
    "inputs": [
      {
        "internalType": "contract UltraVerifier",
        "name": "_verifier",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "verifier",
    "outputs": [
      {
        "internalType": "contract UltraVerifier",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "proof",
        "type": "bytes"
      },
      {
        "internalType": "bytes32[]",
        "name": "y",
        "type": "bytes32[]"
      }
    ],
    "name": "verifyEqual",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const contractAddress = "0x711310B306A21544Dd0cc3A09cA56139FAa8CA59";
let currentProof = null;
let currentPublicInputs = null;

let currentFile = null;

function display(container, msg) {
  const c = document.getElementById(container);
  const p = document.createElement('p');
  p.textContent = msg;
  c.appendChild(p);
}

// Fonction pour convertir une image en tableau de pixels
async function imageToPixelArray(file) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 28;
      canvas.height = 28;
      
      // Fond blanc
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 28, 28);
      
      // Dessiner l'image
      ctx.drawImage(img, 0, 0, 28, 28);
      
      // Afficher un aperçu
      const preview = document.getElementById("preview");
      const previewCtx = preview.getContext("2d");
      previewCtx.drawImage(canvas, 0, 0);
      
      // Convertir en pixels
      const imageData = ctx.getImageData(0, 0, 28, 28);
      const pixels = [];
      
      for(let i = 0; i < imageData.data.length; i += 4) {
        // Convertir en niveaux de gris
        const gray = Math.floor((imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3);
        pixels.push(gray.toString());
      }
      
      resolve(pixels);
    };
    
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Gestionnaire pour le changement de fichier
document.getElementById("imageInput").addEventListener("change", (event) => {
  currentFile = event.target.files[0];
  if (currentFile) {
    display("logs", "Image selected: " + currentFile.name);
  }
});

document.getElementById('submitGuess').addEventListener('click', async () => {
  try {
    const backend = new BarretenbergBackend(circuit);
    const noir = new Noir(circuit);

    const pixels = await imageToPixelArray(currentFile);
    console.log("Pixels:", pixels); // Pour débugger

    const input = {
      input: pixels
    };
    
    display('logs', 'Generating proof... ⌛');
    const { witness } = await noir.execute(input);

    console.log("Witness:", witness);
    const proof = await backend.generateProof(witness);

    // Formater les public inputs
    const formattedPublicInputs = proof.publicInputs.map(input => 
      ethers.zeroPadValue(input, 32)  // Nouvelle syntaxe pour ethers v6
    );
    
    // Formater la preuve en bytes
    const formattedProof = '0x' + Array.from(proof.proof)
                                     .map(x => x.toString(16).padStart(2, '0'))
                                     .join('');
    
    display('logs', 'Generating proof... ✅');
    
    // Afficher les valeurs formatées
    display('results', 'Public Inputs:');
    display('results', JSON.stringify(formattedPublicInputs, null, 2));
    
    display('results', 'Input:');
    display('results', parseInt(proof.publicInputs[0], 16));

    display('results', 'Proof:');
    display('results', formattedProof);
    
    // Afficher le format pour Remix
    display('results', 'Pour Remix verify():');
    display('results', `proof: "${formattedProof}",`);
    display('results', `publicInputs: ${JSON.stringify(formattedPublicInputs)}`);
    
    // Stocker la preuve et les inputs pour la vérification
    currentProof = formattedProof;
    currentPublicInputs = formattedPublicInputs;
    
  } catch (err) {
    console.log(err);
    display('logs', 'Error: ' + err.message);
  }
});

// Ajouter l'événement pour la vérification
document.getElementById('verifyProof').addEventListener('click', async () => {
  try {
    if (!currentProof || !currentPublicInputs) {
      display('logs', 'Please generate a proof first');
      return;
    }

    display('logs', 'Connecting to wallet...');
    
    // Connexion à MetaMask
    if (!window.ethereum) {
      throw new Error('Please install MetaMask');
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    // Création de l'instance du contrat
    const contract = new ethers.Contract(contractAddress, contractABI, signer);
    
    display('logs', 'Verifying proof on chain...');
    
    // Appel de la fonction verifyEqual
    const isValid = await contract.verifyEqual(currentProof, currentPublicInputs);
    
    display('logs', isValid ? 'Proof verified successfully! ✅' : 'Proof verification failed ❌');
    
  } catch (err) {
    console.error(err);
    display('logs', 'Error during verification: ' + err.message);
  }
});