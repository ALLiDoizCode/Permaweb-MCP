#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import { homedir, platform } from 'os';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version info
const packagePath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

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
  return banner;
}

function showCompactBanner() {
  return `🧠 PERMAMIND - Immortal AI Memory • Built on Arweave • Powered by AO`;
}

const HELP_TEXT = `${showBanner()}
Permamind MCP Server v${packageJson.version}
${packageJson.description}

Usage:
  permamind [options]

Options:
  --help, -h          Show this help message
  --version, -v       Show version information
  --setup, -s         Run configuration wizard
  --config <path>     Use custom configuration file
  --test, -t          Test server startup and configuration
  --generate-seed     Generate a new seed phrase
  --export-seed       Export current server seed phrase
  --import-seed       Import an existing seed phrase
  --info              Show server information

Environment Variables:
  SEED_PHRASE         Seed phrase for Arweave wallet
  HUB_REGISTRY_ID     Custom hub registry ID (optional)

Examples:
  permamind                    # Start the MCP server
  permamind --setup            # Run configuration wizard
  permamind --test             # Test server configuration
  permamind --generate-seed    # Generate new seed phrase
  permamind --export-seed      # Export current seed phrase
  permamind --import-seed      # Import existing seed phrase

For more information, visit: ${packageJson.homepage}
`;

function showVersion() {
  process.stdout.write(`permamind v${packageJson.version}\n`);
}

function showHelp() {
  process.stdout.write(HELP_TEXT);
}

async function generateSeedPhrase() {
  console.log(showBanner());
  console.log('🔐 Seed Phrase Generator');
  console.log('');
  
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    // Import the mnemonic generation functionality
    let generateMnemonic;
    try {
      ({ generateMnemonic } = await import('../dist/mnemonic.js'));
    } catch (importErr) {
      // Try to build if dist is missing
      const distPath = join(__dirname, '..', 'dist');
      if (!existsSync(distPath)) {
        process.stderr.write('📦 Building permamind...\n');
        execSync('npm run build', { 
          cwd: join(__dirname, '..'),
          stdio: 'inherit' 
        });
        ({ generateMnemonic } = await import('../dist/mnemonic.js'));
      } else {
        throw importErr;
      }
    }
    const seedPhrase = await generateMnemonic();
    
    process.stderr.write('🎲 Generated new seed phrase:\n');
    process.stderr.write(seedPhrase + '\n');
    process.stderr.write('\n⚠️  IMPORTANT: Store this seed phrase securely!\n');
    process.stderr.write('Without it, you will lose access to your Arweave wallet and stored memories.\n');

    const save = await new Promise(resolve => {
      rl.question('\nWould you like to save this seed phrase? (y/n): ', resolve);
    });

    if (save.toLowerCase() === 'y') {
      const choice = await new Promise(resolve => {
        rl.question('\nHow would you like to save it?\n1. Environment variable (recommended)\n2. Save to config file\n3. Both\nEnter choice (1-3): ', resolve);
      });

      if (choice === '1' || choice === '3') {
        process.stderr.write('\n📝 Add to your shell profile (.bashrc, .zshrc, etc.):');
        process.stderr.write(`export SEED_PHRASE="${seedPhrase}"`);
        
        if (platform() === 'win32') {
          process.stderr.write('\n📝 For Windows:');
          process.stderr.write(`set SEED_PHRASE=${seedPhrase}`);
          process.stderr.write('Or PowerShell:');
          process.stderr.write(`$env:SEED_PHRASE="${seedPhrase}"`);
        }
      }

      if (choice === '2' || choice === '3') {
        const configPath = getSeedConfigPath();
        const configDir = dirname(configPath);
        
        // Ensure directory exists
        const fs = await import('fs');
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }

        const config = {
          seedPhrase: seedPhrase,
          createdAt: new Date().toISOString(),
          source: 'generated'
        };

        writeFileSync(configPath, JSON.stringify(config, null, 2));
        process.stderr.write(`\n💾 Seed phrase saved to: ${configPath}`);
        process.stderr.write('⚠️  Keep this file secure and backed up!');
      }
    } else {
      process.stderr.write('\n💡 Remember to save this seed phrase manually!');
      process.stderr.write('You can set it later with: permamind --import-seed');
    }

  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error('Error importing mnemonic module:', err.message);
      console.error('This typically means the project is not built properly.');
      console.error('Please run: npm run build');
    } else {
      console.error('Error generating seed phrase:', err.message);
      console.error('If the problem persists, please file an issue: https://github.com/ALLiDoizCode/Permamind/issues');
    }
    process.exit(1);
  } finally {
    rl.close();
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

async function exportSeedPhrase() {
  try {
    // Check if there's an environment variable first
    if (process.env.SEED_PHRASE) {
      process.stderr.write('🔑 Current seed phrase (from environment):');
      process.stderr.write(process.env.SEED_PHRASE);
      process.stderr.write('\n💡 This seed phrase is set via environment variable');
      return;
    }

    // Check if there's a saved seed phrase
    const configPath = getSeedConfigPath();
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        if (config.seedPhrase) {
          process.stderr.write('🔑 Current seed phrase (from saved config):');
          process.stderr.write(config.seedPhrase);
          process.stderr.write('\n💡 This seed phrase is saved in:', configPath);
          return;
        }
      } catch (err) {
        console.warn('⚠️  Could not read saved seed phrase config');
      }
    }

    // Try to get seed phrase from a temporary server startup
    process.stderr.write('🔍 No persistent seed phrase found.');
    process.stderr.write('💡 The server generates temporary seed phrases when none is provided.');
    process.stderr.write('');
    process.stderr.write('To get a persistent seed phrase:');
    process.stderr.write('1. Generate one: permamind --generate-seed');
    process.stderr.write('2. Import existing: permamind --import-seed');
    process.stderr.write('3. Set environment: export SEED_PHRASE="your phrase here"');

  } catch (err) {
    console.error('❌ Error exporting seed phrase:', err.message);
    process.exit(1);
  }
}

