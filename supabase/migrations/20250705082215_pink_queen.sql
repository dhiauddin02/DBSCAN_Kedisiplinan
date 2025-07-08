/*
  # Fix delete trigger timing issue

  1. Changes
    - Drop the existing BEFORE DELETE trigger
    - Recreate it as an AFTER DELETE trigger to prevent tuple modification conflicts

  2. Security
    - Maintains the same functionality but with proper timing
    - Prevents the "tuple to be deleted was already modified" error
*/

-- Drop the existing BEFORE DELETE trigger
DROP TRIGGER IF EXISTS on_public_users_delete ON public.users;

-- Recreate as AFTER DELETE trigger
CREATE TRIGGER on_public_users_delete 
  AFTER DELETE ON public.users 
  FOR EACH ROW 
  EXECUTE FUNCTION handle_delete_user_from_auth();