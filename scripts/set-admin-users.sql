-- Set admin status for the two admin users
UPDATE users 
SET is_admin = true 
WHERE email IN ('anthony@sidelineswap.com', 'jmcloughlin12@gmail.com');

-- Verify the update
SELECT id, email, name, is_admin 
FROM users 
WHERE email IN ('anthony@sidelineswap.com', 'jmcloughlin12@gmail.com');
