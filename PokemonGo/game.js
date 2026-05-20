// ============================================================
// Global State
// ============================================================

let map, userMarker;
let userLat, userLng;
let monsters = [];       // All uncaught monsters currently on the map
let activeMonster = null; // The monster within catch range (if any)
let isThrowing = false;   // Prevents double-throws mid-animation
let textureLoopId = null; // requestAnimationFrame ID for the GIF texture loop

let isLoginMode = true;   // Toggles between login and register form
let currentUser = null;   // Username of the logged-in trainer

// ============================================================
// Authentication
// ============================================================

// Swaps the auth form between Login and Register mode
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? "Trainer Login" : "Register New Trainer";
    document.getElementById('auth-btn').innerText = isLoginMode ? "Login" : "Register";
    document.getElementById('auth-toggle').innerHTML = isLoginMode
        ? "Need an account? <b>Register here</b>"
        : "Already have an account? <b>Login here</b>";
    document.getElementById('auth-status').innerText = "";
}

// Sends login or registration data to the appropriate PHP endpoint,
// then transitions to the map screen on success
async function submitAuth() {
    const usernameInp = document.getElementById('username').value.trim();
    const statusDiv = document.getElementById('auth-status');

    if (!usernameInp) {
        statusDiv.innerText = "Please enter a username.";
        return;
    }

    const endpoint = isLoginMode ? 'login.php' : 'register.php';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInp })
        });

        let data = {};
        try {
            data = await response.json();
        } catch (jsonErr) {
            console.error("Failed to parse JSON response.");
            statusDiv.innerText = "Server sent an invalid response format.";
            return;
        }

        if (response.ok) {
            // Hide auth screen, show map, and begin the game
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('map-screen').style.display = 'block';
            currentUser = data.username || usernameInp;
            initMap();
        } else {
            statusDiv.innerText = data.error || "Authentication failed.";
        }
    } catch (error) {
        statusDiv.innerText = "Network error. Please try again.";
        console.error(error);
    }
}

// ============================================================
// Map & GPS
// ============================================================

// Initializes the Leaflet map and starts watching the user's GPS position
function initMap() {
    // Start centered at (0,0) — the watchPosition callback immediately re-centers on first fix
    map = L.map('map').setView([0, 0], 18);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                userLat = position.coords.latitude;
                userLng = position.coords.longitude;

                if (!userMarker) {
                    // First GPS fix: place the player marker, center map, load monsters
                    userMarker = L.circleMarker([userLat, userLng], { color: 'blue', radius: 8 }).addTo(map);
                    map.setView([userLat, userLng], 18);
                    loadMonstersFromJson();
                } else {
                    userMarker.setLatLng([userLat, userLng]);
                }

                checkDistances();
            },
            () => { document.getElementById('status').innerText = "GPS Error. Please enable location."; },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    } else {
        document.getElementById('status').innerText = "Geolocation not supported.";
    }
}

// Fetches monster spawn data from monsters.json and places each one on the map
async function loadMonstersFromJson() {
    try {
        const response = await fetch('monsters.json');
        const data = await response.json();

        const monsterIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
            iconSize: [40, 40]
        });

        data.forEach(poke => {
            let marker = L.marker([poke.lat, poke.lng], { icon: monsterIcon }).addTo(map);
            marker.bindPopup(`<b>${poke.name}</b>`);

            // Store the Leaflet marker reference so we can remove it after a catch
            monsters.push({
                id: poke.id,
                pokedex_number: poke.pokedex_number,
                name: poke.name,
                lat: poke.lat,
                lng: poke.lng,
                marker: marker
            });
        });

        checkDistances();
    } catch (error) {
        console.error("Database fetch failed:", error);
        document.getElementById('status').innerText = "Error: Map could not read monsters.json database.";
    }
}

// Finds the nearest monster and shows the catch button if the player is within 20 feet
function checkDistances() {
    if (monsters.length === 0) {
        document.getElementById('status').innerText = "All monsters captured!";
        document.getElementById('catch-btn').style.display = 'none';
        return;
    }

    const userLatLng = L.latLng(userLat, userLng);
    let closestMonster = null;
    let minDistanceFeet = Infinity;

    monsters.forEach(monster => {
        const monsterLatLng = L.latLng(monster.lat, monster.lng);
        const distanceFeet = userLatLng.distanceTo(monsterLatLng) * 3.28084;

        if (distanceFeet < minDistanceFeet) {
            minDistanceFeet = distanceFeet;
            closestMonster = monster;
        }
    });

    document.getElementById('status').innerText =
        `Closest: ${closestMonster.name} (${Math.round(minDistanceFeet)} feet away)`;

    // 20-foot radius is the encounter trigger distance
    if (minDistanceFeet < 20) {
        activeMonster = closestMonster;
        document.getElementById('catch-btn').innerText = `A wild ${activeMonster.name} appeared! CATCH IT!`;
        document.getElementById('catch-btn').style.display = 'inline-block';
    } else {
        activeMonster = null;
        document.getElementById('catch-btn').style.display = 'none';
    }
}

// ============================================================
// AR Encounter Screen
// ============================================================

// Switches from the map view to the AR catch screen
function startEncounter() {
    document.getElementById('map-screen').style.visibility = 'hidden';
    document.getElementById('ar-screen').style.visibility = 'visible';
    resetEncounterScene();
}

// Returns to the map and cancels any running texture animation
function fleeEncounter() {
    if (textureLoopId) {
        cancelAnimationFrame(textureLoopId);
        textureLoopId = null;
    }
    document.getElementById('map-screen').style.visibility = 'visible';
    document.getElementById('ar-screen').style.visibility = 'hidden';
}

