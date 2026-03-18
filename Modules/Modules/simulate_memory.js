const os = require('os');

console.log('💧 ------------------------------------------------ 💧');
console.log(` Starting Memory Stress Test...`);
console.log(' Keep an eye on your Verolla Dashboard for Memory spikes!');
console.log(' Press Ctrl+C in this terminal to STOP the test.');
console.log('💧 ------------------------------------------------ 💧');

// Create a global array so the garbage collector doesn't clean it up
const memoryHogs = [];
let allocatedMB = 0;

// Allocate 50MB every 200 milliseconds to steadily build up RAM usage
const interval = setInterval(() => {
    try {
        // Buffer.alloc allocates memory outside the V8 heap and fills it with zeroes, 
        // forcing actual physical memory consumption which the OS monitors.
        const chunk = Buffer.alloc(50 * 1024 * 1024); 
        memoryHogs.push(chunk);
        allocatedMB += 50;

        console.log(`[+] Consumed 50 MB - Total allocated: ${allocatedMB} MB`);
    } catch (err) {
        console.error('Failed to allocate more memory (System out of memory or Node limit reached):', err.message);
        clearInterval(interval);
        console.log('Holding onto memory... Press Ctrl+C to exit and release memory.');
    }
}, 200);
