const localtunnel = require('localtunnel');

async function startTunnel() {
  try {
    const tunnel = await localtunnel({ port: 3000 });
    console.log('Tunnel started! Use this link on your phone:');
    console.log(tunnel.url);
    
    tunnel.on('close', () => {
      console.log('Tunnel closed. Restarting in 2 seconds...');
      setTimeout(startTunnel, 2000);
    });
    
    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });
    
  } catch (err) {
    console.error('Failed to start tunnel:', err);
    setTimeout(startTunnel, 5000);
  }
}

startTunnel();

setInterval(() => {
  // Keep event loop alive
}, 1000 * 60 * 60);