// Resets all A-Frame elements and starts streaming the monster's animated GIF as a texture
function resetEncounterScene() {
    isThrowing = false;
    document.getElementById('ar-throw-btn').style.display = 'inline-block';
    document.getElementById('ar-status').innerText =
        `Capturing wild ${activeMonster ? activeMonster.name : "Target"}...`;

    const monster = document.getElementById('monster');
    const ball = document.getElementById('pokeball');
    const nativeImg = document.getElementById('native-gif-element');

    if (activeMonster) {
        // PokeAPI Gen V sprites are animated GIFs, which A-Frame's texture system
        // can't animate natively. We use a hidden <img> as a GIF decoder and then
        // copy each decoded frame onto a canvas every animation frame, pushing that
        // canvas as a Three.js CanvasTexture to the A-Frame mesh.
        const gifUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${activeMonster.pokedex_number}.gif`;
        nativeImg.src = gifUrl;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        nativeImg.onload = () => {
            canvas.width = nativeImg.naturalWidth || 128;
            canvas.height = nativeImg.naturalHeight || 128;

            function updateTexture() {
                // Stop the loop once the monster has been captured (visibility toggled off)
                if (monster.getAttribute('visible') !== 'false') {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(nativeImg, 0, 0, canvas.width, canvas.height);

                    const mesh = monster.getObject3D('mesh');
                    if (mesh && mesh.material) {
                        // Only create a new CanvasTexture on the first frame to avoid memory leaks
                        if (!mesh.material.map || mesh.material.map.image !== canvas) {
                            const texture = new THREE.CanvasTexture(canvas);
                            texture.minFilter = THREE.LinearFilter;
                            mesh.material.map = texture;
                        }
                        mesh.material.map.needsUpdate = true;
                    }
                    textureLoopId = requestAnimationFrame(updateTexture);
                }
            }

            // Cancel any previous loop before starting a new one
            if (textureLoopId) cancelAnimationFrame(textureLoopId);
            textureLoopId = requestAnimationFrame(updateTexture);
        };
    }

    // Reset monster and ball to their starting positions/states
    monster.setAttribute('visible', 'true');
    monster.setAttribute('scale', '1 1 1');
    monster.removeAttribute('animation');

    ball.setAttribute('position', '0 0.2 -1.2');
    ball.setAttribute('color', '#ff3b30');
    ball.removeAttribute('animation');
}

// ============================================================
// Catch Sequence
// ============================================================

// Launches the ball toward the monster and kicks off the capture animation chain
function throwBall() {
    if (isThrowing) return; // Ignore taps while animation is already running
    isThrowing = true;

    document.getElementById('ar-throw-btn').style.display = 'none';
    document.getElementById('ar-status').innerText = "Go!";

    const ball = document.getElementById('pokeball');
    const monster = document.getElementById('monster');

    // Phase 1: Ball flies toward the monster
    ball.setAttribute('animation', 'property: position; to: 0 1.5 -3.8; dur: 600; easing: easeOutQuad');

    setTimeout(() => {
        // Phase 2: Monster shrinks into the ball on contact
        document.getElementById('ar-status').innerText = "Contact!";
        monster.setAttribute('animation', 'property: scale; to: 0 0 0; dur: 300');

        setTimeout(() => {
            monster.setAttribute('visible', 'false');
            if (textureLoopId) {
                cancelAnimationFrame(textureLoopId);
                textureLoopId = null;
            }

            // Phase 3: Ball drops to the ground
            ball.setAttribute('animation', 'property: position; to: 0 0.12 -3.8; dur: 400; easing: easeInQuad');

            setTimeout(() => {
                runShakeSequence(1);
            }, 450);
        }, 300);
    }, 600);
}

// Animates the ball rocking back and forth 3 times, then calls catch success
function runShakeSequence(shakeNumber) {
    if (shakeNumber > 3) {
        executeCatchSuccess();
        return;
    }

    document.getElementById('ar-status').innerText = `Shaking... ${shakeNumber}`;
    const ball = document.getElementById('pokeball');

    // Alternate tilt direction each shake for a natural rocking feel
    const tiltDir = shakeNumber % 2 === 0 ? 15 : -15;
    ball.setAttribute('animation', `property: rotation; to: 0 0 ${tiltDir}; dur: 150; dir: alternate; loop: 2`);

    setTimeout(() => {
        ball.removeAttribute('animation');
        ball.setAttribute('rotation', '0 0 0');

        setTimeout(() => {
            runShakeSequence(shakeNumber + 1);
        }, 400);
    }, 300);
}

// Saves the catch to the server, removes the monster from the map, then returns to map view
async function executeCatchSuccess() {
    document.getElementById('ar-status').innerText =
        `${activeMonster ? activeMonster.name : "Target"} Secured!`;
    const ball = document.getElementById('pokeball');
    ball.setAttribute('color', '#4CD964'); // Turn the ball green on success

    if (activeMonster && currentUser) {
        try {
            const response = await fetch('catch.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser,
                    monster: {
                        id: activeMonster.id,
                        pokedex_number: activeMonster.pokedex_number,
                        name: activeMonster.name
                    }
                })
            });

            const result = await response.json();

            if (result.success) {
                // Remove the marker from the Leaflet map and from our local array
                map.removeLayer(activeMonster.marker);
                monsters = monsters.filter(m => m.id !== activeMonster.id);
                activeMonster = null;
            } else {
                console.error("Server failed to save the catch:", result.error);
                document.getElementById('ar-status').innerText = "Error: Could not save to inventory!";
            }
        } catch (error) {
            console.error("Network error during catch:", error);
            document.getElementById('ar-status').innerText = "Connection error!";
        }
    }

    // Brief pause so the player can see the success message before returning to the map
    setTimeout(() => {
        fleeEncounter();
        checkDistances();
    }, 1500);
}
