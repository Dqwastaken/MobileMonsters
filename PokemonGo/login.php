<?php
header('Content-Type: application/json');

// Read the JSON payload
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

// Load existing users
if (file_exists($usersFile)) {
    $jsonData = file_get_contents($usersFile);
    $users = json_decode($jsonData, true) ?: [];
}

// Verify username
if (in_array($username, $users)) {
    http_response_code(200);
    echo json_encode(["success" => true, "username" => $username]);
} else {
    http_response_code(401);
    echo json_encode(["error" => "Invalid username. Try again or register."]);
}
?>