async function importSeedPhrase() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    process.stderr.write('🔐 Import Existing Seed Phrase');
    process.stderr.write('===============================\n');

    const seedPhrase = await new Promise(resolve => {
      rl.question('Enter your 12-word seed phrase: ', resolve);
    });

    if (!seedPhrase || seedPhrase.trim().split(' ').length !== 12) {
      console.error('❌ Invalid seed phrase. Must be exactly 12 words.');
      process.exit(1);
    }

    // Validate the seed phrase by trying to import it
    try {
      let validateMnemonic;
      try {
        ({ validateMnemonic } = await import('../dist/mnemonic.js'));
      } catch (importErr) {
        // Try to build if dist is missing
        const distPath = join(__dirname, '..', 'dist');
        if (!existsSync(distPath)) {
          process.stderr.write('📦 Building permamind for validation...\n');
          execSync('npm run build', { 
            cwd: join(__dirname, '..'),
            stdio: 'inherit' 
          });
          ({ validateMnemonic } = await import('../dist/mnemonic.js'));
        } else {
          throw importErr;
        }
      }
      if (!(await validateMnemonic(seedPhrase.trim()))) {
        console.error('❌ Invalid seed phrase. Please check and try again.');
        process.exit(1);
      }
    } catch (err) {
      console.warn('⚠️  Could not validate seed phrase:', err.message);
    }

    const choice = await new Promise(resolve => {
      rl.question('\nHow would you like to save this seed phrase?\n1. Environment variable (recommended)\n2. Save to config file\n3. Both\nEnter choice (1-3): ', resolve);
    });

    const trimmedSeed = seedPhrase.trim();

    if (choice === '1' || choice === '3') {
      process.stderr.write('\n📝 Add to your shell profile (.bashrc, .zshrc, etc.):');
      process.stderr.write(`export SEED_PHRASE="${trimmedSeed}"`);
      
      if (platform() === 'win32') {
        process.stderr.write('\n📝 For Windows:');
        process.stderr.write(`set SEED_PHRASE=${trimmedSeed}`);
        process.stderr.write('Or PowerShell:');
        process.stderr.write(`$env:SEED_PHRASE="${trimmedSeed}"`);
      }
    }

    if (choice === '2' || choice === '3') {
      const configPath = getSeedConfigPath();
      const configDir = dirname(configPath);
      
      // Ensure directory exists
      const fs = await import('fs');
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const config = {
        seedPhrase: trimmedSeed,
        createdAt: new Date().toISOString(),
        source: 'imported'
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));
      process.stderr.write(`\n💾 Seed phrase saved to: ${configPath}`);
      process.stderr.write('⚠️  Keep this file secure and backed up!');
    }

    process.stderr.write('\n✅ Seed phrase imported successfully!');
    process.stderr.write('🔄 Restart your MCP clients to use the new seed phrase.');

  } catch (err) {
    console.error('❌ Error importing seed phrase:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function testServer() {
  // Set production environment for deployed installations
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }
  
  process.stderr.write(showCompactBanner() + '\n');
  process.stderr.write('🔧 Testing Permamind server configuration...');
  
  // Check if dist directory exists
  const distPath = join(__dirname, '..', 'dist');
  try {
    const fs = await import('fs');
    if (!fs.existsSync(distPath)) {
      console.error('Error: Distribution files not found. Run: npm run build');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error checking distribution files:', err.message);
    process.exit(1);
  }

  // Load constants to show network configuration
  let constants;
  try {
    const constantsPath = join(__dirname, '..', 'dist', 'constants.js');
    constants = await import(constantsPath);
  } catch (err) {
    console.error('Error loading constants:', err.message);
    process.exit(1);
  }

  // Show environment and network configuration
  const isMainnet = constants.ARWEAVE_URL() === 'arweave.net';
  console.log('');
  console.log('🌐 Network Configuration:');
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Network: ${isMainnet ? '🟢 MAINNET' : '🟡 TESTNET'}`);
  console.log(`   Arweave: ${constants.ARWEAVE_URL()}`);
  console.log(`   Gateway: ${constants.GATEWAY_URL()}`);
  console.log(`   CU (Compute Unit): ${constants.CU_URL()}`);
  console.log(`   MU (Messenger Unit): ${constants.MU_URL()}`);
  console.log(`   Scheduler: ${constants.SCHEDULER()}`);
  console.log('');

  // Show Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  console.log('🔧 System Configuration:');
  console.log(`   Node.js: ${nodeVersion} ${majorVersion >= 20 ? '✅' : '❌ (requires 20+)'}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Architecture: ${process.arch}`);
  console.log('');

  // Check environment variables
  console.log('🔑 Environment Variables:');
  if (process.env.SEED_PHRASE) {
    console.log('   SEED_PHRASE: ✅ Set');
  } else {
    console.log('   SEED_PHRASE: ❌ Not set');
    console.log('   Generate one with: permamind --generate-seed');
  }
  
  if (process.env.HUB_REGISTRY_ID) {
    console.log(`   HUB_REGISTRY_ID: ✅ ${process.env.HUB_REGISTRY_ID}`);
  } else {
    console.log(`   HUB_REGISTRY_ID: 📋 Using default (${constants.HUB_REGISTRY_ID()})`);
  }
  console.log('');

  if (majorVersion < 20) {
    console.error(`❌ Error: Node.js ${nodeVersion} is not supported. Please upgrade to Node.js 20 or later.`);
    process.exit(1);
  }

  console.log('✅ Configuration validation complete!');
  console.log('Start the server with: permamind');
}

async function startServer(configPath) {
  try {
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    
    // Check if server file exists
    const fs = await import('fs');
    if (!fs.existsSync(serverPath)) {
      console.error('❌ Error: Server file not found at:', serverPath);
      console.error('📦 Please build the project first: npm run build');
      console.error('🔧 If you installed globally, the build should be included');
      console.error('🐛 If this persists, file an issue: https://github.com/ALLiDoizCode/Permamind/issues');
      process.exit(1);
    }

    // Validate Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 20) {
      console.error(`❌ Error: Node.js ${nodeVersion} is not supported`);
      console.error('🟢 Please upgrade to Node.js 20 or higher');
      console.error('📥 Download from: https://nodejs.org/');
      process.exit(1);
    }

    // Set config path if provided
    if (configPath) {
      if (!fs.existsSync(configPath)) {
        console.error('❌ Error: Config file not found:', configPath);
        process.exit(1);
      }
      process.env.CONFIG_PATH = configPath;
      process.stderr.write('📝 Using config file:', configPath);
    }

    // Check for seed phrase from various sources
    let seedPhrase = process.env.SEED_PHRASE;
    
    if (!seedPhrase) {
      // Check for saved seed phrase
      const configPath = getSeedConfigPath();
      if (existsSync(configPath)) {
        try {
          const config = JSON.parse(readFileSync(configPath, 'utf8'));
          if (config.seedPhrase) {
            seedPhrase = config.seedPhrase;
            process.env.SEED_PHRASE = seedPhrase;
            // Silent loading for MCP protocol compatibility
          }
        } catch (err) {
          // Silent error handling for MCP protocol compatibility
        }
      }
    }

    // Note: Removing console output during MCP server startup to prevent JSON protocol interference
    // Seed phrase validation occurs silently - use --test flag for diagnostics

    // Set production environment for deployed installations
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'production';
    }

    // Start the server by importing and running it
    // Note: No console output here as it interferes with MCP JSON protocol
    await import(serverPath);
    
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error('❌ Error: Missing dependencies or build files');
      console.error('📦 Try: npm run build');
      console.error('🔧 If globally installed, try: npm update -g permamind');
    } else if (err.code === 'EACCES') {
      console.error('❌ Error: Permission denied');
      console.error('🔐 Check file permissions and try again');
    } else {
      console.error('❌ Error starting server:', err.message);
      console.error('🔍 Stack trace:', err.stack);
    }
    
    console.error('\n🩺 Troubleshooting:');
    console.error('1. Check Node.js version: node --version (need 20+)');
    console.error('2. Rebuild project: npm run build');
    console.error('3. Test configuration: permamind --test');
    console.error('4. File an issue: https://github.com/ALLiDoizCode/Permamind/issues');
    
    process.exit(1);
  }
}

function runSetup() {
  try {
    execSync(`node "${join(__dirname, 'permamind-setup.js')}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('Error running setup wizard:', err.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  // No arguments, start the server
  startServer().catch(err => {
    console.error('Server failed to start:', err.message);
    process.exit(1);
  });
} else {
  const command = args[0];
  
  switch (command) {
    case '--help':
    case '-h':
      showHelp();
      break;
      
    case '--version':
    case '-v':
      showVersion();
      break;
      
    case '--setup':
    case '-s':
      runSetup();
      break;
      
    case '--config':
      if (args[1]) {
        startServer(args[1]).catch(err => {
          console.error('Server failed to start:', err.message);
          process.exit(1);
        });
      } else {
        console.error('Error: --config requires a file path');
        process.exit(1);
      }
      break;
      
    case '--test':
    case '-t':
      testServer().catch(err => {
        console.error('Test failed:', err.message);
        process.exit(1);
      });
      break;
      
    case '--generate-seed':
      generateSeedPhrase().catch(err => {
        console.error('Seed generation failed:', err.message);
        process.exit(1);
      });
      break;
      
    case '--export-seed':
      exportSeedPhrase().catch(err => {
        console.error('Seed export failed:', err.message);
        process.exit(1);
      });
      break;
      
    case '--import-seed':
      importSeedPhrase().catch(err => {
        console.error('Seed import failed:', err.message);
        process.exit(1);
      });
      break;
      
    case '--info':
      console.log(showBanner());
      process.stdout.write(`Permamind MCP Server v${packageJson.version}\n`);
      process.stdout.write(`Description: ${packageJson.description}\n`);
      process.stdout.write(`Repository: ${packageJson.repository.url}\n`);
      process.stdout.write(`Author: ${packageJson.author}\n`);
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      process.stderr.write('Use --help for available options');
      process.exit(1);
  }
}