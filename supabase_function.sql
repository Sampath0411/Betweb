-- Create function to increment balance atomically
CREATE OR REPLACE FUNCTION increment_balance(user_id INTEGER, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE users SET balance = balance + amount WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;
