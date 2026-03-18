const { Worker, isMainThread } = require('worker_threads');
const os = require('os');

if (isMainThread) {
  console.log('🔥 ------------------------------------------------ 🔥');
  console.log(` Starting CPU Stress Test on all ${os.cpus().length} cores...`);
  console.log(' Keep an eye on your Verolla Dashboard!');
  console.log(' Press Ctrl+C in this terminal to STOP the test.');
  console.log('🔥 ------------------------------------------------ 🔥');
  
  for (let i = 0; i < os.cpus().length; i++) {
    new Worker(__filename);
  }
} else {
  // This infinite loop runs on each core, maxing out your CPU specifically for testing.
  while (true) {}
}
