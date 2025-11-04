#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir, platform } from 'os';
import { createInterface } from 'readline';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function showBanner() {
  const banner = `
 ██████╗ ███████╗██████╗ ███╗   ███╗ █████╗ ███╗   ███╗██╗███╗   ██╗██████╗ 
 ██╔══██╗██╔════╝██╔══██╗████╗ ████║██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗
 ██████╔╝█████╗  ██████╔╝██╔████╔██║███████║██╔████╔██║██║██╔██╗ ██║██║  ██║
 ██╔═══╝ ██╔══╝  ██╔══██╗██║╚██╔╝██║██╔══██║██║╚██╔╝██║██║██║╚██╗██║██║  ██║
 ██║     ███████╗██║  ██║██║ ╚═╝ ██║██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██████╔╝
 ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝ 
                                                                              
🧠 Immortal Memory Layer for AI Agents • Built on Arweave • Powered by AO
`;
  console.log(banner);
}

function detectOS() {
  const os = platform();
  switch (os) {
    case 'darwin': return 'macOS';
    case 'win32': return 'Windows';
    case 'linux': return 'Linux';
    default: return os;
  }
}

function getClaudeDesktopConfigPath() {
  const os = platform();
  const home = homedir();
  
  switch (os) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    case 'linux':
      return join(home, '.config', 'Claude', 'claude_desktop_config.json');
    default:
      return null;
  }
}

function getVSCodeConfigPath() {
  const home = homedir();
  const os = platform();
  
  switch (os) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'Code', 'User');
    case 'win32':
      return join(home, 'AppData', 'Roaming', 'Code', 'User');
    case 'linux':
      return join(home, '.config', 'Code', 'User');
    default:
      return null;
  }
}

function getSeedConfigPath() {
  const home = homedir();
  const os = platform();
  
  switch (os) {
    case 'darwin':
      return join(home, '.config', 'permamind', 'seed.json');
    case 'win32':
      return join(home, 'AppData', 'Roaming', 'permamind', 'seed.json');
    default:
      return join(home, '.config', 'permamind', 'seed.json');
  }
}

function isClaudeDesktopConfigured() {
  const claudeConfigPath = getClaudeDesktopConfigPath();
  if (!claudeConfigPath || !existsSync(claudeConfigPath)) {
    return false;
  }
  
  try {
    const config = JSON.parse(readFileSync(claudeConfigPath, 'utf8'));
    return !!config.mcpServers?.permamind;
  } catch (err) {
    return false;
  }
}

function isVSCodeConfigured() {
  const vscodeConfigDir = getVSCodeConfigPath();
  if (!vscodeConfigDir) {
    return false;
  }
  
  const mcpConfigPath = join(vscodeConfigDir, 'mcp.json');
  if (!existsSync(mcpConfigPath)) {
    return false;
  }
  
  try {
    const config = JSON.parse(readFileSync(mcpConfigPath, 'utf8'));
    return !!config.mcpServers?.permamind;
  } catch (err) {
    return false;
  }
}

async function generateSeedPhrase() {
  try {
    // Import the mnemonic generation functionality
    const { generateMnemonic } = await import('../dist/mnemonic.js');
    return await generateMnemonic();
  } catch (err) {
    // Try to build the project if dist is missing
    const distPath = join(__dirname, '..', 'dist');
    if (!existsSync(distPath)) {
      console.log('📦 Building permamind...');
      try {
        execSync('npm run build', { 
          cwd: join(__dirname, '..'),
          stdio: 'inherit' 
        });
        // Try importing again after build
        const { generateMnemonic } = await import('../dist/mnemonic.js');
        return await generateMnemonic();
      } catch (buildErr) {
        console.error('❌ Error: Could not build permamind.');
        console.error('This may happen with global installations.');
        console.error('Try installing locally instead: npm install permamind');
        process.exit(1);
      }
    } else {
      console.error('❌ Error: Could not generate seed phrase.');
      console.error('Module import failed:', err.message);
      process.exit(1);
    }
  }
}

function loadTemplate(templateName) {
  const templatePath = join(__dirname, '..', 'templates', templateName);
  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf8');
  }
  return null;
}

