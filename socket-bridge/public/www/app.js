// Service UUID (must match KickPi BLE server)
const SERVICE_UUID = '12345678-1234-5678-1234-567890abcdef';

// Characteristic UUID (must match KickPi BLE server)
const WIFI_UUID = '12345678-1234-5678-1234-1234567890ac';

// ✅ Helpers
function updateLoading(msg) {
  document.getElementById("status").textContent = msg;
}

function hideLoading() {}

// ✅ Ping device without CORS issues
function pingDevice(url, timeout = 2000) {
  return new Promise((resolve) => {
    const img = new Image();

    const timer = setTimeout(() => {
      img.src = "";
      resolve(false);
    }, timeout);

    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };

    img.src = url + "/?_=" + Date.now();
  });
}

// ✅ Wait until KickPi is reachable
async function waitForDevice(url, retries = 25, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    const ok = await pingDevice(url);
    console.log(`Ping attempt ${i + 1}: ${ok}`);

    if (ok) return true;

    await new Promise(r => setTimeout(r, delay));
  }
  return false;
}

// ✅ Redirect to quiz page (#rounds section)
async function redirectToQuiz() {
  const base = "http://192.168.1.77:8080";
  const fullUrl = base + "/index.html#rounds";

  updateLoading("Waiting for device to come online...");

  const ready = await waitForDevice(base);

  if (ready) {
    updateLoading("Connected! Launching quiz...");
    setTimeout(() => {
      window.location.href = fullUrl;
    }, 1000);
  } else {
    hideLoading();
    document.getElementById("status").innerHTML = `
      ⚠️ Device connected but not reachable.<br><br>
      <a href="${fullUrl}" target="_blank">Open Quiz Manually</a>
    `;
  }
}

// ✅ MAIN provisioning
async function provisionKickPi(ssid, password) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Scanning for KickPi...';

  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID]
    });

    statusEl.textContent = `Device found: ${device.name}. Connecting...`;
    console.log(`Device selected: ${device.name}`);

    const server = await device.gatt.connect();
    console.log('Connected to GATT server');

    const service = await server.getPrimaryService(SERVICE_UUID);
    const wifiChar = await service.getCharacteristic(WIFI_UUID);

    const credentials = JSON.stringify({ ssid, password });
    await wifiChar.writeValue(new TextEncoder().encode(credentials));

    statusEl.textContent = 'Wi-Fi credentials sent! Waiting for KickPi to connect...';
    console.log('Wi-Fi credentials sent successfully!');

    try {
      server.disconnect();
      console.log('Disconnected from KickPi');
      statusEl.textContent += ' Done!';

      // ✅ show redirect button
document.getElementById("goToQuizBtn").style.display = "block";
    } catch (disconnectErr) {
      console.warn('Error disconnecting from device:', disconnectErr);
    }

    // ✅ THIS WAS MISSING BEFORE
    console.log("Starting redirect flow...");
    await redirectToQuiz();

  } catch (err) {
    console.error('BLE provisioning failed:', err);
    statusEl.textContent = 'Error: ' + err.message;

    // ✅ show redirect button
document.getElementById("goToQuizBtn").style.display = "block";
  }
}

// ✅ Button handler
document.getElementById('provisionBtn').addEventListener('click', () => {
  const ssid = document.getElementById('ssid').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!ssid || !password) {
    alert('Please enter both SSID and password.');
    return;
  }

  provisionKickPi(ssid, password);
});