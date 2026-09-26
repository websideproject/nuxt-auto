// Forwards localhost:<port> inside the Playwright container to the playground served on the host, so the
// suite opens http://localhost:3100 locally exactly as it does in CI. Started by visual-baseline.sh.
const net = require('node:net')

const port = Number(process.env.VISUAL_PORT || 3100)

net.createServer((client) => {
  const upstream = net.connect(port, 'host.docker.internal')
  client.pipe(upstream).pipe(client)
  // A page that navigates away mid-request resets its socket; that must not take the forwarder down.
  client.on('error', () => upstream.destroy())
  upstream.on('error', () => client.destroy())
}).listen(port, '127.0.0.1')
