<?php
header('Content-Type: application/json');

// Read the JSON payload from the fetch request
$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

if (!isset($input['username']) || trim($input['username']) === '') {
    http_response_code(400);
    echo json_encode(["error" => "Username is required."]);
    exit;
}

$username = trim($input['username']);
$usersFile = 'users.json';
$users = [];

// Load existing users if the file exists
if (file_exists($usersFile) && filesize($usersFile) > 0) {
    $jsonData = file_get_contents($usersFile);
    $users = json_decode($jsonData, true) ?: [];
}

// Extract just the usernames from our list of account objects
$existingUsernames = array_column($users, 'username');

// Check if username already exists
if (in_array($username, $existingUsernames)) {
    http_response_code(400);
    echo json_encode(["error" => "That username is already taken."]);
    exit;
}

// Format the new user as an object with an empty inventory array
$users[] = [
    "username" => $username,
    "inventory" => []
];

// Save the updated list using LOCK_EX to prevent concurrent write corruption
file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT), LOCK_EX);

http_response_code(201);

// COMBINED RESPONSE: Merged your success data and debug path into one clean JSON string.
// Sending multiple echos causes an unparsable format like {"success":true}{"debug_path":...}
echo json_encode([
    "success" => true, 
    "username" => $username,
    "debug_path" => realpath($usersFile)
]);
?>