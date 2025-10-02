import puppeteer from 'puppeteer-core';

let browser = null;
let page = null;
let canvas = null;
let sharedBuffer = null;
let frameIndex = 0;

self.onmessage = async (event) => {
  const { type, ...data } = event.data;
  
  switch (type) {
    case 'init':
      await initialize(data);
      break;
    case 'navigate':
      await navigate(data.url);
      break;
    case 'control':
      await executeControl(data.command);
      break;
    case 'capture':
      await captureFrame();
      break;
    case 'dispose':
      await dispose();
      break;
  }
};

async function initialize({ canvas: offscreenCanvas, config, sharedBuffer: buffer }) {
  canvas = offscreenCanvas;
  sharedBuffer = new Uint8Array(buffer);
  
  // Launch headless browser
  browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions'
    ]
  });
  
  page = await browser.newPage();
  await page.setViewport({
    width: config.width || 1920,
    height: config.height || 1080,
    deviceScaleFactor: 1
  });
  
  // Set up proxy if specified
  if (config.proxy) {
    await page.authenticate({
      username: config.proxy.username,
      password: config.proxy.password
    });
  }
  
  // Start capture loop
  startCaptureLoop();
}

async function navigate(url) {
  if (!page) return;
  
  try {
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
  } catch (error) {
    console.error('Navigation error:', error);
  }
}

async function executeControl(command) {
  if (!page) return;
  
  const [action, ...params] = command.split(':');
  
  switch (action) {
    case 'click':
      await page.click(params[0] || 'body');
      break;
    case 'type':
      await page.keyboard.type(params.join(':'));
      break;
    case 'scroll':
      await page.evaluate((direction) => {
        window.scrollBy(0, direction === 'down' ? 100 : -100);
      }, params[0]);
      break;
    case 'navigate':
      if (params[0] === 'back') await page.goBack();
      else if (params[0] === 'forward') await page.goForward();
      else if (params[0] === 'reload') await page.reload();
      else if (params[0] === 'url') await navigate(params[1]);
      break;
    case 'screenshot':
      const screenshot = await page.screenshot({ encoding: 'binary' });
      self.postMessage({ type: 'screenshot', data: screenshot }, [screenshot.buffer]);
      break;
  }
}

async function captureFrame() {
  if (!page || !canvas) return;
  
  // Capture viewport
  const screenshot = await page.screenshot({
    encoding: 'binary',
    type: 'png',
    fullPage: false
  });
  
  // Decode to canvas
  const ctx = canvas.getContext('2d');
  const blob = new Blob([screenshot], { type: 'image/png' });
  const bitmap = await createImageBitmap(blob);
  
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  
  // Get pixel data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Write to shared buffer if available
  if (sharedBuffer) {
    const offset = frameIndex * canvas.width * canvas.height * 4;
    sharedBuffer.set(imageData.data, offset);
    frameIndex = (frameIndex + 1) % 1024; // Ring buffer
  }
  
  // Send frame data
  self.postMessage({
    type: 'frame',
    data: imageData.data,
    timestamp: Date.now()
  }, [imageData.data.buffer]);
}

function startCaptureLoop() {
  const captureInterval = setInterval(async () => {
    await captureFrame();
  }, 1000 / 30); // 30 FPS
  
  self.addEventListener('message', (event) => {
    if (event.data.type === 'stop-capture') {
      clearInterval(captureInterval);
    }
  });
}

async function dispose() {
  if (page) await page.close();
  if (browser) await browser.close();
  self.close();
}
