<?php
// catch.php
// Accepts a JSON POST with { "username": "...", "monster": { id, pokedex_number, name } }.
// Adds the monster to the trainer's inventory in users.json and removes it from monsters.json.
// Both files are locked with flock() to prevent race conditions if two players
// catch the same monster at the same moment.

header('Content-Type: application/json');

$input = file_get_contents('php://input');
$data  = json_decode($input, true);

if (!isset($data['username']) || !isset($data['monster'])) {
    echo json_encode(["success" => false, "error" => "Missing user or monster data."]);
    exit;
}

$username      = trim($data['username']);
$caughtMonster = $data['monster'];
$monsterId     = $caughtMonster['id'];

$usersFile    = 'users.json';
$monstersFile = 'monsters.json';

// Open both files before locking so we hold the locks for as short a time as possible
$usersFh    = fopen($usersFile, 'c+');
$monstersFh = fopen($monstersFile, 'c+');

if (!$usersFh || !$monstersFh) {
    echo json_encode(["success" => false, "error" => "Could not open data files."]);
    exit;
}

// Exclusive locks prevent two simultaneous requests from double-catching the same monster
flock($usersFh, LOCK_EX);
flock($monstersFh, LOCK_EX);

$usersData    = json_decode(stream_get_contents($usersFh), true) ?: [];
$monstersData = json_decode(stream_get_contents($monstersFh), true) ?: [];

// Verify the monster is still on the map before accepting the catch.
// Without this check, a player could catch the same monster twice by tapping quickly.
$monsterExists = false;
foreach ($monstersData as $m) {
    if ($m['id'] === $monsterId) {
        $monsterExists = true;
        break;
    }
}

if (!$monsterExists) {
    flock($usersFh, LOCK_UN);
    flock($monstersFh, LOCK_UN);
    fclose($usersFh);
    fclose($monstersFh);
    echo json_encode(["success" => false, "error" => "Monster no longer available."]);
    exit;
}

// Find the trainer and append the monster to their inventory
$userFound = false;
foreach ($usersData as &$user) {
    $storedName = is_array($user) ? $user['username'] : $user;
    if ($storedName === $username) {
        // Migrate a legacy string entry to the object format on first catch
        if (is_string($user)) {
            $user = ["username" => $username, "inventory" => []];
        }
        if (!isset($user['inventory'])) {
            $user['inventory'] = [];
        }
        $user['inventory'][] = $caughtMonster;
        $userFound = true;
        break;
    }
}
unset($user); // Unset the reference to avoid accidental mutation later

if (!$userFound) {
    flock($usersFh, LOCK_UN);
    flock($monstersFh, LOCK_UN);
    fclose($usersFh);
    fclose($monstersFh);
    echo json_encode(["success" => false, "error" => "User not found."]);
    exit;
}

// Remove the caught monster and re-index so the file saves as a JSON array, not an object
$updatedMonsters = array_values(array_filter($monstersData, fn($m) => $m['id'] !== $monsterId));

// Truncate before writing so leftover bytes from a longer previous value don't corrupt the file
ftruncate($usersFh, 0);
rewind($usersFh);
fwrite($usersFh, json_encode($usersData, JSON_PRETTY_PRINT));

ftruncate($monstersFh, 0);
rewind($monstersFh);
fwrite($monstersFh, json_encode($updatedMonsters, JSON_PRETTY_PRINT));

flock($usersFh, LOCK_UN);
flock($monstersFh, LOCK_UN);
fclose($usersFh);
fclose($monstersFh);

echo json_encode(["success" => true]);
?>
