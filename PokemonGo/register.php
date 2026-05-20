<?php
// register.php
// Accepts a JSON POST with { "username": "..." } and creates a new trainer account
// in users.json. Returns 201 on success, 400 if the username is taken or missing.

header('Content-Type: application/json');

$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

if (!isset($input['username']) || trim($input['username']) === '') {
    http_response_code(400);
    echo json_encode(["error" => "Username is required."]);
    exit;
}

$username  = trim($input['username']);
$usersFile = 'users.json';
$users     = [];

if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true) ?: [];
}

// Check for duplicate usernames. Users are stored as objects { username, inventory }
// but we also handle legacy plain-string entries gracefully.
$taken = false;
foreach ($users as $user) {
    $storedName = is_array($user) ? $user['username'] : $user;
    if ($storedName === $username) {
        $taken = true;
        break;
    }
}

if ($taken) {
    http_response_code(400);
    echo json_encode(["error" => "That username is already taken."]);
    exit;
}

// Store the new trainer as an object so catch.php can find them by username
// and inventory can be populated later without a schema change.
$users[] = ["username" => $username, "inventory" => []];
file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT));

http_response_code(201);
echo json_encode(["success" => true, "username" => $username]);
?>
