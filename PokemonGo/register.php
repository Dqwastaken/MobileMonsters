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
if (file_exists($usersFile)) {
    $jsonData = file_get_contents($usersFile);
    $users = json_decode($jsonData, true) ?: [];
}

// Check if username already exists
if (in_array($username, $users)) {
    http_response_code(400);
    echo json_encode(["error" => "That username is already taken."]);
    exit;
}

// Add new user and save
$users[] = $username;
file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT));

http_response_code(201);
echo json_encode(["success" => true, "username" => $username]);
// Temporary debug line to show the absolute path
echo json_encode(["debug_path" => realpath($usersFile)]);
?>