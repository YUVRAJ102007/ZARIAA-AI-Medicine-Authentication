let scanner;
let isProcessing = false;
let lastScannedData = null;

const STATUS_CONFIG = {
    READY: {
        className: "",
        badge: "Ready",
        title: "Ready to scan",
        message: "Your verification result will appear here as soon as the QR code is detected."
    },
    LOADING: {
        className: "status-loading",
        badge: "Checking",
        title: "Verifying encrypted record",
        message: "Please wait while VORTEX checks the scanned package."
    },
    GENUINE: {
        className: "status-genuine",
        badge: "Genuine",
        title: "Authentic medicine detected",
        message: "This package is valid and verified."
    },
    EXPIRED: {
        className: "status-expired",
        badge: "Expired",
        title: "Medicine expired",
        message: "This medicine is no longer safe to use."
    },
    DUPLICATE: {
        className: "status-duplicate",
        badge: "Duplicate",
        title: "Duplicate scan detected",
        message: "This code has already been scanned."
    },
    COUNTERFEIT: {
        className: "status-counterfeit",
        badge: "Counterfeit",
        title: "Fake medicine detected",
        message: "This product is not found in registry."
    },
    INVALID: {
        className: "status-invalid",
        badge: "Invalid",
        title: "Invalid QR",
        message: "QR code is corrupted or unreadable."
    },
    OFFLINE: {
        className: "status-expired",
        badge: "Offline",
        title: "Offline Mode",
        message: "Scan saved locally. Will verify when online."
    }
};

function getResultElement() {
    return document.getElementById("result");
}

function renderResult(status, data = {}) {
    const target = getResultElement();
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.INVALID;

    if (status === "READY") {
        target.innerHTML = `
            <div class="result-placeholder">
                <strong>${config.title}</strong>
                <p>${config.message}</p>
            </div>
        `;
        return;
    }

    target.innerHTML = `
        <div class="result-card ${config.className}">
            <span class="result-status-pill">${config.badge}</span>
            <h3>${config.title}</h3>
            <p>${config.message}</p>

            ${data.name ? `<p><strong>${data.name}</strong></p>` : ""}
            ${data.expiry ? `<p>Expiry: ${data.expiry}</p>` : ""}
        </div>
    `;
}

async function startScanner() {
    const reader = document.getElementById("reader");
    reader.innerHTML = "";
    renderResult("READY");

    scanner = new Html5Qrcode("reader");

    try {
        await scanner.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 220, height: 220 }, // 🔥 FIXED (square)
                aspectRatio: 1.0 // 🔥 VERY IMPORTANT
            },
            onScanSuccess
        );
    } catch (error) {
        renderResult("INVALID", { detail: error });
    }
}

let hasScanned = false;  // 🔥 ADD THIS AT TOP

async function onScanSuccess(decodedText) {

    // 🔥 BLOCK MULTIPLE SCANS
    if (hasScanned) return;
    hasScanned = true;

    isProcessing = true;
    lastScannedData = decodedText;

    console.log("SCANNED:", decodedText);

    renderResult("LOADING");

    // 🔥 STOP CAMERA IMMEDIATELY
    try {
        await scanner.stop();
    } catch (e) {
        console.log("Stop error:", e);
    }

    // 🔌 OFFLINE MODE
    if (!navigator.onLine) {
        let scans = JSON.parse(localStorage.getItem("offline_scans") || "[]");

        scans.push({
            data: decodedText,
            time: new Date()
        });

        localStorage.setItem("offline_scans", JSON.stringify(scans));

        renderResult("OFFLINE");
        return;
    }

    try {
        const response = await fetch("/verify", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ data: decodedText })
        });

        const data = await response.json();

        renderResult(data.status, data);

        // 🚨 SHOW REPORT ONLY IF COUNTERFEIT
        if (data.status === "COUNTERFEIT" || data.status === "DUPLICATE") {
    document.getElementById("report-section").style.display = "block";
} else {
    document.getElementById("report-section").style.display = "none";
}
    } catch (error) {
        renderResult("INVALID");
    }

    isProcessing = false;
}

// 🔁 RESTART
async function restartScan() {
    hasScanned = false;   // 🔥 RESET
    isProcessing = false;

    if (scanner) {
        try { await scanner.stop(); } catch {}
        scanner = null;
    }

    document.getElementById("result").innerHTML = "";
    document.getElementById("report-section").style.display = "none";

    startScanner();
}

// 🚨 REPORT FUNCTION
function submitReport() {
    const issue = document.getElementById("issue").value;
    const note = document.getElementById("note").value;

    fetch("/report", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            data: lastScannedData,
            issue,
            note
        })
    })
    .then(() => alert("Report submitted successfully"));
}

// 🔄 SYNC OFFLINE DATA
window.addEventListener("online", async () => {
    let scans = JSON.parse(localStorage.getItem("offline_scans") || "[]");

    for (let scan of scans) {
        await fetch("/verify", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ data: scan.data })
        });
    }

    localStorage.removeItem("offline_scans");
    console.log("Offline scans synced");
});

window.onload = startScanner;

function searchMedicine(){
    let name = document.getElementById("searchBox").value;

    fetch(`/search_medicine?name=${name}`)
    .then(res => res.json())
    .then(data => {
        let html = "";

        data.forEach(p => {
            html += `
                <div class="result-card">
                    <h3>${p.name}</h3>
                    <p>Rating: ${p.rating}</p>
                </div>
            `;
        });

        document.getElementById("results").innerHTML = html;
    });
}
function searchMedicine(){
    let name = document.getElementById("searchBox").value.trim();

    console.log("Searching:", name);  // 🔥 DEBUG

    if(!name){
        alert("Enter medicine name");
        return;
    }

    fetch(`/search_medicine?name=${name}`)
    .then(res => res.json())
    .then(data => {
        console.log("Result:", data); // 🔥 DEBUG

        let html = "";

        if(data.length === 0){
            html = "<p>No pharmacy found</p>";
        } else {
            data.forEach(p => {
                html += `
                    <div class="result-card">
                        <h3>${p.name}</h3>
                        <p>Rating: ${p.rating}</p>
                    </div>
                `;
            });
        }

        document.getElementById("results").innerHTML = html;
    });
}