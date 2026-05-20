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

// Search through the array of user objects to find a matching username
$userAuthenticated = false;
foreach ($users as $user) {
    if (isset($user['username']) && $user['username'] === $username) {
        $userAuthenticated = true;
        break;
    }
}

// If the trainer wasn't found in the file, reject the login request
if (!$userAuthenticated) {
    http_response_code(401); // 401 Unauthorized
    echo json_encode(["error" => "Trainer profile not found. Please register an account first."]);
    exit;
}

// Success! Return status 200 and the user data back to the frontend
http_response_code(200);
echo json_encode([
    "success" => true,
    "username" => $username
]);
?>