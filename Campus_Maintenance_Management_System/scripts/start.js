const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';
const projectRoot = path.join(__dirname, '..');

// Helper functions
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      ...options,
      shell: isWindows,
      stdio: 'inherit'
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    
    proc.on('error', reject);
  });
}

function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, { ...options, shell: isWindows }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function checkFileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkDirExists(dirPath) {
  try {
    const stat = await fs.promises.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function main() {
  process.chdir(projectRoot);
  
  console.log('Starting CMMS System...\n');

  // Check/install frontend dependencies
  const frontendNodeModules = path.join(projectRoot, 'frontend', 'node_modules');
  if (!(await checkDirExists(frontendNodeModules))) {
    console.log('Installing frontend dependencies...');
    process.chdir(path.join(projectRoot, 'frontend'));
    await runCommand('npm', ['install']);
    process.chdir(projectRoot);
  }

  // Check Python
  let pythonCmd = 'python3';
  try {
    await execCommand('python --version');
    pythonCmd = 'python';
  } catch {
    try {
      await execCommand('python3 --version');
    } catch {
      console.error('Python not found. Please install Python 3.8+');
      process.exit(1);
    }
  }

  // Check/install backend dependencies
  try {
    await execCommand(`${pythonCmd} -c "import flask, flask_cors"`);
  } catch {
    console.log('Installing backend dependencies...');
    await runCommand(pythonCmd === 'python' ? 'pip' : 'pip3', ['install', '-r', 'backend/requirements.txt']);
  }

  // Initialize database if needed
  const dbPath = path.join(projectRoot, 'cmms_database.db');
  if (!(await checkFileExists(dbPath))) {
    console.log('Initializing database...');
    await runCommand(pythonCmd, ['scripts/init_db.py', '--seed']);
  }

  // Create logs directory
  const logsDir = path.join(projectRoot, 'logs');
  if (!(await checkDirExists(logsDir))) {
    await fs.promises.mkdir(logsDir, { recursive: true });
  }

  // Start backend
  console.log('\nStarting backend server...');
  const backendLog = path.join(logsDir, 'api.log');
  const backendProcess = spawn(pythonCmd, ['api.py'], {
    cwd: path.join(projectRoot, 'backend'),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows
  });

  const backendLogStream = fs.createWriteStream(backendLog);
  backendProcess.stdout.pipe(backendLogStream);
  backendProcess.stderr.pipe(backendLogStream);

  // Wait a bit for backend to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start frontend
  console.log('Starting frontend server...\n');
  const frontendLog = path.join(logsDir, 'frontend.log');
  const frontendProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(projectRoot, 'frontend'),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows
  });

  const frontendLogStream = fs.createWriteStream(frontendLog);
  frontendProcess.stdout.pipe(frontendLogStream);
  frontendProcess.stderr.pipe(frontendLogStream);

  console.log('==========================================');
  console.log('CMMS System is running!');
  console.log('Backend: http://localhost:5001');
  console.log('Frontend: http://localhost:8080');
  console.log('');
  console.log('Press Ctrl+C to stop both servers');
  console.log('==========================================\n');

  // Handle cleanup
  process.on('SIGINT', () => {
    console.log('\nStopping servers...');
    backendProcess.kill();
    frontendProcess.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    backendProcess.kill();
    frontendProcess.kill();
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