function updateClaudeDesktopConfig(configPath, seedPhrase) {
  let config = { mcpServers: {} };
  
  // Load existing config if it exists
  if (existsSync(configPath)) {
    try {
      const existingConfig = readFileSync(configPath, 'utf8');
      config = JSON.parse(existingConfig);
      if (!config.mcpServers) {
        config.mcpServers = {};
      }
    } catch (err) {
      // console.warn removed
    }
  }

  // Add or update Permamind server configuration
  config.mcpServers.permamind = {
    command: "npx",
    args: ["permamind"],
    env: {
      SEED_PHRASE: seedPhrase,
      PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin`
    }
  };

  // Ensure directory exists
  const configDir = dirname(configPath);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Write the updated config
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return true;
}

function createVSCodeConfig(configDir, seedPhrase) {
  const mcpConfigPath = join(configDir, 'mcp.json');
  const config = {
    mcpServers: {
      permamind: {
        command: "npx",
        args: ["permamind"],
        env: {
          SEED_PHRASE: seedPhrase,
          PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin`
        }
      }
    }
  };
  
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
  return mcpConfigPath;
}

async function testServerConnection(seedPhrase) {
  process.stderr.write('\nTesting server connection...\n');
  
  try {
    // Set environment variable temporarily
    process.env.SEED_PHRASE = seedPhrase;
    
    // Try to start the server in test mode
    execSync('node "' + join(__dirname, 'permamind.js') + '" --test', { 
      stdio: 'inherit',
      env: { ...process.env, SEED_PHRASE: seedPhrase }
    });
    
    // console.log removed
    return true;
  } catch (err) {
    console.error('✗ Server test failed:', err.message);
    return false;
  }
}

