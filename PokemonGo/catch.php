<?php
header('Content-Type: application/json');

// Read the incoming JSON payload from the frontend
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!isset($data['username']) || !isset($data['monster'])) {
    echo json_encode(["success" => false, "error" => "Missing user or monster data."]);
    exit;
}

$username = $data['username'];
$caughtMonster = $data['monster'];
$monsterId = $caughtMonster['id'];

// --- 1. UPDATE USERS.JSON ---
$usersFile = 'users.json';
$usersData = json_decode(file_get_contents($usersFile), true);
$userFound = false;

// Find the user and add the monster to their inventory
foreach ($usersData as &$user) {
    if ($user['username'] === $username) {
        // Create the inventory array if it doesn't exist yet
        if (!isset($user['inventory'])) {
            $user['inventory'] = [];
        }
        $user['inventory'][] = $caughtMonster;
        $userFound = true;
        break;
    }
}

if (!$userFound) {
    echo json_encode(["success" => false, "error" => "User not found in database."]);
    exit;
}

// Save the updated users data
file_put_contents($usersFile, json_encode($usersData, JSON_PRETTY_PRINT));


// --- 2. UPDATE MONSTERS.JSON ---
$monstersFile = 'monsters.json';
$monstersData = json_decode(file_get_contents($monstersFile), true);

// Filter out the monster that was just caught
$updatedMonsters = array_filter($monstersData, function($m) use ($monsterId) {
    return $m['id'] !== $monsterId;
});

// Re-index the array so it saves as a JSON array `[...]` instead of an object `{...}`
$updatedMonsters = array_values($updatedMonsters);

// Save the updated monsters data
file_put_contents($monstersFile, json_encode($updatedMonsters, JSON_PRETTY_PRINT));


// --- 3. RESPOND TO FRONTEND ---
echo json_encode(["success" => true]);
?>