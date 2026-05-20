<?php
// login.php
// Accepts a JSON POST with { "username": "..." } and checks whether
// that username exists in users.json. Returns 200 on success, 401 on failure.

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

// Search by username property. Users are stored as objects { username, inventory }
// but we also handle legacy plain-string entries gracefully.
$userFound = false;
foreach ($users as $user) {
    $storedName = is_array($user) ? $user['username'] : $user;
    if ($storedName === $username) {
        $userFound = true;
        break;
    }
}

if ($userFound) {
    http_response_code(200);
    echo json_encode(["success" => true, "username" => $username]);
} else {
    http_response_code(401);
    echo json_encode(["error" => "Invalid username. Try again or register."]);
}
?>