async function main() {
  // Show welcome banner
  showBanner();
  console.log(`🚀 Permamind Setup Wizard`);
  
  const os = detectOS();
  console.log(`🖥️  Detected OS: ${os}`);
  console.log('');
  
  // Check if permamind is built
  const distPath = join(__dirname, '..', 'dist');
  if (!existsSync(distPath)) {
    console.error('❌ Error: Permamind is not built. Please run: npm run build');
    process.exit(1);
  }
  
  // console.log removed
  // console.log removed
  
  let seedPhrase = process.env.SEED_PHRASE;
  let seedSource = '';
  
  // Check for environment variable first
  if (seedPhrase) {
    seedSource = 'environment variable';
    // console.log removed
  } else {
    // Check for saved config file
    const configPath = getSeedConfigPath();
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        if (config.seedPhrase) {
          seedPhrase = config.seedPhrase;
          seedSource = 'saved config file';
          // console.log removed
        }
      } catch (err) {
        // console.warn removed
      }
    }
    
    // Check Claude Desktop config if no seed phrase found yet
    if (!seedPhrase) {
      const claudeConfigPath = getClaudeDesktopConfigPath();
      if (claudeConfigPath && existsSync(claudeConfigPath)) {
        try {
          const claudeConfig = JSON.parse(readFileSync(claudeConfigPath, 'utf8'));
          if (claudeConfig.mcpServers?.permamind?.env?.SEED_PHRASE) {
            seedPhrase = claudeConfig.mcpServers.permamind.env.SEED_PHRASE;
            seedSource = 'Claude Desktop config';
            // console.log removed
          }
        } catch (err) {
          // console.warn removed
        }
      }
    }
  }
  
  if (seedPhrase) {
    // console.log removed
    // console.log removed.slice(0, 3).join(' ') + '...');
    // console.log removed
    // console.log removed
    
    const choice = await question('\nChoose an option:\n1. Use existing seed phrase\n2. Generate new seed phrase\n3. Import different seed phrase\nEnter choice (1-3): ');
    
    if (choice === '1') {
      // console.log removed
      // Keep the existing seedPhrase value
    } else if (choice === '2') {
      // console.log removed
      seedPhrase = await generateSeedPhrase();
      // console.log removed
      // console.log removed
      // console.log removed
    } else if (choice === '3') {
      seedPhrase = await question('\nEnter your 12-word seed phrase: ');
      
      // Validate the seed phrase
      const words = seedPhrase.trim().split(/\s+/);
      if (words.length !== 12) {
        console.error('❌ Invalid seed phrase. Must be exactly 12 words.');
        process.exit(1);
      }
      // console.log removed
    } else {
      // console.log removed
      // Keep the existing seedPhrase value
    }
  }
  
  if (!seedPhrase) {
    const choice = await question('\nChoose an option:\n1. Generate new seed phrase\n2. Import existing seed phrase\n3. Use system-generated temporary phrase (not recommended)\nEnter choice (1-3): ');
    
    if (choice === '1') {
      // console.log removed
      seedPhrase = await generateSeedPhrase();
      // console.log removed
      // console.log removed
      // console.log removed
    } else if (choice === '2') {
      seedPhrase = await question('\nEnter your 12-word seed phrase: ');
      
      // Validate the seed phrase
      const words = seedPhrase.trim().split(/\s+/);
      if (words.length !== 12) {
        console.error('❌ Invalid seed phrase. Must be exactly 12 words.');
        process.exit(1);
      }
      // console.log removed
    } else if (choice === '3') {
      // console.log removed
      // console.log removed
      // console.log removed
      seedPhrase = null; // Will use system-generated temporary
    } else {
      // console.log removed
      process.exit(1);
    }
  }
  
  // console.log removed
  // console.log removed
  
  // Claude Desktop Configuration
  const claudeConfigPath = getClaudeDesktopConfigPath();
  if (claudeConfigPath && seedPhrase) {
    if (isClaudeDesktopConfigured()) {
      // console.log removed
      const reconfigure = await question('Update configuration? (y/n): ');
      if (reconfigure.toLowerCase() === 'y') {
        try {
          updateClaudeDesktopConfig(claudeConfigPath, seedPhrase);
          // console.log removed
        } catch (err) {
          console.error('✗ Failed to update Claude Desktop:', err.message);
        }
      }
    } else {
      const configureClaudeDesktop = await question(`\nConfigure Claude Desktop? (y/n): `);
      if (configureClaudeDesktop.toLowerCase() === 'y') {
        try {
          updateClaudeDesktopConfig(claudeConfigPath, seedPhrase);
          // console.log removed
        } catch (err) {
          console.error('✗ Failed to configure Claude Desktop:', err.message);
        }
      }
    }
  } else if (!seedPhrase) {
    // console.log removed
  } else {
    // console.log removed
  }
  
  // VS Code Configuration
  const vscodeConfigDir = getVSCodeConfigPath();
  if (vscodeConfigDir && seedPhrase) {
    if (isVSCodeConfigured()) {
      // console.log removed
      const reconfigure = await question('Update configuration? (y/n): ');
      if (reconfigure.toLowerCase() === 'y') {
        try {
          const mcpConfigPath = createVSCodeConfig(vscodeConfigDir, seedPhrase);
          // console.log removed
        } catch (err) {
          console.error('✗ Failed to update VS Code:', err.message);
        }
      }
    } else {
      const configureVSCode = await question('\nConfigure VS Code? (y/n): ');
      if (configureVSCode.toLowerCase() === 'y') {
        try {
          const mcpConfigPath = createVSCodeConfig(vscodeConfigDir, seedPhrase);
          // console.log removed
        } catch (err) {
          console.error('✗ Failed to configure VS Code:', err.message);
        }
      }
    }
  } else if (!seedPhrase) {
    // console.log removed
  }
  
  // console.log removed
  // console.log removed
  
  if (seedPhrase) {
    const testConnection = await question('\nTest server connection? (y/n): ');
    if (testConnection.toLowerCase() === 'y') {
      await testServerConnection(seedPhrase);
    }
  } else {
    // console.log removed
  }
  
  // console.log removed
  // console.log removed
  
  if (seedPhrase) {
    const setupEnv = await question('\nAdd SEED_PHRASE to environment? (y/n): ');
    if (setupEnv.toLowerCase() === 'y') {
      // console.log removed:');
      // console.log removed
      
      if (os === 'Windows') {
        // console.log removed
        // console.log removed
        // console.log removed
        // console.log removed
      }
    }
  } else {
    // console.log removed
  }
  
  // console.log removed
  // console.log removed
  // console.log removed
  // console.log removed');
  // console.log removed
  // console.log removed
  // console.log removed
  
  rl.close();
}

main().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});